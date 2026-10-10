<div align="center">
  <img src="frontend/public/pocket-logo.svg" alt="PocketPlan Logo" width="84" height="84" />
  <h1>PocketPlan</h1>
  <p><strong>Smart Saving, Brighter Future — Master your money with PocketPlan</strong></p>
  <p>An intuitive, gamified personal finance and savings web app designed to make budgeting enjoyable, effortless, and stress-free.</p>

  <p>
    <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-5.1-646CFF?logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Firebase-Firestore%20%7C%20Auth-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  </p>
</div>

---

## 💡 What is PocketPlan?

Managing personal finances often feels intimidating, tedious, or dry. Spreadsheets are complex, and traditional banking apps lack personality. 

**PocketPlan** bridges this gap as a modern, lightweight web application that combines **core financial tracking tools** with an **interactive, friendly mascot system**. Whether you are a student budgeting daily allowances, a young professional tracking cash flow, or someone striving to save up for a dream goal, PocketPlan gives you a complete, clear picture of your finances in real time.

### 🎯 Key Problems PocketPlan Solves:
1. **Unconscious Spending**: Pinpoint exactly where your money leaks with categorized expense tracking and instant charts.
2. **Abandoned Savings Goals**: Break down intimidating savings targets into bite-sized milestones with visual progress indicators.
3. **Boring Budgeting**: Stay motivated using gamified mascot companions (**Pocky**, **Koiny**, **Pundi**, and **Hematy**) that provide timely tips, encouragement, and milestone celebrations.
4. **Friction to Start**: Jump right in using **Demo Mode** without mandatory registration, or connect your Firebase account for real-time cloud persistence.

---

## 🌟 Core Features & Modules

### 1. 📊 Financial Dashboard
- **Real-Time Balance Overview**: Live snapshot of total net balance, monthly income, and monthly expenses.
- **Visual Analytics**: Interactive charts powered by Chart.js displaying expense breakdown and monthly comparisons.
- **Companion Status**: Quick balance-health indicators brought to life by animated mascots (*Pundi* & *Hematy*).

### 2. 💸 Cash Flow & Transaction Management
- **Quick Logging**: Add income and expense entries in seconds with custom titles, amounts, and categories (Food, Transport, Bills, Shopping, etc.).
- **Filtering & Search**: Quickly find past transactions by type or date.
- **Total Control**: Safely delete or revise transaction records with immediate balance recalculation.

### 3. 🎯 Savings Goals & Milestones
- **Target Tracking**: Set targets with custom amounts, deadlines, and categories.
- **Interactive Progress Bars**: Watch savings grow step-by-step with coin-marker milestone checkpoints.
- **Celebration Feedback**: Hit savings milestones and receive cheerful celebrations from *Koiny*.

### 4. 🧸 Interactive Mascot Companions
- **Pocky (Floating Assistant)**: A friendly, floating companion docked on your screen. Tap Pocky for contextual budgeting tips, shortcuts, or to celebrate your financial discipline.
- **Koiny (Lucky Mascot)**: Rewards savings habits and brings fun interactions across goal tracking.
- **Responsive Proportions**: Mascots automatically adapt their size across mobile phones, tablets, and desktops without layout overflow.

### 5. ⚡ Dual-Mode Persistence (Cloud & Offline)
- **Cloud Mode**: Full authentication and cloud database sync powered by Firebase Auth and Google Cloud Firestore.
- **Offline / Guest Demo Mode**: If no Firebase credentials are configured, PocketPlan seamlessly falls back to local storage and mock data—no setup or account required to test.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, React Router 6, Chart.js, React-Chartjs-2, CSS3 Modular System |
| **Backend** | Node.js, Express.js, Firebase Admin SDK, Morgan, CORS, Dotenv |
| **Database & Auth** | Google Cloud Firestore, Firebase Authentication |
| **Deployment** | Vercel / Node Server Ready |

---

## 📂 Project Structure

```text
PocketPlan/
├── api/                # Serverless deployment adapter
├── backend/            # Express REST API & Firebase Admin
│   ├── index.js        # Server entry point & route definitions
│   └── package.json
├── frontend/           # Vite React client
│   ├── public/         # Static assets, SVG logos & avatars
│   ├── src/
│   │   ├── components/ # Mascots, Navigation, Charts, Layout
│   │   ├── pages/      # Dashboard, Transactions, Goals, Profile, About
│   │   ├── providers/  # Auth & Data context providers
│   │   └── styles/     # Modular CSS (base, responsive, mascots, etc.)
│   └── package.json
├── firestore.rules     # Cloud Firestore security rules
└── vercel.json         # Vercel deployment routing configuration
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** >= 18.x
- **npm** >= 9.x

### 1. Clone Repository
```bash
git clone https://github.com/Syahrulalhabib/PocketPlan.git
cd PocketPlan
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```

Create `.env` in `frontend/`:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```
> *Note:* If environment variables are omitted, PocketPlan runs in **Demo Mode** using mock data and local storage.

Start frontend development server:
```bash
npm run dev
```

### 3. Backend Setup
```bash
cd ../backend
npm install
```

Create `.env` in `backend/`:
```env
PORT=5000
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json
# Or use base64: GOOGLE_SERVICE_ACCOUNT_BASE64=
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_from_botfather
TELEGRAM_BOT_USERNAME=your_bot_username
```

Start backend server:
```bash
npm run dev
```

---

## 📡 API Reference

