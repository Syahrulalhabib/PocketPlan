<div align="center">
  <img src="frontend/public/pocket-logo.svg" alt="PocketPlan Logo" width="84" height="84" />
  <h1>PocketPlan</h1>
  <p><strong>Smart Saving, Brighter Future — Master your money with PocketPlan</strong></p>
  <p>An intuitive, gamified personal finance app with Telegram bot integration and AI-powered receipt scanning.</p>

  <p>
    <a href="https://pocketplan.ai.id"><img src="https://img.shields.io/badge/Live-pocketplan.ai.id-e45153?style=for-the-badge" alt="Live Site" /></a>
    <a href="https://t.me/yourpocketplan_bot"><img src="https://img.shields.io/badge/Telegram-@yourpocketplan__bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Bot" /></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-5.1-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/Telegram%20Bot-API-26A5E4?logo=telegram&logoColor=white" alt="Telegram" />
    <img src="https://img.shields.io/badge/Gemini-AI%20Receipt%20Scanner-4285F4?logo=google&logoColor=white" alt="Gemini AI" />
    <img src="https://img.shields.io/badge/Playwright-E2E%20Tests-2EAD33?logo=playwright&logoColor=white" alt="Playwright" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  </p>
</div>

---

## Try PocketPlan Now

| Platform | Link |
|----------|------|
| **Web App** | [pocketplan.ai.id](https://pocketplan.ai.id) |
| **Telegram Bot** | [@yourpocketplan_bot](https://t.me/yourpocketplan_bot) |

> No registration required — try **Demo Mode** instantly on the web, or just open the Telegram bot and start tracking.

---

## What is PocketPlan?

Managing personal finances often feels intimidating, tedious, or dry. Spreadsheets are complex, and traditional banking apps lack personality.

**PocketPlan** bridges this gap as a modern, lightweight application that combines **core financial tracking** with an **interactive mascot system** and **native Telegram bot integration**. Whether you are a student budgeting daily allowances, a young professional tracking cash flow, or someone saving for a goal, PocketPlan gives you a complete picture of your finances in real time.

### Key Problems Solved

1. **Unconscious Spending** — Pinpoint where your money leaks with categorized expense tracking and instant charts.
2. **Abandoned Savings Goals** — Break down savings targets into milestones with visual progress indicators.
3. **Boring Budgeting** — Stay motivated with gamified mascot companions (**Pocky**, **Koiny**, **Pundi**, and **Hematy**) that provide tips, encouragement, and celebrations.
4. **Friction to Start** — Jump right in with **Demo Mode** (no registration), or connect via **Telegram Bot** for instant access.
5. **Manual Data Entry** — Snap a photo of your receipt and let **Gemini AI** extract the transactions automatically.

---

## Core Features

### Financial Dashboard
- Real-time balance overview with live income and expense snapshots
- Interactive charts (Chart.js) for expense breakdown and monthly comparisons
- Companion status indicators powered by animated mascots

### Cash Flow & Transaction Management
- Quick logging with custom titles, amounts, categories (Food, Transport, Bills, Shopping, etc.)
- AI-powered receipt scanning via Google Gemini — snap a photo, get structured data
- Filter, search, and delete transactions with immediate balance recalculation

### Savings Goals & Milestones
- Set targets with custom amounts, deadlines, and categories
- Interactive progress bars with coin-marker milestone checkpoints
- Purchase completed goals directly from web or Telegram bot

### Telegram Bot Integration
- Full financial tracking from Telegram — no web app needed
- Natural language input: just type `kopi 25k` to log an expense
- Two-way account linking between web and Telegram
- Passwordless SSO: get a 6-digit code from the bot, log in on the web instantly

### Interactive Mascot Companions
- **Pocky** — Floating assistant with contextual budgeting tips
- **Koiny** — Lucky mascot that rewards savings habits
- Responsive sizing across mobile, tablet, and desktop

### Dual-Mode Persistence
- **Cloud Mode** — Firebase Auth + Firestore for real-time sync
- **Demo Mode** — In-memory storage, no account required

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, React Router 6, Chart.js, CSS3 Modular System |
| **Backend** | Node.js, Express.js, Firebase Admin SDK, Helmet, CORS |
| **Database & Auth** | Google Cloud Firestore, Firebase Authentication |
| **Telegram Bot** | Telegram Bot API, Natural Language Parser |
| **AI** | Google Gemini API (Receipt OCR Scanner) |
| **Testing** | Playwright (E2E + Security), Node.js Assert (Unit) |
| **Deployment** | Vercel (Serverless), Cloudflare (DNS + Workers) |

---

## Project Structure

```text
PocketPlan/
├── api/                  # Serverless deployment adapter (Vercel)
├── backend/              # Express REST API & Firebase Admin
│   ├── index.js          # Server entry point & route definitions
│   ├── lib/
│   │   ├── firebaseAdmin.js        # Firebase Admin SDK init
│   │   ├── geminiReceiptScanner.js  # Gemini AI receipt OCR scanner
│   │   ├── telegramBot.js          # Telegram bot handler & reminders
│   │   ├── telegramBotCore.js      # Telegram API helpers & link-code logic
│   │   ├── telegramParser.js       # Natural-language transaction parser
│   │   ├── emailTemplate.js        # Email verification HTML template
│   │   ├── mailer.js               # SMTP email sender
│   │   ├── telegram.test.js        # Telegram bot unit tests
│   │   ├── isolation.test.js       # REST API & data isolation tests
│   │   ├── accountLinking.test.js  # Account linking unit tests
│   │   ├── email.test.js           # Email template tests
│   │   └── ...test.js              # Additional unit tests
│   ├── scripts/
│   │   └── pollTelegram.js         # Long-polling mode for local dev
│   └── package.json
├── frontend/             # Vite React client
│   ├── public/           # Static assets, SVG logos & avatars
│   ├── src/
│   │   ├── components/   # Mascots, Navigation, Charts, Layout
│   │   ├── pages/        # Dashboard, Transactions, Goals, Profile
│   │   ├── providers/    # Auth & Data context providers
│   │   ├── services/     # Firebase & Telegram API clients
│   │   ├── utils/        # Formatters & chart helpers
│   │   └── styles/       # Modular CSS system
│   ├── test/
│   │   └── chartLogic.test.js  # Chart utility unit tests
│   └── package.json
├── tests/
│   └── e2e/
│       ├── domain-migration.spec.js  # Domain & content E2E tests
│       ├── security.spec.js          # Security E2E tests
│       └── start-backend.js          # Test server bootstrap
├── playwright.config.js  # Playwright E2E configuration
├── vercel.json           # Vercel deployment config
├── STAGING.md            # Staging workflow documentation
└── LICENSE               # MIT License
```

---

## Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x

### 1. Clone Repository
```bash
git clone https://github.com/Syahrulalhabib/PocketPlan.git
cd PocketPlan
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Frontend Setup

Create `.env` in `frontend/`:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_TELEGRAM_BOT_USERNAME=yourpocketplan_bot
```
> If environment variables are omitted, PocketPlan runs in **Demo Mode** with mock data and local storage.

Start frontend development server:
```bash
npm run dev
```

### 4. Backend Setup

Create `.env` in `backend/`:
```env
PORT=4000
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_BOT_USERNAME=yourpocketplan_bot
FRONTEND_ORIGIN=http://localhost:5173
```

Start backend server:
```bash
npm run dev:backend
```

---

## API Reference

Base URL: `https://pocketplan.ai.id` (production) or `http://localhost:4000` (local)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/health` | Health check | No |
| `POST` | `/api/scan-receipt` | Scan receipt image via Gemini AI | Bearer Token |
| `POST` | `/api/telegram-webhook` | Telegram webhook endpoint | Webhook Secret |
| `POST` | `/api/telegram/link-code` | Generate 6-char link code | Bearer Token |
| `POST` | `/api/telegram/cancel-link-code` | Cancel active link code | Bearer Token |
| `GET` | `/api/telegram/status` | Check Telegram link status | Bearer Token |
| `POST` | `/api/telegram/unlink` | Disconnect Telegram account | Bearer Token |
| `POST` | `/api/telegram/web-login` | Exchange bot code for web session | No |
| `GET` | `/api/transactions` | Fetch transactions | Bearer Token |
| `POST` | `/api/transactions` | Create transaction | Bearer Token |
| `DELETE` | `/api/transactions/:id` | Delete transaction | Bearer Token |
| `GET` | `/api/goals` | Fetch savings goals | Bearer Token |
| `POST` | `/api/goals` | Create savings goal | Bearer Token |
| `DELETE` | `/api/goals/:id` | Delete savings goal | Bearer Token |
| `GET` | `/api/report` | Monthly financial report | Bearer Token |
| `GET` | `/api/achievements` | User achievements | Bearer Token |
| `POST` | `/api/cron/reminders` | Trigger daily reminders | Cron Secret |
| `POST` | `/api/admin/sync-commands` | Sync bot commands | Admin Secret |

---

## Telegram Bot

Chat [@yourpocketplan_bot](https://t.me/yourpocketplan_bot) on Telegram to start tracking your finances instantly.

### Quick Start
1. Open the bot and press **Start**
2. Type `kopi 25k` to log your first expense
3. Type `/saldo` to check your balance
4. Type `/web` to get a login code for the web app

### Bot Commands

| Command | Function | Example |
|---------|----------|---------|
| *(type directly)* | Log expense | `kopi susu 25k`, `50k makan siang` |
| `/catat` | Log expense | `/catat bensin 50k` |
| `/masuk` | Log income | `/masuk gaji 2.5jt` |
| `/goal` | Create savings goal | `/goal Laptop Baru 10jt` |
| `/goals` | View all goals & progress | `/goals` |
| `/beligoal` | Purchase completed goal | `/beligoal Laptop` |
| `/saldo` | Check balance | `/saldo` |
| `/riwayat` | Last 5 transactions | `/riwayat` |
| `/batal` | Undo last transaction | `/batal` |
| `/web` | Get web login code | `/web` |
| `/link` | Link web account | `/link AB12CD` |
| `/menu` | Show keyboard menu | `/menu` |
| `/help` | Full guide | `/help` |

> **Flexible input:** `50k`, `50rb`, `50.000`, `1.5jt`, `Rp50000` — all work. Order doesn't matter: `/catat 50k kopi` = `/catat kopi 50k`.

### Web-Telegram Account Linking

**From Web to Telegram:**
1. Open **Profile** > **Telegram Bot** tab on the web
2. Click **Connect** to get a 6-digit code
3. Send `/link CODE` to the bot — done

**From Telegram to Web:**
1. Chat the bot and type `/web`
2. Get a 6-digit code
3. On the website login page, choose **Login with Telegram** and enter the code

---

## Testing

PocketPlan has comprehensive test coverage with **42 tests** across unit and E2E suites.

### Unit Tests (8 suites)
```bash
npm test
```

Covers: Telegram bot logic, REST API isolation, account linking, Gemini receipt scanner, monthly reports, achievements, email templates, chart utilities.

### E2E Tests (Playwright)
```bash
npm run test:e2e
```

Covers:
- **Domain migration** — verifies no old domain references in frontend pages, API responses, and email templates
- **Security** — Helmet headers, CORS enforcement, admin auth (403), webhook auth, input validation, rate limiting, error sanitization, secret leak prevention

### Run All Tests
```bash
npm run test:all
```

---

## Security

PocketPlan implements multiple layers of security:

- **Helmet** — X-Frame-Options, HSTS, X-Content-Type-Options, X-XSS-Protection
- **CORS** — Strict origin allowlist with fail-closed fallback
- **Authentication** — Firebase ID token verification, Bearer token pattern
- **Admin endpoints** — Protected by separate admin/cron secrets, no query string secrets
- **Webhook** — Telegram secret token validation, fail-closed when unconfigured
- **Rate limiting** — Sliding window per-key on auth-sensitive endpoints (web-login, receipt scan, link-code)
- **Input validation** — Type whitelists, amount bounds, date format regex, field sanitization
- **Error sanitization** — Generic error messages in production, no stack trace leaks
- **XSS prevention** — HTML entity escaping in email templates, Markdown escaping in Telegram messages

---

## Deployment

PocketPlan is deployed on **Vercel** (serverless) with **Cloudflare** (DNS + CDN + SSL):

```
User → pocketplan.ai.id → Cloudflare (SSL + CDN) → Vercel (Production)
```

### Webhook Setup (Production)
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://pocketplan.ai.id/api/telegram-webhook" \
  -d "secret_token=YOUR_WEBHOOK_SECRET"
```

### Sync Bot Commands
```bash
curl -X POST "https://pocketplan.ai.id/api/admin/sync-commands" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes and add tests
4. Run the full test suite: `npm run test:all`
5. Commit and push (`git push origin feature/my-feature`)
6. Open a Pull Request

---

## License

This project is licensed under the [MIT License](LICENSE).
