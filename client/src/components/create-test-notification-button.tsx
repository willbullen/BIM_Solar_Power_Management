import React from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Button component for creating a test notification
 * Used for development only to test notification functionality
 */
export function CreateTestNotificationButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleCreateTestNotification = async () => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest('/api/agent/notifications/test', 'POST');
      
      // Invalidate notifications cache to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
      
      toast({
        title: 'Test notification created',
        description: `Created a ${response.notification.type} notification: ${response.notification.title}`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error creating test notification:', error);
      toast({
        title: 'Error',
        description: 'Failed to create test notification',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleCreateTestNotification}
      disabled={isLoading}
    >
      <Plus className="w-4 h-4 mr-2" />
      {isLoading ? 'Creating...' : 'Create Test Notification'}
    </Button>
  );
}