/**
 * Migration script to rename agent tables to use the langchain prefix
 * 
 * This script will rename the following tables:
 * - agent_conversations to langchain_agent_conversations
 * - agent_messages to langchain_agent_messages
 * - agent_notifications to langchain_agent_notifications
 * - agent_settings to langchain_agent_settings
 * - agent_tasks to langchain_agent_tasks
 * - telegram_messages to langchain_telegram_messages
 * - telegram_settings to langchain_telegram_settings
 * - telegram_users to langchain_telegram_users
 * 
 * The migration will:
 * 1. Create new tables with the langchain_ prefix
 * 2. Copy data from old tables to new tables
 * 3. Update foreign key references
 * 4. Drop old tables when complete
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Main migration function to rename agent tables to use langchain prefix
 */
export async function migrateLangchainNaming(force: boolean = false) {
  try {
    console.log('Starting migration to rename agent tables to langchain_ prefix...');

    // Always create tables first to ensure schema definitions exist
    // This ensures that any code using the new table names will work
    console.log('Creating langchain_ prefixed tables...');
    await createLangchainTables();

    // Check if we should perform data migration
    const existingTables = await checkExistingTables();
    if (existingTables.length > 0 && !force) {
      console.log(`Tables created. Some langchain_ prefixed tables already have data: ${existingTables.join(', ')}`);
      console.log('Skipping data migration. Use force=true to proceed with full migration');
      return true;
    }

    console.log('Proceeding with full data migration...');
    
    // Migrate data from old tables to new tables
    await migrateTableData();
    
    // Update foreign key references 
    await updateForeignKeyReferences();
    
    // Drop old tables
    await dropOldTables();

    console.log('Migration completed successfully!');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Check if any of the target langchain tables already exist
 */
async function checkExistingTables(): Promise<string[]> {
  const result = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'langchain_agent_conversations',
      'langchain_agent_messages',
      'langchain_agent_notifications',
      'langchain_agent_settings',
      'langchain_agent_tasks',
      'langchain_telegram_messages',
      'langchain_telegram_settings',
      'langchain_telegram_users'
    )
  `);
  
  const existingTables: string[] = [];
  for (const row of result.rows) {
    if (row && typeof row === 'object' && 'table_name' in row) {
      existingTables.push(String(row.table_name));
    }
  }
  return existingTables;
}

/**
 * Create new tables with langchain_ prefix
 */
async function createLangchainTables() {
  console.log('Creating new tables with langchain_ prefix...');
  
  // Create langchain_telegram_settings explicitly since it's causing issues
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_settings (
      id SERIAL PRIMARY KEY,
      bot_token TEXT NOT NULL,
      bot_username TEXT NOT NULL,
      webhook_url TEXT,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  
  // Insert default settings if needed
  const settingsCount = await db.execute(sql`
    SELECT COUNT(*) FROM langchain_telegram_settings
  `);
  
  if (parseInt(settingsCount.rows[0].count as string) === 0) {
    await db.execute(sql`
      INSERT INTO langchain_telegram_settings 
      (bot_token, bot_username, is_enabled) 
      VALUES ('PLACEHOLDER_TOKEN', 'emporiumbotdev', TRUE)
    `);
    console.log('Inserted default Telegram bot settings');
  }
  
  // Try to create other tables by copying existing ones if they exist
  try {
    // Create langchain_agent_conversations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_agent_conversations (
        LIKE agent_conversations INCLUDING ALL
      )
    `);
    
    // Create langchain_agent_messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_agent_messages (
        LIKE agent_messages INCLUDING ALL
      )
    `);
  
    // Create langchain_agent_notifications
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_agent_notifications (
        LIKE agent_notifications INCLUDING ALL
      )
    `);
    
    // Create langchain_agent_settings
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_agent_settings (
        LIKE agent_settings INCLUDING ALL
      )
    `);
    
    // Create langchain_agent_tasks
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_agent_tasks (
        LIKE agent_tasks INCLUDING ALL
      )
    `);
  } catch (error) {
    console.log('Error copying from existing tables:', error);
    console.log('Will create tables using explicit schema definitions');
    
    // If the source tables don't exist, create with explicit schema
    await createTablesExplicitly();
  }
  
  try {
    // Create langchain_telegram_messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_telegram_messages (
        LIKE telegram_messages INCLUDING ALL
      )
    `);
    
    // Create langchain_telegram_users
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS langchain_telegram_users (
        LIKE telegram_users INCLUDING ALL
      )
    `);
  } catch (error) {
    console.log('Error creating telegram tables:', error);
    // Telegram tables are already created explicitly above
  }
  
  console.log('New tables created successfully');
}

/**
 * Create tables with explicit schema definitions rather than copying
 */
