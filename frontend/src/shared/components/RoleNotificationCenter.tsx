import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Send, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

type NotificationItem = {
  id: number;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_role?: string;
  receiver_name?: string;
  receiver_role?: string;
  tags?: Record<string, string>;
};

type Props = {
  title: string;
  description: string;
};

const API_URL =
  (import.meta as any).env.VITE_API_URL ||
  (import.meta as any).env.REACT_APP_API_URL ||
  "/api";

export default function RoleNotificationCenter({ title, description }: Props) {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const headers = useMemo(
    () => (token ? { Authorization: `Token ${token}`, "Content-Type": "application/json" } : {}),
    [token]
  );

  const [received, setReceived] = useState<NotificationItem[]>([]);
  const [sent, setSent] = useState<NotificationItem[]>([]);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [receiverRole, setReceiverRole] = useState("");
  const [message, setMessage] = useState("");
  const [notificationType, setNotificationType] = useState("general");
  const [region, setRegion] = useState("");
  const [cropType, setCropType] = useState("");
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [receivedRes, sentRes] = await Promise.all([
        fetch(`${API_URL}/notification-center/?type=received`, { headers }),
        fetch(`${API_URL}/notification-center/?type=sent`, { headers }),
      ]);
      const receivedData = receivedRes.ok ? await receivedRes.json() : [];
      const sentData = sentRes.ok ? await sentRes.json() : [];
      setReceived(Array.isArray(receivedData?.results) ? receivedData.results : receivedData || []);
      setSent(Array.isArray(sentData?.results) ? sentData.results : sentData || []);
    } catch {
      setReceived([]);
      setSent([]);
    } finally {
      setLoading(false);
    }
  }, [headers, token]);

  const fetchAllowedRoles = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_URL}/notification-center/allowed-receivers/`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        setAllowedRoles(data.allowed_receivers || []);
      }
    } catch {
      setAllowedRoles([]);
    }
  }, [headers, token]);

  useEffect(() => {
    fetchAllowedRoles();
    fetchNotifications();
  }, [fetchAllowedRoles, fetchNotifications]);

  const markAllRead = async () => {
    if (!token) return;
    await fetch(`${API_URL}/notifications/mark_all_read/`, {
      method: "POST",
      headers,
    });
    fetchNotifications();
  };

  const markRead = async (id: number) => {
    if (!token) return;
    await fetch(`${API_URL}/notifications/${id}/mark_read/`, {
      method: "POST",
      headers,
    });
    fetchNotifications();
  };

  const handleSend = async () => {
    if (!token) return;
    if (!receiverRole) {
      toast.error("Select a receiver role");
      return;
    }
    if (!message.trim()) {
      toast.error("Message is required");
      return;
    }
    setSending(true);
    try {
      const payload: Record<string, any> = {
        receiver_role: receiverRole,
        message,
        notification_type: notificationType,
      };
      if (receiverRole === "End-App-User") {
        if (region) payload.region = region;
        if (cropType) payload.crop_type = cropType;
        payload.tags = {
          ...(region ? { region } : {}),
          ...(cropType ? { crop_type: cropType } : {}),
        };
      }
      const resp = await fetch(`${API_URL}/notification-center/`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to send notification");
      }
      toast.success("Notification sent");
      setReceiverRole("");
      setMessage("");
      setRegion("");
      setCropType("");
      setNotificationType("general");
      fetchNotifications();
    } catch (error: any) {
      toast.error(error?.message || "Unable to send notification");
    } finally {
      setSending(false);
    }
  };

  const showSegmentation = receiverRole === "End-App-User";

  const renderNotificationCard = (item: NotificationItem, variant: "received" | "sent") => (
    <button
      key={item.id}
      className={`w-full rounded-lg border p-4 text-left transition ${
        !item.is_read && variant === "received" ? "bg-primary/5 border-primary/30" : "bg-card"
      }`}
      onClick={() => {
        setActiveNotification(item);
        if (variant === "received" && !item.is_read) {
          markRead(item.id);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Badge variant="outline">{variant === "received" ? "Received" : "Sent"}</Badge>
        <Badge variant="secondary">{item.notification_type}</Badge>
      </div>
      <p className="mt-2 font-semibold text-sm">
        {variant === "received"
          ? `From: ${item.sender_name || "System"}`
          : `To: ${item.receiver_name || "Recipient"}`}
      </p>
      <p className="text-sm text-muted-foreground line-clamp-2">{item.message}</p>
      {item.tags && Object.keys(item.tags).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(item.tags).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {String(value)}
            </Badge>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {new Date(item.created_at).toLocaleString()}
      </p>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllRead}>
            <Check className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        </div>
      </div>

      {allowedRoles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Notification</CardTitle>
            <CardDescription>Choose who should receive this message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Receiver Role</Label>
              <Select value={receiverRole} onValueChange={(v) => setReceiverRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showSegmentation && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Region Tag</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g., Punjab" />
                </div>
                <div className="space-y-2">
                  <Label>Crop Type Tag</Label>
                  <Input value={cropType} onChange={(e) => setCropType(e.target.value)} placeholder="e.g., Wheat" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notification Type</Label>
              <Select value={notificationType} onValueChange={setNotificationType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter your message..." />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={sending || !receiverRole || !message}>
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="received">
            <Inbox className="mr-2 h-4 w-4" />
            Received ({received.filter((n) => !n.is_read).length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="mr-2 h-4 w-4" />
            Sent ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Received Notifications</CardTitle>
              <CardDescription>Messages sent to you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {received.map((item) => renderNotificationCard(item, "received"))}
              {!loading && received.length === 0 && (
                <p className="text-sm text-muted-foreground">No notifications received yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>Sent Notifications</CardTitle>
              <CardDescription>Messages you've delivered</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sent.map((item) => renderNotificationCard(item, "sent"))}
              {!loading && sent.length === 0 && (
                <p className="text-sm text-muted-foreground">No notifications sent yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!activeNotification} onOpenChange={(open) => !open && setActiveNotification(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeNotification?.sender_name || activeNotification?.receiver_name || "Notification"}
            </DialogTitle>
            <DialogDescription>
              {activeNotification?.notification_type
                ? `Type: ${activeNotification.notification_type}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {activeNotification && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{activeNotification.message}</p>
              {activeNotification.tags && Object.keys(activeNotification.tags).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(activeNotification.tags).map(([key, value]) => (
                    <Badge key={key} variant="secondary">
                      {key}: {String(value)}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(activeNotification.created_at).toLocaleString()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

