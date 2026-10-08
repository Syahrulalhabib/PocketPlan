<div align="center">
  <img src="frontend/public/pocket-logo.svg" alt="PocketPlan Logo" width="80" height="80" />
  <h1>PocketPlan</h1>
  <p><strong>Smart Saving, Brighter Future — Master your money with PocketPlan</strong></p>

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

## 📌 Overview

**PocketPlan** is a modern, responsive personal finance and savings web application. Built for effortless daily budgeting, expense tracking, and goal achievement, PocketPlan combines financial analytics with delightful, interactive mascot assistants (**Pocky**, **Koiny**, **Pundi**, and **Hematy**) to make money management engaging and intuitive.

---

## ✨ Features

- **💰 Balance & Cash Flow Tracking**: Real-time income and expense monitoring with quick transaction logging and category filtering.
- **🎯 Smart Savings Goals**: Set target budgets, track milestones, and visualize goal progression with interactive coin markers.
- **📊 Interactive Analytics**: Clean visual summaries and spending breakdowns powered by Chart.js.
- **🧸 Gamified Mascot Assistants**:
  - **Pocky**: Floating interactive assistant offering smart financial tips and instant actions.
  - **Koiny**: Celebrates savings milestones and luck interactions.
  - **Pundi & Hematy**: Dashboard stat card companion mascots.
- **📱 Responsive & Touch-Optimized**: Tailored scaling and proportions across desktop, tablet, and mobile (down to 360px).
- **🔒 Dual Mode Architecture**: Seamless fallback between Cloud Firestore/Firebase Auth and local offline demo mode.

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
```

Start backend server:
```bash
npm run dev
```

---

## 📡 API Reference

Base URL: `http://localhost:5000`

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/health` | Health check endpoint | No |
| `GET` | `/api/transactions` | Fetch user transactions | Optional (Token) |
| `POST` | `/api/transactions` | Create new transaction | Optional (Token) |
| `DELETE` | `/api/transactions/:id` | Remove transaction | Optional (Token) |
| `GET` | `/api/goals` | Fetch user savings goals | Optional (Token) |
| `POST` | `/api/goals` | Create new savings goal | Optional (Token) |
| `DELETE` | `/api/goals/:id` | Remove savings goal | Optional (Token) |

---

## 👥 Development Team

Developed as part of Praktikum Pemrograman Berbasis Web (PBW):

| Member | Role |
|---|---|
| **Mochammad Gendry Afriansyah** | UI/UX Designer |
| **Syahrul Al Habib** | Backend Engineer |
| **Tedy Fachrudin** | Frontend Engineer |

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

