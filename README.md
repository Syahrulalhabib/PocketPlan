# PocketPlan

Prototype web app that matches the provided PocketPlan mockups. Built with Vite + React (JavaScript) for the frontend and Express + optional Firebase Admin for the backend. Firebase client SDK is wired with env placeholders so you can drop your config in and switch from demo/local state to Firestore/Auth.

## Structure

- `frontend/` – Vite React app (routing, pages, chart, demo data).  
- `backend/` – Express API with optional Firestore persistence via firebase-admin (falls back to in-memory demo data).

## Frontend

1) `cd frontend`
2) Install deps: `npm install`
3) Create `.env` with your Firebase web config:
   ```bash
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=
   ```
4) Run dev server: `npm run dev`
5) Build: `npm run build`

Notes:
- If env vars are missing, the app runs in demo mode (local state, mock auth).  
- Routes: `/login`, `/register`, `/dashboard`, `/transactions`, `/goals`, `/about`, `/profile`.

## Backend

1) `cd backend`
2) Install deps: `npm install`
3) Copy `.env.example` to `.env` and set credentials. Provide either `GOOGLE_APPLICATION_CREDENTIALS` (path to serviceAccount.json) or `GOOGLE_SERVICE_ACCOUNT_BASE64` (base64-encoded JSON).  
4) Run: `npm start`

API (Firestore when credentials are present; otherwise in-memory demo data):
- `GET /health`
- `GET/POST/DELETE /api/transactions`
- `GET/POST/DELETE /api/goals`

Auth: If firebase-admin is configured, send `Authorization: Bearer <idToken>`; otherwise requests are allowed for demo mode.

## Assets

- Background pattern: `frontend/public/bg-pattern.svg`  
- Logo: `frontend/public/pocket-logo.svg`

## Customization

- Update colors/spacing in `frontend/src/styles/global.css`.
- Replace demo data in `frontend/src/providers/DataProvider.jsx`.
- Hook profile save to Firebase Auth/Firestore inside `ProfilePage.jsx`.
