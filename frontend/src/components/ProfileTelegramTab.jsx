import { useState, useEffect, useCallback } from 'react';
import { TelegramIcon, CheckIcon } from './Icons.jsx';
import { getTelegramStatus, requestLinkCode, requestUnlink } from '../services/telegramApi.js';
import { getUserDocRef, listenDoc, firebaseEnabled } from '../services/firebase.js';

const ProfileTelegramTab = ({ user, setStatusMessage }) => {
  const [loading, setLoading] = useState(true);
  const [linkInfo, setLinkInfo] = useState({ linked: false, chatId: null, username: null });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const [requestingCode, setRequestingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

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
              <li><code>/catat 50000 makan nasi</code> Pengeluaran</li>
              <li><code>/catat 20k bensin</code> Format k, rb, jt didukung</li>
              <li><code>/masuk 2.5jt gaji</code> Pemasukan</li>
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
              <p className="code-instruction">Kode Integrasi Kamu (15 Menit):</p>
              <div className="code-display-wrap">
                <span className="secret-link-code">{generatedCode}</span>
                <button type="button" className="pill btn-secondary copy-code-btn" onClick={handleCopyCode}>
                  {copied ? <CheckIcon size={14} /> : null}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
              </div>
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
