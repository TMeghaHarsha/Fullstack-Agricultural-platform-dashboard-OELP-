import { useEffect, useState } from "react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

function parseResultsJson(d: any) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.results)) return d.results;
  return [];
}

export function usePlatformData() {
  const [adminAnalytics, setAdminAnalytics] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Token ${token}` } : {};
    setLoading(true);

    const fetchData = async () => {
      try {
        const [adminRes, txRes, subsRes, plansRes] = await Promise.all([
          fetch(`${API_URL}/admin/analytics/`, { headers }).catch(() => null),
          fetch(`${API_URL}/transactions/`, { headers }).catch(() => null),
          fetch(`${API_URL}/subscriptions/recent/`, { headers }).catch(() => null),
          fetch(`${API_URL}/plans/`, { headers }).catch(() => null),
        ]);

        const adminJson = adminRes && adminRes.ok ? await adminRes.json() : null;
        const txJson = txRes && txRes.ok ? await txRes.json() : null;
        const subsJson = subsRes && subsRes.ok ? await subsRes.json() : null;
        const plansJson = plansRes && plansRes.ok ? await plansRes.json() : null;

        if (!mounted) return;
        setAdminAnalytics(adminJson || null);
        setTransactions(parseResultsJson(txJson));
        setRecentSubscriptions(parseResultsJson(subsJson));
        setPlans(parseResultsJson(plansJson));
      } catch (e) {
        // ignore - keep empty arrays
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // Listen for manual refresh events (so other pages can trigger an update)
    const onRefresh = () => { setLoading(true); fetchData(); };
    window.addEventListener('platform-data-refresh', onRefresh);
    return () => { mounted = false; window.removeEventListener('platform-data-refresh', onRefresh); };
  }, []);

  return {
    adminAnalytics,
    transactions,
    recentSubscriptions,
    plans,
    loading,
  };
}

export default usePlatformData;
