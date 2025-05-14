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

    // Check if tables already exist with langchain prefix
    const existingTables = await checkExistingTables();
    if (existingTables.length > 0 && !force) {
      console.log(`Some langchain_ prefixed tables already exist: ${existingTables.join(', ')}`);
      console.log('Use force=true to proceed anyway');
      return false;
    }

    // Create new tables with langchain_ prefix
    await createLangchainTables();
    
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
  
  return result.rows.map(row => row.table_name);
}

/**
 * Create new tables with langchain_ prefix
 */
async function createLangchainTables() {
  console.log('Creating new tables with langchain_ prefix...');
  
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
  
  // Create langchain_telegram_messages
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_messages (
      LIKE telegram_messages INCLUDING ALL
    )
  `);
  
  // Create langchain_telegram_settings
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_settings (
      LIKE telegram_settings INCLUDING ALL
    )
  `);
  
  // Create langchain_telegram_users
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS langchain_telegram_users (
      LIKE telegram_users INCLUDING ALL
    )
  `);
  
  console.log('New tables created successfully');
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
if (require.main === module) {
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