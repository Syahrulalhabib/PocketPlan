import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let initialized = false;
let db = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const initFirebaseAdmin = () => {
  if (initialized) return db;
  if (process.env.SKIP_FIREBASE_INIT) return db;

  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const serviceAccountBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;

  try {
    let credential;
    if (serviceAccountBase64) {
      const json = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
      credential = admin.credential.cert(json);
    } else {
      const candidates = [
        serviceAccountPath,
        serviceAccountPath && path.resolve(process.cwd(), serviceAccountPath),
        serviceAccountPath && path.resolve(__dirname, '..', serviceAccountPath),
        path.resolve(__dirname, '../ServiceAccount.json'),
        path.resolve(process.cwd(), 'backend/ServiceAccount.json'),
        path.resolve(process.cwd(), 'ServiceAccount.json')
      ].filter(Boolean);

      const foundPath = candidates.find((p) => fs.existsSync(p));
      if (foundPath) {
        credential = admin.credential.cert(foundPath);
      }
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

