import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import usePlatformData from "@/lib/usePlatformData";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid } from "recharts";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AdminAnalytics() {
  const [summary, setSummary] = useState<any | null>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const { adminAnalytics, transactions: hookTx = [], plans: hookPlans = [], loading } = usePlatformData();
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    (async () => {
      try {
        // Prefer hook-provided adminAnalytics/transactions when available
        if (adminAnalytics) {
          setSummary(adminAnalytics.stats || null);
        } else {
          const adminRes = await fetch(`${API_URL}/admin/analytics/`, { headers: { Authorization: `Token ${token}` } }).catch(() => null);
          const adminData = adminRes && adminRes.ok ? await adminRes.json() : null;
          setSummary(adminData?.stats || null);
        }

        // For fields and transactions, prefer hook data if it contains values
        if (hookTx && hookTx.length > 0) {
          setTransactions(hookTx);
        } else {
          const txRes = await fetch(`${API_URL}/transactions/`, { headers: { Authorization: `Token ${token}` } }).catch(() => null);
          const txJson = txRes && txRes.ok ? await txRes.json() : { results: [] };
          setTransactions(Array.isArray(txJson?.results) ? txJson.results : txJson || []);
        }

        // Fields remain fetched from admin endpoint (no hook currently provides fields)
        const fieldsRes = await fetch(`${API_URL}/admin/fields/`, { headers: { Authorization: `Token ${token}` } }).catch(() => null);
        const fieldsJson = fieldsRes && fieldsRes.ok ? await fieldsRes.json() : { results: [] };
        setFields(Array.isArray(fieldsJson?.results) ? fieldsJson.results : fieldsJson || []);
      } catch {}
    })();
  }, []);

  const filteredFields = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return fields;
    const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
    const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;
    return fields.filter((f:any) => {
      const d = f.created_at ? new Date(f.created_at) : null;
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [fields, dateRange]);

  const filteredTx = useMemo(() => {
    if (!dateRange.start && !dateRange.end) return transactions;
    const start = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
    const end = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;
    return transactions.filter((t:any) => {
      const d = t.created_at ? new Date(t.created_at) : null;
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [transactions, dateRange]);

  const fieldsOverTime = useMemo(() => {
    const byMonth: Record<string, number> = {};
    filteredFields.forEach((f:any) => {
      const m = (f.created_at || '').slice(0,7) || 'unknown';
      byMonth[m] = (byMonth[m] || 0) + 1;
    });
    return Object.keys(byMonth).sort().map((m) => ({ month: m, fields: byMonth[m] }));
  }, [filteredFields]);

  const planMix = useMemo(() => {
    const map: Record<string, number> = {};
    (filteredFields || []).forEach((f:any) => {
      const name = f.user_plan_name || f.plan_name || 'Unknown';
      if (!name) return;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.keys(map).map((k) => ({ name: k, value: map[k] }));
  }, [filteredFields]);

  const revenueTrend = useMemo(() => {
    // Always prefer adminAnalytics revenue_by_day if available (already net of refunds and filled for 7 days)
    if (adminAnalytics && Array.isArray(adminAnalytics.revenue_by_day) && adminAnalytics.revenue_by_day.length > 0) {
      return adminAnalytics.revenue_by_day.map((r:any) => ({ 
        month: r.name || r.day || '', 
        revenue: Number(r.value || r.amount || 0) 
      }));
    }
    
    // Fallback to computing from filtered transactions
    const revByMonth: Record<string, number> = {};
    filteredTx.forEach((t:any) => {
      const m = (t.created_at || '').slice(0,7) || 'unknown';
      const amt = Number(t.amount) || 0;
      if (['success','paid','completed'].includes(String(t.status||'').toLowerCase())) {
        revByMonth[m] = (revByMonth[m] || 0) + amt;
      }
    });
    return Object.keys(revByMonth).sort().map(m => ({ month: m, revenue: revByMonth[m] }));
  }, [adminAnalytics, filteredTx]);

  const cropDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredFields.forEach((f:any) => {
      const name = f.crop_name || 'Unassigned';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.keys(map).map((k) => ({ name: k, value: map[k] }));
  }, [filteredFields]);

  const irrigationDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filteredFields.forEach((f:any) => {
      const name = f.irrigation_method_name || 'Unspecified';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.keys(map).map((k) => ({ name: k, value: map[k] }));
  }, [filteredFields]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Key platform insights</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Apply across all charts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <input type="date" className="border rounded h-9 px-2 w-full" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <input type="date" className="border rounded h-9 px-2 w-full" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setDateRange({ start: "", end: "" })}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>User Activity (Fields over time)</CardTitle><CardDescription>By month</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fieldsOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="fields" fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Revenue Trend</CardTitle><CardDescription>Monthly</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={revenueTrend}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke={COLORS[1]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Crop Distribution</CardTitle><CardDescription>Across all users</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={cropDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {cropDistribution.map((_:any, idx:number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Irrigation Distribution</CardTitle><CardDescription>Across all users</CardDescription></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={irrigationDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {irrigationDistribution.map((_:any, idx:number) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
