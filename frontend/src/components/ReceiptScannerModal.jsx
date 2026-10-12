import { useState, useRef, useCallback } from 'react';
import Modal from './Modal.jsx';
import { formatRupiah } from '../utils/formatters.js';
import { getAuthToken } from '../services/firebase.js';

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

const DIRECT_GEMINI_PROMPT = `Analisis struk belanja ini. Ekstrak JSON valid tanpa markdown:
{
  "merchant_name": "Nama Toko",
  "date": "YYYY-MM-DD",
  "items": [{"item_name": "Nama Barang", "quantity": 1, "unit_price": 0, "total_price": 0}],
  "subtotal": 0,
  "tax": 0,
  "total_amount": 0,
  "payment_method": "CASH / QRIS / DEBIT / CREDIT",
  "category": "Food"
}
Kategori yang valid: Food, Transport, Shopping, Bills, Entertainment, Health, Other.`;

async function callDirectGeminiApi(base64, mimeType, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: DIRECT_GEMINI_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }],
      generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
  }
  const json = await res.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini API tidak mengembalikan teks');
  return JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());
}

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
            setParsed({
              amount: d.total_amount || 0,
              category: d.category || 'Food',
              description: d.merchant_name || 'Struk Belanja',
              date: d.date || new Date().toISOString().slice(0, 10),
              type: 'Expense',
              items: d.items || [],
              paymentMethod: d.payment_method || 'CASH'
            });
            setEngineUsed(json.modelUsed || 'Google Gemini AI (Backend)');
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

      // 2. Direct Gemini AI via browser jika VITE_GEMINI_API_KEY ada
      const clientApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (clientApiKey) {
        setProgress(70);
        const directData = await callDirectGeminiApi(base64, mimeType, clientApiKey);
        setParsed({
          amount: directData.total_amount || 0,
          category: directData.category || 'Food',
          description: directData.merchant_name || 'Struk Belanja',
          date: directData.date || new Date().toISOString().slice(0, 10),
          type: 'Expense',
          items: directData.items || [],
          paymentMethod: directData.payment_method || 'CASH'
        });
        setEngineUsed('Google Gemini 1.5 Flash (Direct API)');
        setRawText(JSON.stringify(directData, null, 2));
        setProgress(100);
        setStatus(STATUS.DONE);
        return;
      }

      // Jika keduanya gagal/belum ada API Key
      throw new Error(
        lastError ||
        'GEMINI_API_KEY belum dikonfigurasi. Masukkan GEMINI_API_KEY di backend/.env atau VITE_GEMINI_API_KEY di frontend/.env.'
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
    <Modal open={open} onClose={handleClose} title="📸 Scan Struk">
      <div className="modal-form" style={{ gap: '12px' }}>
        {status === STATUS.IDLE && (
          <div className="receipt-upload-zone" onClick={() => fileRef.current?.click()}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧾</div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
              Tap untuk foto struk atau pilih gambar
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
              JPG, PNG, HEIC • Otomatis dipindai dengan Google Gemini AI
            </p>
          </div>
        )}
        {status === STATUS.LOADING && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {preview && (
              <img
                src={preview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '12px', marginBottom: '12px', objectFit: 'contain' }}
              />
            )}
            <div className="receipt-progress-bar">
              <div className="receipt-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Membaca rincian struk dengan AI... {progress}%
            </p>
          </div>
        )}
        {status === STATUS.ERROR && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>❌</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Gagal memindai</p>
            <p style={{ margin: '4px 0 12px', fontSize: '0.85rem', color: 'var(--muted)' }}>{errorMsg}</p>
            <button type="button" className="pill btn-secondary" onClick={reset}>
              Coba Lagi
            </button>
          </div>
        )}
        {status === STATUS.DONE && parsed && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                ⚡ Dipindai via: <strong>{engineUsed}</strong>
              </span>
              {parsed.paymentMethod && (
                <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                  💳 {parsed.paymentMethod}
                </span>
              )}
            </div>
            <div className="receipt-result-card">
              <div className="receipt-result-row">
                <span className="receipt-result-label">💰 Jumlah</span>
                <span className="receipt-result-value" style={{ fontWeight: 700 }}>
                  {parsed.amount ? formatRupiah(parsed.amount) : <em style={{ color: '#f59e0b' }}>Tidak terdeteksi</em>}
                </span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">📂 Kategori</span>
                <span className="receipt-result-value">{parsed.category}</span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">🏪 Toko / Merchant</span>
                <span className="receipt-result-value">{parsed.description}</span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">📅 Tanggal</span>
                <span className="receipt-result-value">{parsed.date}</span>
              </div>
            </div>

            {Array.isArray(parsed.items) && parsed.items.length > 0 && (
              <details style={{ fontSize: '0.8rem' }} open>
                <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '6px' }}>
                  🛒 Rincian Belanja ({parsed.items.length} item)
                </summary>
                <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '8px' }}>
                  {parsed.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span>• {item.item_name} {item.quantity > 1 ? `(${item.quantity}x)` : ''}</span>
                      <span style={{ fontWeight: 600 }}>{formatRupiah(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <details style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Lihat payload mentah</summary>
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
              Hasil bisa diedit setelah dimasukkan ke form transaksi.
            </p>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={reset}>
                Scan Ulang
              </button>
              <button type="button" className="pill btn-primary" onClick={handleUseResult}>
                ✅ Gunakan Hasil
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReceiptScannerModal;

