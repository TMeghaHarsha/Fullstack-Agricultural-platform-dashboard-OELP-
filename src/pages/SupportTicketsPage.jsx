import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  Box, Card, CardContent, Typography, Button, TextField,
  Select, MenuItem, FormControl, InputLabel, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Grid, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Tooltip, Alert
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Assignment as AssignIcon,
  PlayArrow as StartIcon,
  CheckCircle as ResolveIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  ConfirmationNumber as TicketIcon,
  AssignmentTurnedIn as AssignedIcon,
  Autorenew as InProgressIcon,
  Done as DoneIcon
} from '@mui/icons-material';

function SupportTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [supportUsers, setSupportUsers] = useState([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [comment, setComment] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'support') {
      fetchAllData();
    }
  }, [user]);

  useEffect(() => {
    filterTickets();
  }, [tickets, tabValue, statusFilter, priorityFilter]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchTickets(),
      fetchStats(),
      fetchSupportUsers()
    ]);
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/support-tickets/');
      setTickets(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/support-tickets/stats/');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchSupportUsers = async () => {
    try {
      const response = await api.get('/support-tickets/support_users/');
      setSupportUsers(response.data);
    } catch (error) {
      console.error('Error fetching support users:', error);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Filter by tab
    if (tabValue === 1) {
      filtered = filtered.filter(t => t.assigned_to_support?.id === user?.id);
    } else if (tabValue === 2) {
      filtered = filtered.filter(t => !t.assigned_to_support);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  };

  const handleViewTicket = async (ticket) => {
    try {
      // Fetch full ticket details
      const response = await api.get(`/support-tickets/${ticket.id}/`);
      setSelectedTicket(response.data);
      setOpenDialog(true);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      setError('Failed to fetch ticket details');
    }
  };

  const handleAssignTicket = async () => {
    try {
      await api.post(`/support-tickets/${selectedTicket.id}/assign/`, {
        assigned_to: selectedAssignee
      });
      setAssignDialogOpen(false);
      setSelectedAssignee('');
      await fetchAllData();
      setError('');
      alert('Ticket assigned successfully!');
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setError('Failed to assign ticket');
    }
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      await api.post(`/support-tickets/${ticketId}/update_status/`, {
        status: newStatus,
        resolution_notes: newStatus === 'resolved' ? resolutionNotes : undefined
      });
      await fetchAllData();
      setResolutionNotes('');
      setOpenDialog(false);
      setError('');
      alert('Status updated successfully!');
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update status');
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;

    try {
      await api.post(`/support-tickets/${selectedTicket.id}/add_comment/`, {
        comment: comment,
        is_internal: false
      });
      setComment('');
      // Refresh ticket details
      const response = await api.get(`/support-tickets/${selectedTicket.id}/`);
      setSelectedTicket(response.data);
      setError('');
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'error',
      assigned: 'info',
      in_progress: 'warning',
      resolved: 'success',
      closed: 'default'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'success',
      medium: 'info',
      high: 'warning',
      urgent: 'error'
    };
    return colors[priority] || 'default';
  };

  if (user?.role !== 'support') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <Typography variant="h5">Access Denied</Typography>
          <Typography>This page is only accessible to support team members.</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Support Tickets
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchAllData}
          variant="outlined"
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#fff3e0' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Total Tickets
                    </Typography>
                    <Typography variant="h4">
                      {stats.total}
                    </Typography>
                  </Box>
                  <TicketIcon sx={{ fontSize: 40, color: '#ff9800' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#e3f2fd' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Open Tickets
                    </Typography>
                    <Typography variant="h4">
                      {stats.open}
                    </Typography>
                  </Box>
                  <TicketIcon sx={{ fontSize: 40, color: '#2196f3' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#fff9c4' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      In Progress
                    </Typography>
                    <Typography variant="h4">
                      {stats.in_progress}
                    </Typography>
                  </Box>
                  <InProgressIcon sx={{ fontSize: 40, color: '#fbc02d' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#e8f5e9' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      My Assigned
                    </Typography>
                    <Typography variant="h4">
                      {stats.my_assigned}
                    </Typography>
                  </Box>
                  <AssignedIcon sx={{ fontSize: 40, color: '#4caf50' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#ffebee' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Urgent
                    </Typography>
                    <Typography variant="h4">
                      {stats.urgent_tickets}
                    </Typography>
                  </Box>
                  <TicketIcon sx={{ fontSize: 40, color: '#f44336' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: '#f3e5f5' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Resolved
                    </Typography>
                    <Typography variant="h4">
                      {stats.resolved}
                    </Typography>
                  </Box>
                  <DoneIcon sx={{ fontSize: 40, color: '#9c27b0' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="All Tickets" />
          <Tab label="Assigned to Me" />
          <Tab label="Unassigned" />
        </Tabs>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              label="Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              label="Priority"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket #</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">Loading...</TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">No tickets found</TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id} hover>
                  <TableCell>{ticket.ticket_number}</TableCell>
                  <TableCell>{ticket.title}</TableCell>
                  <TableCell>{ticket.category}</TableCell>
                  <TableCell>
                    <Chip
                      label={ticket.status.replace('_', ' ')}
                      color={getStatusColor(ticket.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ticket.priority}
                      color={getPriorityColor(ticket.priority)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{ticket.created_by?.full_name || ticket.created_by?.email}</TableCell>
                  <TableCell>
                    {ticket.assigned_to_support?.full_name || 'Unassigned'}
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton onClick={() => handleViewTicket(ticket)} size="small">
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    {!ticket.assigned_to_support && (
                      <Tooltip title="Assign">
                        <IconButton
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setAssignDialogOpen(true);
                          }}
                          size="small"
                          color="primary"
                        >
                          <AssignIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* View Ticket Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Ticket #{selectedTicket?.ticket_number}
          <IconButton
            onClick={() => setOpenDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedTicket && (
            <Box>
              <Typography variant="h6" gutterBottom>{selectedTicket.title}</Typography>
              
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Chip
                    label={selectedTicket.status.replace('_', ' ')}
                    color={getStatusColor(selectedTicket.status)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Chip
                    label={selectedTicket.priority}
                    color={getPriorityColor(selectedTicket.priority)}
                  />
                </Grid>
              </Grid>

              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedTicket.description}
              </Typography>

              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Category:</strong> {selectedTicket.category}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>Created By:</strong> {selectedTicket.created_by?.full_name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Assigned To:</strong> {selectedTicket.assigned_to_support?.full_name || 'Unassigned'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">
                    <strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}
                  </Typography>
                </Grid>
              </Grid>

              {/* Comments Section */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Comments ({selectedTicket.comments?.length || 0})</Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2 }}>
                  {selectedTicket.comments?.map((comment) => (
                    <Card key={comment.id} sx={{ mb: 1, bgcolor: '#f5f5f5' }}>
                      <CardContent sx={{ py: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          <strong>{comment.user?.full_name}</strong> - {new Date(comment.created_at).toLocaleString()}
                        </Typography>
                        <Typography variant="body2">{comment.comment}</Typography>
                      </CardContent>
                    </Card>
                  ))}
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add a comment..."
                  size="small"
                />
                <Button 
                  onClick={handleAddComment} 
                  variant="contained" 
                  sx={{ mt: 1 }}
                  disabled={!comment.trim()}
                >
                  Add Comment
                </Button>
              </Box>

              {/* Actions */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Actions</Typography>
                <Grid container spacing={1}>
                  {selectedTicket.status === 'open' && !selectedTicket.assigned_to_support && (
                    <Grid item>
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AssignIcon />}
                        onClick={() => {
                          setAssignDialogOpen(true);
                        }}
                      >
                        Assign to Me
                      </Button>
                    </Grid>
                  )}
                  {(selectedTicket.status === 'assigned' || selectedTicket.status === 'open') && (
                    <Grid item>
                      <Button
                        variant="contained"
                        color="warning"
                        startIcon={<StartIcon />}
                        onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                      >
                        Start Progress
                      </Button>
                    </Grid>
                  )}
                  {selectedTicket.status === 'in_progress' && (
                    <Grid item>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<ResolveIcon />}
                        onClick={() => {
                          const notes = prompt('Enter resolution notes:');
                          if (notes) {
                            setResolutionNotes(notes);
                            handleUpdateStatus(selectedTicket.id, 'resolved');
                          }
                        }}
                      >
                        Mark Resolved
                      </Button>
                    </Grid>
                  )}
                  {selectedTicket.status === 'resolved' && (
                    <Grid item>
                      <Button
                        variant="contained"
                        startIcon={<CloseIcon />}
                        onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                      >
                        Close Ticket
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Ticket Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)}>
        <DialogTitle>Assign Ticket</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Assign To</InputLabel>
            <Select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              label="Assign To"
            >
              {supportUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAssignTicket} variant="contained" disabled={!selectedAssignee}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SupportTicketsPage;
