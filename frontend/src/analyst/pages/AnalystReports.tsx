import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsChart } from "@/admin/components/dashboard/AnalyticsChart";
import { Download, Search } from "lucide-react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AnalystReports() {
  const [filters, setFilters] = useState<{ crop?: string; region?: string; date_from?: string; date_to?: string }>({});
  const [reports, setReports] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/soil-reports/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setReports(Array.isArray(d?.results) ? d.results : (Array.isArray(d) ? d : [])))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const viewAnalytics = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const params = new URLSearchParams();
    if (filters.crop) params.set("crop", filters.crop);
    if (filters.region) params.set("region", filters.region);
    if (filters.date_from) params.set("date_from", filters.date_from);
    if (filters.date_to) params.set("date_to", filters.date_to);
    const url = `${API_URL}/analytics/summary/${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Token ${token}` } });
    const data = res.ok ? await res.json() : null;
    setAnalytics(data || null);
  };

  const lifecycleData = useMemo(() => (analytics?.lifecycle_completion || []).map((x:any, i:number) => ({ name: x.name || `Item ${i+1}`, value: Number(x.value) || 0 })), [analytics]);
  const cropDist = useMemo(() => (analytics?.crop_distribution || []).map((x:any, i:number) => ({ name: x.name || `Crop ${i+1}`, value: Number(x.value) || 0 })), [analytics]);

  const exportCSV = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    // Build query params
    const params = new URLSearchParams();
    if (filters.crop) params.set("crop", filters.crop);
    if (filters.region) params.set("region", filters.region);
    if (filters.date_from) params.set("start_date", filters.date_from);
    if (filters.date_to) params.set("end_date", filters.date_to);
    params.set("token", token);
    
    // Open export URL in new window
    const url = `${API_URL}/reports/export/csv/?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Generate insights and explore analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export PDF Report
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Apply filters and view analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-muted-foreground">Crop</label>
              <Input placeholder="e.g., Wheat" value={filters.crop || ""} onChange={(e)=> setFilters({...filters, crop: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Region</label>
              <Input placeholder="e.g., West" value={filters.region || ""} onChange={(e)=> setFilters({...filters, region: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={filters.date_from || ""} onChange={(e)=> setFilters({...filters, date_from: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={filters.date_to || ""} onChange={(e)=> setFilters({...filters, date_to: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button onClick={viewAnalytics}><Search className="mr-2 h-4 w-4" /> View Analytics</Button>
          </div>
        </CardContent>
      </Card>

      {analytics && (
        <div className="grid gap-4 md:grid-cols-2">
          <AnalyticsChart title="Lifecycle Completion" data={lifecycleData} dataKey="value" />
          <AnalyticsChart title="Crop Distribution" data={cropDist} dataKey="value" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Latest soil reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>pH</TableHead>
                  <TableHead>EC</TableHead>
                  <TableHead>Soil Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.slice(0, 10).map((r:any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.field_name || r.field || (typeof r.field === 'object' ? r.field?.name : '-') || '-'}</TableCell>
                    <TableCell>{r.sampled_at ? new Date(r.sampled_at).toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '-')}</TableCell>
                    <TableCell>{r.ph != null ? r.ph.toFixed(2) : '-'}</TableCell>
                    <TableCell>{r.ec != null ? r.ec.toFixed(2) : '-'}</TableCell>
                    <TableCell>{r.soil_type_name || r.soil_type || (typeof r.soil_type === 'object' ? r.soil_type?.name : '-') || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
