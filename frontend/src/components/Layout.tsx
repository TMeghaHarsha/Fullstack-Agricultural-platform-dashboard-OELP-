import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { User, Shield, MessageSquare } from "lucide-react";
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
  const [showAgribot, setShowAgribot] = useState(false);
  const [agribotMessages, setAgribotMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [agribotInput, setAgribotInput] = useState("");
  const [agribotLoading, setAgribotLoading] = useState(false);
  const [userPlan, setUserPlan] = useState<any | null>(null);

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
    
    // Load user plan to check AI access
    fetch(`${API_URL}/subscriptions/user/`, { headers: { Authorization: `Token ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.results && d.results.length > 0) {
          setUserPlan(d.results[0]);
        }
      })
      .catch(() => {});
  }, [API_URL]);
  
  const hasAgribotAccess = userPlan && userPlan.plan_name && 
    (userPlan.plan_name.toLowerCase().includes("topup") || 
     userPlan.plan_name.toLowerCase().includes("enterprise"));
  
  const sendAgribotMessage = async () => {
    if (!agribotInput.trim() || agribotLoading) return;
    
    const userMessage = agribotInput.trim();
    setAgribotInput("");
    setAgribotMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setAgribotLoading(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/agribot/chat/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Token ${token}` } : {})
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setAgribotMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setAgribotMessages(prev => [...prev, { role: 'assistant', content: data.detail || "Error: Could not get response" }]);
      }
    } catch (error) {
      setAgribotMessages(prev => [...prev, { role: 'assistant', content: "Error: Could not connect to Agribot" }]);
    } finally {
      setAgribotLoading(false);
    }
  };

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
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-6">
            <SidebarTrigger className="text-primary" />
            <div className="flex items-center gap-4">
              <NotificationBell />
              {hasAgribotAccess && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowAgribot(true)}
                  title="Chat with Agribot"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
              )}
              
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Support</DialogTitle>
            <DialogDescription>
              Tell us about the issue you're facing and we'll help you resolve it.
            </DialogDescription>
          </DialogHeader>
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

      {/* Agribot Chat Dialog */}
      <Dialog open={showAgribot} onOpenChange={setShowAgribot}>
        <DialogContent className="max-w-2xl h-[600px] flex flex-col">
          <DialogHeader>
            <DialogTitle>Agribot - AI Assistant</DialogTitle>
            <DialogDescription>
              Ask questions about the website features, fields, crops, irrigation, and more.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 border rounded-lg p-4">
            {agribotMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">
                Start a conversation with Agribot. Ask about website features, fields, crops, irrigation, soil analysis, reports, analytics, subscriptions, or settings.
              </p>
            ) : (
              agribotMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {agribotLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={agribotInput}
              onChange={(e) => setAgribotInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendAgribotMessage()}
              placeholder="Type your message..."
              disabled={agribotLoading}
            />
            <Button onClick={sendAgribotMessage} disabled={agribotLoading || !agribotInput.trim()}>
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </SidebarProvider>
  );
}
