import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import usePlatformData from "@/lib/usePlatformData";
import { Shield, DollarSign, Users, Map, UserCheck } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({ 
    total_revenue: 0, 
    active_end_users: 0, 
    total_fields: 0, 
    active_admins: 0,
    active_employees: 0,
    total_admins: 0,
    total_employees: 0,
  });
  const [roleTitle, setRoleTitle] = useState<string>("Admin");
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { adminAnalytics, transactions: hookTx = [], plans: hookPlans = [], recentSubscriptions, loading } = usePlatformData();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    (async () => {
      try {
        // Prefer hook-provided adminAnalytics and transactions when available
        const data = adminAnalytics || null;
        if (data) {
          const roleNames = Array.isArray(data.role_names) ? data.role_names : [];
          const firstRole = roleNames.find((r: string) => ["SuperAdmin","Admin","Analyst","Business","Developer","Support","Agronomist"].includes(r)) || "Admin";
          setRoleTitle(firstRole);
          const s = data.stats || {};

          // compute total_admins from users endpoint if available (match Users page logic)
          let totalAdmins = 0;
          let totalEmployees = 0;
          try {
            const usersRes = await fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } }).catch(() => null);
            const usersJson = usersRes && usersRes.ok ? await usersRes.json() : null;
            const usersData = Array.isArray(usersJson?.results) ? usersJson.results : (usersJson || []);
            if (Array.isArray(usersData)) {
              totalAdmins = usersData.filter((u:any) => (u.roles || []).includes('Admin')).length;
              totalEmployees = usersData.filter((u:any) => (u.roles || []).some((r: string) => ['Analyst','Agronomist','Support','Business','Developer'].includes(r))).length;
            }
          } catch (e) {
            totalAdmins = 0;
            totalEmployees = 0;
          }

          setMetrics({
            total_revenue: Number(s.total_revenue) || 0,
            active_end_users: Number(s.active_end_users) || 0,
            total_fields: Number(s.total_fields) || 0,
            active_admins: Number(s.active_admins) || 0,
            active_employees: Number(s.active_employees) || 0,
            total_admins: Number(totalAdmins) || 0,
            total_employees: Number(totalEmployees) || 0,
          } as any);
          setRecentActivity(Array.isArray(data.recent_activity) ? data.recent_activity : []);
        } else {
          // fallback: fetch admin analytics and users as before
          const [adminRes, txRes, fieldsRes, notiRes, usersRes] = await Promise.all([
            fetch(`${API_URL}/admin/analytics/`, { headers: { Authorization: `Token ${token}` } }),
            fetch(`${API_URL}/transactions/`, { headers: { Authorization: `Token ${token}` } }),
            fetch(`${API_URL}/admin/fields/`, { headers: { Authorization: `Token ${token}` } }),
            fetch(`${API_URL}/admin/notifications/`, { headers: { Authorization: `Token ${token}` } }),
            fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } }),
          ]);
          const adminData = adminRes && adminRes.ok ? await adminRes.json() : null;
          const txJson = txRes && txRes.ok ? await txRes.json() : null;
          const fieldsJson = fieldsRes && fieldsRes.ok ? await fieldsRes.json() : null;
          const notiJson = notiRes && notiRes.ok ? await notiRes.json() : null;
          const usersJson = usersRes && usersRes.ok ? await usersRes.json() : null;
          if (adminData) {
            const roleNames = Array.isArray(adminData.role_names) ? adminData.role_names : [];
            const firstRole = roleNames.find((r: string) => ["SuperAdmin","Admin","Analyst","Business","Developer","Support","Agronomist"].includes(r)) || "Admin";
            setRoleTitle(firstRole);
            const s = adminData.stats || {};
            let totalAdmins = 0;
            let totalEmployees = 0;
            try {
              const usersData = Array.isArray(usersJson?.results) ? usersJson.results : (usersJson || []);
              if (Array.isArray(usersData)) {
                totalAdmins = usersData.filter((u:any) => (u.roles || []).includes('Admin')).length;
                totalEmployees = usersData.filter((u:any) => (u.roles || []).some((r: string) => ['Analyst','Agronomist','Support','Business','Developer'].includes(r))).length;
              }
            } catch (e) {
              totalAdmins = 0;
              totalEmployees = 0;
            }
            setMetrics({
              total_revenue: Number(s.total_revenue) || 0,
              active_end_users: Number(s.active_end_users) || 0,
              total_fields: Number(s.total_fields) || 0,
              active_admins: Number(s.active_admins) || 0,
              active_employees: Number(s.active_employees) || 0,
              total_admins: Number(totalAdmins) || 0,
              total_employees: Number(totalEmployees) || 0,
            } as any);
            setRecentActivity(Array.isArray(adminData.recent_activity) ? adminData.recent_activity : []);
          }
          setTransactions(Array.isArray(txJson?.results) ? txJson.results : (txJson || []));
          setFields(Array.isArray(fieldsJson?.results) ? fieldsJson.results : (fieldsJson || []));
          setNotifications(Array.isArray(notiJson?.results) ? notiJson.results : (notiJson || []));
        }

        // If hook-provided transactions exist, prefer them
        if (hookTx && hookTx.length > 0) {
          setTransactions(hookTx);
        }
      } catch (e) {
        // noop
      }
    })();
  }, [adminAnalytics, hookTx]);

  // Build monthly datasets (YYYY-MM) or use revenue_by_day from backend
  const revenueTrend = useMemo(() => {
    // Prefer the adminAnalytics revenue_by_day if available (already net of refunds and filled for 7 days)
    if (adminAnalytics && Array.isArray(adminAnalytics.revenue_by_day) && adminAnalytics.revenue_by_day.length > 0) {
      return adminAnalytics.revenue_by_day.map((r:any) => ({ 
        month: r.name || r.day || r.month || r.label || r.date || r.x || '', 
        amount: Number(r.value || r.amount || 0) 
      }));
    }
    const map: Record<string, number> = {};
    transactions
      .filter((t:any) => ["success","paid","completed"].includes((t.status||"").toLowerCase()))
      .forEach((t:any) => {
        const m = (t.created_at || "").slice(0,7);
        if (!m) return;
        const amt = Number(t.amount) || 0;
        map[m] = (map[m] || 0) + amt;
      });
    return Object.keys(map).sort().map(m => ({ month: m, amount: map[m] }));
  }, [adminAnalytics, transactions]);

  const fieldsCreated = useMemo(() => {
    const map: Record<string, number> = {};
    fields.forEach((f:any) => {
      const m = (f.created_at || "").slice(0,7);
      if (!m) return;
      map[m] = (map[m] || 0) + 1;
    });
    return Object.keys(map).sort().map(m => ({ month: m, count: map[m] }));
  }, [fields]);

  const notificationsSent = useMemo(() => {
    const map: Record<string, number> = {};
    notifications.forEach((n:any) => {
      const m = (n.created_at || "").slice(0,7);
      if (!m) return;
      map[m] = (map[m] || 0) + 1;
    });
    return Object.keys(map).sort().map(m => ({ month: m, count: map[m] }));
  }, [notifications]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-foreground">{roleTitle} Dashboard</h1>
          <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] uppercase tracking-wide">
            <Shield className="h-3.5 w-3.5" />
            {roleTitle}
          </span>
        </div>
        <p className="text-muted-foreground">Overview of platform activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">₹{metrics.total_revenue}</div>
            <p className="text-xs text-muted-foreground">From subscriptions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active End Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.active_end_users}</div>
            <p className="text-xs text-muted-foreground">End users</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.total_fields}</div>
            <p className="text-xs text-muted-foreground">Registered fields</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            {/* Show 'Total Employees' for Admin role viewers, otherwise show 'Total Admins' */}
            <CardTitle className="text-sm font-medium">{roleTitle === 'Admin' ? 'Total Employees' : 'Total Admins'}</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{roleTitle === 'Admin' ? metrics.active_employees || metrics.total_employees || 0 : metrics.total_admins}</div>
            <p className="text-xs text-muted-foreground">{roleTitle === 'Admin' ? 'All employees' : 'Administrators across regions'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest platform activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((a:any, index:number) => (
                <div key={index} className="flex justify-between items-center">
                  <p className="text-sm">{a.description || a.action}</p>
                  <p className="text-xs text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</p>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly successful transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fields Created</CardTitle>
            <CardDescription>New fields per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={fieldsCreated}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notifications Sent</CardTitle>
            <CardDescription>Per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={notificationsSent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
