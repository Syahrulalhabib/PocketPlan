const demoCodes = new Map();
const demoLinks = new Map();
const demoMigrated = new Map();
const _uidCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateUidCache(chatId) {
  if (chatId) _uidCache.delete(String(chatId));
  else _uidCache.clear();
}

export async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  if (!botToken || !chatId) return null;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...options })
    });
    const data = await res.json();
    if (!data.ok && typeof data.description === 'string' && data.description.includes("can't parse entities")) {
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...options, parse_mode: undefined })
      });
      return await retryRes.json();
    }
    return data;
  } catch (err) {
    console.error('Telegram sendMessage error:', err.message);
    return null;
  }
}

export async function deleteTelegramMessage(botToken, chatId, messageId) {
  if (!botToken || !chatId || !messageId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
    const data = await res.json();
    return data?.ok || false;
  } catch (err) {
    console.error('Telegram deleteMessage error:', err.message);
    return false;
  }
}

export async function generateLinkCode(uid, db, botUsername = '') {
  const strUid = String(uid);

  // Strict 1:1 check: akun yang sudah terhubung tidak boleh generate link code
  if (db) {
    const userDoc = await db.collection('users').doc(strUid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    if (userData?.linkedWebUid || userData?.linkedTelegramUid || userData?.telegramChatId) {
      throw new Error('Akun Telegram ini sudah terhubung ke akun web. Satu akun Telegram hanya bisa terhubung ke satu akun web.');
    }
    const linkSnap = await db.collection('telegram_links').where('uid', '==', strUid).limit(1).get();
    if (!linkSnap.empty) {
      throw new Error('Akun Telegram ini sudah terhubung ke akun web. Satu akun Telegram hanya bisa terhubung ke satu akun web.');
    }
    if (strUid.startsWith('tg_')) {
      const cId = strUid.replace('tg_', '');
      const tgLinkSnap = await db.collection('telegram_links').doc(cId).get();
      if (tgLinkSnap.exists && tgLinkSnap.data()?.uid && tgLinkSnap.data().uid !== strUid) {
        throw new Error('Akun Telegram ini sudah terhubung ke akun web. Satu akun Telegram hanya bisa terhubung ke satu akun web.');
      }
    }
  } else {
    for (const [chatId, link] of demoLinks.entries()) {
      if (link.uid === strUid) {
        throw new Error('Akun Telegram ini sudah terhubung ke akun web. Satu akun Telegram hanya bisa terhubung ke satu akun web.');
      }
      if (strUid === `tg_${chatId}` && link.uid && link.uid !== strUid) {
        throw new Error('Akun Telegram ini sudah terhubung ke akun web. Satu akun Telegram hanya bisa terhubung ke satu akun web.');
      }
    }
  }

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

export async function migrateTelegramDataToUser(chatId, targetUid, db) {
  if (!chatId || !targetUid) return;
  const sourceUid = `tg_${String(chatId)}`;
  if (sourceUid === targetUid) return;

  if (db) {
    const targetUserRef = db.collection('users').doc(targetUid);
    const targetSnap = await targetUserRef.get();
    if (targetSnap.exists) {
      const targetData = targetSnap.data() || {};
      if (targetData.telegramChatId && String(targetData.telegramChatId) !== String(chatId)) {
        throw new Error('Akun web ini sudah terhubung ke akun Telegram lain.');
      }
      if (targetData.linkedTelegramUid && targetData.linkedTelegramUid !== sourceUid) {
        throw new Error('Akun web ini sudah terhubung ke akun Telegram lain.');
      }
    }

    const sourceUserRef = db.collection('users').doc(sourceUid);
    const sourceSnap = await sourceUserRef.get();
    if (sourceSnap.exists) {
      const sourceData = sourceSnap.data() || {};
      if (sourceData.migratedTo && sourceData.migratedTo !== targetUid) {
        throw new Error('Akun Telegram ini sudah pernah di-migrate.');
      }
    }

    try {
      if (sourceSnap.exists) {
        const sourceData = sourceSnap.data() || {};
        if (sourceData.baseBalance && Number(sourceData.baseBalance) > 0) {
          const targetBase = Number(targetSnap.data()?.baseBalance || 0);
          if (targetBase === 0) {
            await targetUserRef.set({ baseBalance: Number(sourceData.baseBalance) }, { merge: true });
          }
        }
      }

      const txSnap = await db.collection('users').doc(sourceUid).collection('transactions').get();
      if (!txSnap.empty) {
        const batch = db.batch();
        for (const d of txSnap.docs) {
          const newRef = db.collection('users').doc(targetUid).collection('transactions').doc(d.id);
          batch.set(newRef, d.data(), { merge: true });
          batch.delete(d.ref);
        }
        await batch.commit();
      }

      const goalsSnap = await db.collection('users').doc(sourceUid).collection('goals').get();
      if (!goalsSnap.empty) {
        const batch = db.batch();
        for (const d of goalsSnap.docs) {
          const newRef = db.collection('users').doc(targetUid).collection('goals').doc(d.id);
          batch.set(newRef, d.data(), { merge: true });
          batch.delete(d.ref);
        }
        await batch.commit();
      }
      const budgetSnap = await db.collection('users').doc(sourceUid).collection('budgets').get();
      if (!budgetSnap.empty) {
        const batch = db.batch();
        for (const d of budgetSnap.docs) {
          const newRef = db.collection('users').doc(targetUid).collection('budgets').doc(d.id);
          batch.set(newRef, d.data(), { merge: true });
          batch.delete(d.ref);
        }
        await batch.commit();
      }

      await Promise.all([
        targetUserRef.set({
          linkedTelegramUid: sourceUid,
          telegramChatId: String(chatId)
        }, { merge: true }),
        sourceUserRef.set({
          linkedWebUid: targetUid,
          migratedTo: targetUid,
          migratedAt: new Date().toISOString()
        }, { merge: true })
      ]);
    } catch (err) {
      if (err?.message?.includes('terhubung') || err?.message?.includes('migrate')) throw err;
      console.error('Failed to migrate Telegram data to linked user:', err);
    }
  } else {
    // Demo in-memory mode
    for (const [cId, link] of demoLinks.entries()) {
      if (link.uid === targetUid && String(cId) !== String(chatId)) {
        throw new Error('Akun web ini sudah terhubung ke akun Telegram lain.');
      }
    }
    if (demoMigrated.has(sourceUid) && demoMigrated.get(sourceUid) !== targetUid) {
      throw new Error('Akun Telegram ini sudah pernah di-migrate.');
    }
    demoMigrated.set(sourceUid, targetUid);
    const existing = demoLinks.get(String(chatId));
    if (existing) {
      existing.linkedWebUid = targetUid;
      existing.migratedTo = targetUid;
    }
  }
}

export async function getLinkStatus(uid, db) {
  if (db) {
    const userDoc = await db.collection('users').doc(uid).get();
    const data = userDoc.data();
    if (!data) return { linked: false, dataLinked: false, fullyLinked: false };

    const chatId = data.telegramChatId;
    const isTg = Boolean(data.isTelegramUser || uid.startsWith('tg_'));
    const isFullyLinked = isTg
      ? Boolean(data.linkCompletedAt || (data.emailVerified && data.webPasswordSet))
      : Boolean(chatId || data.linkedTelegramUid);
    const isDataLinked = Boolean(chatId || data.linkedTelegramUid);

    if (chatId) {
      migrateTelegramDataToUser(chatId, uid, db).catch(() => {});
      return {
        linked: isFullyLinked,
        dataLinked: isDataLinked,
        fullyLinked: isFullyLinked,
        linkCompletedAt: data.linkCompletedAt || null,
        chatId: data.telegramChatId,
        username: data.telegramUsername || null
      };
    }
    if (data.telegramChatId === null) {
      return { linked: false, dataLinked: false, fullyLinked: false };
    }
    const linkSnap = await db.collection('telegram_links').where('uid', '==', uid).limit(1).get();
    if (!linkSnap.empty) {
      const linkDoc = linkSnap.docs[0];
      const linkChatId = linkDoc.id;
      migrateTelegramDataToUser(linkChatId, uid, db).catch(() => {});
      return {
        linked: isFullyLinked,
        dataLinked: true,
        fullyLinked: isFullyLinked,
        linkCompletedAt: data.linkCompletedAt || linkDoc.data()?.linkCompletedAt || null,
        chatId: linkChatId,
        username: linkDoc.data()?.username || null
      };
    }
    return { linked: false, dataLinked: false, fullyLinked: false };
  }

  // Demo in-memory mode
  for (const [chatId, link] of demoLinks.entries()) {
    if (link.uid === uid) {
      const isTg = Boolean(uid.startsWith('tg_') || link.isTelegramUser);
      const isFullyLinked = isTg
        ? Boolean(link.linkCompletedAt || (link.emailVerified && link.webPasswordSet))
        : true;
      return {
        linked: isFullyLinked,
        dataLinked: true,
        fullyLinked: isFullyLinked,
        linkCompletedAt: link.linkCompletedAt || null,
        chatId,
        username: link.username || null
      };
    }
  }
  return { linked: false, dataLinked: false, fullyLinked: false };
}

export async function unlinkAccount(uid, db) {
  const strIdentifier = String(uid);

  if (db) {
    let webUid = null;
    let chatId = null;

    if (strIdentifier.startsWith('tg_') || !isNaN(Number(strIdentifier))) {
      chatId = strIdentifier.replace('tg_', '');
      const [linkSnap, tgUserSnap] = await Promise.all([
        db.collection('telegram_links').doc(chatId).get(),
        db.collection('users').doc(`tg_${chatId}`).get()
      ]);
      webUid = linkSnap.data()?.uid || tgUserSnap.data()?.linkedWebUid || null;
      if (webUid === `tg_${chatId}`) webUid = null;
    } else {
      webUid = strIdentifier;
      const userRef = db.collection('users').doc(webUid);
      const userSnap = await userRef.get();
      const uData = userSnap.data();
      chatId = uData?.telegramChatId || uData?.linkedTelegramUid?.replace('tg_', '') || null;
      if (!chatId) {
        const linkSnap = await db.collection('telegram_links').where('uid', '==', webUid).limit(1).get();
        if (!linkSnap.empty) chatId = linkSnap.docs[0].id;
      }
    }

    if (chatId) {
      invalidateUidCache(chatId);
      await db.collection('telegram_links').doc(String(chatId)).delete().catch(() => {});
      await db.collection('users').doc(`tg_${chatId}`).set({
        linkedWebUid: null,
        migratedTo: null,
        migratedAt: null
      }, { merge: true }).catch(() => {});
    }

    if (webUid) {
      await db.collection('users').doc(webUid).set({
        telegramChatId: null,
        telegramUsername: null,
        linkedTelegramUid: null,
        linkCompletedAt: null
      }, { merge: true }).catch(() => {});
    }
  } else {
    // Demo in-memory mode
    let targetChatId = null;
    let targetUid = null;

    const rawChatId = strIdentifier.replace('tg_', '');
    if (demoLinks.has(rawChatId)) {
      targetChatId = rawChatId;
      targetUid = demoLinks.get(rawChatId).uid;
    } else {
      for (const [cId, link] of demoLinks.entries()) {
        if (link.uid === strIdentifier) {
          targetChatId = cId;
          targetUid = strIdentifier;
          break;
        }
      }
    }

    if (targetChatId) {
      invalidateUidCache(targetChatId);
      demoLinks.delete(targetChatId);
      demoMigrated.delete(`tg_${targetChatId}`);
    }
    if (targetUid) {
      demoMigrated.delete(targetUid);
      for (const [cId, link] of demoLinks.entries()) {
        if (link.uid === targetUid) {
          invalidateUidCache(cId);
          demoLinks.delete(cId);
          demoMigrated.delete(`tg_${cId}`);
        }
      }
    }
    demoMigrated.delete(strIdentifier);
    if (strIdentifier.startsWith('tg_')) demoMigrated.delete(strIdentifier);
  }

  return { success: true };
}

export async function completeTelegramLink(uid, db, botToken = process.env.TELEGRAM_BOT_TOKEN) {
  const now = new Date().toISOString();
  let targetChatId = null;

  if (db) {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    targetChatId = data.telegramChatId || (uid.startsWith('tg_') ? uid.replace('tg_', '') : null);

    await userRef.set({
      emailVerified: true,
      webPasswordSet: true,
      linkCompletedAt: now
    }, { merge: true });

    if (targetChatId) {
      await db.collection('telegram_links').doc(String(targetChatId)).set({
        linkCompletedAt: now
      }, { merge: true }).catch(() => {});
    }
  } else {
    const strChatId = uid.startsWith('tg_') ? uid.replace('tg_', '') : null;
    for (const [chatId, link] of demoLinks.entries()) {
      if (link.uid === uid || (strChatId && chatId === strChatId)) {
        targetChatId = chatId;
        link.emailVerified = true;
        link.webPasswordSet = true;
        link.linkCompletedAt = now;
        break;
      }
    }
    if (!targetChatId && strChatId) {
      targetChatId = strChatId;
      demoLinks.set(strChatId, {
        uid,
        emailVerified: true,
        webPasswordSet: true,
        linkCompletedAt: now
      });
    }
  }

  // Notif "🎉 Akun berhasil terhubung!" HANYA dikirim setelah emailVerified === true DAN webPasswordSet === true
  if (botToken && targetChatId) {
    await sendTelegramMessage(
      botToken,
      targetChatId,
      '🎉 *Akun berhasil terhubung!*\n\n' +
      'Akun Telegram Anda kini telah aktif dan tersambung penuh ke website Pocketplan.\n\n' +
      'Catatan keuangan dan target impian Anda kini tersinkron secara real-time! 🌐\n\n' +
      'Mau mulai catat? Coba ketik: `kopi 15k`'
    ).catch(() => {});
  }

  return { success: true, linkCompletedAt: now, chatId: targetChatId };
}

export async function findLinkedUid(chatId, db) {
  const strId = String(chatId);
  const now = Date.now();
  const cached = _uidCache.get(strId);
  if (cached && cached.exp > now) {
    return cached.uid;
  }

  let resolvedUid = null;
  if (db) {
    const snap = await db.collection('telegram_links').doc(strId).get();
    resolvedUid = snap.exists ? snap.data().uid : null;
  } else {
    const found = demoLinks.get(strId);
    resolvedUid = found ? found.uid : null;
  }

  _uidCache.set(strId, { uid: resolvedUid, exp: now + CACHE_TTL_MS });
  return resolvedUid;
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

    // Strict 1:1 check: Is Telegram account already linked to another web account?
    const tgLinkSnap = await db.collection('telegram_links').doc(strId).get();
    if (tgLinkSnap.exists) {
      const lData = tgLinkSnap.data();
      if (lData?.uid && lData.uid !== `tg_${strId}` && lData.uid !== uid) {
        return 'ALREADY_LINKED_TG';
      }
    }
    const tgUserSnap = await db.collection('users').doc(`tg_${strId}`).get();
    if (tgUserSnap.exists) {
      const tgData = tgUserSnap.data();
      if (tgData?.linkedWebUid && tgData.linkedWebUid !== uid) {
        return 'ALREADY_LINKED_TG';
      }
    }

    // Strict 1:1 check: Is target web account already linked to another Telegram account?
    const targetUserSnap = await db.collection('users').doc(uid).get();
    if (targetUserSnap.exists) {
      const tData = targetUserSnap.data();
      if ((tData?.telegramChatId && String(tData.telegramChatId) !== strId) ||
          (tData?.linkedTelegramUid && tData.linkedTelegramUid !== `tg_${strId}`)) {
        return 'ALREADY_LINKED_WEB';
      }
    }

    const completedAt = !uid.startsWith('tg_') ? new Date().toISOString() : null;

    await Promise.all([
      db.collection('telegram_links').doc(strId).set({
        uid,
        linkedAt: new Date().toISOString(),
        username: userFrom.username || null,
        firstName: userFrom.first_name || null,
        ...(completedAt && { linkCompletedAt: completedAt })
      }),
      db.collection('users').doc(uid).set(
        {
          telegramChatId: strId,
          telegramUsername: userFrom.username || null,
          linkedTelegramUid: `tg_${strId}`,
          ...(completedAt && { linkCompletedAt: completedAt })
        },
        { merge: true }
      ),
      db.collection('users').doc(`tg_${strId}`).set(
        {
          linkedWebUid: uid,
          telegramChatId: strId,
          telegramUsername: userFrom.username || null
        },
        { merge: true }
      )
    ]);

    _uidCache.set(strId, { uid, exp: Date.now() + CACHE_TTL_MS });
    migrateTelegramDataToUser(strId, uid, db).catch((err) => console.error('Migration error:', err));
    return uid;
  }

  const entry = demoCodes.get(cleanCode);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    demoCodes.delete(cleanCode);
    return 'EXPIRED';
  }
  const uid = entry.uid;

  // Strict 1:1 check: Is Telegram account already linked to another web account?
  const existingLink = demoLinks.get(strId);
  if (existingLink && existingLink.uid && existingLink.uid !== `tg_${strId}` && existingLink.uid !== uid) {
    return 'ALREADY_LINKED_TG';
  }

  // Strict 1:1 check: Is target web account already linked to another Telegram account?
  for (const [cId, link] of demoLinks.entries()) {
    if (link.uid === uid && String(cId) !== strId) {
      return 'ALREADY_LINKED_WEB';
    }
  }

  demoCodes.delete(cleanCode);
  const completedAt = !uid.startsWith('tg_') ? new Date().toISOString() : null;
  demoLinks.set(strId, {
    uid,
    linkedAt: Date.now(),
    username: userFrom.username || null,
    linkedTelegramUid: `tg_${strId}`,
    linkedWebUid: uid,
    ...(completedAt && { linkCompletedAt: completedAt })
  });
  _uidCache.set(strId, { uid, exp: Date.now() + CACHE_TTL_MS });
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

export async function editTelegramMessage(botToken, chatId, messageId, text, options = {}) {
  if (!botToken || !chatId || !messageId) return null;
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown', ...options })
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram editMessageText error:', err.message);
    return null;
  }
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

  _uidCache.set(strId, { uid: newUid, exp: Date.now() + CACHE_TTL_MS });
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

export async function attachMessageToWebCode(code, messageId, chatId, db) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (db) {
    await db.collection('telegram_web_codes').doc(cleanCode).set(
      { messageId: Number(messageId), chatId: String(chatId) },
      { merge: true }
    );
  } else {
    const entry = demoWebCodes.get(cleanCode);
    if (entry) {
      entry.messageId = Number(messageId);
      entry.chatId = String(chatId);
    }
  }
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
    const chatId = uData.telegramChatId || data.chatId || (data.uid.startsWith('tg_') ? data.uid.replace('tg_', '') : null);
    return {
      uid: data.uid,
      name: uData.name || 'Telegram User',
      email: uData.email || `${data.uid}@telegram.pocketplan`,
      telegramChatId: chatId,
      telegramUsername: uData.telegramUsername || null,
      messageId: data.messageId || null
    };
  }

  const entry = demoWebCodes.get(cleanCode);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    demoWebCodes.delete(cleanCode);
    return 'EXPIRED';
  }
  demoWebCodes.delete(cleanCode);
  let demoChatId = entry.uid.startsWith('tg_') ? entry.uid.replace('tg_', '') : null;
  let demoUsername = null;
  for (const [cId, link] of demoLinks.entries()) {
    if (link.uid === entry.uid) {
      demoChatId = cId;
      demoUsername = link.username || null;
      break;
    }
  }
  return {
    uid: entry.uid,
    name: demoUsername ? `@${demoUsername}` : 'Telegram User',
    email: `${entry.uid}@telegram.pocketplan`,
    telegramChatId: demoChatId || entry.chatId || null,
    telegramUsername: demoUsername,
    messageId: entry.messageId || null
  };
}

