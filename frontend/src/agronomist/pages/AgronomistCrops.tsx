import { MetricCard } from "../../admin/components/dashboard/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MapPin, Sprout, Activity, Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

const getHealthBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    Healthy: "default",
    Moderate: "secondary",
    Attention: "destructive",
  };
  return variants[status] || "default";
};

export default function AgronomistCrops() {
  const [fields, setFields] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [cropFilter, setCropFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/admin/fields/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then((d)=>setFields(Array.isArray(d?.results)? d.results : (d||[])))
      .catch(()=>setFields([]));
  }, []);

  const metrics = useMemo(() => {
    const totalFields = fields.length;
    const totalHectares = fields.reduce((acc, f)=> acc + (typeof (f.area?.hectares) === 'number' ? f.area.hectares : 0), 0);
    const totalAcres = totalHectares * 2.47105;
    const activeCrops = fields.filter((f)=> !!f.crop_name).length;
    return { totalFields, totalAcres: Math.round(totalAcres), activeCrops };
  }, [fields]);

  const filtered = useMemo(()=>{
    let rows = fields;
    const query = q.toLowerCase();
    if (region !== "all") rows = rows.filter((f:any)=> (f.location_name||"").toLowerCase().includes(region));
    if (cropFilter !== "all") rows = rows.filter((f:any)=> (f.crop_name||"").toLowerCase() === cropFilter);
    if (!query) return rows;
    return rows.filter((f:any)=> (`${f.name||''} ${f.crop_name||''} ${f.location_name||''}`).toLowerCase().includes(query));
  }, [fields, q, region, cropFilter]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Crops Management</h1>
        <p className="text-muted-foreground">Monitor and manage all agricultural fields</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total Fields" value={String(metrics.totalFields)} icon={MapPin} />
        <MetricCard label="Total Acres" value={String(metrics.totalAcres)} icon={Sprout} />
        <MetricCard label="Active Crops" value={String(metrics.activeCrops)} icon={Activity} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search fields..." className="pl-9" value={q} onChange={(e)=>setQ(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  <SelectItem value="north">North</SelectItem>
                  <SelectItem value="south">South</SelectItem>
                  <SelectItem value="east">East</SelectItem>
                  <SelectItem value="west">West</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cropFilter} onValueChange={setCropFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Crop Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Crops</SelectItem>
                  {Array.from(new Set(fields.map((f:any)=>f.crop_name).filter(Boolean))).map((c:any)=>(
                    <SelectItem key={c} value={String(c).toLowerCase()}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field ID</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Acres</TableHead>
                  <TableHead>Irrigation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f:any) => {
                  const acres = typeof (f.area?.hectares) === 'number' ? (f.area.hectares * 2.47105).toFixed(2) : '-';
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>{f.crop_name || '-'}</TableCell>
                      <TableCell>{f.location_name || '-'}</TableCell>
                      <TableCell>{acres}</TableCell>
                      <TableCell>{f.irrigation_method_name || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
