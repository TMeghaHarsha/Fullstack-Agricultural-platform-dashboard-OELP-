import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Ticket, TicketStatus, TicketPriority, TicketComment } from '@/types/support';

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [supportStaff, setSupportStaff] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const [ticketRes, staffRes] = await Promise.all([
          fetch(`/api/support/tickets/${id}/`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access')}`,
            },
          }),
          fetch('/api/users/?role=support', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access')}`,
            },
          }),
        ]);

        if (!ticketRes.ok) throw new Error('Failed to fetch ticket');
        if (!staffRes.ok) throw new Error('Failed to fetch support staff');

        const ticketData = await ticketRes.json();
        const staffData = await staffRes.json();

        setTicket(ticketData);
        setAssignedTo(ticketData.assigned_to_support?.id?.toString() || '');
        setSupportStaff(
          staffData.results.map((user: any) => ({
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
          }))
        );
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: 'Error',
          description: 'Failed to load ticket details',
          variant: 'destructive',
        });
        navigate('/support/tickets');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchTicket();
    }
  }, [id, navigate, toast]);

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/support/tickets/${ticket.id}/update_status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          status: newStatus,
          resolution_notes: ticket.resolution_notes,
        }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      const updatedTicket = await response.json();
      setTicket(updatedTicket);
      toast({
        title: 'Success',
        description: 'Ticket status updated successfully',
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update ticket status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async () => {
    if (!ticket || !assignedTo) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/support/tickets/${ticket.id}/assign/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          assigned_to: parseInt(assignedTo),
        }),
      });

      if (!response.ok) throw new Error('Failed to assign ticket');

      const updatedTicket = await response.json();
      setTicket(updatedTicket);
      toast({
        title: 'Success',
        description: 'Ticket assigned successfully',
      });
    } catch (error) {
      console.error('Error assigning ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign ticket',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !ticket) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/support/tickets/${ticket.id}/add_comment/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          comment,
          is_internal: isInternal,
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');

      const newComment = await response.json();
      setTicket({
        ...ticket,
        comments: [...ticket.comments, newComment],
      });
      setComment('');
      setIsInternal(false);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForwardToRole = async (role: string) => {
    if (!ticket) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/support/tickets/${ticket.id}/forward/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          role,
        }),
      });

      if (!response.ok) throw new Error('Failed to forward ticket');

      const updatedTicket = await response.json();
      setTicket(updatedTicket);
      toast({
        title: 'Success',
        description: `Ticket forwarded to ${role} team`,
      });
    } catch (error) {
      console.error('Error forwarding ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to forward ticket',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!ticket) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/support/tickets/${ticket.id}/update_status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access')}`,
        },
        body: JSON.stringify({
          status: 'resolved',
          resolution_notes: ticket.resolution_notes || 'Issue resolved',
        }),
      });

      if (!response.ok) throw new Error('Failed to resolve ticket');

      const updatedTicket = await response.json();
      setTicket(updatedTicket);
      toast({
        title: 'Success',
        description: 'Ticket marked as resolved',
      });
    } catch (error) {
      console.error('Error resolving ticket:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve ticket',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return <div>Loading ticket details...</div>;
  }

  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-blue-100 text-blue-800';
      case 'high':
        return 'bg-yellow-100 text-yellow-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Ticket #{ticket.ticket_number}</h1>
          <p className="text-muted-foreground">{ticket.title}</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => navigate('/support/tickets')}
            disabled={isUpdating}
          >
            Back to Tickets
          </Button>
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <Button
              onClick={handleResolve}
              disabled={isUpdating}
              variant="outline"
              className="bg-green-100 text-green-800 hover:bg-green-200"
            >
              {isUpdating ? 'Resolving...' : 'Mark as Resolved'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{ticket.title}</CardTitle>
                  <CardDescription>
                    Created by {ticket.created_by.first_name} {ticket.created_by.last_name} on{' '}
                    {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Badge className={getStatusBadgeVariant(ticket.status)}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className={getPriorityBadgeVariant(ticket.priority)}>
                    {ticket.priority}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <p>{ticket.description}</p>
              </div>

              {ticket.resolution_notes && (
                <div className="mt-6 p-4 bg-green-50 rounded-md">
                  <h4 className="font-medium text-green-800 mb-2">Resolution Notes</h4>
                  <p className="text-green-700">{ticket.resolution_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {ticket.comments.length > 0 ? (
                  ticket.comments.map((comment: TicketComment) => (
                    <div key={comment.id} className="flex space-x-4">
                      <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {comment.user.first_name[0]}{comment.user.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">
                            {comment.user.first_name} {comment.user.last_name}
                            {comment.is_internal && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Internal
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                        <p className="mt-1 text-sm">{comment.comment}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">No comments yet.</p>
                )}
              </div>

              <div className="mt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="comment">Add a comment</Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Type your comment here..."
                      className="mt-1 min-h-[100px]"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="internal"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <Label htmlFor="internal" className="text-sm">
                        Internal Note (only visible to support staff)
                      </Label>
                    </div>
                    <Button
                      onClick={handleAddComment}
                      disabled={!comment.trim() || isSubmitting}
                      className="ml-auto"
                    >
                      {isSubmitting ? 'Posting...' : 'Post Comment'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select
                  value={ticket.priority}
                  onValueChange={(value) => {
                    setTicket({ ...ticket, priority: value as TicketPriority });
                  }}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assigned To</Label>
                <div className="flex space-x-2 mt-1">
                  <Select
                    value={assignedTo}
                    onValueChange={setAssignedTo}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {supportStaff.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAssign}
                    disabled={isUpdating || !assignedTo}
                  >
                    {isUpdating ? 'Assigning...' : 'Assign'}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Forward To Role</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {['agronomist', 'analyst', 'admin', 'developer'].map((role) => (
                      <Button
                        key={role}
                        variant="outline"
                        size="sm"
                        onClick={() => handleForwardToRole(role)}
                        disabled={isUpdating}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Button>
                    ))}
                  </div>
                  {ticket.forwarded_to_role && (
                    <p className="text-sm text-muted-foreground">
                      Forwarded to: {ticket.forwarded_to_role}
                      {ticket.forwarded_to_user && ` (${ticket.forwarded_to_user.first_name} ${ticket.forwarded_to_user.last_name})`}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div>
                <Label>Created</Label>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>

              {ticket.updated_at && (
                <div>
                  <Label>Last Updated</Label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.updated_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {ticket.resolved_at && (
                <div>
                  <Label>Resolved</Label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.resolved_at), 'MMM d, yyyy h:mm a')}
                    {ticket.resolved_by && ` by ${ticket.resolved_by.first_name} ${ticket.resolved_by.last_name}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticket.history.length > 0 ? (
                  ticket.history.map((history) => (
                    <div key={history.id} className="flex space-x-3">
                      <div className="flex-shrink-0">
                        <div className="h-2 w-2 rounded-full bg-gray-300 mt-2" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">
                            {history.user ? `${history.user.first_name} ${history.user.last_name}` : 'System'}
                          </span>{' '}
                          {history.description}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(history.created_at), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No history available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
