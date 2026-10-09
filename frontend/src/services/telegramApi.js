import { getAuthToken } from './firebase.js';

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
    if (!res.ok) throw new Error('Failed to fetch telegram status');
    return await res.json();
  } catch (err) {
    return { linked: false, error: err.message };
  }
}

export async function requestLinkCode() {
  const headers = await getHeaders();
  const res = await fetch('/api/telegram/link-code', {
    method: 'POST',
    headers
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to generate link code');
  }
  return await res.json();
}

export async function requestUnlink() {
  const headers = await getHeaders();
  const res = await fetch('/api/telegram/unlink', {
    method: 'POST',
    headers
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'Failed to unlink');
  }
  return await res.json();
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

