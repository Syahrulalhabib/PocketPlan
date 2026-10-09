import { useState, useEffect, useCallback, useRef } from 'react';
import { TelegramIcon, CheckIcon } from './Icons.jsx';
import { getTelegramStatus, requestLinkCode, requestUnlink } from '../services/telegramApi.js';
import { getUserDocRef, listenDoc, firebaseEnabled } from '../services/firebase.js';

const formatTimer = (ms) => {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ProfileTelegramTab = ({ user, setStatusMessage }) => {
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState({ linked: false, chatId: null, username: null });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [requestingCode, setRequestingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const timerRef = useRef(null);

  const startTimer = useCallback((expiry) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const exp = typeof expiry === 'number' ? expiry : new Date(expiry).getTime();
    setExpiresAt(exp);
    setRemaining(Math.max(0, exp - Date.now()));
    timerRef.current = setInterval(() => {
      const left = Math.max(0, exp - Date.now());
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setGeneratedCode(null);
        setDeepLink(null);
        setExpiresAt(null);
      }
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getTelegramStatus();
      setLinkInfo(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (firebaseEnabled && user?.id) {
      const ref = getUserDocRef(user.id);
      const unsub = listenDoc(ref, (snap) => {
        const data = snap?.data?.();
        if (data?.telegramChatId) {
          setLinkInfo({
            linked: true,
            chatId: data.telegramChatId,
            username: data.telegramUsername || null
          });
          setGeneratedCode(null);
        } else if (data && data.telegramChatId === null) {
          setLinkInfo({ linked: false, chatId: null, username: null });
        }
      });
      return () => unsub && unsub();
    }
  }, [user, fetchStatus]);

  const handleGenerateCode = async () => {
    try {
      setRequestingCode(true);
      const res = await requestLinkCode();
      setGeneratedCode(res.code);
      setDeepLink(res.deepLink);
      if (res.expiresAt) startTimer(res.expiresAt);
    } catch (err) {
      setStatusMessage?.({ type: 'error', text: err?.message || 'Gagal membuat kode' });
    } finally {
      setRequestingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard?.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    if (!window.confirm('Putuskan hubungan akun Telegram?')) return;
    try {
      setUnlinking(true);
      await requestUnlink();
      setLinkInfo({ linked: false, chatId: null, username: null });
      setGeneratedCode(null);
      setStatusMessage?.({ type: 'success', text: 'Akun Telegram diputuskan.' });
    } catch (err) {
      setStatusMessage?.({ type: 'error', text: err?.message || 'Gagal memutuskan.' });
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return <div className="telegram-tab-loading">Memuat status integrasi...</div>;
  }

  return (
    <div className="profile-telegram-tab">
      <div className="form-section-intro">
        <h3 className="section-title">Integrasi Telegram Bot</h3>
        <p className="section-desc">Catat transaksi langsung dari Telegram. Otomatis sinkron ke akun kamu.</p>
      </div>

      {linkInfo.linked ? (
        <div className="telegram-connected-card">
          <div className="connected-header">
            <span className="connected-badge">● Terhubung Aktif</span>
            <span className="connected-user">{linkInfo.username ? `@${linkInfo.username}` : `ID: ${linkInfo.chatId}`}</span>
          </div>
          <div className="telegram-commands-box">
            <h4>💡 Perintah Bot:</h4>
            <ul>
              <li><code>/catat makan nasi 50k</code> Catat pengeluaran</li>
              <li><code>/masuk gaji 2.5jt</code> Catat pemasukan</li>
              <li><code>kopi susu 25k</code> Catat kilat (keterangan + nominal)</li>
              <li><code>/goal Motor Matic 15jt</code> Buat target impian</li>
              <li><code>/saldo</code> Ringkasan saldo</li>
              <li><code>/riwayat</code> 5 transaksi terakhir</li>
              <li><code>/batal</code> Batalkan catatan terakhir</li>
            </ul>
          </div>
          <button type="button" className="pill btn-danger" onClick={handleUnlink} disabled={unlinking}>
            {unlinking ? 'Memutuskan...' : 'Putuskan Sambungan'}
          </button>
        </div>
      ) : (
        <div className="telegram-unconnected-card">
          <div className="telegram-promo">
            <div className="telegram-icon-hero"><TelegramIcon size={32} /></div>
            <h4>Catat Cepat Kapan Saja via Telegram</h4>
            <p>Hubungkan akun untuk mencatat pengeluaran harian tanpa membuka web.</p>
          </div>
          {!generatedCode ? (
            <button type="button" className="pill btn-primary telegram-connect-btn" onClick={handleGenerateCode} disabled={requestingCode}>
              <TelegramIcon size={18} />
              <span>{requestingCode ? 'Menghubungkan...' : 'Hubungkan Telegram Sekarang'}</span>
            </button>
          ) : (
            <div className="telegram-code-card">
              <p className="code-instruction">Kode Integrasi Kamu:</p>
              <div className="code-display-wrap">
                <span className="secret-link-code">{generatedCode}</span>
                <button type="button" className="pill btn-secondary copy-code-btn" onClick={handleCopyCode}>
                  {copied ? <CheckIcon size={14} /> : null}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
              <p className="code-timer" style={{ fontSize: '0.85rem', color: remaining < 60000 ? 'var(--danger)' : 'var(--text-muted)', margin: '0.35rem 0 0.5rem', fontVariantNumeric: 'tabular-nums' }}>
                ⏱️ Berlaku {formatTimer(remaining)}
              </p>
              <p className="code-hint-text">Kirim perintah berikut ke bot di Telegram:</p>
              <div className="code-cmd-preview"><code>/link {generatedCode}</code></div>
              {deepLink && (
                <a href={deepLink} target="_blank" rel="noopener noreferrer" className="pill btn-primary telegram-deeplink-btn">
                  <TelegramIcon size={18} />
                  <span>Buka Bot Telegram</span>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileTelegramTab;
