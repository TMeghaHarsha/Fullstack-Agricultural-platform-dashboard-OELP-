import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function IssuesPage() {
  const API_URL = (import.meta as any).env.VITE_API_URL || (import.meta as any).env.REACT_APP_API_URL || "/api";
  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Token ${token}` } : {};
  };

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/support-tickets/forwarded-to-me/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : data.results || []);
      }
    } catch (error) {
      toast.error("Failed to load issues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
  };

  const handleResolve = async () => {
    if (!selectedTicket) return;

    try {
      const res = await fetch(`${API_URL}/support-tickets/${selectedTicket.id}/resolve/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          resolution_notes: resolutionNotes,
        }),
      });

      if (res.ok) {
        toast.success("Ticket resolved and sent back to support for review");
        setShowResolveDialog(false);
        setShowTicketDialog(false);
        setResolutionNotes("");
        loadTickets();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to resolve ticket");
      }
    } catch (error) {
      toast.error("Failed to resolve ticket");
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-muted-foreground">Tickets forwarded to your role for resolution</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forwarded Tickets</CardTitle>
          <CardDescription>Review and resolve tickets assigned to your role</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading issues...</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No issues assigned to your role</p>
            </div>
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
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm">{ticket.ticket_number}</TableCell>
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{ticket.created_by?.full_name || ticket.created_by?.email || "N/A"}</TableCell>
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
              </div>
              <div>
                <Label>Description</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">{selectedTicket.description}</div>
              </div>
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
          <DialogFooter>
            {selectedTicket?.status !== "resolved" && selectedTicket?.status !== "closed" && (
              <Button onClick={() => setShowResolveDialog(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Resolved
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowTicketDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Ticket</DialogTitle>
            <DialogDescription>Add resolution notes and mark this ticket as resolved</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how you resolved this issue..."
                rows={6}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              This ticket will be sent back to the support team for review. They will notify the user once reviewed.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>Mark as Resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

