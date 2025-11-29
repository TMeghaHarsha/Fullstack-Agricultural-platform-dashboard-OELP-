import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, CheckCircle, Clock, AlertCircle, XCircle, Send, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function SupportDashboard() {
  const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Token ${token}` } : {};
  };

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [forwardRole, setForwardRole] = useState("");
  const [forwardUser, setForwardUser] = useState("all");
  const [usersByRole, setUsersByRole] = useState<any[]>([]);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/support-tickets/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : data.results || []);
      }
    } catch (error) {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleViewTicket = async (ticket: any) => {
    try {
      // Fetch full ticket details with comments and history
      const res = await fetch(`${API_URL}/support-tickets/${ticket.id}/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data);
        setShowTicketDialog(true);
      } else {
        // Fallback to basic ticket data
        setSelectedTicket(ticket);
        setShowTicketDialog(true);
      }
    } catch (error) {
      // Fallback to basic ticket data
      setSelectedTicket(ticket);
      setShowTicketDialog(true);
    }
  };

  const handleForward = async () => {
    if (!forwardRole || !selectedTicket) {
      toast.error("Please select a role to forward to");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/support-tickets/${selectedTicket.id}/forward/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          role: forwardRole,
          user_id: forwardUser === "all" ? null : forwardUser,
        }),
      });

      if (res.ok) {
        toast.success(`Ticket forwarded to ${forwardRole}`);
        setShowForwardDialog(false);
        setForwardRole("");
        setForwardUser("");
        loadTickets();
        setShowTicketDialog(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to forward ticket");
      }
    } catch (error) {
      toast.error("Failed to forward ticket");
    }
  };

  const handleNotifyUser = async () => {
    if (!selectedTicket || !notifyMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/support-tickets/${selectedTicket.id}/notify-user/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: notifyMessage }),
      });

      if (res.ok) {
        toast.success("User notified successfully");
        setShowNotifyDialog(false);
        setNotifyMessage("");
        setShowTicketDialog(false);
        loadTickets();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to notify user");
      }
    } catch (error) {
      toast.error("Failed to notify user");
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`${API_URL}/support-tickets/${selectedTicket.id}/update_status/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "closed" }),
      });

      if (res.ok) {
        toast.success("Ticket closed successfully");
        setShowTicketDialog(false);
        setSelectedTicket(null);
        loadTickets();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to close ticket");
      }
    } catch (error) {
      toast.error("Failed to close ticket");
    }
  };

  const loadUsersByRole = async (role: string) => {
    if (!role) return;
    try {
      const res = await fetch(`${API_URL}/support-tickets/users-by-role/?role=${role}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUsersByRole(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  useEffect(() => {
    if (forwardRole) {
      loadUsersByRole(forwardRole);
    } else {
      setUsersByRole([]);
    }
  }, [forwardRole]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "destructive",
      assigned: "secondary",
      in_progress: "default",
      resolved: "outline",
      closed: "secondary",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ")}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800",
    };
    return <Badge className={colors[priority] || ""}>{priority}</Badge>;
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (activeTab === "all") return true;
    if (activeTab === "resolved") return ticket.status === "resolved";
    if (activeTab === "open") return ticket.status === "open" || ticket.status === "assigned";
    return ticket.status === activeTab;
  });

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open" || t.status === "assigned").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support Dashboard</h1>
        <p className="text-muted-foreground">Manage support tickets and forward to specialized roles</p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>View and manage all support tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              {loading ? (
                <div className="text-center py-8">Loading tickets...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No tickets found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Forwarded To</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                        <TableCell className="font-medium">{ticket.title}</TableCell>
                        <TableCell>{ticket.category}</TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell>{ticket.created_by?.full_name || ticket.created_by?.email || "N/A"}</TableCell>
                        <TableCell>
                          {ticket.forwarded_to_role ? (
                            <Badge variant="outline">{ticket.forwarded_to_role}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleViewTicket(ticket)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Ticket Details Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket #{selectedTicket?.ticket_number}</DialogTitle>
            <DialogDescription>{selectedTicket?.title}</DialogDescription>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedTicket.status)}</div>
                </div>
                <div>
                  <Label>Priority</Label>
                  <div className="mt-1">{getPriorityBadge(selectedTicket.priority)}</div>
                </div>
                <div>
                  <Label>Category</Label>
                  <div className="mt-1">{selectedTicket.category}</div>
                </div>
                <div>
                  <Label>Created By</Label>
                  <div className="mt-1">{selectedTicket.created_by?.full_name || selectedTicket.created_by?.email}</div>
                </div>
                {selectedTicket.forwarded_to_role && (
                  <div>
                    <Label>Forwarded To</Label>
                    <div className="mt-1">
                      <Badge>{selectedTicket.forwarded_to_role}</Badge>
                    </div>
                  </div>
                )}
                {selectedTicket.resolved_by && (
                  <div>
                    <Label>Resolved By</Label>
                    <div className="mt-1">{selectedTicket.resolved_by?.full_name || selectedTicket.resolved_by?.email}</div>
                  </div>
                )}
              </div>
              <div>
                <Label>Description</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">{selectedTicket.description}</div>
              </div>
              {selectedTicket.resolution_notes && (
                <div>
                  <Label>Resolution Notes</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">{selectedTicket.resolution_notes}</div>
                </div>
              )}
              {selectedTicket.comments && selectedTicket.comments.length > 0 && (
                <div>
                  <Label>Comments</Label>
                  <div className="mt-1 space-y-2">
                    {selectedTicket.comments.map((comment: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted rounded-md">
                        <div className="font-medium text-sm">{comment.user?.full_name || comment.user?.email}</div>
                        <div className="text-sm mt-1">{comment.comment}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(comment.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between gap-2">
            <div className="flex gap-2">
              {selectedTicket?.status === "resolved" && (
                <Button onClick={() => setShowNotifyDialog(true)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Notify User
                </Button>
              )}
              {selectedTicket?.status !== "resolved" &&
                selectedTicket?.status !== "closed" &&
                !selectedTicket?.forwarded_to_role && (
                  <Button onClick={() => setShowForwardDialog(true)}>
                    <Send className="h-4 w-4 mr-2" />
                    Forward Ticket
                  </Button>
                )}
            </div>
            <div className="flex gap-2">
              {selectedTicket?.status !== "closed" && (
                <Button variant="destructive" onClick={handleCloseTicket}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Close Ticket
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowTicketDialog(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Forward Dialog */}
      <Dialog open={showForwardDialog} onOpenChange={setShowForwardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Forward Ticket</DialogTitle>
            <DialogDescription>Forward this ticket to a specialized role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Forward To Role</Label>
              <Select value={forwardRole} onValueChange={setForwardRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Agronomist">Agronomist</SelectItem>
                  <SelectItem value="Analyst">Analyst</SelectItem>
                  <SelectItem value="Developer">Developer</SelectItem>
                  <SelectItem value="Business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {forwardRole && (
              <div className="space-y-2">
                <Label>Select Specific User (Optional)</Label>
                <Select value={forwardUser} onValueChange={setForwardUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user (optional)" />
                  </SelectTrigger>
                
                  <SelectContent>
                    {/* Default option */}
                    <SelectItem value="all">All users with this role</SelectItem>
                
                    {/* Users list */}
                    {Array.isArray(usersByRole) && usersByRole.length > 0 ? (
                      usersByRole.map((user) => {
                        if (!user || !user.id) return null;
                
                        return (
                          <SelectItem key={user.id} value={String(user.id)}>
                            {user.full_name || user.email || user.username || "Unknown User"}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>No users available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForwardDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleForward}>Forward</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify User Dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notify User</DialogTitle>
            <DialogDescription>Send a notification to the user about ticket resolution</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder="Enter notification message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleNotifyUser}>Send Notification</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
