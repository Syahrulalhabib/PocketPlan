# Implementation Plan

Complete 3 security items + cleanup: webhook secret, rate limiting, isolation tests, dead file removal.

## [Overview]

- **Item 1 (High):** Webhook secret — verify `X-Telegram-Bot-Api-Secret-Token` header in POST `/api/telegram-webhook`. Reject 403 if mismatch. Skip check if env not set (dev compat). Polling unaffected.
- **Item 2 (Medium):** Rate limit — in-memory sliding window on `POST /api/telegram/web-login`. No new deps. 5 attempts/15min per IP. ponytail: resets on serverless cold start; upgrade to KV store when needed.
- **Item 3 (High):** Isolation tests — `backend/lib/isolation.test.js`. Proves per-user Map isolation, DELETE no-op for wrong ID, API handler responses.
- **Item 4 (Low):** Delete `frontend/src/assets/pocky-bot.png` (zero refs) + `backend/scripts/extract_avatar.mjs` (one-time script done).
- **Item 5:** Polish semua teks respons bot di `telegramBot.js` — perbaiki format, emoji encoding, konsistensi tone Pocky. Termasuk fallback "bingung", /start, /help, /saldo, /goals, /riwayat, /batal, semua guidance messages.
- **Item 6:** Draft bio/description BotFather — teks `About` dan `Description` untuk di-set manual via BotFather, menarik user baru.

## [Files]

### Modified
1. `backend/index.js` — webhook secret check + rate limiter on web-login
2. `backend/.env.example` — add `TELEGRAM_WEBHOOK_SECRET`
3. `backend/.env` — add `TELEGRAM_WEBHOOK_SECRET=`
4. `README.md` — webhook secret setup note (BotFather `/setwebhook` `secret_token` param)

## [Functions]

### New: `checkRateLimit(key, max=5, windowMs=15*60*1000)` — inline in `backend/index.js`
- In-memory Map of `key → timestamp[]`
- Prunes expired, checks count, returns `{ allowed, retryAfterSec }`
- Applied at top of `/api/telegram/web-login` with `req.ip` as key

### Modified: POST `/api/telegram-webhook` handler
- Add 4 lines: read `TELEGRAM_WEBHOOK_SECRET`, compare to header, 403 if mismatch
- Guard: `if (webhookSecret && header !== webhookSecret)` — no secret configured = skip (dev)

### Modified: POST `/api/telegram/web-login` handler
- Add rate limit guard before `verifyWebLoginCode` call

## [Testing] — `backend/lib/isolation.test.js`

Tests (all using assert, no frameworks):
1. Per-user Map pattern: `Map.get('userA')` !== `Map.get('userB')` — proves demo data isolation
2. HTTP test: start app, POST transaction, GET returns it; DELETE wrong ID = no-op
3. Cross-user: add data for uid A, verify uid B Map has independent default data
4. DELETE non-existent transaction ID returns ok without crash

Approach: demo mode (`useFirestore=false`) gives all HTTP requests `uid:'demo-user'`. Multi-user isolation tested at Map level directly (same pattern as `getDemoTransactions`/`getDemoGoals`). HTTP tests verify API handler correctness.

## [Item 5] — Bot Response Text Polish

File: `backend/lib/telegramBot.js`. Semua teks respons diperbaiki:

1. **Fallback "bingung"** (line 318-323): format lebih helpful, emoji konsisten
2. **/start welcome** (line ~114-120): tone lebih welcoming, format rapi
3. **/start kode sukses** (line ~103-108): tone celebratory konsisten
4. **/start kode expired/gagal**: format rapi
5. **/link sukses/gagal/expired**: format rapi
6. **/unlink**: format rapi
7. **/help panduan**: format rapi, urutan logis
8. **/saldo** (sendSaldo): format rapi
9. **/goals** (sendGoals): format rapi
10. **/goals kosong**: lebih encouraging
11. **/web** (sendWebAccess): format rapi
12. **/riwayat**: format rapi
13. **/batal**: format rapi
14. **Keyboard button guidance** (Catat Keluar/Masuk): format rapi
15. **Bare /catat, /masuk guidance**: format rapi
16. **/beligoal guidance/success**: format rapi
17. **/goal format guidance**: format rapi
18. **Goal created success**: format rapi
19. **Transaction recorded** (income/expense): format rapi
20. **Callback buy success**: format rapi

Prinsip: konsisten Markdown bold/italic, emoji yang sesuai, tone Pocky friendly tapi profesional, tidak berlebihan.

## [Item 6] — BotFather Bio/Description Draft

Output: bagian baru di README.md dengan draft teks untuk di-copy-paste ke BotFather.

- **About** (max 120 chars): ringkas, jelas apa fungsi bot
- **Description** (max 512 chars): deskripsi lebih lengkap, fitur utama, cara mulai

## [Implementation Order]

1. Webhook secret check in `backend/index.js`
2. Rate limiter + apply to web-login in `backend/index.js`
3. Update `.env.example` + `.env`
4. README webhook note + BotFather draft bio
5. Polish semua teks respons bot di `telegramBot.js`
6. Create `isolation.test.js`
7. Update `package.json` test script
8. Delete dead files
9. `npm test` — green
10. Frontend build — verify

5. `backend/package.json` — test script: `node lib/telegram.test.js && node lib/isolation.test.js`

### New
6. `backend/lib/isolation.test.js` — user isolation regression tests

### Deleted
7. `frontend/src/assets/pocky-bot.png`
8. `backend/scripts/extract_avatar.mjs`