Base URL: `http://localhost:4000`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Health check endpoint | No |
| `POST` | `/api/telegram-webhook` | Incoming Telegram webhook updates | No (Telegram Secret) |
| `POST` | `/api/telegram/link-code` | Generate 6-char link code for account pairing | Yes (Bearer Token) |
| `GET` | `/api/telegram/status` | Check Telegram link status | Yes (Bearer Token) |
| `POST` | `/api/telegram/unlink` | Disconnect Telegram from user account | Yes (Bearer Token) |
| `POST` | `/api/telegram/web-login` | Exchange 6-char bot code for web session | No |
| `GET` | `/api/transactions` | Fetch user transactions | Optional (Token) |
| `POST` | `/api/transactions` | Create new transaction | Optional (Token) |
| `DELETE` | `/api/transactions/:id` | Remove transaction | Optional (Token) |
| `GET` | `/api/goals` | Fetch user savings goals | Optional (Token) |
| `POST` | `/api/goals` | Create new savings goal | Optional (Token) |
| `DELETE` | `/api/goals/:id` | Remove savings goal | Optional (Token) |

---

## 🤖 Telegram Bot Integration & Dual-Way Onboarding

PocketPlan comes with native Telegram Bot integration (`@yourpocketplan_bot`):

### 1. Daftar di Website -> Akses Telegram
1. Buka halaman **Profile** di website -> Tab **Telegram Bot**.
2. Klik tombol **Hubungkan Telegram Sekarang** (mendapatkan kode 6 karakter atau klik langsung deep link).
3. Bot Telegram terbuka, tekan **Start** (atau ketik `/link KODE`).
4. Akun tersambung otomatis secara real-time!

### 2. Pengguna Baru dari Telegram -> Akses Website
1. Langsung chat `@yourpocketplan_bot` di Telegram dan tekan `/start`.
2. Akun langsung otomatis dibuatkan (`tg_<chatId>`). Kamu bisa langsung catat transaksi & goals via Telegram!
3. Untuk membuka akun tersebut di website: ketik `/web` di bot Telegram untuk mendapatkan **Kode Akses 6 Digit**.
4. Buka website PocketPlan, di halaman Login pilih tab **"Masuk dengan Telegram"** dan masukkan kodenya.
5. Website langsung masuk ke dashboard dengan data transaksi yang sama persis!

### 📋 Daftar Perintah Bot

| Perintah | Fungsi | Contoh |
|---|---|---|
| *(ketik langsung)* | Catat pengeluaran kilat | `kopi susu 25k`, `50k makan siang` |
| `/catat` | Catat pengeluaran | `/catat bensin 50k`, `/catat makan siang 35rb` |
| `/keluar` | Alias `/catat` | `/keluar parkir 5k` |
| `/masuk` | Catat pemasukan | `/masuk gaji 2.5jt`, `/masuk freelance 500k` |
| `/goal` | Buat target impian | `/goal Laptop Baru 10jt`, `/goal 500k Sepatu` |
| `/goals` | Lihat semua target & progres | `/goals` |
| `/beligoal` | Beli target yang tercapai | `/beligoal Laptop` |
| `/saldo` | Cek sisa saldo | `/saldo` |
| `/riwayat` | 5 transaksi terakhir | `/riwayat` |
| `/batal` | Batalkan transaksi terakhir | `/batal` |
| `/web` | Kode login website | `/web` |
| `/link` | Hubungkan akun website | `/link AB12CD` |
| `/menu` | Tampilkan keyboard menu | `/menu` |
| `/help` | Panduan lengkap | `/help` |

> 💡 **Format nominal fleksibel:** `50k`, `50rb`, `50.000`, `1.5jt`, `Rp50000`
> 
> 💡 **Urutan bebas:** `/catat 50k kopi` atau `/catat kopi 50k` keduanya bisa!

### 🎯 Fitur Realisasi & Pembelian Goals (Achieved Goals)
- **Di Website**: Goal yang telah tercapai (`balance >= target`) akan memunculkan tombol **"🛍️ Beli"**. Saat diklik, pengeluaran otomatis dicatat dan goal otomatis diselesaikan (dihapus dari daftar aktif). Saat membuat transaksi pengeluaran baru di menu Transaksi, tersedia juga dropdown opsi untuk menautkan goal tercapai.
- **Di Telegram Bot**: Ketik `/goals` untuk melihat visual progress bar. Jika goal tercapai, bot menampilkan tombol inline interaktif `[🛍️ Beli Goal: Nama]` (atau ketik `/beligoal [nama]`). Sistem langsung mencatat pengeluaran dan menyelesaikan goal dengan notifikasi perayaan!
- **Pembatalan**: Jika salah beli, ketik `/batal` di Telegram atau hapus transaksi di website — goal otomatis dikembalikan ke daftar aktif.

### 🔒 Webhook Security (Production)

Set `TELEGRAM_WEBHOOK_SECRET` di `.env` backend lalu daftarkan webhook dengan `secret_token`:

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://yourapp.vercel.app/api/telegram-webhook" \
  -d "secret_token=YOUR_RANDOM_SECRET"
```

Ini memastikan endpoint `/api/telegram-webhook` hanya menerima request dari Telegram.

### 📝 BotFather Bio & Description

Gunakan teks ini saat setup bot via [@BotFather](https://t.me/BotFather):

**Name:** `PocketPlan`
**About (bio, maks 120 karakter):**
```
Asisten keuangan pribadimu 🪙 Catat pemasukan & pengeluaran, buat target tabungan, cek saldo — semua dari Telegram.
```
**Description (saat user buka chat pertama kali):**
```
🪙 PocketPlan — Asisten Keuangan Pribadi

Catat keuanganmu langsung dari Telegram:
💸 Pengeluaran: ketik "kopi 25k"
💰 Pemasukan: /masuk gaji 2jt
🎯 Target: /goal Laptop 10jt
📊 Saldo: /saldo

Tekan Start untuk mulai!
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

