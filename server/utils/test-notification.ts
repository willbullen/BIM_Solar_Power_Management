import { db } from '../db';
import { agentNotifications } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { format } from 'date-fns';

/**
 * Creates a test notification for development and testing purposes
 * @param userId The user ID to create the notification for (defaults to 1)
 * @returns The created notification
 */
export async function createTestNotification(userId = 1) {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const types = ['alert', 'info', 'success', 'warning'];
  const randomType = types[Math.floor(Math.random() * types.length)];
  
  // Notification messages based on type
  const messages = {
    alert: 'Urgent: Abnormal power usage detected in Freezer Unit 3',
    info: 'Scheduled maintenance completed for Solar Panel Array B',
    success: 'New energy optimization achieved: 12% reduction in peak loads',
    warning: 'Weather alert: Heavy cloud cover expected to reduce solar gain by 30%'
  };
  
  // Create the notification
  const result = await db.insert(agentNotifications).values({
    userId,
    title: `Test ${randomType.charAt(0).toUpperCase() + randomType.slice(1)} Notification`,
    message: messages[randomType as keyof typeof messages],
    type: randomType,
    priority: randomType === 'alert' ? 'high' : randomType === 'warning' ? 'medium' : 'low',
    source: 'system',
    category: 'test',
    createdAt: sql`NOW()`,
    data: JSON.stringify({
      test: true,
      timestamp,
      randomValue: Math.floor(Math.random() * 100)
    })
  }).returning();
  
  return result[0];
}