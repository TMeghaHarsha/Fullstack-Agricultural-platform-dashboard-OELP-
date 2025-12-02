import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { User, Shield } from "lucide-react";
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
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { NotificationBell } from "@/shared/components/NotificationBell";
import Agribot from "./Agribot";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [showFaqDialog, setShowFaqDialog] = useState(false);
  const [supportData, setSupportData] = useState({
    title: "",
    category: "general",
    priority: "medium",
    description: "",
  });
  const [me, setMe] = useState<{ full_name?: string; email?: string; roles?: string[] } | null>(null);
  const [userPlan, setUserPlan] = useState<any | null>(null);
  const [isEnterprise, setIsEnterprise] = useState(false);

  const API_URL =
    (import.meta as any).env.VITE_API_URL ||
    (import.meta as any).env.REACT_APP_API_URL ||
    "/api";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/auth/me/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => {});
    
    // Check user's subscription plan
    fetch(`${API_URL}/subscriptions/user/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const plan = Array.isArray(d?.results) ? d.results[0] : d;
        setUserPlan(plan);
        const planName = (plan?.plan_name || "").toLowerCase();
        setIsEnterprise(planName === "enterpriseplan" || planName === "enterprise");
      })
      .catch(() => {});
  }, [API_URL]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    toast.success("Logged out successfully");
    navigate("/");
  };

  const handleSupportSubmit = async () => {
    if (!supportData.title || !supportData.description) {
      toast.error("Please fill in the title and description");
      return;
    }
    const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/support-tickets/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
      body: JSON.stringify({
        title: supportData.title,
        description: supportData.description,
        category: supportData.category,
        priority: supportData.priority,
      }),
    });
    if (res.ok) {
      toast.success("Support ticket submitted successfully");
      setShowSupportDialog(false);
      setSupportData({
        title: "",
        category: "general",
        priority: "medium",
        description: "",
      });
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.detail || "Failed to submit support ticket");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-3 sm:px-6">
            <SidebarTrigger className="text-primary" />
            <div className="flex items-center gap-4">
              <NotificationBell />
              
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
          
          <main className="flex-1 p-3 sm:p-6 bg-background">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Contact Support
              {isEnterprise && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-yellow-400 to-orange-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                  ⭐ Priority Support
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {isEnterprise ? (
                <div className="space-y-2">
                  <p className="font-medium text-primary">You have Enterprise Plan with Priority Support!</p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                    <li>Faster response times (typically within 1-2 hours)</li>
                    <li>Dedicated support team member</li>
                    <li>Priority ticket handling</li>
                    <li>Extended support hours</li>
                  </ul>
                </div>
              ) : (
                "Tell us about the issue you're facing and we'll help you resolve it."
              )}
            </DialogDescription>
          </DialogHeader>
          {isEnterprise && (
            <div className="rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-yellow-900">Priority Support Active</h4>
                  <p className="mt-1 text-sm text-yellow-800">
                    Your Enterprise plan includes priority support. Your ticket will be handled with high priority and you'll receive faster responses.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support-title">Title *</Label>
                <Input
                  id="support-title"
                  placeholder="Brief summary of your issue"
                  value={supportData.title}
                  onChange={(e) => setSupportData((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
            <div className="space-y-2">
              <Label>Category</Label>
                <Select value={supportData.category} onValueChange={(value) => setSupportData((prev) => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="crop">Crop Related</SelectItem>
                  <SelectItem value="transaction">Transaction</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="software_issue">Software Issue/Glitches</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={supportData.priority} onValueChange={(value) => setSupportData((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Describe your problem..."
                value={supportData.description}
                onChange={(e) => setSupportData((prev) => ({ ...prev, description: e.target.value }))}
                rows={5}
              />
            </div>
            <Button onClick={handleSupportSubmit} className="w-full">
              Submit Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Agribot 
        API_URL={API_URL} 
        authHeaders={() => {
          const token = localStorage.getItem("token");
          return token ? { Authorization: `Token ${token}` } : {};
        }} 
      />
    </SidebarProvider>
  );
}
