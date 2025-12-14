import admin from 'firebase-admin';
import fs from 'fs';

let initialized = false;
let db = null;

export const initFirebaseAdmin = () => {
  if (initialized) return db;

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serviceAccountBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

  try {
    let credential;
    if (serviceAccountBase64) {
      const json = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
      credential = admin.credential.cert(json);
    } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      credential = admin.credential.cert(serviceAccountPath);
    }

    if (credential) {
      admin.initializeApp({ credential });
      db = admin.firestore();
      initialized = true;
      console.log('Firebase Admin initialized');
    } else {
      console.warn('Firebase Admin not initialized (service account missing). Using in-memory data.');
    }
  } catch (err) {
    console.warn('Firebase Admin init failed, falling back to in-memory data', err?.message);
  }

  return db;
};

export const getDb = () => db;
