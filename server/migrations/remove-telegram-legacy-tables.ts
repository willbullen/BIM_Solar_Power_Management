/**
 * This script removes the legacy telegram_users and telegram_messages tables
 * after migrating to the langchain_telegram_* prefixed tables
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
// Import for ES module main detection
import { fileURLToPath } from 'url';

export async function migrate() {
  try {
    console.log('Legacy telegram tables migration is now DISABLED to preserve verification data');
    
    // Simply return without doing anything
    console.log('Legacy telegram tables cleanup completed successfully.');
    return;
    
    /* Original code commented out to preserve Telegram verification data
    console.log('Starting removal of old telegram_users and telegram_messages tables...');
    
    // Check and remove telegram_users table
    const usersTableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telegram_users'
      );
    `);
    
    if (usersTableExists.rows[0].exists) {
      console.log('telegram_users table found. Removing it...');
      
      // Remove telegram_messages first due to foreign key dependency
      await removeTelegramMessagesTable();
      
      // Now remove the telegram_users table
      await db.execute(sql`DROP TABLE IF EXISTS telegram_users;`);
      console.log('telegram_users table removed successfully');
    } else {
      console.log('telegram_users table does not exist, nothing to remove.');
    }
    */
  } catch (error) {
    console.error('Error during removal of legacy telegram tables:', error);
    throw error;
  }
}

/**
 * Check and remove the telegram_messages table
 */
async function removeTelegramMessagesTable() {
  // Check if telegram_messages table exists
  const messagesTableExists = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'telegram_messages'
    );
  `);
  
  if (messagesTableExists.rows[0].exists) {
    console.log('telegram_messages table found. Removing it...');
    await db.execute(sql`DROP TABLE IF EXISTS telegram_messages;`);
    console.log('telegram_messages table removed successfully');
  } else {
    console.log('telegram_messages table does not exist, nothing to remove.');
  }
}

// Run the migration if this script is executed directly
// Using ES modules approach instead of CommonJS

// Check if this file is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  migrate()
    .then(() => {
      console.log('Legacy telegram tables removal completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Legacy telegram tables removal failed:', error);
      process.exit(1);
    });
}