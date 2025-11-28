import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, UserPlus, Shield, Trash2 } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

interface UserRow { id: number; username: string; email: string; full_name: string; roles?: string[]; date_joined?: string; phone_number?: string; created_by_name?: string; created_by_id?: number }

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [me, setMe] = useState<{ id?: number; roles?: string[]; created_by_id?: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", full_name: "", phone_number: "", region: "" });
  const [role, setRole] = useState<string>("Analyst");
  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [metrics, setMetrics] = useState({
    total_users: 0,
    total_employees: 0,
    active_users: 0,
    total_admins: 0,
    new_this_week: 0
  });

  const token = localStorage.getItem("token");

  const loadUsers = () => {
    fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const usersData = Array.isArray(d?.results) ? d.results : d || [];
        setUsers(usersData);
        
        // Calculate metrics (end-users only)
        const isEndUserOnly = (u:any) => {
          const roles = u.roles || [];
          const uniq = Array.from(new Set(roles));
          if (uniq.length === 0) return true; // treat missing roles as end-user fallback
          return uniq.every((r:string) => r === 'End-App-User');
        };
        const endUsers = usersData.filter(isEndUserOnly);
        const totalUsers = endUsers.length;
        const activeUsers = endUsers.filter((u: any) => u.is_active !== false).length;
        const totalAdmins = usersData.filter((u: any) => (u.roles || []).includes('Admin')).length;
        const totalEmployees = usersData.filter((u: any) => (u.roles || []).some((r: string) => ['Analyst','Agronomist','Support','Business','Developer'].includes(r))).length;
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
        const newThisWeek = usersData.filter((u:any) => u.date_joined && new Date(u.date_joined) >= weekAgo).length;
        
        setMetrics({
          total_users: totalUsers,
          total_employees: totalEmployees,
          active_users: activeUsers,
          total_admins: totalAdmins,
          new_this_week: newThisWeek
        });
      })
      .catch(() => {});
  };

  useEffect(() => { 
    loadUsers(); 
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => {});
  }, []);

  const createEmployeeOrAdmin = async () => {
    const roles = me?.roles || [];
    const isSuperAdmin = roles.includes('SuperAdmin');
    const isAdmin = roles.includes('Admin');
    if (!form.full_name || !form.password || !form.region) {
      toast.error("Fill all required fields");
      return;
    }
    
    // Generate a username if missing (no domain, backend will set email)
    const base = form.full_name.toLowerCase().replace(/\s+/g, '.');
    const username = form.username || base;

    if (isSuperAdmin) {
      // Create Admin only (no role selection)
      const res = await fetch(`${API_URL}/admin/users/create-admin/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({ full_name: form.full_name, username, password: form.password, region: form.region, phone_number: form.phone_number }),
      });
      if (res.ok) {
        toast.success("Admin created successfully");
        setOpen(false);
        setForm({ username: "", password: "", full_name: "", phone_number: "", region: "" });
        loadUsers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Failed to create admin");
      }
    } else if (isAdmin) {
      // Create employee by signup then assign role (exclude End-User and SuperAdmin)
      const res = await fetch(`${API_URL}/auth/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: form.password, full_name: form.full_name, phone_number: form.phone_number || "0000000000" }),
      });
      if (res.ok) {
        const data = await res.json();
        const uid = data?.user?.id;
        if (["SuperAdmin","End-App-User"].includes(role)) {
          toast.error("Invalid role selection");
          return;
        }
        await fetch(`${API_URL}/admin/users/${uid}/assign-role/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
          body: JSON.stringify({ role }),
        });
        toast.success("Employee created successfully");
        setOpen(false);
        setForm({ username: "", password: "", full_name: "", phone_number: "", region: "" });
        loadUsers();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Failed to create employee");
      }
    }
  };

  const deleteUser = async (user: UserRow) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    
    const res = await fetch(`${API_URL}/admin/users/${user.id}/`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    });
    
    if (res.ok) {
      toast.success("User deleted successfully");
      loadUsers();
    } else {
      toast.error("Failed to delete user");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users Management</h1>
        <p className="text-muted-foreground">Manage users and administrators</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.total_users}</div>
            <p className="text-xs text-muted-foreground">All users</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.active_users}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{(me?.roles||[]).includes('SuperAdmin') ? 'New This Week' : 'Total Employees'}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{(me?.roles||[]).includes('SuperAdmin') ? metrics.new_this_week : metrics.total_employees}</div>
            <p className="text-xs text-muted-foreground">{(me?.roles||[]).includes('SuperAdmin') ? 'Joined in last 7 days' : 'All employees'}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{(me?.roles||[]).includes('Admin') && !(me?.roles||[]).includes('SuperAdmin') ? 'New This Week' : 'Total Admins'}</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{(me?.roles||[]).includes('Admin') && !(me?.roles||[]).includes('SuperAdmin') ? metrics.new_this_week : metrics.total_admins}</div>
            <p className="text-xs text-muted-foreground">{(me?.roles||[]).includes('Admin') && !(me?.roles||[]).includes('SuperAdmin') ? 'Joined in last 7 days' : 'Admin team'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">All Users</h2>
          <p className="text-muted-foreground">Manage users and administrators</p>
        </div>
        <div className="flex items-center gap-2">
          {(me?.roles||[]).includes('SuperAdmin') && (
            <Button
              variant="outline"
              onClick={async () => {
                const res = await fetch(`${API_URL}/admin/users/dedupe-roles-bulk/`, { method: 'POST', headers: { Authorization: `Token ${token}` } });
                if (res.ok) {
                  const d = await res.json().catch(() => ({}));
                  toast.success(`Deduped roles${d?.removed !== undefined ? `, removed ${d.removed}` : ''}`);
                  loadUsers();
                } else {
                  toast.error('Failed to dedupe roles');
                }
              }}
            >Dedupe Roles</Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              {(me?.roles||[]).includes('SuperAdmin') ? 'Add Admin' : 'Add Employee'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{(me?.roles||[]).includes('SuperAdmin') ? 'Add New Admin' : 'Add New Employee'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. john.doe" />
              </div>
              <div className="space-y-2">
                <Label>Region *</Label>
                <Select value={form.region} onValueChange={(value) => setForm({ ...form, region: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="North">North</SelectItem>
                    <SelectItem value="South">South</SelectItem>
                    <SelectItem value="East">East</SelectItem>
                    <SelectItem value="West">West</SelectItem>
                    <SelectItem value="Central">Central</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <p className="text-xs text-muted-foreground">For Admins, email will be username@agriplatform.com</p>
              </div>
              {!(me?.roles||[]).includes('SuperAdmin') && (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Analyst">Analyst</SelectItem>
                      <SelectItem value="Agronomist">Agronomist</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Developer">Developer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={createEmployeeOrAdmin}>{(me?.roles||[]).includes('SuperAdmin') ? 'Create Admin' : 'Create Employee'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    {/* Filters */}
    <div className="flex flex-wrap gap-3 items-center">
      <div className="w-64">
        <Input placeholder="Search name/email/phone" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="w-56">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger><SelectValue placeholder="Filter by role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="EMPLOYEES">Employees</SelectItem>
            <SelectItem value="USERS">End Users</SelectItem>
            <SelectItem value="ADMINS">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    {/* Analytics Section */}
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>User Signups Over Time</CardTitle>
          <CardDescription>Monthly</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={useMemo(() => {
              const byMonth: Record<string, number> = {};
              users.forEach((u:any) => {
                const m = (u.date_joined || '').slice(0,7) || 'unknown';
                byMonth[m] = (byMonth[m] || 0) + 1;
              });
              return Object.keys(byMonth).sort().map(m => ({ month: m, count: byMonth[m] }));
            }, [users])}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
          <CardDescription>Excludes End-App-User</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={useMemo(() => {
                const map: Record<string, number> = {};
                users.forEach((u:any) => (u.roles||[]).forEach((r:string) => {
                  if (r === 'End-App-User') return;
                  map[r] = (map[r] || 0) + 1;
                }));
                return Object.keys(map).map(k => ({ name: k, value: map[k] }));
              }, [users])} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {useMemo(() => {
                  const arr: JSX.Element[] = [];
                  const colors = ['hsl(var(--chart-1))','hsl(var(--chart-2))','hsl(var(--chart-3))','hsl(var(--chart-4))'];
                  const map: Record<string, number> = {};
                  users.forEach((u:any) => (u.roles||[]).forEach((r:string) => { if (r !== 'End-App-User') map[r]=(map[r]||0)+1; }));
                  const data = Object.keys(map).map(k => ({ name: k, value: map[k] }));
                  data.forEach((_, idx) => arr.push(<Cell key={idx} fill={colors[idx % colors.length]} />));
                  return arr;
                }, [users])}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>All Users</CardTitle>
        <CardDescription>Users and managers only (other roles managed by managers)</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        )}
        {users.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.filter(u => {
                  const r = u.roles || [];
                  const isSuper = (me?.roles||[]).includes('SuperAdmin');
                  const isAdmin = (me?.roles||[]).includes('Admin') && !isSuper;
                  const text = (u.full_name||'') + ' ' + (u.email||'') + ' ' + (u.phone_number||'');
                  if (search && !text.toLowerCase().includes(search.toLowerCase())) return false;
                  if (roleFilter !== 'ALL') {
                    const isEmployee = r.some(x => ['Analyst','Agronomist','Support','Business','Developer'].includes(x));
                    const isEndUser = r.length === 0 || r.every(x => x === 'End-App-User');
                    const isAdminRole = r.includes('Admin') && !r.includes('SuperAdmin');
                    if (roleFilter === 'EMPLOYEES' && !isEmployee) return false;
                    if (roleFilter === 'USERS' && !isEndUser) return false;
                    if (roleFilter === 'ADMINS' && !isAdminRole) return false;
                  }
                  if (isSuper) {
                    return r.length === 0 || r.some(x => ['Admin','SuperAdmin','End-App-User'].includes(x));
                  }
                  if (isAdmin) {
                    const createdByMe = u.created_by_id && me?.id && Number(u.created_by_id) === Number(me.id);
                    const isSUWhoCreatedMe = me?.created_by_id && Number(u.id) === Number(me.created_by_id);
                    const isEmployee = r.some(x => ['Analyst','Agronomist','Support','Business','Developer'].includes(x));
                    const isEndUser = r.length === 0 || r.every(x => x === 'End-App-User');
                    return createdByMe && (isEmployee || isEndUser) || isSUWhoCreatedMe;
                  }
                  return true;
                }).map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone_number || '-'}</TableCell>
                    <TableCell>
                      {(() => {
                        const rr = (u.roles || []);
                        const hasOther = rr.some((x:string) => x !== 'End-App-User');
                        const show = hasOther ? rr.filter((x:string) => x !== 'End-App-User') : rr;
                        return show.map((r) => (
                          <Badge key={r} variant="secondary" className="mr-1">{r}</Badge>
                        ));
                      })()}
                    </TableCell>
                    <TableCell>{u.created_by_name || '-'}</TableCell>
                    <TableCell>
                      { (() => {
                          const r = u.roles || [];
                          const isSuper = (me?.roles||[]).includes('SuperAdmin');
                          const isAdminRole = (me?.roles||[]).includes('Admin');
                          const isUAdmin = r.includes('Admin') && !r.includes('SuperAdmin');
                          const isUEmployee = r.some(x => ['Analyst','Agronomist','Support','Business','Developer'].includes(x));
                          if (isSuper && isUAdmin) return true;
                          if (!isSuper && isAdminRole && isUEmployee) return true;
                          return false;
                        })() && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => deleteUser(u)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
  );
}
