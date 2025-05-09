import { createTestNotification } from './utils/test-notification';

/**
 * Simple script to create a test notification
 * Used to test the notification system
 */
async function main() {
  try {
    console.log('Creating test notification...');
    const notification = await createTestNotification();
    console.log('Test notification created successfully:', notification);
    process.exit(0);
  } catch (error) {
    console.error('Error creating test notification:', error);
    process.exit(1);
  }
}

// Run script directly
if (require.main === module) {
  main();
}