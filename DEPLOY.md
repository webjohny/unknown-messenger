# Деплой на cash-come (messenger.cash-come.com)

Сервер: `161.35.78.171` (Ubuntu 20.04, 2 vCPU / 4 GB), доступ по SSH-ключу
`~/.ssh/cashcome_deploy` під `root`.

## Що вже є на сервері

- Спільний **Traefik v2.10** (проєкт `/root/docker`) тримає 80/443, docker-провайдер,
  `exposedbydefault=false`, спільна мережа `cashcome`.
- TLS-сертифікат подається файловим провайдером (`/root/docker/traefik-config.yml`,
  опції `cash-come-tls-options@file`). Домен проксюється Cloudflare, тому origin-cert
  на точну відповідність не перевіряється.
- `nginx` на хості вимкнено (`systemctl is-active nginx` → inactive), конфіги в
  `sites-enabled` — спадок.

## Маршрутизація

Усе живе на **одному** домені `messenger.cash-come.com`, Traefik розводить за шляхом:

| Шлях         | Сервіс              | Порт |
| ------------ | ------------------- | ---- |
| `/api`       | `messenger-api`     | 4000 |
| `/socket.io` | `messenger-api`     | 4000 |
| `/livekit`   | `messenger-livekit` | 7880 (префікс зрізається `stripprefix`) |
| решта        | `messenger-web`     | 3000 |

Усі сервіси названі з префіксом `messenger-` не для краси: мережа `cashcome`
спільна на весь сервер, а вбудований DNS Docker резолвить імена по всіх
підключених мережах. Сервіс з іменем `postgres` ловив би чужий `postgres-db`, а
`web` — `arena_web_1`.

`livekit-client` дописує `/rtc/v1` до `NEXT_PUBLIC_LIVEKIT_URL`, тож
`wss://messenger.cash-come.com/livekit` перетворюється на
`wss://messenger.cash-come.com/livekit/rtc/v1` → Traefik зрізає `/livekit` →
`livekit:7880/rtc/v1`. Окремий піддомен для SFU не потрібен.

**Медіа не йде через Traefik і не йде через Cloudflare.** LiveKit віддає ICE-кандидати
з публічним IP сервера (`rtc.use_external_ip: true`), тому в ufw мають бути відкриті:

```bash
ufw allow 7882/udp comment 'livekit rtc udp mux'
ufw allow 7881/tcp comment 'livekit rtc tcp fallback'
```

MinIO та coturn у цьому деплої не піднімаються: S3 у коді ще не використовується,
а TURN-фолбек закриває `tcp_port: 7881` самого LiveKit.

## Перший деплой

```bash
ssh -i ~/.ssh/cashcome_deploy root@161.35.78.171
git clone https://github.com/webjohny/unknown-messenger.git /root/messenger
cd /root/messenger
cp .env.example .env      # далі відредагувати, див. нижче
docker-compose -f docker-compose.cashcome.yml -p messenger up -d --build
```

Обов'язкові значення в `/root/messenger/.env`:

```dotenv
POSTGRES_USER=messenger
POSTGRES_PASSWORD=<random>
POSTGRES_DB=messenger
JWT_ACCESS_SECRET=<random 48+>
JWT_REFRESH_SECRET=<random 48+>
LIVEKIT_API_KEY=<random>
LIVEKIT_API_SECRET=<random 32+>
PUBLIC_WEB_URL=https://messenger.cash-come.com
PUBLIC_LIVEKIT_URL=wss://messenger.cash-come.com/livekit
DB_SYNCHRONIZE=false
STT_PROVIDER=mock
```

`PUBLIC_WEB_URL` і `PUBLIC_LIVEKIT_URL` вшиваються в клієнтський бандл на етапі
`docker build`, тому після їх зміни `web` треба перебілдити (`--build`), а не просто
перезапустити.

### Схема БД

Міграцій у репозиторії поки немає, тому порожню базу бутстрапимо один раз:

```bash
DB_SYNCHRONIZE=true docker-compose -f docker-compose.cashcome.yml -p messenger up -d messenger-api
# перевірити, що таблиці створились, і повернути false:
docker-compose -f docker-compose.cashcome.yml -p messenger up -d messenger-api
```

Далі — тільки `migration:generate` / `migration:run`. `DB_SYNCHRONIZE=true` на живих
даних не вмикати.

## Оновлення

```bash
cd /root/messenger && git pull
docker-compose -f docker-compose.cashcome.yml -p messenger up -d --build
```

## Діагностика

```bash
docker-compose -f docker-compose.cashcome.yml -p messenger ps
docker-compose -f docker-compose.cashcome.yml -p messenger logs -f messenger-api
curl -sI https://messenger.cash-come.com/
curl -s  https://messenger.cash-come.com/api/health   # якщо ендпойнт є
curl -s 'https://messenger.cash-come.com/livekit/rtc/validate?access_token=x'
```
