import { useState, useRef, useCallback } from 'react';
import Modal from './Modal.jsx';
import { parseReceiptText } from '../utils/parseReceipt.js';
import { formatRupiah } from '../utils/formatters.js';

const STATUS = { IDLE: 'idle', LOADING: 'loading', DONE: 'done', ERROR: 'error' };

const ReceiptScannerModal = ({ open, onClose, onResult }) => {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [rawText, setRawText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef(null);

  const reset = useCallback(() => {
    setStatus(STATUS.IDLE); setProgress(0); setPreview(null);
    setParsed(null); setRawText(''); setErrorMsg('');
  }, []);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const processImage = useCallback(async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url); setStatus(STATUS.LOADING); setProgress(0);
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('ind+eng', 1, {
        logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100)); }
      });
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      setRawText(text);
      const result = parseReceiptText(text);
      setParsed(result); setStatus(STATUS.DONE);
    } catch (err) {
      setErrorMsg(err?.message || 'Gagal memproses gambar'); setStatus(STATUS.ERROR);
    } finally { URL.revokeObjectURL(url); }
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = '';
  }, [processImage]);

  const handleUseResult = useCallback(() => {
    if (parsed) { onResult(parsed); handleClose(); }
  }, [parsed, onResult, handleClose]);

  return (
    <Modal open={open} onClose={handleClose} title="📸 Scan Struk">
      <div className="modal-form" style={{ gap: '12px' }}>
        {status === STATUS.IDLE && (
          <div className="receipt-upload-zone" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={handleFileChange} style={{ display: 'none' }} />
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧾</div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>
              Tap untuk foto struk atau pilih gambar
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
              JPG, PNG, HEIC • Diproses di browser, tidak dikirim ke server
            </p>
          </div>
        )}
        {status === STATUS.LOADING && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {preview && <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '12px', marginBottom: '12px', objectFit: 'contain' }} />}
            <div className="receipt-progress-bar">
              <div className="receipt-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Memindai struk... {progress}%
            </p>
          </div>
        )}
        {status === STATUS.ERROR && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>❌</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Gagal memindai</p>
            <p style={{ margin: '4px 0 12px', fontSize: '0.85rem', color: 'var(--muted)' }}>{errorMsg}</p>
            <button type="button" className="pill btn-secondary" onClick={reset}>Coba Lagi</button>
          </div>
        )}
        {status === STATUS.DONE && parsed && (
          <>
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
                <span className="receipt-result-label">📝 Deskripsi</span>
                <span className="receipt-result-value">{parsed.description}</span>
              </div>
              <div className="receipt-result-row">
                <span className="receipt-result-label">📅 Tanggal</span>
                <span className="receipt-result-value">{parsed.date}</span>
              </div>
            </div>
            <details style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Lihat teks OCR mentah</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflow: 'auto', background: 'rgba(0,0,0,0.03)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem' }}>
                {rawText || '(kosong)'}
              </pre>
            </details>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Hasil bisa diedit setelah dimasukkan ke form transaksi.
            </p>
            <div className="modal-actions">
              <button type="button" className="pill btn-secondary" onClick={reset}>Scan Ulang</button>
              <button type="button" className="pill btn-primary" onClick={handleUseResult}>✅ Gunakan Hasil</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReceiptScannerModal;

