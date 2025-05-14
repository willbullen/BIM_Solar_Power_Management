import { db } from '../db';
import * as schema from '../../shared/schema';
import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * This script migrates the database to add the agent notifications table
 */
export async function migrate() {
  console.log('Starting agent notifications database migration...');

  try {
    // Create the agent notifications table
    await createNotificationsTable();
    console.log('Successfully created agent notifications table');

    console.log('Agent notifications database migration completed successfully');
  } catch (error) {
    console.error('Error during agent notifications migration:', error);
    throw error;
  }
}

/**
 * Create the agent notifications table
 */
async function createNotificationsTable() {
  try {
    // Create the agent_notifications table if it doesn't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        read_at TIMESTAMP,
        data JSONB DEFAULT '{}'::jsonb
      );
    `);
  } catch (error) {
    console.error('Error creating agent_notifications table:', error);
    throw error;
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}