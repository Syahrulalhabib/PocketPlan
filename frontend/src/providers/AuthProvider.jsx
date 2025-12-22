import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  firebaseEnabled,
  getAuthClient,
  googleProvider,
  signInEmail,
  signInWithGoogle,
  signOutUser,
  signUpEmail,
  watchAuth,
  updateProfileName,
  updateProfileData,
  resetPasswordEmail,
  sendVerificationEmail
} from '../services/firebase';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseEnabled) {
      setLoading(false);
      return;
    }
    const unsubscribe = watchAuth((fbUser) => {
      if (fbUser && !fbUser.emailVerified) {
        signOutUser();
        setUser(null);
        setLoading(false);
        return;
      }
      if (fbUser) {
        setUser({
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email || 'User',
          email: fbUser.email || 'user@pocketplan.app',
          photoURL: fbUser.photoURL || undefined
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => (unsubscribe ? unsubscribe() : undefined);
  }, []);

  const login = async (email, password) => {
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
        name: 'PocketPlan User',
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

  const logout = async () => {
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
      login,
      register,
      googleLogin,
      logout,
      updateProfileInfo,
      resetPassword,
      resendVerification
    }),
    [user, loading, updateProfileInfo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
