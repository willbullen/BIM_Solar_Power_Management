/**
 * Migration script to properly move data from telegram_* tables to langchain_telegram_* tables
 * and then drop the old tables.
 */

import pg from 'pg';
import * as dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Starting Telegram table migration...");
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // 1. First check if old tables exist
    console.log("Checking if old telegram tables exist...");
    
    const tableCheckQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('telegram_users', 'telegram_messages', 'telegram_settings');
    `;
    
    const tableResult = await client.query(tableCheckQuery);
    const oldTables = tableResult.rows.map(row => row.table_name);
    
    if (oldTables.length === 0) {
      console.log("No old telegram tables found, nothing to migrate.");
      await client.query('COMMIT');
      return;
    }
    
    console.log(`Found ${oldTables.length} old tables to migrate: ${oldTables.join(', ')}`);
    
    // 2. Migrate data from old to new tables if they exist
    if (oldTables.includes('telegram_users')) {
      console.log("Migrating telegram_users to langchain_telegram_users...");
      // Check if there's data to migrate
      const userCheckQuery = `SELECT COUNT(*) FROM telegram_users;`;
      const userCountResult = await client.query(userCheckQuery);
      const userCount = parseInt(userCountResult.rows[0].count);
      
      if (userCount > 0) {
        // First check if destination table exists
        const destTableCheck = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_telegram_users';
        `;
        const destTableResult = await client.query(destTableCheck);
        
        if (destTableResult.rows.length > 0) {
          // Migrate data
          const migrateUsersQuery = `
            INSERT INTO langchain_telegram_users 
            SELECT * FROM telegram_users
            ON CONFLICT (id) DO NOTHING;
          `;
          await client.query(migrateUsersQuery);
          console.log(`Migrated ${userCount} users to langchain_telegram_users`);
        } else {
          console.log("Destination table langchain_telegram_users doesn't exist, skipping migration.");
        }
      } else {
        console.log("No users to migrate from telegram_users.");
      }
    }
    
    if (oldTables.includes('telegram_messages')) {
      console.log("Migrating telegram_messages to langchain_telegram_messages...");
      // Check if there's data to migrate
      const msgCheckQuery = `SELECT COUNT(*) FROM telegram_messages;`;
      const msgCountResult = await client.query(msgCheckQuery);
      const msgCount = parseInt(msgCountResult.rows[0].count);
      
      if (msgCount > 0) {
        // First check if destination table exists
        const destTableCheck = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_telegram_messages';
        `;
        const destTableResult = await client.query(destTableCheck);
        
        if (destTableResult.rows.length > 0) {
          // Migrate data
          const migrateMessagesQuery = `
            INSERT INTO langchain_telegram_messages
            SELECT * FROM telegram_messages
            ON CONFLICT (id) DO NOTHING;
          `;
          await client.query(migrateMessagesQuery);
          console.log(`Migrated ${msgCount} messages to langchain_telegram_messages`);
        } else {
          console.log("Destination table langchain_telegram_messages doesn't exist, skipping migration.");
        }
      } else {
        console.log("No messages to migrate from telegram_messages.");
      }
    }
    
    if (oldTables.includes('telegram_settings')) {
      console.log("Migrating telegram_settings to langchain_telegram_settings...");
      // Check if there's data to migrate
      const settingsCheckQuery = `SELECT COUNT(*) FROM telegram_settings;`;
      const settingsCountResult = await client.query(settingsCheckQuery);
      const settingsCount = parseInt(settingsCountResult.rows[0].count);
      
      if (settingsCount > 0) {
        // First check if destination table exists
        const destTableCheck = `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_telegram_settings';
        `;
        const destTableResult = await client.query(destTableCheck);
        
        if (destTableResult.rows.length > 0) {
          // Migrate data
          const migrateSettingsQuery = `
            INSERT INTO langchain_telegram_settings
            SELECT * FROM telegram_settings
            ON CONFLICT (id) DO NOTHING;
          `;
          await client.query(migrateSettingsQuery);
          console.log(`Migrated ${settingsCount} settings to langchain_telegram_settings`);
        } else {
          console.log("Destination table langchain_telegram_settings doesn't exist, skipping migration.");
        }
      } else {
        console.log("No settings to migrate from telegram_settings.");
      }
    }
    
    // 3. Drop old tables after successful migration
    for (const table of oldTables) {
      console.log(`Dropping old table: ${table}...`);
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
    }
    
    await client.query('COMMIT');
    console.log("Migration completed successfully. Old tables dropped.");
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error during migration:", error);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Use self-executing async function for ESM
(async () => {
  try {
    await main();
    console.log("Migration script completed");
    process.exit(0);
  } catch (err) {
    console.error("Migration script failed:", err);
    process.exit(1);
  }
})();