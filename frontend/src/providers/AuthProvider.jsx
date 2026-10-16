import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { demoUser } from '../demo/demoData.js';
import {
  firebaseEnabled,
  signInEmail,
  signInWithGoogle,
  signOutUser,
  signUpEmail,
  signInWithToken,
  watchAuth,
  updateProfileName,
  updateProfileData,
  resetPasswordEmail,
  sendVerificationEmail,
  updateUserEmail,
  updateUserPassword,
  reloadAuthUser,
  verifyActionCode,
  inspectActionCode
} from '../services/firebase';
import { telegramWebLogin } from '../services/telegramApi';

import { isDummyEmail } from '../utils/formatters.js';
export { isDummyEmail };

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [isDemo, setIsDemo] = useState(() => {
    try {
      return sessionStorage.getItem('pocketplan_demo_mode') === '1';
    } catch {
      return false;
    }
  });
  const [user, setUser] = useState(() => (sessionStorage.getItem('pocketplan_demo_mode') === '1' ? demoUser : null));
  const [loading, setLoading] = useState(true);

  const startDemo = useCallback(() => {
    try {
      sessionStorage.setItem('pocketplan_demo_mode', '1');
    } catch {}
    setIsDemo(true);
    setUser(demoUser);
    setLoading(false);
  }, []);

  const exitDemo = useCallback(() => {
    try {
      sessionStorage.removeItem('pocketplan_demo_mode');
    } catch {}
    setIsDemo(false);
    setUser(null);
  }, []);

  useEffect(() => {
    if (isDemo) {
      setUser(demoUser);
      setLoading(false);
      return;
    }

    if (!firebaseEnabled) {
      const savedTg = localStorage.getItem('pocketplan_tg_user');
      if (savedTg) {
        try { setUser(JSON.parse(savedTg)); } catch {}
      }
      setLoading(false);
      return;
    }
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const unsubscribe = watchAuth((fbUser) => {
      clearTimeout(fallbackTimer);
      if (sessionStorage.getItem('pocketplan_demo_mode') === '1') {
        setUser(demoUser);
        setLoading(false);
        return;
      }
      if (fbUser) {
        const savedTg = localStorage.getItem('pocketplan_tg_user');
        let extraTg = null;
        if (savedTg) {
          try {
            const parsed = JSON.parse(savedTg);
            if (parsed.id === fbUser.uid || parsed.telegramChatId) extraTg = parsed;
          } catch {}
        }
        const isTg = Boolean(extraTg?.isTelegramUser || fbUser.uid.startsWith('tg_'));
        const resolvedEmail = fbUser.email || extraTg?.email || (isTg ? `${fbUser.uid}@telegram.pocketplan` : 'user@pocketplan.app');
        const emailVerified = Boolean(fbUser.emailVerified || extraTg?.emailVerified);
        const webPasswordSet = Boolean(extraTg?.webPasswordSet);
        const needsVerification = isTg ? (isDummyEmail(resolvedEmail) || !emailVerified || !webPasswordSet) : false;
        const resolved = {
          id: fbUser.uid,
          name: fbUser.displayName || extraTg?.name || fbUser.email || (isTg ? 'Telegram User' : 'User'),
          email: resolvedEmail,
          photoURL: fbUser.photoURL || extraTg?.photoURL || undefined,
          isTelegramUser: isTg,
          telegramChatId: extraTg?.telegramChatId || (isTg && fbUser.uid.startsWith('tg_') ? fbUser.uid.replace('tg_', '') : undefined),
          telegramUsername: extraTg?.telegramUsername || undefined,
          emailVerified,
          webPasswordSet,
          needsVerification
        };
        setUser(resolved);
        if (isTg) {
          localStorage.setItem('pocketplan_tg_user', JSON.stringify(resolved));
        }
      } else {
        const savedTg = localStorage.getItem('pocketplan_tg_user');
        if (savedTg) {
          try { setUser(JSON.parse(savedTg)); } catch { setUser(null); }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(fallbackTimer);
      if (unsubscribe) unsubscribe();
    };
  }, [isDemo]);

  const login = async (email, password) => {
    try { sessionStorage.removeItem('pocketplan_demo_mode'); } catch {}
    setIsDemo(false);
    if (firebaseEnabled) {
      const credentials = await signInEmail(email, password);
      setUser({
        id: credentials.user.uid,
        name: credentials.user.displayName || credentials.user.email || 'User',
        email: credentials.user.email || email,
        photoURL: credentials.user.photoURL || undefined
      });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setUser({
        id: 'demo-user',
        name: 'Pocketplan User',
        email
      });
    }
  };

  const register = async (name, email, password) => {
    if (firebaseEnabled) {
      const credentials = await signUpEmail(email, password);
      await updateProfileName(name);
      try {
        await sendVerificationEmail(credentials.user, {
          url: `${window.location.origin}/verification?source=register`,
          handleCodeInApp: true
        });
      } catch (err) {
        console.warn('sendVerificationEmail notice:', err?.message);
      }
      const resolvedUser = {
        id: credentials.user.uid,
        name,
        email,
        emailVerified: false,
        webPasswordSet: true,
        needsVerification: true,
        isTelegramUser: false
      };
      setUser(resolvedUser);
      return { needsVerification: true, user: resolvedUser };
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const demoRegUser = {
        id: 'demo-user',
        name,
        email,
        emailVerified: false,
        webPasswordSet: true,
        needsVerification: true,
        isTelegramUser: false
      };
      setUser(demoRegUser);
      return { needsVerification: true, user: demoRegUser };
    }
  };

  const googleLogin = async () => {
    if (firebaseEnabled) {
      const credentials = await signInWithGoogle();
      setUser({
        id: credentials.user.uid,
        name: credentials.user.displayName || 'User',
        email: credentials.user.email || 'user@pocketplan.app',
        photoURL: credentials.user.photoURL || undefined
      });
    } else {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setUser({
        id: 'demo-google',
        name: 'Demo Google User',
        email: 'user@pocketplan.app'
      });
    }
  };

  const loginWithTelegram = async (code) => {
    const tgUser = await telegramWebLogin(code);
    if (tgUser.customToken && firebaseEnabled) {
      await signInWithToken(tgUser.customToken);
    }
    const chatId = tgUser.telegramChatId || (tgUser.uid?.startsWith('tg_') ? tgUser.uid.replace('tg_', '') : undefined);
    const resolvedEmail = tgUser.email || `${tgUser.uid || 'user'}@telegram.pocketplan`;
    const emailVerified = Boolean(tgUser.emailVerified);
    const webPasswordSet = Boolean(tgUser.webPasswordSet);
    const needsVerification = isDummyEmail(resolvedEmail) || !emailVerified || !webPasswordSet;
    const resolvedUser = {
      id: tgUser.uid || tgUser.id,
      name: tgUser.name || 'Telegram User',
      email: resolvedEmail,
      photoURL: tgUser.photoURL || undefined,
      telegramChatId: chatId,
      telegramUsername: tgUser.telegramUsername || undefined,
      isTelegramUser: true,
      emailVerified,
      webPasswordSet,
      needsVerification
    };
    setUser(resolvedUser);
    localStorage.setItem('pocketplan_tg_user', JSON.stringify(resolvedUser));
    return resolvedUser;
  };

  const changeEmailAndSendVerification = async (newEmail) => {
    if (!newEmail || !newEmail.includes('@')) throw new Error('Email tidak valid.');
    if (firebaseEnabled) {
      try {
        await updateUserEmail(newEmail);
      } catch (e) {
        console.warn('updateUserEmail notice:', e?.message);
      }
      await sendVerificationEmail();
    }
    const updated = {
      ...user,
      email: newEmail,
      emailVerified: false,
      needsVerification: true
    };
    setUser(updated);
    if (user?.isTelegramUser) {
      localStorage.setItem('pocketplan_tg_user', JSON.stringify(updated));
    }
    return updated;
  };

  const checkEmailVerified = async () => {
    if (firebaseEnabled) {
      const refreshed = await reloadAuthUser();
      if (refreshed?.emailVerified) {
        const isTg = Boolean(user?.isTelegramUser);
        const webPwd = Boolean(user?.webPasswordSet);
        const updated = {
          ...user,
          emailVerified: true,
          needsVerification: isTg && !webPwd
        };
        setUser(updated);
        if (isTg) localStorage.setItem('pocketplan_tg_user', JSON.stringify(updated));
        return true;
      }
      return false;
    }
    const isTg = Boolean(user?.isTelegramUser);
    const webPwd = Boolean(user?.webPasswordSet);
    const updated = {
      ...user,
      emailVerified: true,
      needsVerification: isTg && !webPwd
    };
    setUser(updated);
    if (isTg) localStorage.setItem('pocketplan_tg_user', JSON.stringify(updated));
    return true;
  };

  const verifyCode = async (oobCode) => {
    if (!oobCode) throw new Error('Kode verifikasi tidak ditemukan.');
    if (firebaseEnabled) {
      await verifyActionCode(oobCode);
      const refreshed = await reloadAuthUser();
      if (user) {
        const isTg = Boolean(user.isTelegramUser);
        const webPwd = Boolean(user.webPasswordSet);
        const updated = {
          ...user,
          emailVerified: true,
          needsVerification: isTg && !webPwd
        };
        setUser(updated);
        if (isTg) localStorage.setItem('pocketplan_tg_user', JSON.stringify(updated));
        return { ok: true, user: updated, isTelegramUser: isTg, webPasswordSet: webPwd };
      }
      return { ok: true, refreshed };
    } else {
      if (oobCode === 'expired' || oobCode.includes('expired')) {
        const err = new Error('Tautan verifikasi kedaluwarsa.');
        err.code = 'auth/expired-action-code';
        throw err;
      }
      if (oobCode === 'invalid' || oobCode.includes('invalid')) {
        const err = new Error('Tautan verifikasi tidak valid.');
        err.code = 'auth/invalid-action-code';
        throw err;
      }
      await new Promise((r) => setTimeout(r, 300));
      if (user) {
        const isTg = Boolean(user.isTelegramUser);
        const webPwd = Boolean(user.webPasswordSet);
        const updated = {
          ...user,
          emailVerified: true,
          needsVerification: isTg && !webPwd
        };
        setUser(updated);
        return { ok: true, user: updated, isTelegramUser: isTg, webPasswordSet: webPwd };
      }
      return { ok: true };
    }
  };

  const setupWebPassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) throw new Error('Password minimal 6 karakter.');
    if (firebaseEnabled) {
      await updateUserPassword(newPassword);
    }
    const updated = {
      ...user,
      emailVerified: true,
      webPasswordSet: true,
      needsVerification: false
    };
    setUser(updated);
    if (user?.isTelegramUser) {
      localStorage.setItem('pocketplan_tg_user', JSON.stringify(updated));
    }
    return updated;
  };

  const logout = async () => {
    localStorage.removeItem('pocketplan_tg_user');
    try { sessionStorage.removeItem('pocketplan_demo_mode'); } catch {}
    setIsDemo(false);
    if (firebaseEnabled) {
      await signOutUser();
    }
    setUser(null);
  };

  const resetPassword = async (email) => {
    if (!email) throw new Error('Email is required');
    if (firebaseEnabled) {
      await resetPasswordEmail(email);
    } else {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  };

  const resendVerification = async (email, password) => {
    if (firebaseEnabled) {
      if (user && !password) {
        await sendVerificationEmail();
        return;
      }
      if (!email) throw new Error('Email diperlukan');
      if (password) {
        await signInEmail(email, password);
        await sendVerificationEmail();
        await signOutUser();
        return;
      }
      throw new Error('Silakan masuk ke akun Anda terlebih dahulu untuk mengirim ulang verifikasi.');
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  const updateProfileInfo = useCallback(
    async (payload) => {
      if (!user) return;
      const nextUser = {
        ...user,
        name: payload?.name || user?.name,
        email: payload?.email || user?.email,
        photoURL: payload?.photoURL || user?.photoURL
      };

      if (firebaseEnabled) {
        await updateProfileData({
          displayName: nextUser.name,
          photoURL: nextUser.photoURL || null
        });
      }
      setUser(nextUser);
      return nextUser;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isDemo,
      startDemo,
      exitDemo,
      login,
      register,
      googleLogin,
      loginWithTelegram,
      logout,
      updateProfileInfo,
      resetPassword,
      resendVerification,
      changeEmailAndSendVerification,
      checkEmailVerified,
      verifyCode,
      setupWebPassword
    }),
    [user, loading, isDemo, startDemo, exitDemo, updateProfileInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
