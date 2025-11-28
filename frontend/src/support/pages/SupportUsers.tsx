import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search } from "lucide-react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

interface UserRow { id: number; username?: string; email?: string; full_name?: string; roles?: string[]; date_joined?: string; phone_number?: string }

export default function SupportUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    (async () => {
      try {
        let resp = await fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } });
        if (!resp.ok) throw new Error(String(resp.status));
        let d = await resp.json();
        const arr = Array.isArray(d?.results) ? d.results : (d || []);
        const filtered = arr.filter((u:any) => !((u.roles || []).includes('SuperAdmin')));
        setUsers(filtered);
      } catch {
        try {
          let resp2 = await fetch(`${API_URL}/users/`, { headers: { Authorization: `Token ${token}` } });
          let d2 = resp2.ok ? await resp2.json() : null;
          const arr2 = Array.isArray(d2?.results) ? d2.results : (d2 || []);
          const normalized = arr2.map((u:any) => ({ ...u, roles: Array.isArray(u?.roles) ? u.roles : [] }));
          const filtered2 = normalized.filter((u:any) => !((u.roles || []).includes('SuperAdmin')));
          setUsers(filtered2);
        } catch {
          setUsers([]);
        }
      }
    })();
  }, []);

  const visible = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') {
      if (roleFilter === 'End-App-User') {
        list = list.filter(u => (u.roles || []).length === 0 || (u.roles || []).every(r => r === 'End-App-User'));
      } else {
        list = list.filter(u => (u.roles || []).includes(roleFilter));
      }
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(u =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, query]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => (u.roles || []).forEach(r => set.add(r)));
    set.add('End-App-User');
    set.delete('SuperAdmin');
    return Array.from(set);
  }, [users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground">Browse and search users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={query} onChange={(e)=> setQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {allRoles.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {(u.full_name || u.username || '?').split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{u.full_name || u.username || u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{u.email || '-'}</TableCell>
                    <TableCell>{u.phone_number || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles && u.roles.length > 0 ? u.roles : ['End-App-User']).filter(r => r !== 'SuperAdmin').map(r => (
                          <Badge key={r} variant="secondary">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{u.date_joined ? new Date(u.date_joined).toLocaleDateString() : '-'}</TableCell>
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
