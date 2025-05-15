/**
 * This script migrates the database to add Telegram integration tables
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { telegramSettings, telegramUsers, telegramMessages } from '../../shared/schema';
// Import for ES module main detection
import { fileURLToPath } from 'url';

export async function migrate() {
  try {
    console.log('Starting Telegram integration database migration...');
    
    // Create tables
    await createTelegramTables();
    
    // Create default settings if needed
    await createDefaultSettings();
    
    console.log('Telegram integration database migration completed successfully.');
  } catch (error) {
    console.error('Error during Telegram integration database migration:', error);
    throw error;
  }
}

/**
 * Create all the Telegram related tables
 */
async function createTelegramTables() {
  try {
    console.log('Creating Telegram tables...');
    
    // Check if telegram_settings table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'telegram_settings'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      // Create telegram_settings table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS telegram_settings (
          id SERIAL PRIMARY KEY,
          bot_token TEXT NOT NULL,
          bot_username TEXT NOT NULL,
          webhook_url TEXT,
          is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_by INTEGER REFERENCES users(id)
        );
      `);
      
      // Create telegram_users table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS telegram_users (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          telegram_id TEXT NOT NULL UNIQUE,
          telegram_username TEXT,
          telegram_first_name TEXT,
          telegram_last_name TEXT,
          chat_id TEXT NOT NULL,
          notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          receive_alerts BOOLEAN NOT NULL DEFAULT TRUE,
          receive_reports BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_accessed TIMESTAMP,
          verification_code TEXT,
          verification_expires TIMESTAMP,
          is_verified BOOLEAN NOT NULL DEFAULT FALSE
        );
      `);
      
      // Create telegram_messages table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS telegram_messages (
          id SERIAL PRIMARY KEY,
          telegram_user_id INTEGER NOT NULL REFERENCES telegram_users(id),
          direction TEXT NOT NULL,
          message_text TEXT NOT NULL,
          message_id TEXT,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          is_processed BOOLEAN NOT NULL DEFAULT FALSE,
          conversation_id INTEGER REFERENCES langchain_agent_conversations(id)
        );
      `);
      
      console.log('Telegram tables created successfully.');
    } else {
      console.log('Telegram tables already exist. Skipping creation.');
    }
  } catch (error) {
    console.error('Error creating Telegram tables:', error);
    throw error;
  }
}

/**
 * Create default Telegram settings
 */
async function createDefaultSettings() {
  try {
    // Check if settings already exist
    const existingSettings = await db.select().from(telegramSettings).limit(1);
    
    if (existingSettings.length === 0) {
      console.log('Creating default Telegram settings...');
      
      // Insert placeholder settings (will need to be updated by admin)
      await db.insert(telegramSettings).values({
        botToken: 'PLACEHOLDER_TOKEN',
        botUsername: 'emporium_agent_bot',
        webhookUrl: null,
        isEnabled: false
      });
      
      console.log('Default Telegram settings created successfully.');
    } else {
      console.log('Telegram settings already exist. Skipping creation of defaults.');
    }
  } catch (error) {
    console.error('Error creating default Telegram settings:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
// Using ES modules approach instead of CommonJS

// Check if this file is being run directly
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  migrate()
    .then(() => {
      console.log('Telegram integration migration completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Telegram integration migration failed:', error);
      process.exit(1);
    });
}