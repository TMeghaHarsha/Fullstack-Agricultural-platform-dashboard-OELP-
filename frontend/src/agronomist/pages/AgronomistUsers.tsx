import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users as UsersIcon, UserCheck, TrendingUp } from "lucide-react";
import { MetricCard } from "../../admin/components/dashboard/MetricCard";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

interface Row { id:number; full_name?:string; email?:string; phone_number?:string; roles?:string[]; date_joined?:string; created_by_name?:string }

export default function AgronomistUsers() {
  const [data, setData] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [joined, setJoined] = useState<string>("all");
  const [me, setMe] = useState<{ created_by_id?: number; created_by_name?: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/users/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((d) => setData(Array.isArray(d?.results) ? d.results : (d || [])))
      .catch(() => setData([]));
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then((d) => setMe(d || null))
      .catch(() => setMe(null));
  }, []);

  const metrics = useMemo(() => {
    const total = data.length;
    const active = data.filter((u:any) => u.is_active !== false).length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
    const newWeek = data.filter((u:any) => u.date_joined && new Date(u.date_joined) >= weekAgo).length;
    return { total, active, newWeek };
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = data;
    if (joined !== "all") {
      const now = new Date();
      const cutoff = new Date(joined === "7d" ? now.getTime() - 7*24*60*60*1000 : now.getTime() - 30*24*60*60*1000);
      rows = rows.filter(u => u.date_joined && new Date(u.date_joined) >= cutoff);
    }
    if (!q) return rows;
    return rows.filter(u => (`${u.full_name||''} ${u.email||''} ${u.phone_number||''}`).toLowerCase().includes(q));
  }, [data, search, joined]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Overview of platform users</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Users" value={String(metrics.total)} icon={UsersIcon} />
        <MetricCard label="Active Users" value={String(metrics.active)} icon={UserCheck} />
        <MetricCard label="New This Week" value={String(metrics.newWeek)} icon={TrendingUp} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>Read-only list</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="max-w-sm w-full">
              <Input placeholder="Search name/email/phone" value={search} onChange={(e)=>setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={joined} onValueChange={setJoined}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Joined" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Joined last 7 days</SelectItem>
                  <SelectItem value="30d">Joined last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {me?.created_by_name && (
                  <TableRow>
                    <TableCell className="font-medium">{me.created_by_name}</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Admin</Badge>
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '-'}</TableCell>
                    <TableCell>{u.email || '-'}</TableCell>
                    <TableCell>{u.phone_number || '-'}</TableCell>
                    <TableCell>
                      {(u.roles||[]).map((r) => (
                        <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>
                      ))}
                    </TableCell>
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
