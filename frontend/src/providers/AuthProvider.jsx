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
  sendVerificationEmail
} from '../services/firebase';
import { telegramWebLogin } from '../services/telegramApi';

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
      const isPasswordUser = fbUser?.providerData?.some((p) => p.providerId === 'password');
      if (fbUser && isPasswordUser && !fbUser.emailVerified) {
        signOutUser();
        setUser(null);
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
        const resolved = {
          id: fbUser.uid,
          name: fbUser.displayName || extraTg?.name || fbUser.email || (isTg ? 'Telegram User' : 'User'),
          email: fbUser.email || extraTg?.email || (isTg ? `${fbUser.uid}@telegram.pocketplan` : 'user@pocketplan.app'),
          photoURL: fbUser.photoURL || extraTg?.photoURL || undefined,
          isTelegramUser: isTg,
          telegramChatId: extraTg?.telegramChatId || (isTg && fbUser.uid.startsWith('tg_') ? fbUser.uid.replace('tg_', '') : undefined),
          telegramUsername: extraTg?.telegramUsername || undefined
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
      if (!credentials.user.emailVerified) {
        await signOutUser();
        throw new Error('Email not verified. Please check your inbox.');
      }
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
        await sendVerificationEmail(credentials.user);
      } catch (err) {
        await signOutUser();
        setUser(null);
        throw err;
      }
      await signOutUser();
      setUser(null);
      return { needsVerification: true };
    } else {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setUser({
        id: 'demo-user',
        name,
        email
      });
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
    const resolvedUser = {
      id: tgUser.uid || tgUser.id,
      name: tgUser.name || 'Telegram User',
      email: tgUser.email || `${tgUser.uid || 'user'}@telegram.pocketplan`,
      photoURL: tgUser.photoURL || undefined,
      telegramChatId: chatId,
      telegramUsername: tgUser.telegramUsername || undefined,
      isTelegramUser: true
    };
    setUser(resolvedUser);
    localStorage.setItem('pocketplan_tg_user', JSON.stringify(resolvedUser));
    return resolvedUser;
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
    if (!email || !password) throw new Error('Email and password are required');
    if (firebaseEnabled) {
      await signInEmail(email, password);
      await sendVerificationEmail();
      await signOutUser();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
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
      resendVerification
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
