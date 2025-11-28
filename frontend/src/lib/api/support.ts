import { Ticket, TicketComment, TicketStatus, TicketPriority } from '@/types/support';

const API_BASE_URL = '/api/support';

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'An error occurred');
  }
  return response.json();
}

// Fetch support statistics
export async function fetchSupportStats() {
  const response = await fetch(`${API_BASE_URL}/tickets/stats/`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
  });
  return handleResponse<{
    open_tickets: number;
    assigned_to_me: number;
    unassigned: number;
    avg_response_time: number;
  }>(response);
}

// Fetch tickets with optional filters
export async function fetchTickets(params: {
  status?: string;
  assigned_to?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}) {
  const queryParams = new URLSearchParams();
  
  if (params.status) queryParams.append('status', params.status);
  if (params.assigned_to) queryParams.append('assigned_to', params.assigned_to);
  if (params.priority) queryParams.append('priority', params.priority);
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());

  const response = await fetch(`${API_BASE_URL}/tickets/?${queryParams.toString()}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
  });
  
  return handleResponse<{ count: number; results: Ticket[] }>(response);
}

// Fetch a single ticket by ID
export async function fetchTicketById(id: string | number) {
  const response = await fetch(`${API_BASE_URL}/tickets/${id}/`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
  });
  return handleResponse<Ticket>(response);
}

// Create a new ticket
export async function createTicket(data: {
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
}) {
  const response = await fetch(`${API_BASE_URL}/tickets/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
    body: JSON.stringify(data),
  });
  return handleResponse<Ticket>(response);
}

// Update ticket status
export async function updateTicketStatus(
  ticketId: string | number,
  status: TicketStatus,
  resolutionNotes?: string
) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/update_status/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
    body: JSON.stringify({
      status,
      resolution_notes: resolutionNotes,
    }),
  });
  return handleResponse<Ticket>(response);
}

// Assign ticket to a support user
export async function assignTicket(ticketId: string | number, userId: number) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/assign/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
    body: JSON.stringify({
      assigned_to: userId,
    }),
  });
  return handleResponse<Ticket>(response);
}

// Add a comment to a ticket
export async function addTicketComment(
  ticketId: string | number,
  comment: string,
  isInternal = false
) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/add_comment/`, {
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
  return handleResponse<TicketComment>(response);
}

// Forward ticket to a specific role
export async function forwardTicketToRole(ticketId: string | number, role: string) {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/forward/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
    body: JSON.stringify({
      role,
    }),
  });
  return handleResponse<Ticket>(response);
}

// Fetch support users
export async function fetchSupportUsers() {
  const response = await fetch('/api/users/?role=support', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access')}`,
    },
  });
  return handleResponse<{ results: Array<{ id: number; first_name: string; last_name: string; email: string }> }>(response);
}

// Mark ticket as resolved
export async function resolveTicket(ticketId: string | number, resolutionNotes: string) {
  return updateTicketStatus(ticketId, 'resolved', resolutionNotes);
}

// Close a ticket
export async function closeTicket(ticketId: string | number) {
  return updateTicketStatus(ticketId, 'closed');
}

// Reopen a ticket
export async function reopenTicket(ticketId: string | number) {
  return updateTicketStatus(ticketId, 'open');
}
