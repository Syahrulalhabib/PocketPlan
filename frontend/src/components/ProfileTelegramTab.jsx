import { useState, useEffect, useCallback, useRef } from 'react';
import { TelegramIcon, CheckIcon } from './Icons.jsx';
import Modal from './Modal.jsx';
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
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
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
              text: `🎉 Pocky Telegram Bot (${uName ? '@' + uName : 'ID: ' + cId}) successfully linked!`
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
      setStatusMessage?.({ type: 'error', text: err?.message || 'Failed to generate link code' });
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
      setStatusMessage?.({ type: 'info', text: 'Link code cancelled.' });
    } catch (err) {
      setStatusMessage?.({ type: 'error', text: err?.message || 'Failed to cancel code' });
    } finally {
      setCancellingCode(false);
    }
  };

  const handleOpenUnlinkModal = () => {
    setShowUnlinkModal(true);
  };

  const handleConfirmUnlink = async () => {
    try {
      setUnlinking(true);
      await requestUnlink();
      setLinkInfo({ linked: false, chatId: null, username: null });
      setGeneratedCode(null);
      setShowUnlinkModal(false);
      setStatusMessage?.({ type: 'success', text: 'Telegram account disconnected.' });
    } catch (err) {
      setStatusMessage?.({ type: 'error', text: err?.message || 'Failed to disconnect.' });
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return <div className="telegram-tab-loading">Loading integration status...</div>;
  }

  return (
    <div className="profile-telegram-tab">
      <div className="form-section-intro">
        <h3 className="section-title">Pocky Telegram Bot Integration ✨</h3>
        <p className="section-desc">
          Log transactions and scan receipts on the go with Pocky on Telegram (@yourpocketplan_bot).
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
                <span className="connected-badge">● Pocky Connected &amp; Active! 🎉</span>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                  Ready to track expenses and scan receipts
                </div>
              </div>
            </div>
            <span className="connected-user">
              {linkInfo.username ? `@${linkInfo.username}` : `ID: ${linkInfo.chatId}`}
            </span>
          </div>

          <div className="telegram-commands-box">
            <h4>💡 Pocky Telegram Command Cheatsheet:</h4>
            <ul>
              <li>
                <code>📸 Send Receipt Photo</code>
                <span>Pocky reads &amp; records automatically via Pocky Scan</span>
              </li>
              <li>
                <code>/koreksi 150k</code>
                <span>Correct amount of the last receipt / record</span>
              </li>
              <li>
                <code>/toko Indomaret</code>
                <span>Update merchant name of the last receipt</span>
              </li>
              <li>
                <code>coffee 25k</code>
                <span>Instant quick logging in plain text without syntax</span>
              </li>
              <li>
                <code>/catat lunch 50k</code>
                <span>Log daily expense with category</span>
              </li>
              <li>
                <code>/masuk salary 2.5m</code>
                <span>Record income</span>
              </li>
              <li>
                <code>/goal Laptop 10m</code>
                <span>Create a new savings goal</span>
              </li>
              <li>
                <code>/goals</code>
                <span>View goals progress &amp; buy button</span>
              </li>
              <li>
                <code>/pengingat</code>
                <span>Configure automatic daily reminders twice a day</span>
              </li>
              <li>
                <code>/saldo</code>
                <span>Check current balance</span>
              </li>
              <li>
                <code>/batal</code>
                <span>Cancel &amp; undo the last record</span>
              </li>
            </ul>
          </div>

          <button type="button" className="pill btn-danger" onClick={handleOpenUnlinkModal} disabled={unlinking}>
            {unlinking ? 'Disconnecting...' : 'Disconnect Account'}
          </button>
        </div>
      ) : (
        <div className="telegram-unconnected-card">
          <div className="pocky-receipt-intro" style={{ marginBottom: '8px' }}>
            <div className="pocky-receipt-mascot-wrap">
              <PockySvg isWaving={true} />
            </div>
            <div className="pocky-receipt-bubble">
              <strong>Hi! Let&apos;s get to know Pocky on Telegram ✨</strong>
              <p>
                Simply send a text to the Telegram bot to auto-scan receipts, log coffee or fuel without opening the web, and track your savings goals!
              </p>
            </div>
          </div>

          <div className="telegram-promo">
            <div className="telegram-icon-hero"><TelegramIcon size={32} /></div>
            <h4>Track Quickly Anytime via Telegram</h4>
            <p>Connect your Pocketplan account to <strong>@yourpocketplan_bot</strong>.</p>
          </div>

          {!generatedCode ? (
            <button type="button" className="pill btn-primary telegram-connect-btn" onClick={handleGenerateCode} disabled={requestingCode}>
              <TelegramIcon size={18} />
              <span>{requestingCode ? 'Connecting...' : 'Connect to Pocky Telegram Now'}</span>
            </button>
          ) : (
            <div className="telegram-code-card">
              <p className="code-instruction">Your Link Code:</p>
              <div className="code-display-wrap">
                <span className="secret-link-code">{generatedCode}</span>
                <button type="button" className="pill btn-secondary copy-code-btn" onClick={handleCopyCode}>
                  {copied ? <CheckIcon size={14} /> : null}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="code-timer" style={{ fontSize: '0.85rem', color: remaining < 60000 ? 'var(--danger)' : 'var(--text-muted)', margin: '0.35rem 0 0.5rem', fontVariantNumeric: 'tabular-nums' }}>
                ⏱️ Valid for {formatTimer(remaining)}
              </p>
              <p className="code-hint-text">Send this command to Pocky on Telegram:</p>
              <div className="code-cmd-preview"><code>/link {generatedCode}</code></div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {deepLink && (
                  <a href={deepLink} target="_blank" rel="noopener noreferrer" className="pill btn-primary telegram-deeplink-btn" style={{ flex: 1, margin: 0, justifyContent: 'center' }}>
                    <TelegramIcon size={18} />
                    <span>Open Telegram Bot</span>
                  </a>
                )}
                <button
                  type="button"
                  className="pill btn-secondary"
                  onClick={handleCancelCode}
                  disabled={cancellingCode}
                  style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
                >
                  {cancellingCode ? 'Cancelling...' : '❌ Cancel Code'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showUnlinkModal}
        title="Disconnect Telegram?"
        onClose={() => !unlinking && setShowUnlinkModal(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Akun Telegram kamu akan diputus dari akun web ini. Kamu tetap bisa menghubungkan lagi nanti.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="pill btn-secondary"
              onClick={() => setShowUnlinkModal(false)}
              disabled={unlinking}
            >
              Batal
            </button>
            <button
              type="button"
              className="pill btn-danger"
              onClick={handleConfirmUnlink}
              disabled={unlinking}
            >
              {unlinking ? 'Memutuskan...' : 'Ya, Putuskan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfileTelegramTab;
