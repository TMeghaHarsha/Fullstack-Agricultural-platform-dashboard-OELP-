import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Plus, Send, Inbox } from "lucide-react";
import { toast } from "sonner";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AdminNotifications() {
  const [open, setOpen] = useState(false);
  const [targetRole, setTargetRole] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [notificationType, setNotificationType] = useState<string>("general");
  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [sentItems, setSentItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [allowedReceivers, setAllowedReceivers] = useState<string[]>([]);
  
  // Tags for filtering end-users
  const [region, setRegion] = useState<string>("");
  const [cropType, setCropType] = useState<string>("");

  useEffect(() => {
    loadNotifications();
    loadUsers();
    loadAllowedReceivers();
  }, []);

  const loadNotifications = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const [receivedRes, sentRes] = await Promise.all([
        fetch(`${API_URL}/admin/notifications/?type=received`, { headers: { Authorization: `Token ${token}` } }),
        fetch(`${API_URL}/admin/notifications/?type=sent`, { headers: { Authorization: `Token ${token}` } })
      ]);
      const receivedData = receivedRes.ok ? await receivedRes.json() : { results: [] };
      const sentData = sentRes.ok ? await sentRes.json() : { results: [] };
      setReceivedItems(Array.isArray(receivedData?.results) ? receivedData.results : (receivedData || []));
      setSentItems(Array.isArray(sentData?.results) ? sentData.results : (sentData || []));
    } catch {
      setReceivedItems([]);
      setSentItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const resp = await fetch(`${API_URL}/admin/users/`, { headers: { Authorization: `Token ${token}` } });
      if (resp.ok) {
        const d = await resp.json();
        setUsers(Array.isArray(d?.results) ? d.results : d || []);
      }
    } catch {
      setUsers([]);
    }
  };

  const loadAllowedReceivers = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const resp = await fetch(`${API_URL}/admin/notifications/allowed-receivers/`, { headers: { Authorization: `Token ${token}` } });
      if (resp.ok) {
        const data = await resp.json();
        setAllowedReceivers(data.allowed_receivers || []);
      }
    } catch {}
  };

  const recipients = useMemo(() => {
    if (!targetRole) return [] as any[];
    let pool = users.filter((u: any) => (u.roles || []).includes(targetRole));
    
    // Apply filters for End-App-User
    if (targetRole === 'End-App-User') {
      // Note: Filtering happens on backend, but we can show all end-users here
      pool = users.filter((u: any) => {
        const roles = u.roles || [];
        return roles.length === 0 || roles.every((r: string) => r === 'End-App-User');
      });
    }
    
    // Exclude SuperAdmin from all lists
    pool = pool.filter((u: any) => !((u.roles || []).includes('SuperAdmin')));
    return pool;
  }, [users, targetRole]);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const unread = receivedItems.filter((n: any) => n.is_read === false);
    await Promise.all(unread.map((n: any) => fetch(`${API_URL}/admin/notifications/${n.id}/mark-read/`, { method: 'POST', headers: { Authorization: `Token ${token}` } })));
    loadNotifications();
  };

  const send = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    if (!targetRole) {
      toast.error("Please select a receiver role");
      return;
    }
    if (!recipient) {
      toast.error("Please select a recipient");
      return;
    }

    const tags: any = {};
    if (targetRole === 'End-App-User') {
      if (region) tags.region = region;
      if (cropType) tags.crop_type = cropType;
    }

    const res = await fetch(`${API_URL}/admin/notifications/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
      body: JSON.stringify({ 
        message, 
        receiver: recipient,
        notification_type: notificationType,
        tags
      })
    });
    
    if (res.ok) {
      toast.success("Notification sent successfully");
      setOpen(false);
      setTargetRole("");
      setRecipient("");
      setMessage("");
      setRegion("");
      setCropType("");
      setNotificationType("general");
      loadNotifications();
    } else {
      const error = await res.json().catch(() => ({}));
      toast.error(error.detail || "Failed to send notification");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Manage system communications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllRead}><Check className="mr-2 h-4 w-4" />Mark All Read</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Send New Notification</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Receiver Role</Label>
                  <Select value={targetRole} onValueChange={(v) => { setTargetRole(v); setRecipient(""); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select receiver role" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedReceivers.map((role) => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {targetRole && (
                  <>
                    <div className="space-y-2">
                      <Label>Recipient</Label>
                      <Select value={recipient} onValueChange={setRecipient}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select recipient" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipients.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>{u.full_name || u.email || u.username}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {targetRole === 'End-App-User' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Region Filter (Optional)</Label>
                          <Input placeholder="e.g., Punjab" value={region} onChange={(e) => setRegion(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Crop Type Filter (Optional)</Label>
                          <Input placeholder="e.g., Wheat" value={cropType} onChange={(e) => setCropType(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={notificationType} onValueChange={setNotificationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter your message..." />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={send} disabled={!message || !targetRole || !recipient}>
                    <Send className="mr-2 h-4 w-4" />Send
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="received">
            <Inbox className="mr-2 h-4 w-4" />
            Received ({receivedItems.filter((n) => !n.is_read).length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="mr-2 h-4 w-4" />
            Sent ({sentItems.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Received Notifications</CardTitle>
              <CardDescription>Messages sent to you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {receivedItems.map((n: any) => (
                  <div key={n.id} className={`flex gap-4 p-4 rounded-lg border ${!n.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">From: {n.sender_name} ({n.sender_role})</p>
                        {!n.is_read && <Badge variant='secondary' className="h-5">new</Badge>}
                        <Badge variant='outline'>{n.notification_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.tags && Object.keys(n.tags).length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {Object.entries(n.tags).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {!loading && receivedItems.length === 0 && (
                  <div className="text-sm text-muted-foreground">No notifications received yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>Sent Notifications</CardTitle>
              <CardDescription>Messages you've sent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sentItems.map((n: any) => (
                  <div key={n.id} className="flex gap-4 p-4 rounded-lg border bg-card">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">To: {n.receiver_name} ({n.receiver_role})</p>
                        <Badge variant='outline'>{n.notification_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.tags && Object.keys(n.tags).length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {Object.entries(n.tags).map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {!loading && sentItems.length === 0 && (
                  <div className="text-sm text-muted-foreground">No notifications sent yet.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
