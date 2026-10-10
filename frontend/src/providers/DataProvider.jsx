import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthProvider.jsx';
import {
  firebaseEnabled,
  getDb,
  getUserCollection,
  listenCollection,
  addCollectionDoc,
  deleteCollectionDoc,
  updateCollectionDoc,
  orderedQuery,
  getUserDocRef,
  readDoc
} from '../services/firebase';

import { capitalizeWords } from '../utils/formatters.js';

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export { capitalizeWords };

const DataContext = createContext(undefined);

// Fallback demo data only used when firebase config is absent.
const sampleTransactions = [];
const sampleGoals = [];

export const DataProvider = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState(firebaseEnabled ? [] : sampleTransactions);
  const [goals, setGoals] = useState(firebaseEnabled ? [] : sampleGoals);
  const [baseBalance, setBaseBalance] = useState(0);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  }, []);

  // Sync Firestore per-user collections
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!user) {
      setTransactions([]);
      setGoals([]);
      setBaseBalance(0);
      setLoading(false);
      return;
    }

    const db = getDb();
    if (!db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const txRef = orderedQuery(getUserCollection(user.id, 'transactions'));
    const goalRef = orderedQuery(getUserCollection(user.id, 'goals'), 'name');

    const unsubTx = listenCollection(
      txRef,
      (snap) => {
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTransactions(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    const unsubGoals = listenCollection(
      goalRef,
      (snap) => {
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setGoals(items);
      },
      () => {}
    );

    // Fetch base balance once
    const userDocRef = getUserDocRef(user.id);
    if (userDocRef) {
      readDoc(userDocRef)
        .then((snap) => {
          const data = snap?.data?.();
          if (data && data.baseBalance !== undefined) {
            setBaseBalance(Number(data.baseBalance) || 0);
          }
        })
        .catch(() => {});
    }

    return () => {
      unsubTx && unsubTx();
      unsubGoals && unsubGoals();
    };
  }, [user]);

  const addTransaction = useCallback(async (payload) => {
    const entry = {
      ...payload,
      description: capitalizeWords(payload.description || ''),
      category: capitalizeWords(payload.category || ''),
      amount: Number(payload.amount) || 0,
      date: payload.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => [{ ...entry, id: generateId() }, ...prev]);
        showToast('Transaction added (demo mode).');
        return;
      }
      const ref = getUserCollection(user.id, 'transactions');
      await addCollectionDoc(ref, entry);
      showToast('Transaction saved.');
    } catch (err) {
      console.error('Add transaction failed', err);
      showToast(err?.message || 'Failed to save transaction', 'error');
    }
  }, [user, showToast]);

  const updateTransaction = useCallback(async (id, updates) => {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.description !== undefined) cleanUpdates.description = capitalizeWords(cleanUpdates.description);
    if (cleanUpdates.category !== undefined) cleanUpdates.category = capitalizeWords(cleanUpdates.category);
    if (cleanUpdates.amount !== undefined) cleanUpdates.amount = Number(cleanUpdates.amount) || 0;

    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...cleanUpdates } : t)));
        showToast('Transaction updated (demo mode).');
        return;
      }
      await updateCollectionDoc(user.id, 'transactions', id, cleanUpdates);
      showToast('Transaction updated.');
    } catch (err) {
      console.error('Update transaction failed', err);
      showToast(err?.message || 'Failed to update transaction', 'error');
    }
  }, [user, showToast]);

  const addGoal = useCallback(async (payload) => {
    const entry = {
      ...payload,
      name: capitalizeWords(payload.name || ''),
      target: Number(payload.target) || 0,
      amount: Number(payload.amount) || 0,
      type: payload.type || 'Saving',
      createdAt: new Date().toISOString()
    };
    if (payload.category) {
      entry.category = capitalizeWords(payload.category);
    } else {
      delete entry.category;
    }
    try {
      if (!firebaseEnabled || !user) {
        setGoals((prev) => [...prev, { ...entry, id: generateId() }]);
        showToast('Goal added (demo mode).');
        return;
      }
      const ref = getUserCollection(user.id, 'goals');
      await addCollectionDoc(ref, entry);
      showToast('Goal saved.');
    } catch (err) {
      console.error('Add goal failed', err);
      showToast(err?.message || 'Failed to save goal', 'error');
    }
  }, [user, showToast]);

  const deleteTransaction = useCallback(async (id) => {
    // Find the transaction before deleting — check for goalBackup
    const tx = transactions.find((t) => t.id === id);
    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        if (tx?.goalBackup) {
          await addGoal(tx.goalBackup);
          showToast('Transaction deleted & goal restored (demo mode).');
        } else {
          showToast('Transaction deleted (demo mode).');
        }
        return;
      }
      await deleteCollectionDoc(user.id, 'transactions', id);
      if (tx?.goalBackup) {
        const ref = getUserCollection(user.id, 'goals');
        await addCollectionDoc(ref, {
          name: tx.goalBackup.name,
          target: tx.goalBackup.target,
          amount: tx.goalBackup.amount || 0,
          type: tx.goalBackup.type || 'Saving',
          createdAt: tx.goalBackup.createdAt || new Date().toISOString()
        });
        showToast('Transaction deleted & goal restored.');
      } else {
        showToast('Transaction deleted.');
      }
    } catch (err) {
      console.error('Delete transaction failed', err);
      showToast(err?.message || 'Failed to delete transaction', 'error');
    }
  }, [user, transactions, showToast, addGoal]);

  const updateGoal = useCallback(async (id, updates) => {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.name !== undefined) cleanUpdates.name = capitalizeWords(cleanUpdates.name);
    if (cleanUpdates.category !== undefined) {
      if (cleanUpdates.category) {
        cleanUpdates.category = capitalizeWords(cleanUpdates.category);
      } else {
        delete cleanUpdates.category;
      }
    }
    if (cleanUpdates.target !== undefined) cleanUpdates.target = Number(cleanUpdates.target) || 0;

    try {
      if (!firebaseEnabled || !user) {
        setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...cleanUpdates } : g)));
        showToast('Goal updated (demo mode).');
        return;
      }
      await updateCollectionDoc(user.id, 'goals', id, cleanUpdates);
      showToast('Goal updated.');
    } catch (err) {
      console.error('Update goal failed', err);
      showToast(err?.message || 'Failed to update goal', 'error');
    }
  }, [user, showToast]);

  const deleteGoal = useCallback(async (id) => {
    try {
      if (!firebaseEnabled || !user) {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        showToast('Goal deleted (demo mode).');
        return;
      }
      await deleteCollectionDoc(user.id, 'goals', id);
      showToast('Goal deleted.');
    } catch (err) {
      console.error('Delete goal failed', err);
      showToast(err?.message || 'Failed to delete goal', 'error');
    }
  }, [user, showToast]);

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'Income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === 'Expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = baseBalance + income - expense;
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthIncome = transactions.filter((t) => t.type === 'Income' && (t.date || '').startsWith(monthPrefix)).reduce((acc, t) => acc + Number(t.amount), 0);
    const monthExpense = transactions.filter((t) => t.type === 'Expense' && (t.date || '').startsWith(monthPrefix)).reduce((acc, t) => acc + Number(t.amount), 0);
    return { income, expense, balance, monthIncome, monthExpense };
  }, [transactions, baseBalance]);

  const value = useMemo(
    () => ({
      firebaseEnabled,
      loading,
      transactions,
      goals,
      baseBalance,
      summary,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addGoal,
      updateGoal,
      deleteGoal,
      toast,
      showToast
    }),
    [transactions, goals, summary, loading, toast, baseBalance, addTransaction, updateTransaction, deleteTransaction, addGoal, updateGoal, deleteGoal, showToast]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
