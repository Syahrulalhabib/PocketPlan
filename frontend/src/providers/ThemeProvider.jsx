import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(undefined);
const THEME_KEY = 'pp-theme';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const isDark = theme === 'dark';
    const root = document.documentElement;
    root.classList.toggle('theme-dark', isDark);
    document.body?.classList.toggle('theme-dark', isDark);
    if (isDark) {
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
