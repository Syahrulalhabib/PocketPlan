import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

let app;
let auth;
let db;

if (firebaseEnabled) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export const getAuthClient = () => auth;
export const getDb = () => db;
export const googleProvider = firebaseEnabled ? new GoogleAuthProvider() : null;

export const signInEmail = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signUpEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const sendVerificationEmail = (user) => {
  const target = user || auth?.currentUser;
  if (!target) {
    return Promise.reject(new Error('No authenticated user available for verification email.'));
  }
  return sendEmailVerification(target);
};
export const resetPasswordEmail = (email) => sendPasswordResetEmail(auth, email);
export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
export const updateProfileName = (name) => (auth?.currentUser && name ? updateProfile(auth.currentUser, { displayName: name }) : undefined);
export const updateProfileData = (data) => (auth?.currentUser ? updateProfile(auth.currentUser, data) : undefined);

// Firestore helpers (per-user subcollections)
export const getUserCollection = (uid, name) => (db ? collection(db, 'users', uid, name) : null);
export const listenCollection = (ref, onData, onError) => (ref ? onSnapshot(ref, onData, onError) : () => {});
export const addCollectionDoc = (ref, data) => (ref ? addDoc(ref, data) : Promise.resolve());
export const deleteCollectionDoc = (uid, collectionName, id) => {
  if (!db) return Promise.resolve();
  const ref = doc(db, 'users', uid, collectionName, id);
  return deleteDoc(ref);
};
export const updateCollectionDoc = (uid, collectionName, id, updates) => {
  if (!db) return Promise.resolve();
  const ref = doc(db, 'users', uid, collectionName, id);
  return updateDoc(ref, updates);
};
export const orderedQuery = (ref, field = 'date') => (ref ? query(ref, orderBy(field, 'desc')) : null);

// User doc (for base balance or profile metadata)
export const getUserDocRef = (uid) => (db ? doc(db, 'users', uid) : null);
export const readDoc = (ref) => (ref ? getDoc(ref) : Promise.resolve(null));
export const writeDoc = (ref, data) => (ref ? setDoc(ref, data, { merge: true }) : Promise.resolve());
