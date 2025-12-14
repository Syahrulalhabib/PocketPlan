import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
  readDoc,
  writeDoc
} from '../services/firebase';
import { v4 as uuid } from 'uuid';

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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  };

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

  const addTransaction = async (payload) => {
    const entry = {
      ...payload,
      amount: Number(payload.amount) || 0,
      date: payload.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => [{ ...entry, id: uuid() }, ...prev]);
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
  };

  const updateTransaction = async (id, updates) => {
    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
        showToast('Transaction updated (demo mode).');
        return;
      }
      await updateCollectionDoc(user.id, 'transactions', id, updates);
      showToast('Transaction updated.');
    } catch (err) {
      console.error('Update transaction failed', err);
      showToast(err?.message || 'Failed to update transaction', 'error');
    }
  };

  const deleteTransaction = async (id) => {
    try {
      if (!firebaseEnabled || !user) {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        showToast('Transaction deleted (demo mode).');
        return;
      }
      await deleteCollectionDoc(user.id, 'transactions', id);
      showToast('Transaction deleted.');
    } catch (err) {
      console.error('Delete transaction failed', err);
      showToast(err?.message || 'Failed to delete transaction', 'error');
    }
  };

  const addGoal = async (payload) => {
    const entry = {
      ...payload,
      amount: Number(payload.amount) || 0,
      target: Number(payload.target) || 0,
      createdAt: new Date().toISOString()
    };
    try {
      if (!firebaseEnabled || !user) {
        setGoals((prev) => [...prev, { ...entry, id: uuid() }]);
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
  };

  const updateGoal = async (id, updates) => {
    try {
      if (!firebaseEnabled || !user) {
        setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
        showToast('Goal updated (demo mode).');
        return;
      }
      await updateCollectionDoc(user.id, 'goals', id, updates);
      showToast('Goal updated.');
    } catch (err) {
      console.error('Update goal failed', err);
      showToast(err?.message || 'Failed to update goal', 'error');
    }
  };

  const deleteGoal = async (id) => {
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
  };

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'Income').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = transactions.filter((t) => t.type === 'Expense').reduce((acc, t) => acc + Number(t.amount), 0);
    const balance = baseBalance + income - expense;
    const monthIncome = income;
    const monthExpense = expense;
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
      toast
    }),
    [transactions, goals, summary, loading, toast, baseBalance]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};
