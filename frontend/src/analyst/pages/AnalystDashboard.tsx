import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AnalyticsChart } from "@/admin/components/dashboard/AnalyticsChart";
import { CheckCircle, Database, FileText } from "lucide-react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AnalystDashboard() {
  const [reportsCount, setReportsCount] = useState(0);
  const [fieldsCount, setFieldsCount] = useState(0);
  const [unread, setUnread] = useState(0);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    // Count soil reports
    fetch(`${API_URL}/soil-reports/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const arr = Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
        setReportsCount(arr.length);
      }).catch(() => setReportsCount(0));
    // Count fields via admin fields (Analyst has access)
    fetch(`${API_URL}/admin/fields/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const arr = Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : []);
        setFieldsCount(arr.length);
      }).catch(() => setFieldsCount(0));
    // Unread notifications from dashboard endpoint
    fetch(`${API_URL}/dashboard/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setUnread(Number(d?.unread_notifications) || 0))
      .catch(() => setUnread(0));
    // Analytics summary for charts
    fetch(`${API_URL}/analytics/summary/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setSummary(d || null))
      .catch(() => setSummary(null));
  }, []);

  const chart1 = useMemo(() => {
    const raw = (summary && Array.isArray(summary.lifecycle_completion)) ? summary.lifecycle_completion : [];
    return raw.map((x: any, i: number) => ({ name: x?.name || `Item ${i+1}`, value: Number(x?.value) || 0 }));
  }, [summary]);

  const chart2 = useMemo(() => {
    const raw = (summary && Array.isArray(summary.crop_distribution)) ? summary.crop_distribution : [];
    return raw.map((x: any, i: number) => ({ name: x?.name || `Crop ${i+1}`, value: Number(x?.value) || 0 }));
  }, [summary]);

  const chart3 = useMemo(() => {
    const raw = (summary && Array.isArray(summary.region_distribution)) ? summary.region_distribution : [];
    // Ensure we have valid data
    if (raw.length === 0) {
      return [{ name: "No Data", value: 0 }];
    }
    return raw.map((x: any, i: number) => ({ 
      name: x?.name || `Region ${i+1}`, 
      value: Number(x?.value) || 0 
    }));
  }, [summary]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analyst Dashboard</h1>
        <p className="text-muted-foreground">Data insights and reporting overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Metric label="Reports Generated" value={reportsCount} icon={FileText} />
        <Metric label="Data Processed (Fields)" value={fieldsCount} icon={Database} />
        <Metric label="Unread Notifications" value={unread} icon={CheckCircle} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AnalyticsChart title="Lifecycle Completion" data={chart1} dataKey="value" />
        <AnalyticsChart title="Crop Distribution" data={chart2} dataKey="value" />
      </div>
      {chart3.length > 0 && chart3[0].name !== "No Data" && (
        <AnalyticsChart title="Region Distribution" data={chart3} dataKey="value" />
      )}
      {(!chart3.length || chart3[0].name === "No Data") && (
        <Card>
          <CardHeader>
            <CardTitle>Region Distribution</CardTitle>
            <CardDescription>No region data available yet</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Add fields with location information to see region distribution.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
