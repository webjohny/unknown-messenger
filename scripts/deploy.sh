#!/usr/bin/env bash
# Розкатка на cash-come. Запускається НЕ локально, а на сервері — workflow
# `.github/workflows/deploy.yml` копіює цей файл по scp і викликає його там.
# Копіює щоразу навмисно: інакше зміна самого скрипта застосовувалася б із
# запізненням на один деплой (скрипт тягне себе ж через git).
#
#   ./deploy.sh <commit-sha>
#
# Змінні (workflow передає їх через env):
#   DEPLOY_PATH   каталог з клоном репозиторію (типово /root/messenger)
#   COMPOSE_FILE  compose-файл (типово docker-compose.cashcome.yml)
#   COMPOSE_PROJECT  ім'я проєкту (типово messenger)
#   HEALTHCHECK_URL  публічний URL для димової перевірки
set -euo pipefail

SHA="${1:?потрібен commit sha}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/messenger}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.cashcome.yml}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-messenger}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-https://messenger.cash-come.com/}"

# На сервері стоїть docker-compose v1, але не варто прив'язуватись: якщо його
# колись знесуть разом з Python 2, плагін `docker compose` підхопиться сам.
if command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"; }
else
  compose() { docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" "$@"; }
fi

cd "$DEPLOY_PATH"

PREV_SHA="$(git rev-parse HEAD)"
echo "==> було: $PREV_SHA, котимо: $SHA"

# .env на сервері git-ignored і містить усі секрети — reset --hard його не чіпає,
# але про всяк випадок переконуємось, що він на місці, ДО того як щось гасити.
test -s .env || { echo "!! немає $DEPLOY_PATH/.env — деплой скасовано"; exit 1; }

git fetch --prune origin
git reset --hard "$SHA"

echo "==> збірка образів"
compose build

# Міграції — окремим одноразовим контейнером ПЕРЕД перемиканням трафіку. Стара
# версія API в цей момент ще жива й обслуговує запити.
# `typeorm` лежить у prod-залежностях, а `nest build` кладе data-source і
# міграції в dist/, тож ts-node тут не потрібен.
echo "==> міграції"
# --name обов'язковий: у сервіса заданий container_name, і без явного імені
# `compose run` у v1 впирається в конфлікт з уже запущеним messenger-api.
docker rm -f messenger-api-migrate >/dev/null 2>&1 || true
compose run --rm --name messenger-api-migrate -e DB_SYNCHRONIZE=false messenger-api \
  node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js

echo "==> перезапуск сервісів"
compose up -d --remove-orphans

echo "==> стан"
compose ps

# Димова перевірка: контейнер може піднятись і одразу впасти на валідації
# секретів, тому дивимось не тільки на HTTP, а й на те, що API не в exited.
echo "==> перевірка"
for i in $(seq 1 30); do
  state="$(docker inspect -f '{{.State.Status}}' messenger-api 2>/dev/null || echo missing)"
  if [ "$state" != "running" ] && [ "$state" != "restarting" ]; then
    echo "!! messenger-api у стані '$state'"
    compose logs --tail=80 messenger-api || true
    echo "!! відкат: cd $DEPLOY_PATH && git reset --hard $PREV_SHA && docker-compose -f $COMPOSE_FILE -p $COMPOSE_PROJECT up -d --build"
    exit 1
  fi
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTHCHECK_URL" || echo 000)"
  if [ "$code" = "200" ]; then
    echo "==> $HEALTHCHECK_URL → 200 (спроба $i)"
    # Старі шари з попередніх збірок з'їдають диск 4-гігабайтної машини швидше,
    # ніж здається.
    docker image prune -f >/dev/null || true
    echo "==> готово: $SHA"
    exit 0
  fi
  sleep 5
done

echo "!! $HEALTHCHECK_URL так і не віддав 200 (останній код: ${code:-?})"
compose logs --tail=80 messenger-api || true
echo "!! відкат: cd $DEPLOY_PATH && git reset --hard $PREV_SHA && docker-compose -f $COMPOSE_FILE -p $COMPOSE_PROJECT up -d --build"
exit 1
