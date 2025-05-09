import { Express, Request, Response } from 'express';
import { agentNotificationService } from './services/agent-notification-service';

// Authentication middleware
function requireAuth(req: Request, res: Response, next: any) {
  const session = req.session as any;
  if (!session || !session.userId) {
    console.log('Auth check - Session:', session ? 'exists' : 'none');
    console.log('Auth check - UserId:', session?.userId || 'none');
    console.log('Auth check - IsAuthenticated: no');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  console.log('Auth check - Session:', 'exists');
  console.log('Auth check - UserId:', session.userId);
  console.log('Auth check - IsAuthenticated: yes');
  next();
}

export function registerNotificationRoutes(app: Express) {
  // Get all notifications for the authenticated user
  app.get('/api/agent/notifications', requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const notifications = await agentNotificationService.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  });

  // Get unread notification count for the authenticated user
  app.get('/api/agent/notifications/unread/count', requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const count = await agentNotificationService.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting unread notification count:', error);
      res.status(500).json({ error: 'Failed to get unread notification count' });
    }
  });

  // Get unread notifications for the authenticated user
  app.get('/api/agent/notifications/unread', requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const notifications = await agentNotificationService.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      res.status(500).json({ error: 'Failed to get unread notifications' });
    }
  });

  // Mark a notification as read
  app.patch('/api/agent/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      
      const notification = await agentNotificationService.markAsRead(notificationId);
      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read for the authenticated user
  app.post('/api/agent/notifications/mark-all-read', requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const count = await agentNotificationService.markAllAsRead(userId);
      res.json({ count, success: true });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // Delete a notification
  app.delete('/api/agent/notifications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      
      const success = await agentNotificationService.deleteNotification(notificationId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });
}