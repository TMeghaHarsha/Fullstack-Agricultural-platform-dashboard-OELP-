import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Ticket, MessageSquare, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchSupportStats } from '@/lib/api/support';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SupportTicketList from '../components/SupportTicketList';

function Metric({ 
  label, 
  value, 
  icon: Icon, 
  color = 'primary',
  onClick
}: { 
  label: string; 
  value: string | number; 
  icon: any;
  color?: string;
  onClick?: () => void;
}) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-green-600 bg-green-100',
    warning: 'text-yellow-600 bg-yellow-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <Card 
      className={`cursor-pointer transition-colors hover:bg-muted/50 ${onClick ? 'hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color as keyof typeof colors]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SupportDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['support-stats'],
    queryFn: fetchSupportStats,
  });

  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }

  if (error) {
    return <div>Error loading dashboard data</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Support Dashboard</h1>
          <p className="text-muted-foreground">Manage and track support tickets</p>
        </div>
        <Button onClick={() => navigate('/support/tickets/new')}>
          Create Ticket
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric 
          label="Open Tickets" 
          value={stats?.open || 0} 
          icon={Ticket} 
          color="warning"
          onClick={() => navigate('/support/tickets?status=open')}
        />
        <Metric 
          label="Assigned to Me" 
          value={stats?.my_tickets || 0} 
          icon={UserCheck} 
          color="primary"
          onClick={() => navigate('/support/tickets?assigned_to=me')}
        />
        <Metric 
          label="In Progress" 
          value={stats?.in_progress || 0} 
          icon={Clock} 
          color="info"
          onClick={() => navigate('/support/tickets?status=in_progress')}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Tickets</h2>
        <SupportTicketList limit={5} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common support tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/support/tickets/new')}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Create New Ticket
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <UserCheck className="mr-2 h-4 w-4" />
              View Assigned Tickets
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support Resources</CardTitle>
            <CardDescription>Helpful links and resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Knowledge Base
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Support Guidelines
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Common Solutions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
