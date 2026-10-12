import { useState, useRef, useCallback } from 'react';
import Modal from './Modal.jsx';
import { formatRupiah } from '../utils/formatters.js';
import { getAuthToken } from '../services/firebase.js';
import { PockySvg } from './FloatingMascot.jsx';

const STATUS = { IDLE: 'idle', LOADING: 'loading', DONE: 'done', ERROR: 'error' };

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const res = reader.result;
      const commaIdx = res.indexOf(',');
      resolve({
        base64: res.slice(commaIdx + 1),
        mimeType: file.type || 'image/jpeg'
      });
    };
    reader.onerror = reject;
  });

const ReceiptScannerModal = ({ open, onClose, onResult }) => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [engineUsed, setEngineUsed] = useState('Gemini AI');
  const fileRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setProgress(0);
    setPreview(null);
    setParsed(null);
    setRawText('');
    setErrorMsg('');
    setEngineUsed('Gemini AI');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const processImage = useCallback(async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStatus(STATUS.LOADING);
    setProgress(20);

    let lastError = null;

    try {
      const { base64, mimeType } = await fileToBase64(file);
      setProgress(40);

      // 1. Coba via backend Gemini endpoint (/api/scan-receipt)
      try {
        const headers = { 'Content-Type': 'application/json' };
        try {
          const token = await getAuthToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        } catch {}

        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers,
          body: JSON.stringify({ imageBase64: base64, mimeType })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            const d = json.data;
            const inferredType = (d.type === 'Income' || d.doc_type === 'transfer_in') ? 'Income' : 'Expense';
            setParsed({
              amount: d.total_amount || 0,
              category: d.category || (inferredType === 'Income' ? 'Salary' : 'Food'),
              description: d.merchant_name || (inferredType === 'Income' ? 'Transfer Masuk' : 'Struk Belanja'),
              date: d.date || new Date().toISOString().slice(0, 10),
              type: inferredType,
              docType: d.doc_type || 'receipt',
              items: d.items || [],
              paymentMethod: d.payment_method || (d.doc_type?.startsWith('transfer') ? 'TRANSFER' : 'CASH')
            });
            setEngineUsed(json.modelUsed || 'Pocky Scan (Gemini AI)');
            setRawText(JSON.stringify(d, null, 2));
            setProgress(100);
            setStatus(STATUS.DONE);
            return;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          lastError = errData.error || `Server error (${res.status})`;
        }
      } catch (backendErr) {
        lastError = backendErr?.message || 'Backend tidak merespons';
      }

      // Jika backend gagal, tampilkan error jelas
      throw new Error(
        lastError ||
        'Gagal memindai struk. Pastikan backend sudah berjalan dan GEMINI_API_KEY dikonfigurasi di backend/.env.'
      );
    } catch (err) {
      setErrorMsg(err?.message || 'Gagal memindai dengan Gemini API');
      setStatus(STATUS.ERROR);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) processImage(file);
      e.target.value = '';
    },
    [processImage]
  );

  const handleUseResult = useCallback(() => {
    if (parsed) {
      onResult(parsed);
      handleClose();
    }
  }, [parsed, onResult, handleClose]);

  return (
    <Modal open={open} onClose={handleClose} title="🧾 Pocky Scan — Struk & Bukti Transfer ✨">
      <div className="modal-form" style={{ gap: '12px' }}>
        {status === STATUS.IDLE && (
          <>
            <div className="pocky-receipt-intro">
              <div className="pocky-receipt-mascot-wrap">
                <PockySvg isWaving={true} />
              </div>
              <div className="pocky-receipt-bubble">
                <strong>Hai! Pocky siap bacain struk belanja & bukti transfermu 🪙</strong>
                <p>Cukup upload foto struk belanja, bukti transfer m-Banking / e-wallet (masuk/keluar), atau tagihan. Pocky scan bakal deteksi otomatis!</p>
              </div>
            </div>

            <div className="receipt-upload-zone" onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: '42px', marginBottom: '8px' }}>📸</div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.98rem' }}>
                Tap untuk foto struk / bukti transfer atau pilih file
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                JPG, PNG, HEIC, WEBP • Otomatis dipindai via Pocky Scan
              </p>
              <span style={{ marginTop: '8px', fontSize: '0.76rem', color: '#059669', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                💡 Tips Pocky: Foto dengan cahaya terang & tegak yaa
              </span>
            </div>
          </>
        )}

        {status === STATUS.LOADING && (
          <div className="pocky-receipt-loading">
            <div className="pocky-receipt-mascot-wrap">
              <PockySvg isSquishing={true} />
            </div>
            <p className="pocky-loading-title">
              🔍 Pocky lagi teliti membaca gambar kamu nih... ({progress}%)
            </p>
            <p className="pocky-loading-sub">
              Tunggu sebentar yaa, Pocky lagi intip jenis transaksi, nominal, dan rinciannya! 🪙✨
            </p>

            {preview && (
              <img
                src={preview}
                alt="Preview Dokumen"
                className="pocky-receipt-preview"
              />
            )}

            <div className="receipt-progress-bar">
              <div className="receipt-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {status === STATUS.ERROR && (
          <div className="pocky-receipt-error">
            <div className="pocky-receipt-mascot-wrap">
              <PockySvg />
            </div>
            <p className="pocky-error-title">🙈 Aduh, mata Pocky agak burem baca gambar ini!</p>
            <p className="pocky-error-detail">{errorMsg}</p>

            <div className="pocky-error-tips">
              <p>💡 Tips dari Pocky biar gambar terbaca jelas:</p>
              <ul>
                <li>Pastikan cahaya cukup terang dan tidak ada pantulan cahaya silau</li>
                <li>Posisikan struk / bukti transfer tegak lurus dan nominal terlihat penuh</li>
                <li>Atau kamu bisa catat cepat di bot Telegram: <code>kopi 25k</code></li>
              </ul>
            </div>

            <button type="button" className="pill btn-secondary" onClick={reset}>
              🔄 Coba Foto Ulang Bareng Pocky
            </button>
          </div>
        )}
        {status === STATUS.DONE && parsed && (
          <>
            <div className="pocky-receipt-done-header">
              <div className="pocky-done-avatar">
                <PockySvg isWaving={true} />
              </div>
              <div className="pocky-done-text">
                <div className="pocky-done-badge">🎉 Hore! Berhasil Dibaca Pocky!</div>
                <p className="pocky-done-sub">Periksa jenis transaksi & rincian di bawah sebelum dimasukkan ke form yaa ✨</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="pill"
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: parsed.type === 'Expense' ? '#ef4444' : 'var(--card, #fff)',
                  color: parsed.type === 'Expense' ? '#ffffff' : 'var(--muted)',
                  border: parsed.type === 'Expense' ? '1px solid #ef4444' : '1px solid var(--border)',
                  borderRadius: '20px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setParsed(prev => ({ ...prev, type: 'Expense' }))}
              >
                🔴 Pengeluaran
              </button>
              <button
                type="button"
                className="pill"
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: parsed.type === 'Income' ? '#10b981' : 'var(--card, #fff)',
                  color: parsed.type === 'Income' ? '#ffffff' : 'var(--muted)',
                  border: parsed.type === 'Income' ? '1px solid #10b981' : '1px solid var(--border)',
                  borderRadius: '20px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setParsed(prev => ({ ...prev, type: 'Income' }))}
              >
                🟢 Pemasukan
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                ⚡ Dipindai via: <strong>{engineUsed}</strong>
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {parsed.docType && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)', color: '#4f46e5', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                    {parsed.docType === 'transfer_in' ? '💰 Transfer Masuk' :
                     parsed.docType === 'transfer_out' ? '💸 Transfer Keluar' :
                     parsed.docType === 'bill' ? '📄 Tagihan' : '🧾 Struk'}
                  </span>
                )}
                {parsed.paymentMethod && (
                  <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                    💳 {parsed.paymentMethod}
                  </span>
                )}
              </div>
            </div>

            <div className="receipt-result-card">
              <div className="receipt-result-row">
                <span className="receipt-result-label">
                  {parsed.type === 'Income' ? '💰 Nominal Masuk' : '💰 Total Transaksi'}
                </span>
                <span className="receipt-result-value" style={{ fontWeight: 800, color: parsed.type === 'Income' ? '#10b981' : '#ef4444', fontSize: '1.05rem' }}>
                  {parsed.amount ? (
                    `${parsed.type === 'Income' ? '+' : '-'}${formatRupiah(parsed.amount)}`
                  ) : (
                    <em style={{ color: '#f59e0b' }}>Tidak terdeteksi</em>
                  )}
                </span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">
                  {parsed.type === 'Income' ? '📥 Pengirim / Sumber' : '🏪 Toko / Penerima'}
                </span>
                <span className="receipt-result-value">{parsed.description || '-'}</span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">📂 Kategori</span>
                <span className="receipt-result-value">{parsed.category || 'Other'}</span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">📅 Tanggal</span>
                <span className="receipt-result-value">{parsed.date || '-'}</span>
              </div>
            </div>

            {Array.isArray(parsed.items) && parsed.items.length > 0 && (
              <details style={{ fontSize: '0.8rem' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '6px' }}>
                  🛒 Rincian Belanja ({parsed.items.length} item)
                </summary>
                <div style={{ maxHeight: '130px', overflowY: 'auto', background: 'rgba(0,0,0,0.02)', padding: '8px 10px', borderRadius: '8px' }}>
                  {parsed.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: idx < parsed.items.length - 1 ? '1px dashed rgba(0,0,0,0.05)' : 'none' }}>
                      <span>• {item.item_name} {item.quantity > 1 ? `(${item.quantity}x)` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{formatRupiah(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Lihat payload mentah AI</summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '100px',
                  overflow: 'auto',
                  background: 'rgba(0,0,0,0.03)',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.72rem'
                }}
              >
                {rawText || '(kosong)'}
              </pre>
            </details>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              💡 Hasil ini bisa diedit lagi di form transaksi sebelum disimpan.
            </p>

            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={reset}>
                Scan Struk Lain 🔄
              </button>
              <button type="button" className="pill btn-primary" onClick={handleUseResult}>
                ✅ Gunakan Catatan Pocky 🚀
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReceiptScannerModal;

