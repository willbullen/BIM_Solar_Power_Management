import { agentNotificationService } from "../services/agent-notification-service";

/**
 * Create a sample test notification
 * This function is used for testing the notification functionality
 */
export async function createTestNotification(userId: number = 1) {
  try {
    // Create a test notification of each type
    const types = ['info', 'warning', 'error', 'success', 'task', 'conversation'];
    const sources = ['system', 'task', 'conversation', 'agent'];
    
    const randomType = types[Math.floor(Math.random() * types.length)];
    const randomSource = sources[Math.floor(Math.random() * sources.length)];
    
    // Create a notification with a timestamp for uniqueness
    const notification = await agentNotificationService.createNotification({
      userId,
      title: `Test ${randomType.charAt(0).toUpperCase() + randomType.slice(1)} Notification`,
      message: `This is a test ${randomType} notification from ${randomSource} created at ${new Date().toISOString()}`,
      type: randomType,
      source: randomSource,
      read: false,
      data: { testId: Date.now() }
    });
    
    return notification;
  } catch (error) {
    console.error('Error creating test notification:', error);
    throw error;
  }
}