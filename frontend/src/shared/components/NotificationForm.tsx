import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { apiRequest } from '@/lib/api';

type NotificationType = 'info' | 'alert' | 'warning' | 'success' | 'error';

interface NotificationFormProps {
  onSuccess?: () => void;
  userRole: string;
}

export const NotificationForm: React.FC<NotificationFormProps> = ({ onSuccess, userRole }) => {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [notificationType, setNotificationType] = useState<NotificationType>('info');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [cropType, setCropType] = useState('');
  const [availableRoles, setAvailableRoles] = useState<Array<{value: string, label: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableCropTypes, setAvailableCropTypes] = useState<string[]>([]);

  // Fetch allowed receiver roles and filter options
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get allowed receiver roles
        const rolesResponse = await apiRequest('GET', '/api/admin/notifications/allowed_receivers/');
        const roles = rolesResponse.roles || [];
        setAvailableRoles(roles.map((role: string) => ({
          value: role,
          label: role
        })));

        // Fetch available regions and crop types for filtering
        const [regionsRes, cropsRes] = await Promise.all([
          apiRequest('GET', '/api/regions/'),
          apiRequest('GET', '/api/crops/')
        ]);
        
        setAvailableRegions(regionsRes.map((r: any) => r.name));
        setAvailableCropTypes(Array.from(new Set(cropsRes.map((c: any) => c.name))));
      } catch (error) {
        console.error('Error fetching notification data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notification settings',
          variant: 'destructive',
        });
      }
    };

    fetchData();
  }, [userRole, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Message is required',
        variant: 'destructive',
      });
      return;
    }

    if (targetRoles.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one target role',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        message,
        notification_type: notificationType,
        target_roles: targetRoles,
      };

      // Add optional fields if provided
      if (tags.length > 0) {
        payload.tags = tags.join(',');
      }
      if (region) {
        payload.region = region;
      }
      if (cropType) {
        payload.crop_type = cropType;
      }

      await apiRequest('POST', '/api/admin/notifications/', payload);
      
      toast({
        title: 'Success',
        description: 'Notification sent successfully',
      });

      setMessage('');
      setTargetRoles([]);
      setTags([]);
      setRegion('');
      setCropType('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your notification message"
          rows={4}
          className="mt-1"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Notification Type</Label>
          <Select
            value={notificationType}
            onValueChange={(value: NotificationType) => setNotificationType(value)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Information</SelectItem>
              <SelectItem value="alert">Alert</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Target Roles</Label>
          <MultiSelect
            options={availableRoles}
            selected={targetRoles}
            onChange={setTargetRoles}
            placeholder="Select roles"
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="region">Region (optional)</Label>
          <Select
            value={region}
            onValueChange={setRegion}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Filter by region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Regions</SelectItem>
              {availableRegions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="cropType">Crop Type (optional)</Label>
          <Select
            value={cropType}
            onValueChange={setCropType}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Filter by crop type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Crops</SelectItem>
              {availableCropTypes.map((crop) => (
                <SelectItem key={crop} value={crop}>
                  {crop}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Tags (comma separated, optional)</Label>
        <Input
          value={tags.join(',')}
          onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          placeholder="e.g., important, update, reminder"
          className="mt-1"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Notification'}
        </Button>
      </div>
    </form>
  );
};