async function createTablesExplicitly() {
  console.log('Creating tables with explicit schema definitions...');
  
  // Create langchain_agent_conversations
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_agent_conversations (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      context JSONB,
      metadata JSONB
    )
  `);
  
  // Create langchain_agent_messages
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_agent_messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tokens INTEGER,
      metadata JSONB
    )
  `);
  
  // Create langchain_agent_notifications
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_agent_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read BOOLEAN NOT NULL DEFAULT FALSE,
      data JSONB
    )
  `);
  
  // Create langchain_agent_settings
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_agent_settings (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      settings JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  
  // Create langchain_agent_tasks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_agent_tasks (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      result JSONB,
      data JSONB
    )
  `);
  
  // Create langchain_telegram_messages
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_messages (
      id SERIAL PRIMARY KEY,
      telegram_user_id INTEGER NOT NULL,
      conversation_id INTEGER,
      message_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      text TEXT NOT NULL,
      direction TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB
    )
  `);
  
  // Create langchain_telegram_users
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_users (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT,
      username TEXT,
      language_code TEXT,
      user_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB
    )
  `);
  
  console.log('Tables created with explicit schema definitions');
}

/**
 * Migrate data from old tables to new tables
 */
async function migrateTableData() {
  console.log('Migrating data to new tables...');
  
  // Migrate agent_conversations
  await db.execute(sql`
    INSERT INTO langchain_agent_conversations
    SELECT * FROM agent_conversations
  `);
  console.log('Migrated agent_conversations');
  
  // Migrate agent_messages
  await db.execute(sql`
    INSERT INTO langchain_agent_messages
    SELECT * FROM agent_messages
  `);
  console.log('Migrated agent_messages');
  
  // Migrate agent_notifications
  await db.execute(sql`
    INSERT INTO langchain_agent_notifications
    SELECT * FROM agent_notifications
  `);
  console.log('Migrated agent_notifications');
  
  // Migrate agent_settings
  await db.execute(sql`
    INSERT INTO langchain_agent_settings
    SELECT * FROM agent_settings
  `);
  console.log('Migrated agent_settings');
  
  // Migrate agent_tasks
  await db.execute(sql`
    INSERT INTO langchain_agent_tasks
    SELECT * FROM agent_tasks
  `);
  console.log('Migrated agent_tasks');
  
  // Migrate telegram_messages
  await db.execute(sql`
    INSERT INTO langchain_telegram_messages
    SELECT * FROM telegram_messages
  `);
  console.log('Migrated telegram_messages');
  
  // Migrate telegram_settings
  await db.execute(sql`
    INSERT INTO langchain_telegram_settings
    SELECT * FROM telegram_settings
  `);
  console.log('Migrated telegram_settings');
  
  // Migrate telegram_users
  await db.execute(sql`
    INSERT INTO langchain_telegram_users
    SELECT * FROM telegram_users
  `);
  console.log('Migrated telegram_users');
}

/**
 * Update foreign key references to point to new tables
 */
async function updateForeignKeyReferences() {
  console.log('Updating foreign key references...');
  
  // Drop foreign keys on telegram_messages that reference agent_conversations
  await db.execute(sql`
    ALTER TABLE langchain_telegram_messages
    DROP CONSTRAINT IF EXISTS telegram_messages_conversation_id_fkey
  `);
  
  // Re-create foreign keys on langchain_telegram_messages
  await db.execute(sql`
    ALTER TABLE langchain_telegram_messages
    ADD CONSTRAINT langchain_telegram_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES langchain_agent_conversations(id)
  `);
  
  // Drop foreign keys on langchain_telegram_messages that reference telegram_users
  await db.execute(sql`
    ALTER TABLE langchain_telegram_messages
    DROP CONSTRAINT IF EXISTS telegram_messages_telegram_user_id_fkey
  `);
  
  // Re-create foreign keys on langchain_telegram_messages for telegram_user_id
  await db.execute(sql`
    ALTER TABLE langchain_telegram_messages
    ADD CONSTRAINT langchain_telegram_messages_telegram_user_id_fkey
    FOREIGN KEY (telegram_user_id) REFERENCES langchain_telegram_users(id)
  `);
  
  // Drop foreign keys on langchain_agent_messages
  await db.execute(sql`
    ALTER TABLE langchain_agent_messages
    DROP CONSTRAINT IF EXISTS agent_messages_conversation_id_fkey
  `);
  
  // Re-create foreign keys on langchain_agent_messages for conversation_id
  await db.execute(sql`
    ALTER TABLE langchain_agent_messages
    ADD CONSTRAINT langchain_agent_messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES langchain_agent_conversations(id)
  `);
  
  console.log('Foreign key references updated successfully');
}

/**
 * Drop old tables after migration
 */
async function dropOldTables() {
  console.log('Dropping old tables...');
  
  // Drop old tables in reverse order of dependencies
  await db.execute(sql`DROP TABLE IF EXISTS telegram_messages`);
  await db.execute(sql`DROP TABLE IF EXISTS telegram_settings`);
  await db.execute(sql`DROP TABLE IF EXISTS telegram_users`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_messages`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_notifications`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_tasks`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_settings`);
  await db.execute(sql`DROP TABLE IF EXISTS agent_conversations`);
  
  console.log('Old tables dropped successfully');
}

/**
 * Run the migration directly if this script is executed as a standalone module
 */
// For ESM, we need a different approach to check if this is the main module
const isMainModule = import.meta.url.startsWith('file:') && 
  process.argv[1] && import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  migrateLangchainNaming()
    .then(() => {
      console.log('Migration script executed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}