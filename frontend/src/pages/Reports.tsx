import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileDown, TrendingUp, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const Reports = () => {
  const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const authHeaders = token ? { Authorization: `Token ${token}` } : {};
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [fieldsData, setFieldsData] = useState<any[]>([]);
  const [soilReports, setSoilReports] = useState<any[]>([]);
  const [openExport, setOpenExport] = useState(false);
  const [exportType, setExportType] = useState<"csv" | "pdf">("pdf");
  const [selectedAnalytics, setSelectedAnalytics] = useState<Record<string, boolean>>({ crop_distribution: true, irrigation_distribution: true, fields_over_time: true, plan_mix: true });
  const [userPlan, setUserPlan] = useState<any | null>(null);
  const [hasAdvancedAnalytics, setHasAdvancedAnalytics] = useState(false);
  const [filters, setFilters] = useState<{ crop?: string; region?: string; date_from?: string; date_to?: string }>({});
  const [filteredAnalytics, setFilteredAnalytics] = useState<any | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const stats = [
    { title: "Lifecycle Completion", value: analytics ? `${formatLifecyclePercent(analytics.lifecycle_completion)}` : "0%", change: "" },
    { title: "Active Reports", value: analytics && analytics.has_data ? String((analytics.crop_distribution || []).reduce((a:number,b:any)=>a+b.value,0)) : "0", subtitle: "" },
  ];

  function formatLifecyclePercent(raw: any) {
    if (raw == null) return '0%';
    // numeric
    if (typeof raw === 'number') {
      return `${Math.round(raw)}%`;
    }
    // numeric string
    if (typeof raw === 'string') {
      const n = parseFloat(raw);
      if (!isNaN(n)) return `${Math.round(n)}%`;
      return raw;
    }
    // array of items -> try to find a 'completed' item or aggregate values
    if (Array.isArray(raw)) {
      if (raw.length === 0) return '0%';
      // try to find an explicitly named completed/complete item
      const completedItem = raw.find((it: any) => typeof it?.name === 'string' && /complete|completed/i.test(it.name));
      if (completedItem && (typeof completedItem.value === 'number' || typeof completedItem.value === 'string')) {
        const v = Number(completedItem.value);
        if (!isNaN(v)) return `${Math.round(v)}%`;
      }
      // otherwise, sum numeric values; if sum looks like a percent (<=100) use it, else average
      const values = raw.map((it:any) => Number(it?.value || 0)).filter(v => !isNaN(v));
      if (values.length === 0) return '0%';
      const sum = values.reduce((a:number,b:number)=>a+b,0);
      if (sum <= 100) return `${Math.round(sum)}%`;
      return `${Math.round(sum / values.length)}%`;
    }
    // fallback
    try {
      const asNum = Number(raw);
      if (!isNaN(asNum)) return `${Math.round(asNum)}%`;
    } catch {}
    return String(raw);
  }

  // Additional analytics: field growth over time and plan mix
  const [extra, setExtra] = useState<{ planMix: any[]; fieldsOverTime: any[] } | null>(null);

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

  useEffect(() => {
    const fetchIt = async () => {
      try {
        // Fetch all data in parallel
        const [analyticsRes, fieldsRes, cropsRes, plansRes, soilReportsRes] = await Promise.all([
          fetch(`${API_URL}/analytics/summary/`, { headers: authHeaders }),
          fetch(`${API_URL}/fields/`, { headers: authHeaders }),
          fetch(`${API_URL}/crops/`, { headers: authHeaders }),
          fetch(`${API_URL}/subscriptions/user/`, { headers: authHeaders }),
          fetch(`${API_URL}/soil-reports/`, { headers: authHeaders }).catch(() => null)
        ]);
        
        const analyticsData = await analyticsRes.json();
        if (analyticsRes.ok) setAnalytics(analyticsData);
        
        const fieldsJson = await fieldsRes.json().catch(() => ({}));
        const cropsJson = await cropsRes.json().catch(() => ({}));
        const plansJson = await plansRes.json().catch(() => ({}));
        
        const fields = Array.isArray(fieldsJson?.results) ? fieldsJson.results : fieldsJson || [];
        const crops = Array.isArray(cropsJson?.results) ? cropsJson.results : cropsJson || [];
        const plans = Array.isArray(plansJson?.results) ? plansJson.results : Array.isArray(plansJson) ? plansJson : [plansJson].filter(Boolean);
        
        // Check user's subscription for advanced analytics
        const currentPlan = plans.length > 0 ? plans[0] : null;
        setUserPlan(currentPlan);
        const planFeatures = currentPlan?.plan_details?.features || [];
        const hasAdvanced = planFeatures.includes("Advanced Analytics");
        setHasAdvancedAnalytics(hasAdvanced);
        
        // Build crop distribution from actual crops data
        const cropDistribution: Record<string, number> = {};
        fields.forEach((field: any) => {
          if (field.crop_name) {
            cropDistribution[field.crop_name] = (cropDistribution[field.crop_name] || 0) + 1;
          }
        });
        const cropDistData = Object.keys(cropDistribution).map(name => ({ name, value: cropDistribution[name] }));
        
        // Build irrigation distribution from field irrigation methods
        const irrDistribution: Record<string, number> = {};
        fields.forEach((f: any) => {
          const key = f.irrigation_method_name || "Unknown";
          irrDistribution[key] = (irrDistribution[key] || 0) + 1;
        });
        const irrDistData = Object.keys(irrDistribution).map(name => ({ name, value: irrDistribution[name] }));
        
        // Build fields over time
        const byMonth: Record<string, number> = {};
        fields.forEach((f: any) => {
          const d = (f.created_at || '').slice(0,7) || 'unknown';
          byMonth[d] = (byMonth[d] || 0) + 1;
        });
        const fieldsOverTime = Object.keys(byMonth).sort().map((m) => ({ month: m, fields: byMonth[m] }));
        
        // Build plan mix
        const planMixMap: Record<string, number> = {};
        plans.forEach((p: any) => { 
          const name = p.plan_name || 'Free'; 
          planMixMap[name] = (planMixMap[name] || 0) + 1; 
        });
        const planMix = Object.keys(planMixMap).map((k) => ({ name: k, value: planMixMap[k] }));
        
        // Update analytics with correct crop distribution
        if (analyticsData) {
          analyticsData.crop_distribution = cropDistData;
          (analyticsData as any).irrigation_distribution = irrDistData;
        }
        setFieldsData(fields);
        setExtra({ planMix, fieldsOverTime });
        
        // Load soil reports
        if (soilReportsRes && soilReportsRes.ok) {
          const soilData = await soilReportsRes.json();
          const soilArr = Array.isArray(soilData?.results) ? soilData.results : (Array.isArray(soilData) ? soilData : []);
          setSoilReports(soilArr);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    };
    fetchIt();
  }, []);

  const viewAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
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
      setFilteredAnalytics(data || null);
    } catch (error) {
      console.error('Error fetching filtered analytics:', error);
      setFilteredAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "Excellent": return "default";
      case "Good": return "secondary";
      case "Fair": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Comprehensive insights into your farming operations</p>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto">
          <Button
            onClick={() => { setExportType('pdf'); setOpenExport(true); }}
            className="w-full sm:w-auto"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change || stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!analytics || !analytics.has_data) && (
        <Card>
          <CardHeader>
            <CardTitle>No analytics yet</CardTitle>
            <CardDescription>Add crops and fields to see insights.</CardDescription>
          </CardHeader>
        </Card>
      )}
      {/* Basic Reports - Available to all */}
      {(analytics?.crop_distribution?.length > 0 || (analytics as any)?.irrigation_distribution?.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Crop Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={analytics?.crop_distribution || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {(analytics?.crop_distribution || []).map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Irrigation Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={(analytics as any)?.irrigation_distribution || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {(((analytics as any)?.irrigation_distribution) || []).map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advanced Analytics - Only for Main/Top-up/Enterprise plans */}
      {hasAdvancedAnalytics && (
        <>
          {extra?.planMix?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={extra?.planMix || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {(extra?.planMix || []).map((_: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          
          {extra?.fieldsOverTime?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Fields Created Over Time</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={extra.fieldsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="fields" fill={COLORS[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Additional advanced analytics */}
          {fieldsData.length > 0 && (
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Field Size Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={fieldsData.map((f: any) => ({ name: f.name || 'Unknown', size: Number(f.size_acres) || 0 })).slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="size" fill={COLORS[2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Soil Type Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie 
                        data={Object.entries(fieldsData.reduce((acc: Record<string, number>, f: any) => {
                          const soilType = f.soil_type_name || 'Unknown';
                          acc[soilType] = (acc[soilType] || 0) + 1;
                          return acc;
                        }, {})).map(([name, value]) => ({ name, value }))} 
                        dataKey="value" 
                        nameKey="name" 
                        cx="50%" 
                        cy="50%" 
                        outerRadius={80} 
                        label
                      >
                        {Object.entries(fieldsData.reduce((acc: Record<string, number>, f: any) => {
                          const soilType = f.soil_type_name || 'Unknown';
                          acc[soilType] = (acc[soilType] || 0) + 1;
                          return acc;
                        }, {})).map((_, idx: number) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {!hasAdvancedAnalytics && userPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade for Advanced Analytics</CardTitle>
            <CardDescription>Get detailed insights, trends, and advanced reports with Main, Top-up, or Enterprise plans</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filters and View Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Analytics</CardTitle>
          <CardDescription>Apply filters and view filtered analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
            <Button onClick={viewAnalytics} disabled={loadingAnalytics}>
              <Search className="mr-2 h-4 w-4" /> {loadingAnalytics ? "Loading..." : "View Analytics"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtered Analytics Display */}
      {filteredAnalytics && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {filteredAnalytics.crop_distribution && filteredAnalytics.crop_distribution.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Filtered Crop Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={filteredAnalytics.crop_distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {filteredAnalytics.crop_distribution.map((_: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Filtered Crop Distribution</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">No data available for the selected filters.</p>
              </CardContent>
            </Card>
          )}
          {filteredAnalytics.irrigation_distribution && filteredAnalytics.irrigation_distribution.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Filtered Irrigation Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={filteredAnalytics.irrigation_distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {filteredAnalytics.irrigation_distribution.map((_: any, idx: number) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Filtered Irrigation Distribution</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">No data available for the selected filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Soil Reports</CardTitle>
          <CardDescription>Latest generated soil analysis reports ({soilReports.length} total)</CardDescription>
        </CardHeader>
        <CardContent>
          {soilReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No soil reports available yet. Generate soil reports from the Fields page.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>pH</TableHead>
                    <TableHead>EC</TableHead>
                    <TableHead>Soil Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soilReports.slice(0, 10).map((r:any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.id}</TableCell>
                      <TableCell>{r.field_name || (typeof r.field === 'object' ? r.field?.name : String(r.field || '-')) || '-'}</TableCell>
                      <TableCell>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{r.ph != null ? r.ph.toFixed(2) : '-'}</TableCell>
                      <TableCell>{r.ec != null ? r.ec.toFixed(2) : '-'}</TableCell>
                      <TableCell>{r.soil_type_name || (typeof r.soil_type === 'object' ? r.soil_type?.name : String(r.soil_type || '-')) || '-'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => {
                          const fieldId = typeof r.field === 'object' ? r.field?.id : r.field;
                          const url = `${API_URL}/reports/export/pdf/?field_id=${fieldId}${token ? `&token=${token}` : ''}`;
                          window.open(url, "_blank");
                        }}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={openExport} onOpenChange={setOpenExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{exportType === 'csv' ? 'Download CSV' : 'Export PDF'}</DialogTitle>
            <DialogDescription>
              Select analytics to include and date range for your report
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Analytics</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {['crop_distribution','irrigation_distribution','fields_over_time','plan_mix'].map(key => (
                  <label key={key} className="flex items-center gap-2">
                    <input type="checkbox" checked={!!selectedAnalytics[key]} onChange={(e) => setSelectedAnalytics({ ...selectedAnalytics, [key]: e.target.checked })} />
                    {key.replace(/_/g,' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <input type="date" className="border rounded h-9 px-2 w-full" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <input type="date" className="border rounded h-9 px-2 w-full" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenExport(false)}>Cancel</Button>
              <Button onClick={() => {
                const qs = new URLSearchParams();
                Object.keys(selectedAnalytics).filter(k => selectedAnalytics[k]).forEach(k => qs.append('analytics', k));
                if (dateRange.start) qs.set('start_date', dateRange.start);
                if (dateRange.end) qs.set('end_date', dateRange.end);
                if (token) qs.set('token', token);
                const url = `${API_URL}/reports/export/${exportType}/?${qs.toString()}`;
                window.open(url, '_blank');
                setOpenExport(false);
              }}>{exportType === 'csv' ? 'Download' : 'Export'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Health and productivity sections removed per requirements */}
    </div>
  );
};

export default Reports;
