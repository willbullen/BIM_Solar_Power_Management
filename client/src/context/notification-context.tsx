import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface AgentNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  priority: 'low' | 'medium' | 'high';
  source: string;
  category: string;
  createdAt: string;
  readAt: string | null;
  data: string | null;
}

interface NotificationContextType {
  notifications: AgentNotification[];
  unreadCount: number;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<Error | null>(null);
  
  // Fetch all notifications
  const { 
    data: notifications = [], 
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications
  } = useQuery({
    queryKey: ['/api/agent/notifications'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/agent/notifications', 'GET');
        return data as AgentNotification[];
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError(err as Error);
        return [];
      }
    },
    // Refresh every minute
    refetchInterval: 60000,
  });

  // Fetch unread count
  const { 
    data: unreadCountData,
    isLoading: isLoadingUnreadCount,
    refetch: refetchUnreadCount
  } = useQuery({
    queryKey: ['/api/agent/notifications/unread/count'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/agent/notifications/unread/count', 'GET');
        return data.count as number;
      } catch (err) {
        console.error('Error fetching unread count:', err);
        setError(err as Error);
        return 0;
      }
    },
    // Refresh every minute
    refetchInterval: 60000,
  });

  const unreadCount = unreadCountData as number || 0;
  const isLoading = isLoadingNotifications || isLoadingUnreadCount;

  // Mark a notification as read
  const markAsRead = async (id: number): Promise<void> => {
    try {
      await apiRequest(`/api/agent/notifications/${id}/read`, 'PATCH');
      
      // Update cache optimistically
      queryClient.setQueryData(['/api/agent/notifications'], (oldData: AgentNotification[] | undefined) => {
        if (!oldData) return [];
        return oldData.map(notification => 
          notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification
        );
      });
      
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err as Error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async (): Promise<void> => {
    try {
      await apiRequest('/api/agent/notifications/mark-all-read', 'POST');
      
      // Update cache optimistically
      queryClient.setQueryData(['/api/agent/notifications'], (oldData: AgentNotification[] | undefined) => {
        if (!oldData) return [];
        const now = new Date().toISOString();
        return oldData.map(notification => ({ ...notification, readAt: now }));
      });
      
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError(err as Error);
    }
  };

  // Delete a notification
  const deleteNotification = async (id: number): Promise<void> => {
    try {
      await apiRequest(`/api/agent/notifications/${id}`, 'DELETE');
      
      // Update cache optimistically
      queryClient.setQueryData(['/api/agent/notifications'], (oldData: AgentNotification[] | undefined) => {
        if (!oldData) return [];
        return oldData.filter(notification => notification.id !== id);
      });
      
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/notifications/unread/count'] });
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError(err as Error);
    }
  };

  // Refetch both queries
  const refetch = () => {
    refetchNotifications();
    refetchUnreadCount();
  };

  const value = {
    notifications: notifications || [],
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    isLoading,
    error,
    refetch,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}