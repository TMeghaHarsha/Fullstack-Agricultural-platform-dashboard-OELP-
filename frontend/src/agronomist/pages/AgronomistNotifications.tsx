import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";

export default function AgronomistNotifications() {
  const [open, setOpen] = useState(false);
  const [cause, setCause] = useState<string>("");
  const [role, setRole] = useState<string>("end_users");
  const [segment, setSegment] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const templates = useMemo(() => ({
    fertilization: "Fertilization Reminder: Apply NPK as per schedule.",
    irrigation: "Irrigation Schedule: Water application due tomorrow.",
    pest_alert: "Pest Alert: Monitor for signs and apply recommended treatment.",
    soil_amend: "Soil Amendment Recommendation: Add organic matter to improve soil.",
    harvest: "Harvest Window: Ideal harvest window opens next week.",
    growth_stage: "Growth Stage Update: Crop entering flowering stage, adjust practices.",
  }), []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } })
      .then(r=>r.ok?r.json():null)
      .then((d)=> setItems(Array.isArray(d?.results) ? d.results : (d||[])))
      .catch(()=> setItems([]))
      .finally(()=> setLoading(false));
  }, []);

  const markAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const unread = items.filter((n:any)=> n.is_read === false);
    await Promise.all(unread.map((n:any)=> fetch(`${API_URL}/notifications/${n.id}/mark_read/`, { method: 'POST', headers: { Authorization: `Token ${token}` } })));
    // Refresh
    const d = await fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } }).then(r=>r.ok?r.json():null);
    setItems(Array.isArray(d?.results) ? d.results : (d||[]));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground">Crop advisories and field communications</p>
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
                  <Label>Template</Label>
                  <Select value={cause} onValueChange={(v) => { setCause(v); setMessage((templates as any)[v] || ""); }}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fertilization">Fertilization Reminder</SelectItem>
                      <SelectItem value="irrigation">Irrigation Schedule</SelectItem>
                      <SelectItem value="pest_alert">Pest Alert</SelectItem>
                      <SelectItem value="soil_amend">Soil Amendment</SelectItem>
                      <SelectItem value="harvest">Harvest Window</SelectItem>
                      <SelectItem value="growth_stage">Growth Stage Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Recipient Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="end_users">End-Users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Segmentation</Label>
                  <Select value={segment} onValueChange={setSegment}>
                    <SelectTrigger><SelectValue placeholder="Select segment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crop_type">By Crop Type</SelectItem>
                      <SelectItem value="growth_stage">By Growth Stage</SelectItem>
                      <SelectItem value="soil_type">By Soil Type</SelectItem>
                      <SelectItem value="region_field">By Region/Field</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => setOpen(false)}>Send</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Notifications</CardTitle>
          <CardDescription>Crop-related advisories</CardDescription>
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
