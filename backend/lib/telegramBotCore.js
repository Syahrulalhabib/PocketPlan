const demoCodes = new Map();
const demoLinks = new Map();

export async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) return null;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...options })
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram sendMessage error:', err.message);
    return null;
  }
}

export async function generateLinkCode(uid, db, botUsername = '') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  const expiresAt = Date.now() + 15 * 60 * 1000;

  if (db) {
    await db.collection('telegram_codes').doc(code).set({
      uid,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } else {
    demoCodes.set(code, { uid, expiresAt });
  }

  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;
  return { code, expiresAt, deepLink };
}

export async function getLinkStatus(uid, db) {
  if (db) {
    const userDoc = await db.collection('users').doc(uid).get();
    const data = userDoc.data();
    if (data?.telegramChatId) {
      return { linked: true, chatId: data.telegramChatId, username: data.telegramUsername || null };
    }
    return { linked: false };
  }
  for (const [chatId, link] of demoLinks.entries()) {
    if (link.uid === uid) return { linked: true, chatId, username: link.username || null };
  }
  return { linked: false };
}

export async function unlinkAccount(uid, db) {
  if (db) {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const data = snap.data();
    if (data?.telegramChatId) {
      await db.collection('telegram_links').doc(String(data.telegramChatId)).delete();
      await userRef.update({ telegramChatId: null, telegramUsername: null });
    }
  } else {
    for (const [chatId, link] of demoLinks.entries()) {
      if (link.uid === uid) demoLinks.delete(chatId);
    }
  }
  return { success: true };
}

export async function findLinkedUid(chatId, db) {
  const strId = String(chatId);
  if (db) {
    const snap = await db.collection('telegram_links').doc(strId).get();
    return snap.exists ? snap.data().uid : null;
  }
  const found = demoLinks.get(strId);
  return found ? found.uid : null;
}

export async function linkChatWithCode(chatId, code, userFrom, db) {
  const strId = String(chatId);
  const cleanCode = String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  if (db) {
    let uid = null;
    const codeDoc = await db.collection('telegram_codes').doc(cleanCode).get();
    if (codeDoc.exists) {
      const data = codeDoc.data();
      if (new Date(data.expiresAt).getTime() < Date.now()) {
        await codeDoc.ref.delete();
        return 'EXPIRED';
      }
      uid = data.uid;
      await codeDoc.ref.delete();
    } else {
      // Fallback: check users collection where telegramLinkCode is stored directly from web client
      const userSnap = await db.collection('users').where('telegramLinkCode', '==', cleanCode).limit(1).get();
      if (!userSnap.empty) {
        const uDoc = userSnap.docs[0];
        const uData = uDoc.data();
        if (uData.telegramCodeExpiresAt && new Date(uData.telegramCodeExpiresAt).getTime() < Date.now()) {
          await uDoc.ref.update({ telegramLinkCode: null, telegramCodeExpiresAt: null });
          return 'EXPIRED';
        }
        uid = uDoc.id;
        await uDoc.ref.update({ telegramLinkCode: null, telegramCodeExpiresAt: null });
      }
    }

    if (!uid) return null;

    await db.collection('telegram_links').doc(strId).set({
      uid,
      linkedAt: new Date().toISOString(),
      username: userFrom.username || null,
      firstName: userFrom.first_name || null
    });

    await db.collection('users').doc(uid).set(
      { telegramChatId: strId, telegramUsername: userFrom.username || null },
      { merge: true }
    );
    return uid;
  }

  const entry = demoCodes.get(cleanCode);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    demoCodes.delete(cleanCode);
    return 'EXPIRED';
  }
  const uid = entry.uid;
  demoCodes.delete(cleanCode);
  demoLinks.set(strId, { uid, linkedAt: Date.now(), username: userFrom.username || null });
  return uid;
}
export async function answerTelegramCallback(botToken, callbackQueryId, text = '') {
  if (!botToken || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text })
    });
  } catch {}
}

const demoWebCodes = new Map();

export async function ensureTelegramUser(chatId, userFrom, db) {
  const strId = String(chatId);
  const existingUid = await findLinkedUid(strId, db);
  if (existingUid) return existingUid;

  const newUid = `tg_${strId}`;
  const name = userFrom?.first_name || userFrom?.username || 'Telegram User';

  if (db) {
    await db.collection('users').doc(newUid).set({
      name,
      telegramChatId: strId,
      telegramUsername: userFrom?.username || null,
      isTelegramUser: true,
      createdAt: new Date().toISOString()
    }, { merge: true });

    await db.collection('telegram_links').doc(strId).set({
      uid: newUid,
      linkedAt: new Date().toISOString(),
      username: userFrom?.username || null,
      firstName: userFrom?.first_name || null
    });
  } else {
    demoLinks.set(strId, { uid: newUid, username: userFrom?.username || null });
  }

  return newUid;
}

export async function generateWebLoginCode(uid, db) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  const expiresAt = Date.now() + 15 * 60 * 1000;

  if (db) {
    await db.collection('telegram_web_codes').doc(code).set({ uid, expiresAt: new Date(expiresAt).toISOString() });
  } else {
    demoWebCodes.set(code, { uid, expiresAt });
  }
  return { code, expiresAt };
}

export async function verifyWebLoginCode(code, db) {
  const cleanCode = code.trim().toUpperCase();
  if (db) {
    const doc = await db.collection('telegram_web_codes').doc(cleanCode).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (new Date(data.expiresAt).getTime() < Date.now()) {
      await doc.ref.delete();
      return 'EXPIRED';
    }
    await doc.ref.delete();
    const userDoc = await db.collection('users').doc(data.uid).get();
    const uData = userDoc.data() || {};
    return {
      uid: data.uid,
      name: uData.name || 'Telegram User',
      email: uData.email || `${data.uid}@telegram.pocketplan`,
      telegramChatId: uData.telegramChatId || null
    };
  }

  const entry = demoWebCodes.get(cleanCode);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    demoWebCodes.delete(cleanCode);
    return 'EXPIRED';
  }
  demoWebCodes.delete(cleanCode);
  return {
    uid: entry.uid,
    name: 'Telegram User',
    email: `${entry.uid}@telegram.pocketplan`,
    telegramChatId: null
  };
}