export async function cancelWebLoginCode(code, db) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return { success: false };
  if (db) {
    const doc = await db.collection('telegram_web_codes').doc(cleanCode).get();
    if (doc.exists) {
      const data = doc.data();
      await doc.ref.delete();
      return { success: true, messageId: data?.messageId || null, chatId: data?.chatId || null };
    }
    return { success: false };
  }
  const entry = demoWebCodes.get(cleanCode);
  if (entry) {
    demoWebCodes.delete(cleanCode);
    return { success: true, messageId: entry.messageId || null, chatId: entry.chatId || null };
  }
  return { success: false };
}

export async function cancelLinkCode(uid, db) {
  if (!uid) return { success: false };
  if (db) {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
      const data = snap.data();
      const code = data?.telegramLinkCode;
      await userRef.update({
        telegramLinkCode: null,
        telegramCodeExpiresAt: null
      });
      if (code) {
        await db.collection('telegram_codes').doc(code).delete().catch(() => {});
      }
      return { success: true };
    }
    return { success: false };
  }
  for (const [code, val] of demoCodes.entries()) {
    if (val.uid === uid) demoCodes.delete(code);
  }
  return { success: true };
}
export const DEFAULT_BOT_COMMANDS = [
  { command: 'start', description: 'Mulai & sapa Pocky 👋' },
  { command: 'catat', description: 'Catat pengeluaran baru 💸' },
  { command: 'masuk', description: 'Catat pemasukan uang 💰' },
  { command: 'saldo', description: 'Cek total saldo dompet 📊' },
  { command: 'riwayat', description: '5 transaksi terakhir 📜' },
  { command: 'goals', description: 'Cek target & progres celengan 🎯' },
  { command: 'streak', description: 'Cek streak & kartu achievement 🔥' },

  { command: 'pengingat', description: 'Atur pengingat harian otomatis ⏰' },
  { command: 'koreksi', description: 'Koreksi nominal struk/catatan ✏️' },
  { command: 'budget', description: 'Atur budget belanja custom per item 💰' },
  { command: 'ajak', description: 'Ajak teman pakai Pocky 🎉' },
  { command: 'batal', description: 'Batalkan transaksi terakhir 🗑️' },
  { command: 'help', description: 'Panduan lengkap Pocky 📖' },
  { command: 'web', description: 'Dapatkan kode login website 🔗' }
];

export async function syncBotCommands(botToken) {
  if (!botToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: DEFAULT_BOT_COMMANDS })
    });
    const data = await res.json();
    if (data?.ok) {
      console.log('✅ Bot commands synced:', DEFAULT_BOT_COMMANDS.length, 'commands');
    } else {
      console.error('❌ Failed to sync bot commands:', data);
    }
    return data;
  } catch (err) {
    console.error('syncBotCommands error:', err.message);
    return null;
  }
}



