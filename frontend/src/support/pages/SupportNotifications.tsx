import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, Plus } from "lucide-react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function SupportNotifications() {
  const [open, setOpen] = useState(false);
  const [cause, setCause] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>("");
  const [payload, setPayload] = useState<{ receiver: string; message: string }>({ receiver: "__REQUIRED__", message: "" });
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<{ id?: number; roles?: string[] } | null>(null);

  const templates = useMemo(() => ({
    sla_breach: "SLA Breach Notice: We're working to resolve delays.",
    maintenance_window: "Planned Maintenance: Service may be impacted during the window.",
    incident_update: "Incident Update: We are investigating reported issues.",
    resolution_summary: "Ticket Resolution Summary: Your ticket has been resolved.",
    account_assistance: "Account Assistance: We require additional information to proceed.",
  }), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    // load me
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then((d)=> setMe(d||null))
      .catch(()=> setMe(null));
    // load notifications
    fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then((d)=> {
        const arr = Array.isArray(d?.results) ? d.results : (d||[]);
        // filter out the specific message only for support role UI
        const filtered = arr.filter((n:any) => n.message !== "Security Alert: Unusual activity detected. Please review and confirm.");
        setItems(filtered);
      })
      .catch(()=> setItems([]))
      .finally(()=> setLoading(false));
    // load users for recipient selection with fallback if support cannot access admin/users
    (async () => {
      try {
        let resp = await fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } });
        if (!resp.ok) throw new Error(String(resp.status));
        let d = await resp.json();
        setUsers(Array.isArray(d?.results) ? d.results : d || []);
      } catch {
        try {
          let resp2 = await fetch(`${API_URL}/users/`, { headers: { Authorization: `Token ${token}` } });
          let d2 = resp2.ok ? await resp2.json() : null;
          setUsers(Array.isArray(d2?.results) ? d2.results : d2 || []);
        } catch {
          setUsers([]);
        }
      }
    })();
  }, []);

  const recipients = useMemo(() => {
    if (!targetRole) return [] as any[];
    let pool = users as any[];
    if (targetRole === 'End-App-User') {
      pool = pool.filter(u => (u.roles || []).length === 0 || (u.roles || []).every((r:string) => r === 'End-App-User'));
    } else {
      pool = pool.filter(u => (u.roles || []).includes(targetRole));
    }
    // exclude SuperAdmin from being a recipient regardless
    pool = pool.filter(u => !((u.roles||[]).includes('SuperAdmin')));
    return pool;
  }, [users, targetRole]);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const unread = items.filter((n:any)=> n.is_read === false);
    await Promise.all(unread.map((n:any)=> fetch(`${API_URL}/notifications/${n.id}/mark_read/`, { method: 'POST', headers: { Authorization: `Token ${token}` } })));
    const d = await fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null);
    const arr = Array.isArray(d?.results) ? d.results : (d||[]);
    setItems(arr.filter((n:any) => n.message !== "Security Alert: Unusual activity detected. Please review and confirm."));
  };

  const send = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!payload.message) return;
    if (!recipients.some((u:any)=> String(u.id) === String(payload.receiver))) return;
    const res = await fetch(`${API_URL}/admin/notifications/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
      body: JSON.stringify({ message: payload.message, receiver: payload.receiver })
    });
    if (res.ok) {
      setOpen(false);
      setCause("");
      setTargetRole("");
      setPayload({ receiver: "__REQUIRED__", message: "" });
      // reload notifications
      const d = await fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null);
      const arr = Array.isArray(d?.results) ? d.results : (d||[]);
      setItems(arr.filter((n:any) => n.message !== "Security Alert: Unusual activity detected. Please review and confirm."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Support alerts and communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllRead}><Check className="mr-2 h-4 w-4" />Mark All Read</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Create New Notification</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Cause</Label>
                  <Select value={cause} onValueChange={(v)=> { setCause(v); setPayload(p=>({ ...p, message: (templates as any)[v] || p.message })); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cause" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sla_breach">SLA Breach Notice</SelectItem>
                      <SelectItem value="maintenance_window">Planned Maintenance Window</SelectItem>
                      <SelectItem value="incident_update">Incident Update</SelectItem>
                      <SelectItem value="resolution_summary">Ticket Resolution Summary</SelectItem>
                      <SelectItem value="account_assistance">Account Assistance Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={targetRole} onValueChange={(v)=> { setTargetRole(v); setPayload(p=>({ ...p, receiver: "__REQUIRED__" })); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="End-App-User">End User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Analyst">Analyst</SelectItem>
                      <SelectItem value="Agronomist">Agronomist</SelectItem>
                      <SelectItem value="Support">Support</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Developer">Developer</SelectItem>
                      {/* SuperAdmin intentionally omitted */}
                    </SelectContent>
                  </Select>
                </div>
                {targetRole && (
                  <div className="space-y-2">
                    <Label>Recipient</Label>
                    <Select value={payload.receiver} onValueChange={(v) => setPayload({ ...payload, receiver: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {recipients.map((u)=> (
                          <SelectItem key={u.id} value={String(u.id)}>{u.full_name || u.email || u.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea rows={4} value={payload.message} onChange={(e) => setPayload({ ...payload, message: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={send} disabled={payload.receiver === "__REQUIRED__" || !payload.message}>Send</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>Support-related notices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {items.map((n:any) => (
              <div key={n.id} className={`flex gap-4 p-4 rounded-lg border ${!n.is_read ? 'bg-primary-light border-primary/20' : 'bg-card'}`}>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">Notification</p>
                    {!n.is_read && <Badge variant='secondary' className="h-5">new</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!loading && items.length===0 && (
              <div className="text-sm text-muted-foreground">No notifications yet.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
