import { createTestNotification } from './utils/test-notification';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file URL and convert it to a path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const modulePath = process.argv[1];
if (modulePath === __filename) {
  main();
}