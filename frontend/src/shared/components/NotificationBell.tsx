import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserRoles } from "@/lib/auth";

const API_URL =
  (import.meta as any).env.VITE_API_URL ||
  (import.meta as any).env.REACT_APP_API_URL ||
  "/api";

// Helper to format sender display based on receiver role
function formatSenderDisplay(senderName: string | null | undefined, senderRole: string | null | undefined): string {
  if (!senderName && !senderRole) return "System";
  
  const currentUserRoles = getUserRoles();
  // Check if current user (receiver) is an end-user
  const isEndUser = currentUserRoles.some(
    (role) => {
      const normalized = role?.toLowerCase().replace(/[-_\s]/g, "");
      return normalized === "endappuser" || normalized === "enduser" || role === "End-App-User";
    }
  );
  
  // For end-users: show only the SENDER's role name (not the name)
  if (isEndUser) {
    return senderRole || "System";
  }
  
  // For other users: show "Name (Role)"
  if (senderName && senderRole) {
    return `${senderName} (${senderRole})`;
  }
  return senderName || senderRole || "System";
}

export function NotificationBell() {
  const [preview, setPreview] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<any | null>(null);

  const loadPreview = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const [listRes, countRes] = await Promise.all([
        fetch(`${API_URL}/notifications/?unread_only=true&page_size=5`, {
          headers: { Authorization: `Token ${token}` },
        }),
        fetch(`${API_URL}/notifications/unread_count/`, {
          headers: { Authorization: `Token ${token}` },
        }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        const items = Array.isArray(data?.results) ? data.results : data || [];
        setPreview(items.slice(0, 5));
      } else {
        setPreview([]);
      }
      if (countRes.ok) {
        const countData = await countRes.json();
        setUnreadCount(countData.count || 0);
      }
    } catch {
      setPreview([]);
    }
  }, []);

  const markNotificationRead = useCallback(
    async (id: number) => {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${API_URL}/notifications/${id}/mark_read/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
      });
      loadPreview();
    },
    [loadPreview]
  );

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    await fetch(`${API_URL}/notifications/mark_all_read/`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) loadPreview();
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold">
            <span>Notifications</span>
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={markAllRead}>
              Mark all read
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {preview.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">You're all caught up!</div>
            ) : (
              preview.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className={`flex flex-col items-start gap-1 py-3 text-sm ${
                    n.is_read ? "" : "bg-primary/5"
                  }`}
                  onClick={() => {
                    setActiveNotification(n);
                    if (!n.is_read) {
                      markNotificationRead(n.id);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">
                      From: {formatSenderDisplay(n.sender_name, n.sender_role)}
                    </p>
                    {!n.is_read && <Badge variant="secondary">new</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </DropdownMenuItem>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!activeNotification} onOpenChange={(next) => !next && setActiveNotification(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeNotification 
                ? formatSenderDisplay(activeNotification.sender_name, activeNotification.sender_role)
                : "Notification"}
            </DialogTitle>
            <DialogDescription>
              {activeNotification?.notification_type
                ? `Type: ${activeNotification.notification_type}`
                : undefined}
            </DialogDescription>
          </DialogHeader>
          {activeNotification && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{activeNotification.message}</p>
              {activeNotification.tags && Object.keys(activeNotification.tags).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(activeNotification.tags).map(([k, v]) => (
                    <Badge key={k} variant="secondary">
                      {k}: {String(v)}
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
    </>
  );
}

