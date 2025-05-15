/**
 * Migration to remove old telegram_settings table
 * 
 * This script will:
 * 1. Check if telegram_settings table still exists
 * 2. Remove it if it does (since it's been migrated to langchain_telegram_settings)
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Main migration function to remove telegram_settings
 */
export async function removeTelegramSettings() {
  console.log('Starting removal of old telegram_settings table...');

  try {
    // Check if table exists
    const tableExists = await checkTableExists('telegram_settings');
    
    if (tableExists) {
      console.log('telegram_settings table found. Removing it...');
      await db.execute(sql`DROP TABLE IF EXISTS telegram_settings`);
      console.log('telegram_settings table removed successfully');
    } else {
      console.log('telegram_settings table does not exist. Nothing to remove.');
    }
    
    console.log('Old telegram_settings table cleanup completed successfully.');
  } catch (error) {
    console.error('Error removing telegram_settings table:', error);
    throw error;
  }
}

/**
 * Helper to check if a table exists
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    )
  `);
  
  return result.rows[0].exists === true;
}