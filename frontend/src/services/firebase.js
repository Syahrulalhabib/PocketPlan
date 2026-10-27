import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  reload,
  applyActionCode,
  checkActionCode
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc
} from 'firebase/firestore';

import { stripUndefined } from '../utils/formatters.js';
export { stripUndefined };

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

let app;
let auth;
let db;
let googleProvider;

export const getFirebaseApp = () => {
  if (!app && firebaseEnabled) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseAuth = () => {
  if (!auth && firebaseEnabled) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
};

export const getDb = () => {
  if (!db && firebaseEnabled) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
};

const getGoogleProvider = () => {
  if (!googleProvider && firebaseEnabled) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
};

export const signInEmail = (email, password) => signInWithEmailAndPassword(getFirebaseAuth(), email, password);
export const signUpEmail = (email, password) => createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
export const signInWithGoogle = () => signInWithPopup(getFirebaseAuth(), getGoogleProvider()).catch((err) => {
  if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
    return signInWithRedirect(getFirebaseAuth(), getGoogleProvider());
  }
  throw err;
});
export const signOutUser = () => signOut(getFirebaseAuth());
export const signInWithToken = (token) => firebaseSignInWithCustomToken(getFirebaseAuth(), token);
export const sendVerificationEmail = (user, actionCodeSettings) => {
  const target = user || getFirebaseAuth()?.currentUser;
  if (!target) {
    return Promise.reject(new Error('Sesi pengguna tidak ditemukan untuk verifikasi email.'));
  }
  const email = target.email;
  if (!email || (typeof email === 'string' && email.includes('@telegram.pocketplan'))) {
    return Promise.reject(new Error('Email pengguna belum terdaftar atau masih berupa akun sementara. Silakan simpan email asli terlebih dahulu.'));
  }
  const settings = actionCodeSettings || (typeof window !== 'undefined' ? {
    url: `${window.location.origin}/verification`,
    handleCodeInApp: true
  } : undefined);
  return settings ? sendEmailVerification(target, settings) : sendEmailVerification(target);
};
export const resetPasswordEmail = (email) => sendPasswordResetEmail(getFirebaseAuth(), email);
export const verifyActionCode = (code) => {
  const a = getFirebaseAuth();
  if (!a) return Promise.resolve();
  return applyActionCode(a, code);
};
export const inspectActionCode = (code) => {
  const a = getFirebaseAuth();
  if (!a) return Promise.resolve(null);
  return checkActionCode(a, code);
};
export const watchAuth = (cb) => {
  const a = getFirebaseAuth();
  return a ? onAuthStateChanged(a, cb) : () => {};
};
export const updateProfileName = (name) => {
  const u = getFirebaseAuth()?.currentUser;
  return u && name ? updateProfile(u, { displayName: name }) : undefined;
};
export const updateProfileData = (data) => {
  const u = getFirebaseAuth()?.currentUser;
  return u ? updateProfile(u, data) : undefined;
};
export const updateUserEmail = (newEmail) => {
  const u = getFirebaseAuth()?.currentUser;
  if (!u) return Promise.reject(new Error('Sesi pengguna tidak ditemukan. Silakan login kembali.'));
  if (!newEmail || typeof newEmail !== 'string' || !newEmail.includes('@') || newEmail.includes('@telegram.pocketplan')) {
    return Promise.reject(new Error('Format email tidak valid. Masukkan email asli.'));
  }
  return updateEmail(u, newEmail);
};
export const updateUserPassword = (newPassword) => {
  const u = getFirebaseAuth()?.currentUser;
  if (!u) return Promise.reject(new Error('No authenticated user'));
  return updatePassword(u, newPassword);
};
export const reloadAuthUser = async () => {
  const u = getFirebaseAuth()?.currentUser;
  if (!u) return null;
  await reload(u);
  return u;
};

export const getAuthToken = () => {
  const u = getFirebaseAuth()?.currentUser;
  return u ? u.getIdToken() : Promise.resolve(null);
};

// Firestore helpers (per-user subcollections)

export const getUserCollection = (uid, name) => {
  const d = getDb();
  return d ? collection(d, 'users', uid, name) : null;
};
export const listenCollection = (ref, onData, onError) => (ref ? onSnapshot(ref, onData, onError) : () => {});
export const listenDoc = (ref, onData, onError) => (ref ? onSnapshot(ref, onData, onError) : () => {});
export const addCollectionDoc = (ref, data) => (ref ? addDoc(ref, stripUndefined(data)) : Promise.resolve());
export const deleteCollectionDoc = (uid, collectionName, id) => {
  const d = getDb();
  if (!d) return Promise.resolve();
  const ref = doc(d, 'users', uid, collectionName, id);
  return deleteDoc(ref);
};
export const updateCollectionDoc = (uid, collectionName, id, updates) => {
  const d = getDb();
  if (!d) return Promise.resolve();
  const ref = doc(d, 'users', uid, collectionName, id);
  return updateDoc(ref, stripUndefined(updates));
};
export const updateUserDoc = (uid, updates) => {
  const d = getDb();
  if (!d) return Promise.resolve();
  const ref = doc(d, 'users', uid);
  return setDoc(ref, stripUndefined(updates), { merge: true });
};
export const getUserDocData = async (uid) => {
  const d = getDb();
  if (!d) return null;
  const ref = doc(d, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
};

export const getAuthUser = () => getFirebaseAuth()?.currentUser || null;
export const orderedQuery = (ref, field = 'date') => (ref ? query(ref, orderBy(field, 'desc')) : null);

// User doc (for base balance or profile metadata)
export const getUserDocRef = (uid) => {
  const d = getDb();
  return d ? doc(d, 'users', uid) : null;
};
export const readDoc = (ref) => (ref ? getDoc(ref) : Promise.resolve(null));
