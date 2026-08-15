# Messenger — WebRTC + AI Transcription

Монорепо: текстовий чат у реальному часі, відеодзвінки/стріми через LiveKit SFU
та живі AI-субтитри, які генерує окремий Go-мікросервіс.

## Структура

```
apps/
  web/               Next.js 14 (App Router, TS, Tailwind, LiveKit React SDK)
  api-core/          Nest.js — Auth, REST, Socket.io Gateway, LiveKit-токени (TypeORM)
  media-ai-service/  Go — LiveKit-бот, STT-пайплайн, Redis Pub/Sub
infra/
  livekit/           конфіг LiveKit SFU
docker-compose.yml   Postgres, Redis, LiveKit, Coturn, MinIO
```

## Потік даних

1. Клієнт логіниться в `api-core`, отримує JWT (access + rotating refresh).
2. Текст: Socket.io namespace `/ws` з Redis-адаптером → PostgreSQL.
3. Дзвінок: `POST /api/rooms/join` → `api-core` перевіряє membership, створює
   `CallSession` і видає LiveKit room token → клієнт іде напряму в SFU.
4. Якщо `enableTranscription: true`, `api-core` кладе команду в Redis-канал
   `media:control` разом із коротким bot-токеном.
5. Go-сервіс приєднується до кімнати як прихований учасник, пакує вхідний Opus
   RTP в Ogg, стрімить у STT і публікує субтитри в LiveKit DataChannel
   (топік `captions`) — затримка не залежить від бекенду.
6. Після завершення дзвінка Go публікує повний транскрипт у `transcripts:final`;
   `api-core` зберігає сегменти в PostgreSQL і повідомляє кімнату через WS.

## Запуск

```bash
cp .env.example .env          # заповнити секрети

# 1. інфраструктура
docker compose up -d postgres redis livekit minio coturn

# 2. база (перший раз — DB_SYNCHRONIZE=true або згенерувати міграцію)
cd apps/api-core && pnpm install
pnpm migration:generate && pnpm migration:run

# 3. сервіси
pnpm dev:api                  # http://localhost:4000/api
pnpm dev:web                  # http://localhost:3000
cd apps/media-ai-service && go mod tidy && go run ./cmd/bot
```

`STT_PROVIDER=mock` (за замовчуванням) дає синтетичні субтитри без зовнішнього
STT-акаунта. `STT_PROVIDER=deepgram` вмикає реальний стрімінг у Deepgram.

Без мікрофона пайплайн транскрипції можна перевірити синтетичним аудіотреком:

```bash
# ROOM_TOKEN — токен із POST /api/rooms/join
LIVEKIT_URL=ws://localhost:7880 ROOM_TOKEN=<jwt> go run ./cmd/testpublisher
```

## Теми (скіни)

Скіни лежать у `apps/web/themes/*.json` — по файлу на тему. Формат і повний
перелік токенів описані в `apps/web/themes/README.md`.

- Кольори в UI задаються лише токенами (`bg-surface`, `text-ink`, `bg-bubble-own`
  тощо) — жоден компонент не містить хардкоду палітри.
- Вибір теми зберігається в `localStorage` і застосовується inline-скриптом до
  першого рендеру, тож при завантаженні немає спалаху чужої теми.
- Перемикач — іконка палітри в шапці списку чатів і на екрані входу.
- Частковий скін валідний: пропущені токени беруться з дефолтної теми, а
  зламаний файл пропускається з попередженням `[themes] ...` у консолі сервера.

## API (стисло)

| Метод  | Шлях                              | Опис                          |
| ------ | --------------------------------- | ----------------------------- |
| POST   | `/api/auth/register` \| `/login`  | видача пари токенів           |
| POST   | `/api/auth/refresh`               | ротація refresh-токена        |
| GET    | `/api/users/search?q=`            | пошук людей                   |
| GET    | `/api/rooms`                      | кімнати користувача (без ANON) |
| GET    | `/api/rooms/anon`                 | кімнати по анонімних лінках   |
| POST   | `/api/rooms/direct`               | відкрити 1:1 чат (ідемпотентно) |
| POST   | `/api/invites`                    | **без авторизації** — нова анонімна кімната + лінка |
| GET    | `/api/invites/:token`             | публічний прев'ю лінки        |
| POST   | `/api/invites/:token/accept`      | **без авторизації** — увійти по лінці |
| GET    | `/api/rooms/:id/messages`         | історія (keyset-пагінація)    |
| POST   | `/api/rooms/join`                 | LiveKit token + CallSession   |
| POST   | `/api/rooms/:name/end`            | завершити дзвінок, зняти бота |
| GET    | `/api/transcripts/room/:roomId`   | історія транскрипцій          |

WS-події: `message:send` / `message:new`, `presence:typing`, `presence:update`,
`room:created`, `call:transcript-saved`.

Реєстрація, пошук людей і старт діалогу — повністю в UI (`/`).

### Анонімні лінки

Кнопка «анонімна лінка» є в кожному скіні — на екрані входу і в списку чатів.
Вона створює кімнату `RoomType.ANON` і посилання `/invite/:token` на неї.

- Створити лінку можна **без акаунта**: сервер видає гостя `userNNNN` з
  email `null`, без пароля, і разом з ним пару токенів — іншого способу
  повернутись у цей акаунт немає.
- Хто перейшов за лінкою й уже авторизований — лишається під своїм імʼям;
  решта стають гостями в момент переходу.
- ANON-кімната **не потрапляє в список чатів** ні до кого. Лінка — її єдина
  адреса, тому саме посилання постить у тред системним повідомленням.
- Гості не видні в пошуку людей.

## Нотатки з безпеки

- Refresh-токени зберігаються тільки як argon2-хеші й ротуються при кожному використанні.
- LiveKit-токени видає виключно `api-core` після перевірки membership; TTL 2 год
  для користувачів, 6 год для бота (`hidden: true`, `canPublish: false`).
- `DB_SYNCHRONIZE` — лише для локального бутстрапу; у проді працюють міграції.
