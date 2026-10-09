import {
  getAuthToken,
  getAuthUser,
  updateUserDoc,
  getUserDocData,
  firebaseEnabled
} from './firebase.js';

const getHeaders = async () => {
  const token = await getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export async function getTelegramStatus() {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/telegram/status', { headers });
    if (res.ok) return await res.json();
  } catch {
    // API failed, check direct Firestore below
  }

  const user = getAuthUser();
  if (firebaseEnabled && user?.uid) {
    try {
      const data = await getUserDocData(user.uid);
      if (data?.telegramChatId) {
        return {
          linked: true,
          chatId: data.telegramChatId,
          username: data.telegramUsername || null
        };
      }
    } catch {}
  }

  return { linked: false };
}

export async function requestLinkCode() {
  const botUsername = (import.meta.env?.VITE_TELEGRAM_BOT_USERNAME || 'yourpocketplan_bot').replace('@', '');

  // Check existing unexpired code in Firestore first (survives refresh)
  const user = getAuthUser();
  if (firebaseEnabled && user?.uid) {
    const existing = await getUserDocData(user.uid);
    if (existing?.telegramLinkCode && existing?.telegramCodeExpiresAt) {
      const exp = new Date(existing.telegramCodeExpiresAt).getTime();
      if (exp > Date.now()) {
        return {
          code: existing.telegramLinkCode,
          expiresAt: exp,
          deepLink: `https://t.me/${botUsername}?start=${existing.telegramLinkCode}`
        };
      }
    }
  }

  try {
    const headers = await getHeaders();
    const res = await fetch('/api/telegram/link-code', {
      method: 'POST',
      headers
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Backend API unreachable, fall through to client-side Firestore
  }

  if (firebaseEnabled && user?.uid) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await updateUserDoc(user.uid, {
      telegramLinkCode: code,
      telegramCodeExpiresAt: new Date(expiresAt).toISOString()
    });

    return { code, expiresAt, deepLink: `https://t.me/${botUsername}?start=${code}` };
  }

  // Demo fallback
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let demoCode = '';
  for (let i = 0; i < 6; i++) demoCode += chars.charAt(Math.floor(Math.random() * chars.length));
  return {
    code: demoCode,
    expiresAt: Date.now() + 15 * 60 * 1000,
    deepLink: `https://t.me/${botUsername}?start=${demoCode}`
  };
}

export async function requestUnlink() {
  try {
    const headers = await getHeaders();
    const res = await fetch('/api/telegram/unlink', {
      method: 'POST',
      headers
    });
    if (res.ok) return await res.json();
  } catch {
    // Backend API unreachable, fall through to client-side Firestore
  }

  const user = getAuthUser();
  if (firebaseEnabled && user?.uid) {
    await updateUserDoc(user.uid, {
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: null,
      telegramCodeExpiresAt: null
    });
  }

  return { success: true };
}

export async function telegramWebLogin(code) {
  const res = await fetch('/api/telegram/web-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data?.error || 'Login with Telegram failed');
  }
  return data.user;
}

