import { Express, Request, Response } from "express";
import { z } from "zod";
import { agentNotificationService } from "./services/agent-notification-service";

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
}

// Define validation schemas
const notificationIdSchema = z.object({
  id: z.coerce.number().positive()
});

// Register notification routes
export function registerNotificationRoutes(app: Express) {
  // Get all notifications for the current user
  app.get('/api/agent/notifications', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const notifications = await agentNotificationService.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // Get unread notifications count for the current user
  app.get('/api/agent/notifications/unread/count', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const notifications = await agentNotificationService.getUnreadNotifications(userId);
      res.json({ count: notifications.length });
    } catch (error) {
      console.error('Error fetching unread notification count:', error);
      res.status(500).json({ message: 'Failed to fetch unread notification count' });
    }
  });

  // Get unread notifications for the current user
  app.get('/api/agent/notifications/unread', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const notifications = await agentNotificationService.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      res.status(500).json({ message: 'Failed to fetch unread notifications' });
    }
  });

  // Mark a notification as read
  app.patch('/api/agent/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = notificationIdSchema.parse({ id: req.params.id });
      
      // Mark the notification as read
      const notification = await agentNotificationService.markAsRead(id);
      
      res.json(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read for the current user
  app.post('/api/agent/notifications/mark-all-read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      
      // Mark all notifications as read
      const count = await agentNotificationService.markAllAsRead(userId);
      
      res.json({ count });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  // Delete a notification
  app.delete('/api/agent/notifications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = notificationIdSchema.parse({ id: req.params.id });
      
      // Delete the notification
      await agentNotificationService.deleteNotification(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting notification:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  });
}