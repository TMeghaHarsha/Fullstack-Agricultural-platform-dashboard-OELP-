export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'crop' | 'transaction' | 'analysis' | 'software_issue' | 'technical' | 'general';

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface TicketComment {
  id: number;
  user: Pick<User, 'id' | 'first_name' | 'last_name'>;
  comment: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
}

export interface TicketHistory {
  id: number;
  user: Pick<User, 'id' | 'first_name' | 'last_name'> | null;
  action: string;
  description: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>;
  assigned_to_support: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  forwarded_to_role: string | null;
  forwarded_to_user: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  resolution_notes: string | null;
  resolved_by: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'> | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  comments: TicketComment[];
  history: TicketHistory[];
}
