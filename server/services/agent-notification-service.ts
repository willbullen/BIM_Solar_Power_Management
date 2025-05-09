import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";

class AgentNotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data: Omit<schema.InsertAgentNotification, "id" | "createdAt" | "readAt">): Promise<schema.AgentNotification> {
    try {
      const result = await db.insert(schema.agentNotifications).values({
        ...data,
        createdAt: new Date().toISOString(),
        readAt: null
      }).returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: number): Promise<schema.AgentNotification[]> {
    try {
      return await db.select().from(schema.agentNotifications)
        .where(eq(schema.agentNotifications.userId, userId))
        .orderBy(schema.agentNotifications.createdAt, "desc");
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw error;
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: number): Promise<schema.AgentNotification[]> {
    try {
      return await db.select().from(schema.agentNotifications)
        .where(eq(schema.agentNotifications.userId, userId))
        .where(eq(schema.agentNotifications.read, false))
        .orderBy(schema.agentNotifications.createdAt, "desc");
    } catch (error) {
      console.error("Error getting unread notifications:", error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await db.select({ count: sql`count(*)` })
        .from(schema.agentNotifications)
        .where(eq(schema.agentNotifications.userId, userId))
        .where(eq(schema.agentNotifications.read, false));
      
      // Make sure we handle cases where result[0] could be undefined
      if (result && result[0] && result[0].count !== undefined) {
        return Number(result[0].count);
      }
      return 0; // Return 0 if no results or count is undefined
    } catch (error) {
      console.error("Error getting unread count:", error);
      // Return 0 instead of throwing to avoid breaking the client
      return 0;
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number): Promise<schema.AgentNotification> {
    try {
      const result = await db.update(schema.agentNotifications)
        .set({ 
          read: true,
          readAt: new Date().toISOString()
        })
        .where(eq(schema.agentNotifications.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Mark all notifications for a user as read
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      const result = await db.update(schema.agentNotifications)
        .set({ 
          read: true,
          readAt: new Date().toISOString()
        })
        .where(eq(schema.agentNotifications.userId, userId))
        .where(eq(schema.agentNotifications.read, false));
      
      return result.rowCount || 0;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.agentNotifications)
        .where(eq(schema.agentNotifications.id, id));
      
      return !!result.rowCount;
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }
}

// Export service as a singleton
export const agentNotificationService = new AgentNotificationService();