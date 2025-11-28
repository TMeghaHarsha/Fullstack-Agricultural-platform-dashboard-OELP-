import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Bell, Mail, Send } from 'lucide-react';

type NotificationType = 'info' | 'alert' | 'warning' | 'success' | 'error';

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  notification_type: NotificationType;
  notification_type_display: string;
  sender: {
    id: number;
    username: string;
    full_name: string;
  } | null;
  receiver: {
    id: number;
    username: string;
    full_name: string;
  };
  tags: string[];
}

const typeVariantMap = {
  info: 'outline',
  alert: 'secondary',
  warning: 'warning',
  success: 'success',
  error: 'destructive',
} as const;

export const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<{
    received: Notification[];
    sent: Notification[];
  }>({ received: [], sent: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('received');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      
      // Fetch both received and sent notifications in parallel
      const [receivedRes, sentRes] = await Promise.all([
        apiRequest('GET', '/api/notifications/?type=received'),
        apiRequest('GET', '/api/notifications/?type=sent')
      ]);

      // Extract all unique tags
      const allTags = new Set<string>();
      
      const processNotifications = (notifs: Notification[]) => {
        notifs.forEach(notif => {
          if (notif.tags && notif.tags.length > 0) {
            notif.tags.forEach(tag => allTags.add(tag));
          }
        });
        return notifs;
      };

      setNotifications({
        received: processNotifications(receivedRes.results || []),
        sent: processNotifications(sentRes.results || [])
      });
      
      setAvailableTags(allTags);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notifications',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = async (id: number) => {
    try {
      await apiRequest('POST', `/api/notifications/${id}/mark-read/`, {});
      
      // Update local state
      setNotifications(prev => ({
        ...prev,
        received: prev.received.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        )
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.received
        .filter(n => !n.is_read)
        .map(n => n.id);
      
      if (unreadIds.length === 0) return;
      
      await Promise.all(
        unreadIds.map(id => 
          apiRequest('POST', `/api/notifications/${id}/mark-read/`, {})
        )
      );
      
      // Update local state
      setNotifications(prev => ({
        ...prev,
        received: prev.received.map(n => 
          unreadIds.includes(n.id) ? { ...n, is_read: true } : n
        )
      }));
      
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark notifications as read',
        variant: 'destructive',
      });
    }
  };

  const filterNotifications = (notifications: Notification[]) => {
    return notifications.filter(notification => {
      // Filter by type
      if (filterType !== 'all' && notification.notification_type !== filterType) {
        return false;
      }
      
      // Filter by tags if any are selected
      if (selectedTags.length > 0 && notification.tags) {
        const hasMatchingTag = selectedTags.some(tag => 
          notification.tags.includes(tag)
        );
        if (!hasMatchingTag) return false;
      }
      
      return true;
    });
  };

  const filteredReceived = filterNotifications(notifications.received);
  const filteredSent = filterNotifications(notifications.sent);
  const hasUnread = notifications.received.some(n => !n.is_read);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
            {hasUnread && (
              <Badge variant="destructive" className="h-5 w-5 justify-center p-0">
                {notifications.received.filter(n => !n.is_read).length}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={markAllAsRead}
            disabled={!hasUnread || isLoading}
          >
            Mark all as read
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="received" 
          className="w-full"
          onValueChange={setActiveTab}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Received
              {hasUnread && (
                <span className="h-2 w-2 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Sent
            </TabsTrigger>
          </TabsList>
          
          <div className="my-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Select
                value={filterType}
                onValueChange={setFilterType}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="info">Information</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              {availableTags.size > 0 && (
                <MultiSelect
                  options={Array.from(availableTags).map(tag => ({
                    value: tag,
                    label: tag
                  }))}
                  selected={selectedTags}
                  onChange={setSelectedTags}
                  placeholder="Filter by tags"
                  className="w-[200px]"
                />
              )}
            </div>
            
            <TabsContent value="received" className="mt-0">
              <NotificationTabContent 
                notifications={filteredReceived}
                isLoading={isLoading}
                type="received"
                onMarkAsRead={markAsRead}
              />
            </TabsContent>
            
            <TabsContent value="sent" className="mt-0">
              <NotificationTabContent 
                notifications={filteredSent}
                isLoading={isLoading}
                type="sent"
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface NotificationTabContentProps {
  notifications: Notification[];
  isLoading: boolean;
  type: 'received' | 'sent';
  onMarkAsRead?: (id: number) => void;
}

const NotificationTabContent: React.FC<NotificationTabContentProps> = ({
  notifications,
  isLoading,
  type,
  onMarkAsRead,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No {type} notifications found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {notifications.map((notification) => (
          <div 
            key={notification.id}
            className={`p-4 rounded-lg border ${
              !notification.is_read && type === 'received' 
                ? 'bg-accent/50 border-primary/20' 
                : 'bg-card'
            }`}
            onClick={() => {
              if (type === 'received' && !notification.is_read && onMarkAsRead) {
                onMarkAsRead(notification.id);
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={typeVariantMap[notification.notification_type] as any}
                    className="text-xs"
                  >
                    {notification.notification_type_display}
                  </Badge>
                  {type === 'received' && !notification.is_read && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm">{notification.message}</p>
                
                {notification.tags && notification.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {notification.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-2">
                  {type === 'sent' ? 'To: ' : 'From: '}
                  <span className="font-medium">
                    {type === 'sent' 
                      ? notification.receiver.full_name || notification.receiver.username
                      : notification.sender?.full_name || notification.sender?.username || 'System'}
                  </span>
                </p>
              </div>
              
              <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

// MultiSelect component implementation
const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = 'Select items',
  className = '',
}: {
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selected.length === 0 
            ? placeholder 
            : selected.length === 1 
              ? options.find(opt => opt.value === selected[0])?.label || selected[0]
              : `${selected.length} selected`}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="p-1">
            {options.map(option => (
              <div
                key={option.value}
                className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => toggleOption(option.value)}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {selected.includes(option.value) && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <span>{option.label}</span>
              </div>
            ))}
            
            {options.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Select component implementation
const Select = ({
  children,
  value,
  onValueChange,
  ...props
}: {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  [key: string]: any;
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    >
      {children}
    </select>
  );
};

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  )
);
SelectTrigger.displayName = 'SelectTrigger';

const SelectContent = ({ children, className, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
  <div
    className={`z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 ${className}`}
    {...props}
  >
    {children}
  </div>
);

const SelectItem = ({
  children,
  value,
  ...props
}: {
  children: React.ReactNode;
  value: string;
  [key: string]: any;
}) => (
  <option value={value} {...props}>
    {children}
  </option>
);

const SelectValue = ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
  <span {...props}>{children}</span>
);

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue };
