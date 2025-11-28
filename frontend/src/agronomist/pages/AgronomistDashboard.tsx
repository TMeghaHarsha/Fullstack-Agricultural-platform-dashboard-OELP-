import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MetricCard } from "../../admin/components/dashboard/MetricCard";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { MapPin, Sprout, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AgronomistDashboard() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    Promise.all([
      fetch(`${API_URL}/dashboard/`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null),
      fetch(`${API_URL}/analytics/summary/`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null),
    ]).then(([d, a])=>{ setDashboard(d); setAnalytics(a); }).catch(()=>{ setDashboard(null); setAnalytics(null); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agronomist Dashboard</h1>
        <p className="text-muted-foreground">Monitor crop health and field conditions</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Fields Monitored" value={String(dashboard?.active_fields ?? 0)} icon={MapPin} />
        <MetricCard label="Active Crops" value={String(dashboard?.active_crops ?? 0)} icon={Sprout} />
        <MetricCard label="Total Hectares" value={String(dashboard?.total_hectares ?? 0)} icon={TrendingUp} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Crop Distribution</CardTitle>
            <CardDescription>By assigned crops</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={(analytics?.crop_distribution||[]).map((d:any)=>({ name:d.name, value:d.value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Irrigation Methods</CardTitle>
            <CardDescription>Distribution across fields</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={(analytics?.irrigation_distribution||[]).map((d:any)=>({ name:d.name, value:d.value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle Completion</CardTitle>
            <CardDescription>Percentage of completed lifecycles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={[{ name: "Completion", value: analytics?.lifecycle_completion ?? 0 }] }>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} domain={[0,100]} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest field updates</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {(dashboard?.recent_activity||[]).map((r:any) => (
                <li key={r.id} className="rounded-md border p-2">{r.description||r.action} • {new Date(r.created_at).toLocaleString()}</li>
              ))}
              {(!dashboard?.recent_activity || dashboard.recent_activity.length===0) && (
                <li className="text-muted-foreground">No recent activity yet.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
