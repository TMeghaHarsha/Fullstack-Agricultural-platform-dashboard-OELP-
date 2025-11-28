import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, User, Shield } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const [supportData, setSupportData] = useState({ category: "", description: "" });
  const [me, setMe] = useState<{ full_name?: string; email?: string; roles?: string[] } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => {});
    const loadNotifications = async () => {
      try {
        const res = await fetch(`${API_URL}/notifications/`, { headers: { Authorization: `Token ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data.results) ? data.results : data;
          setNotifications(items.slice(0, 5));
        }
      } catch {}
    };
    loadNotifications();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleSupportSubmit = async () => {
    if (!supportData.category || !supportData.description) {
      toast.error("Please fill in all fields");
      return;
    }
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/support/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
      body: JSON.stringify({ category: supportData.category, description: supportData.description }),
    });
    if (res.ok) {
      toast.success("Support request submitted successfully");
      setShowSupportDialog(false);
      setSupportData({ category: "", description: "" });
    } else {
      toast.error("Failed to submit support request");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-6">
            <SidebarTrigger className="text-primary" />
            <div className="flex items-center gap-4">
              <DropdownMenu open={showNotifications} onOpenChange={setShowNotifications}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <div className="px-2 py-1 text-sm text-muted-foreground">
                    {notifications.length === 0 ? "No notifications" : "Latest updates"}
                  </div>
                  {notifications.map((n) => (
                    <DropdownMenuItem key={n.id} className="whitespace-normal text-sm">
                      {n.message}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {me?.full_name || "—"}
                        {(me?.roles || []).length > 0 && (me?.roles || [])[0] !== "End-App-User" && (
                          <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            <Shield className="h-3 w-3" />
                            {(me?.roles || [])[0]}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{me?.email || "—"}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowFaqDialog(true)}>
                    FAQ
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowSupportDialog(true)}>
                    Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowLogoutDialog(true)} className="text-destructive">
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          
          <main className="flex-1 p-6 bg-background">
            {children}
          </main>
        </div>
      </div>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access your dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, stay logged in</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Yes, logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showFaqDialog} onOpenChange={setShowFaqDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Frequently Asked Questions</DialogTitle>
            <DialogDescription>
              Find answers to common questions about our agricultural management platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I add a new crop to my farm?</h4>
                <p className="text-sm text-muted-foreground">
                  A: Go to the Crops page and click "Add Crop". Fill in the required fields including name, season, status, and planted date. You can also specify variety, sowing date, and harvesting date.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I track my field's irrigation?</h4>
                <p className="text-sm text-muted-foreground">
                  A: On the Fields page, you can set irrigation methods for each field and schedule irrigation activities. The system will track and display your irrigation practices.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I generate soil reports?</h4>
                <p className="text-sm text-muted-foreground">
                  A: Go to the Fields page and click "Generate Soil Report". Select the field and enter soil analysis data including pH and EC values.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I view my farm analytics?</h4>
                <p className="text-sm text-muted-foreground">
                  A: Visit the Reports page to see comprehensive analytics including crop distribution, field growth over time, and subscription plan mix.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I change my subscription plan?</h4>
                <p className="text-sm text-muted-foreground">
                  A: Go to the Subscriptions page to view available plans and upgrade or downgrade your current subscription.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I export my data?</h4>
                <p className="text-sm text-muted-foreground">
                  A: On the Reports page, you can download CSV files or export PDF reports by selecting the specific analytics you want to include.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm mb-2">Q: How do I delete my account?</h4>
                <p className="text-sm text-muted-foreground">
                  A: Go to Settings and scroll down to the "Danger Zone" section. Click "Delete Account" and follow the confirmation steps.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSupportDialog} onOpenChange={setShowSupportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Tell us about the issue you're facing and we'll help you resolve it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={supportData.category} onValueChange={(value) => setSupportData({ ...supportData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crop">Crop Related</SelectItem>
                  <SelectItem value="transaction">Transaction</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="software">Software Issue/Glitches</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe your problem..."
                value={supportData.description}
                onChange={(e) => setSupportData({ ...supportData, description: e.target.value })}
                rows={5}
              />
            </div>
            <Button onClick={handleSupportSubmit} className="w-full">
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
