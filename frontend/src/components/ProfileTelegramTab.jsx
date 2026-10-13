import { useState, useEffect, useCallback, useRef } from 'react';
import { TelegramIcon, CheckIcon } from './Icons.jsx';
import { getTelegramStatus, requestLinkCode, requestUnlink, cancelLinkCode } from '../services/telegramApi.js';
import { getUserDocRef, listenDoc, firebaseEnabled } from '../services/firebase.js';
import { PockySvg } from './FloatingMascot.jsx';

const formatTimer = (ms) => {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const ProfileTelegramTab = ({ user, setStatusMessage }) => {
  const [loading, setLoading] = useState(true);
  const isTgAccount = Boolean(user?.isTelegramUser || user?.id?.startsWith('tg_'));
  const initialChatId = user?.telegramChatId || (isTgAccount ? user.id.replace('tg_', '') : null);
  const [linkInfo, setLinkInfo] = useState({
    linked: isTgAccount || Boolean(initialChatId),
    chatId: initialChatId,
    username: user?.telegramUsername || null
  });
  const [generatedCode, setGeneratedCode] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [requestingCode, setRequestingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [cancellingCode, setCancellingCode] = useState(false);
  const timerRef = useRef(null);
  const prevLinkedRef = useRef(isTgAccount || Boolean(initialChatId));

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
      if (res?.linked) {
        setLinkInfo(res);
      } else if (isTgAccount) {
        setLinkInfo({
          linked: true,
          chatId: user?.telegramChatId || user.id.replace('tg_', ''),
          username: user?.telegramUsername || null
        });
      } else {
        setLinkInfo(res || { linked: false });
      }
    } catch {
      if (isTgAccount) {
        setLinkInfo({
          linked: true,
          chatId: user?.telegramChatId || user.id.replace('tg_', ''),
          username: user?.telegramUsername || null
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isTgAccount, user]);

  useEffect(() => {
    fetchStatus();
    if (firebaseEnabled && user?.id) {
      const ref = getUserDocRef(user.id);
      const unsub = listenDoc(ref, (snap) => {
        const data = snap?.data?.();
        if (data?.telegramChatId || isTgAccount) {
          const cId = data?.telegramChatId || user?.telegramChatId || (isTgAccount ? user.id.replace('tg_', '') : null);
          const uName = data?.telegramUsername || user?.telegramUsername || null;
          setLinkInfo({
            linked: true,
            chatId: cId,
            username: uName
          });
          setGeneratedCode(null);
          if (!prevLinkedRef.current) {
            setStatusMessage?.({
              type: 'success',
              text: `🎉 Bot Telegram Pocky (${uName ? '@' + uName : 'ID: ' + cId}) berhasil terhubung!`
            });
            prevLinkedRef.current = true;
          }
        } else if (data && data.telegramChatId === null && !isTgAccount) {
          setLinkInfo({ linked: false, chatId: null, username: null });
          prevLinkedRef.current = false;
        }
      });
      return () => unsub && unsub();
    }
  }, [user, fetchStatus, isTgAccount, setStatusMessage]);

  // Fast-poll while code is displayed so UI transitions immediately when linked via bot
  useEffect(() => {
    if (!generatedCode || isTgAccount || linkInfo.linked) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 1200);
    return () => clearInterval(interval);
  }, [generatedCode, isTgAccount, linkInfo.linked, fetchStatus]);

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

  const handleCancelCode = async () => {
    try {
      setCancellingCode(true);
      if (timerRef.current) clearInterval(timerRef.current);
      await cancelLinkCode();
      setGeneratedCode(null);
      setDeepLink(null);
      setRemaining(0);
      setStatusMessage?.({ type: 'info', text: 'Kode integrasi dibatalkan.' });
    } catch (err) {
      setStatusMessage?.({ type: 'error', text: err?.message || 'Gagal membatalkan kode' });
    } finally {
      setCancellingCode(false);
    }
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
        <h3 className="section-title">Integrasi Bot Telegram Pocky 🪙</h3>
        <p className="section-desc">
          Catat transaksi kilat & foto struk belanjaanmu dari mana saja bareng Pocky di Telegram (@yourpocketplan_bot).
        </p>
      </div>

      {linkInfo.linked ? (
        <div className="telegram-connected-card">
          <div className="connected-header" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ transform: 'scale(0.8)', margin: '-8px 0 -8px -8px' }}>
                <PockySvg isWaving={true} />
              </div>
              <div>
                <span className="connected-badge">● Pocky Terhubung Aktif! 🎉</span>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                  Siap catat transaksi & struk belanjaanmu
                </div>
              </div>
            </div>
            <span className="connected-user">
              {linkInfo.username ? `@${linkInfo.username}` : `ID: ${linkInfo.chatId}`}
            </span>
          </div>

          <div className="telegram-commands-box">
            <h4>💡 Cheat Sheet Perintah Pocky di Telegram:</h4>
            <ul>
              <li>
                <code>📸 Kirim Foto Struk</code>
                <span>Pocky baca & catat otomatis via AI Gemini</span>
              </li>
              <li>
                <code>/koreksi 150k</code>
                <span>Koreksi nominal struk/catatan terakhir</span>
              </li>
              <li>
                <code>/toko Indomaret</code>
                <span>Ubah nama toko struk terakhir</span>
              </li>
              <li>
                <code>kopi susu 25k</code>
                <span>Catat kilat langsung ketik tanpa format</span>
              </li>
              <li>
                <code>/catat makan 50k</code>
                <span>Catat pengeluaran harian</span>
              </li>
              <li>
                <code>/masuk gaji 2.5jt</code>
                <span>Catat pemasukan uang</span>
              </li>
              <li>
                <code>/goal Laptop 10jt</code>
                <span>Buat target impian & celengan</span>
              </li>
              <li>
                <code>/goals</code>
                <span>Lihat progres celengan & tombol beli</span>
              </li>
              <li>
                <code>/pengingat</code>
                <span>Atur pengingat harian otomatis 2x sehari</span>
              </li>
              <li>
                <code>/saldo</code>
                <span>Cek sisa saldo terkini</span>
              </li>
              <li>
                <code>/batal</code>
                <span>Batalkan & hapus catatan terakhir</span>
              </li>
            </ul>
          </div>

          <button type="button" className="pill btn-danger" onClick={handleUnlink} disabled={unlinking}>
            {unlinking ? 'Memutuskan...' : 'Putuskan Sambungan'}
          </button>
        </div>
      ) : (
        <div className="telegram-unconnected-card">
          <div className="pocky-receipt-intro" style={{ marginBottom: '8px' }}>
            <div className="pocky-receipt-mascot-wrap">
              <PockySvg isWaving={true} />
            </div>
            <div className="pocky-receipt-bubble">
              <strong>Hai! Yuk kenalan bareng Pocky di Telegram 🪙</strong>
              <p>
                Cukup kirim pesan ke bot Telegram, kamu bisa scan struk otomatis, catat kopi atau bensin tanpa buka web, dan pantau celengan impianmu!
              </p>
            </div>
          </div>

          <div className="telegram-promo">
            <div className="telegram-icon-hero"><TelegramIcon size={32} /></div>
            <h4>Catat Cepat Kapan Saja via Telegram</h4>
            <p>Hubungkan akun Pocketplan kamu ke bot <strong>@yourpocketplan_bot</strong>.</p>
          </div>

          {!generatedCode ? (
            <button type="button" className="pill btn-primary telegram-connect-btn" onClick={handleGenerateCode} disabled={requestingCode}>
              <TelegramIcon size={18} />
              <span>{requestingCode ? 'Menghubungkan...' : 'Hubungkan ke Pocky Telegram Sekarang'}</span>
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
              <p className="code-hint-text">Kirim perintah berikut ke Pocky di Telegram:</p>
              <div className="code-cmd-preview"><code>/link {generatedCode}</code></div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {deepLink && (
                  <a href={deepLink} target="_blank" rel="noopener noreferrer" className="pill btn-primary telegram-deeplink-btn" style={{ flex: 1, margin: 0, justifyContent: 'center' }}>
                    <TelegramIcon size={18} />
                    <span>Buka Bot Telegram</span>
                  </a>
                )}
                <button
                  type="button"
                  className="pill btn-secondary"
                  onClick={handleCancelCode}
                  disabled={cancellingCode}
                  style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                >
                  {cancellingCode ? 'Membatalkan...' : '❌ Batalkan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileTelegramTab;
