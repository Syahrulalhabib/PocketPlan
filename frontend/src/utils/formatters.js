/**
 * Formatting and manipulation utilities for PocketPlan
 */

export const formatRupiah = (value) => {
  const num = Number(value) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
};

export const formatDisplayNumber = (value) => {
  if (value === '' || value === null || value === undefined) return '';
  return Number(value).toLocaleString('id-ID');
};

export const parseFormattedNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits === '' ? '' : Number(digits);
};

export const capitalizeWords = (str = '') => {
  if (!str || typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s\-_/])(\p{L})/gu, (_, sep, char) => sep + char.toUpperCase());
};

export const adjustMoney = (current, delta) => {
  return Math.max(0, (Number(current) || 0) + delta);
};

export const evaluatePasswordStrength = (password = '') => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8 && /[0-9]/.test(password)) score++;
  if (/[A-Z]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
  if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b' };
  return { score: 3, label: 'Strong', color: '#10b981' };
};
