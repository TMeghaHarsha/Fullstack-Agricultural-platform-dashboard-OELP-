import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

interface FieldRow { id: number; name: string; crop?: number; crop_variety?: number; crop_name?: string; crop_variety_name?: string; location_name?: string; area?: any; soil_type_name?: string; created_at?: string; current_harvesting_date?: string }

export default function AdminCrops() {
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [filters, setFilters] = useState({ crop: "__ALL__", variety: "__ALL__", soil: "__ALL__", location: "__ALL__" });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    setLoading(true);
    setError("");
    fetch(`${API_URL}/admin/fields/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load fields");
        return r.json();
      })
      .then((d) => setFields(Array.isArray(d?.results) ? d.results : d || []))
      .catch((e) => setError(e?.message || "Failed to load fields"))
      .finally(() => setLoading(false));
  }, []);

  const uniqueCrops = useMemo(() => Array.from(new Set(fields.map(f => f.crop_name).filter(Boolean))) as string[], [fields]);
  const uniqueVarieties = useMemo(() => Array.from(new Set(fields.map(f => f.crop_variety_name).filter(Boolean))) as string[], [fields]);
  const uniqueSoils = useMemo(() => Array.from(new Set(fields.map(f => f.soil_type_name).filter(Boolean))) as string[], [fields]);
  const uniqueLocations = useMemo(() => Array.from(new Set(fields.map(f => f.location_name).filter(Boolean))) as string[], [fields]);

  const filtered = useMemo(() => fields.filter(f => {
    return (
      (filters.crop === "__ALL__" || f.crop_name === filters.crop) &&
      (filters.variety === "__ALL__" || f.crop_variety_name === filters.variety) &&
      (filters.soil === "__ALL__" || f.soil_type_name === filters.soil) &&
      (filters.location === "__ALL__" || f.location_name === filters.location)
    );
  }), [fields, filters]);

  // Stats
  const totalFields = filtered.length;
  const activeCrops = filtered.filter(f => !!f.crop_name).length;
  const harvestsThisMonth = filtered.filter(f => {
    const d = f.current_harvesting_date ? new Date(f.current_harvesting_date) : null;
    const now = new Date();
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const uniqueCropsCount = useMemo(() => uniqueCrops.length, [uniqueCrops]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crops Management</h1>
        <p className="text-muted-foreground">Manage fields and crop assignments</p>
      </div>

      {loading && (
        <Card>
          <CardHeader><CardTitle>Loading...</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Fetching fields data, please wait.</p>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Fields</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{totalFields}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Active Crops</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{activeCrops}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Harvests This Month</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{harvestsThisMonth}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Unique Crops</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{uniqueCropsCount}</div></CardContent>
        </Card>
      </div>

      {!loading && (
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Select value={filters.crop} onValueChange={(v) => setFilters({ ...filters, crop: v })}>
              <SelectTrigger><SelectValue placeholder="Crop" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All</SelectItem>
                {uniqueCrops.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.variety} onValueChange={(v) => setFilters({ ...filters, variety: v })}>
              <SelectTrigger><SelectValue placeholder="Variety" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All</SelectItem>
                {uniqueVarieties.map(v => (<SelectItem key={v} value={v}>{v}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.soil} onValueChange={(v) => setFilters({ ...filters, soil: v })}>
              <SelectTrigger><SelectValue placeholder="Soil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All</SelectItem>
                {uniqueSoils.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={filters.location} onValueChange={(v) => setFilters({ ...filters, location: v })}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__ALL__">All</SelectItem>
                {uniqueLocations.map(l => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      )}
      {!loading && (
      <Card>
        <CardHeader>
          <CardTitle>All Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Variety</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Soil</TableHead>
                  <TableHead>Hectares</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{f.crop_name || '-'}</TableCell>
                    <TableCell>{f.crop_variety_name || '-'}</TableCell>
                    <TableCell>{f.location_name || "-"}</TableCell>
                    <TableCell><Badge variant="secondary">{f.soil_type_name || "-"}</Badge></TableCell>
                    <TableCell>{(f.area || {}).hectares ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
