import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Define notification type
export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  source: string;
  read: boolean;
  createdAt: string;
  readAt: string | null;
  data: Record<string, any>;
}

// Context interface
interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  refreshNotifications: () => void;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Hook for using the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Props for provider
interface NotificationProviderProps {
  children: ReactNode;
  pollingInterval?: number; // Time in ms to poll for new notifications
}

// Create provider component
export const NotificationProvider: React.FC<NotificationProviderProps> = ({ 
  children,
  pollingInterval = 30000 // Default to checking every 30 seconds
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch all notifications
  const { 
    data: notifications = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery({ 
    queryKey: ['/api/agent/notifications'],
    refetchInterval: pollingInterval,
  });

  // Get unread count
  const { 
    data: unreadCountData = { count: 0 } 
  } = useQuery({ 
    queryKey: ['/api/agent/notifications/unread/count'],
    refetchInterval: pollingInterval,
  });
  
  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/agent/notifications/${id}/read`, 'PATCH');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to mark notification as read',
        variant: 'destructive',
      });
      console.error('Error marking notification as read:', error);
    }
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/agent/notifications/mark-all-read', 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
      console.error('Error marking all notifications as read:', error);
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/agent/notifications/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to delete notification',
        variant: 'destructive',
      });
      console.error('Error deleting notification:', error);
    }
  });

  // Wrapper functions for mutations
  const markAsRead = async (id: number) => {
    await markAsReadMutation.mutateAsync(id);
  };

  const markAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
  };

  const deleteNotification = async (id: number) => {
    await deleteNotificationMutation.mutateAsync(id);
  };

  // Context value
  const value = {
    notifications: notifications as Notification[],
    unreadCount: unreadCountData.count,
    isLoading,
    error: error as Error | null,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications: refetch
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};