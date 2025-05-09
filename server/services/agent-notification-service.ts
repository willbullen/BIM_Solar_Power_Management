import * as schema from "@shared/schema";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";

/**
 * Service for handling AI agent notifications using REST API instead of WebSockets
 */
export class AgentNotificationService {
  /**
   * Create a new notification
   * @param notification The notification object to create
   */
  async createNotification(notification: schema.InsertAgentNotification): Promise<schema.AgentNotification> {
    const [createdNotification] = await db.insert(schema.agentNotifications)
      .values(notification)
      .returning();
    
    return createdNotification;
  }

  /**
   * Get all unread notifications for a user
   * @param userId The user ID to get notifications for
   * @param limit The maximum number of notifications to return
   */
  async getUnreadNotifications(userId: number, limit: number = 100): Promise<schema.AgentNotification[]> {
    const notifications = await db.query.agentNotifications.findMany({
      where: and(
        eq(schema.agentNotifications.userId, userId),
        eq(schema.agentNotifications.read, false)
      ),
      orderBy: [desc(schema.agentNotifications.createdAt)],
      limit
    });
    
    return notifications;
  }

  /**
   * Get all notifications for a user
   * @param userId The user ID to get notifications for
   * @param limit The maximum number of notifications to return
   */
  async getNotifications(userId: number, limit: number = 100): Promise<schema.AgentNotification[]> {
    const notifications = await db.query.agentNotifications.findMany({
      where: eq(schema.agentNotifications.userId, userId),
      orderBy: [desc(schema.agentNotifications.createdAt)],
      limit
    });
    
    return notifications;
  }

  /**
   * Mark a notification as read
   * @param notificationId The ID of the notification to mark as read
   */
  async markAsRead(notificationId: number): Promise<schema.AgentNotification> {
    const [updatedNotification] = await db.update(schema.agentNotifications)
      .set({ read: true, readAt: new Date() })
      .where(eq(schema.agentNotifications.id, notificationId))
      .returning();
    
    return updatedNotification;
  }

  /**
   * Mark all notifications for a user as read
   * @param userId The user ID to mark notifications for
   * @returns The number of notifications marked as read
   */
  async markAllAsRead(userId: number): Promise<number> {
    const result = await db.update(schema.agentNotifications)
      .set({ read: true, readAt: new Date() })
      .where(and(
        eq(schema.agentNotifications.userId, userId),
        eq(schema.agentNotifications.read, false)
      ));
    
    return result.rowCount || 0;
  }

  /**
   * Delete a notification
   * @param notificationId The ID of the notification to delete
   */
  async deleteNotification(notificationId: number): Promise<void> {
    await db.delete(schema.agentNotifications)
      .where(eq(schema.agentNotifications.id, notificationId));
  }

  /**
   * Create a system notification for a user
   * @param userId The user ID to create the notification for
   * @param title The notification title
   * @param message The notification message
   * @param type The notification type ('info', 'warning', 'error', 'success')
   * @returns The created notification
   */
  async createSystemNotification(
    userId: number, 
    title: string, 
    message: string, 
    type: string = 'info'
  ): Promise<schema.AgentNotification> {
    return this.createNotification({
      userId,
      title,
      message,
      type,
      source: 'system',
      read: false,
      data: {}
    });
  }

  /**
   * Create a task notification for a user
   * @param userId The user ID to create the notification for
   * @param taskId The task ID related to the notification
   * @param title The notification title
   * @param message The notification message
   * @returns The created notification
   */
  async createTaskNotification(
    userId: number,
    taskId: number,
    title: string,
    message: string
  ): Promise<schema.AgentNotification> {
    return this.createNotification({
      userId,
      title,
      message,
      type: 'task',
      source: 'task',
      read: false,
      data: { taskId }
    });
  }

  /**
   * Create a conversation notification for a user
   * @param userId The user ID to create the notification for
   * @param conversationId The conversation ID related to the notification
   * @param title The notification title
   * @param message The notification message
   * @returns The created notification
   */
  async createConversationNotification(
    userId: number,
    conversationId: number,
    title: string,
    message: string
  ): Promise<schema.AgentNotification> {
    return this.createNotification({
      userId,
      title,
      message,
      type: 'conversation',
      source: 'conversation',
      read: false,
      data: { conversationId }
    });
  }
}

// Export a singleton instance
export const agentNotificationService = new AgentNotificationService();