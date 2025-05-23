import { Express, Request, Response } from 'express';
import { agentNotificationService } from './services/agent-notification-service';
import { storage } from './storage';

// Authentication middleware with header-based fallback
async function requireAuth(req: Request, res: Response, next: any) {
  const session = req.session as any;
  
  // First check session-based auth
  if (session && session.userId) {
    console.log('Auth check - Session:', 'exists');
    console.log('Auth check - UserId:', session.userId);
    console.log('Auth check - IsAuthenticated: yes (session)');
    return next();
  }
  
  // If session auth fails, try header-based auth
  const headerUserId = req.header('X-Auth-User-Id');
  const headerUsername = req.header('X-Auth-Username');
  
  if (headerUserId && headerUsername) {
    console.log('Auth check - Using header-based authentication');
    
    try {
      // Validate the header credentials
      const userId = parseInt(headerUserId, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'Invalid user ID in header' });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user || user.username !== headerUsername) {
        return res.status(401).json({ error: 'Invalid authentication credentials' });
      }
      
      // If valid, store in session for future requests
      if (req.session) {
        req.session.userId = userId;
        req.session.userRole = user.role;
        
        // Save session immediately
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session from header auth:', err);
          } else {
            console.log('Session restored from header auth for user:', userId);
          }
        });
      }
      
      // Continue to the next middleware/route handler
      console.log('Auth check - IsAuthenticated: yes (header)');
      return next();
    } catch (error) {
      console.error('Header auth validation error:', error);
      // Continue with other auth methods
    }
  }
  
  // If all auth methods fail
  console.log('Auth check - Session:', session ? 'exists' : 'none');
  console.log('Auth check - UserId:', session?.userId || 'none');
  console.log('Auth check - IsAuthenticated: no');
  return res.status(401).json({ error: 'Not authenticated' });
}

export function registerNotificationRoutes(app: Express) {
  // Create a test notification (for development and testing only)
  app.post('/api/agent/notifications/test', requireAuth, async (req: Request, res: Response) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      // Import the test notification creator
      const { createTestNotification } = await import('./utils/test-notification');
      const notification = await createTestNotification(userId);
      
      res.json({ success: true, notification });
    } catch (error) {
      console.error('Error creating test notification:', error);
      res.status(500).json({ error: 'Failed to create test notification' });
    }
  });

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