import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { useData } from '../providers/DataProvider.jsx';
import { getAuthToken } from '../services/firebase.js';
import LaporanSheet from './LaporanSheet.jsx';
import { computeLocalReport, getIndoMonthLabel } from './LaporanPage.jsx';

const LaporanCetakPage = () => {
  const [searchParams] = useSearchParams();
  const monthParam = searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const { user, isDemo } = useAuth();
  const { transactions, goals } = useData();

  const [apiReport, setApiReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const userName = useMemo(() => {
    return user?.displayName || user?.email?.split('@')[0] || (isDemo ? 'Demo User' : 'User');
  }, [user, isDemo]);

  const monthLabel = useMemo(() => getIndoMonthLabel(monthParam), [monthParam]);

  const prevMonthLabel = useMemo(() => {
    const [y, m] = monthParam.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    return getIndoMonthLabel(prevStr);
  }, [monthParam]);

  const fetchReport = useCallback(async (monthStr) => {
    setLoading(true);
    try {
      if (isDemo) {
        setApiReport(null);
        setLoading(false);
        return;
      }
      const token = await getAuthToken();
      if (!token) {
        setApiReport(null);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/report?month=${monthStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setApiReport(data.report || data || null);
      } else {
        setApiReport(null);
      }
    } catch {
      setApiReport(null);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchReport(monthParam);
  }, [monthParam, fetchReport]);

  const report = useMemo(() => {
    if (apiReport) return apiReport;
    return computeLocalReport(monthParam, transactions, goals, user);
  }, [apiReport, monthParam, transactions, goals, user]);

  return (
    <div className="laporan-print-page">
      <button
        type="button"
        className="laporan-print-floating-btn no-print"
        onClick={() => window.print()}
      >
        🖨️ Print / Save PDF
      </button>

      {loading && !report ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>
          Loading financial report...
        </div>
      ) : (
        <LaporanSheet
          report={report}
          monthLabel={monthLabel}
          prevMonthLabel={prevMonthLabel}
          userName={userName}
        />
      )}
    </div>
  );
};

export default LaporanCetakPage;
