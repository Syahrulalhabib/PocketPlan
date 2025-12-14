import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { initFirebaseAdmin, getDb } from './lib/firebaseAdmin.js';

dotenv.config();
initFirebaseAdmin();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 4000;

const demoTransactions = [
  { id: 't1', category: 'Charity', type: 'Expense', amount: 2000000, date: '2025-11-22', description: 'Sumbangan' }
];
const demoGoals = [{ id: 'g1', name: 'Laptop', type: 'Saving', amount: 2340000, target: 15000000 }];

const useFirestore = Boolean(getDb());

// Middleware to verify Firebase token when admin is configured
const requireAuth = async (req, res, next) => {
  if (!useFirestore) return next();
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    await import('firebase-admin').then(({ auth }) => auth().verifyIdToken(token));
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.get('/health', (_, res) => res.json({ ok: true, useFirestore }));

app.get('/api/transactions', requireAuth, async (req, res) => {
  if (!useFirestore) return res.json(demoTransactions);
  const db = getDb();
  const snapshot = await db.collection('transactions').get();
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json(items);
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!useFirestore) {
    demoTransactions.unshift({ ...payload, id: `t-${Date.now()}` });
    return res.status(201).json({ ok: true });
  }
  const db = getDb();
  const docRef = await db.collection('transactions').add(payload);
  res.status(201).json({ id: docRef.id });
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!useFirestore) {
    const idx = demoTransactions.findIndex((t) => t.id === id);
    if (idx >= 0) demoTransactions.splice(idx, 1);
    return res.json({ ok: true });
  }
  const db = getDb();
  await db.collection('transactions').doc(id).delete();
  res.json({ ok: true });
});

app.get('/api/goals', requireAuth, async (req, res) => {
  if (!useFirestore) return res.json(demoGoals);
  const db = getDb();
  const snapshot = await db.collection('goals').get();
  const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  res.json(items);
});

app.post('/api/goals', requireAuth, async (req, res) => {
  const payload = req.body;
  if (!useFirestore) {
    demoGoals.push({ ...payload, id: `g-${Date.now()}` });
    return res.status(201).json({ ok: true });
  }
  const db = getDb();
  const docRef = await db.collection('goals').add(payload);
  res.status(201).json({ id: docRef.id });
});

app.delete('/api/goals/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!useFirestore) {
    const idx = demoGoals.findIndex((g) => g.id === id);
    if (idx >= 0) demoGoals.splice(idx, 1);
    return res.json({ ok: true });
  }
  const db = getDb();
  await db.collection('goals').doc(id).delete();
  res.json({ ok: true });
});

// Export for Vercel serverless. When running locally (npm run dev/start), still listen on PORT.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`PocketPlan API running on http://localhost:${PORT}`);
  });
}

export default app;
