/**
 * Migration script to add task scheduling features to the langchain_agent_tasks table
 * and create the new langchain_agent_task_tools table
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Main migration function to add task scheduling and tool association tables
 */
export async function migrateTaskScheduling() {
  console.log('Starting task scheduling migration...');
  
  try {
    // Add new columns to langchain_agent_tasks table
    await addColumnsToAgentTasks();
    
    // Create new langchain_agent_task_tools table
    await createAgentTaskToolsTable();
    
    console.log('Task scheduling migration completed successfully');
    return true;
  } catch (error) {
    console.error('Task scheduling migration failed:', error);
    return false;
  }
}

/**
 * Add new columns to the langchain_agent_tasks table for scheduling features
 */
async function addColumnsToAgentTasks() {
  console.log('Adding columns to langchain_agent_tasks table...');
  
  try {
    // Check if the columns already exist
    const { rows: columnsExist } = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'langchain_agent_tasks' 
      AND column_name IN (
        'scheduled_for', 
        'recurrence', 
        'priority', 
        'depends_on', 
        'completed_at', 
        'notify_on_complete', 
        'notify_on_fail', 
        'telegram_notify'
      )
    `);
    
    const existingColumns = columnsExist.map(row => row.column_name);
    console.log('Existing columns:', existingColumns);
    
    // Add scheduled_for column if it doesn't exist
    if (!existingColumns.includes('scheduled_for')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN scheduled_for TIMESTAMPTZ
      `);
      console.log('Added scheduled_for column');
    }
    
    // Add recurrence column if it doesn't exist
    if (!existingColumns.includes('recurrence')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN recurrence TEXT
      `);
      console.log('Added recurrence column');
    }
    
    // Add priority column if it doesn't exist
    if (!existingColumns.includes('priority')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN priority TEXT DEFAULT 'medium'
      `);
      console.log('Added priority column');
    }
    
    // Add depends_on column if it doesn't exist
    if (!existingColumns.includes('depends_on')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN depends_on INTEGER REFERENCES langchain_agent_tasks(id)
      `);
      console.log('Added depends_on column');
    }
    
    // Add completed_at column if it doesn't exist
    if (!existingColumns.includes('completed_at')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN completed_at TIMESTAMPTZ
      `);
      console.log('Added completed_at column');
    }
    
    // Add notify_on_complete column if it doesn't exist
    if (!existingColumns.includes('notify_on_complete')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN notify_on_complete BOOLEAN DEFAULT TRUE
      `);
      console.log('Added notify_on_complete column');
    }
    
    // Add notify_on_fail column if it doesn't exist
    if (!existingColumns.includes('notify_on_fail')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN notify_on_fail BOOLEAN DEFAULT TRUE
      `);
      console.log('Added notify_on_fail column');
    }
    
    // Add telegram_notify column if it doesn't exist
    if (!existingColumns.includes('telegram_notify')) {
      await db.execute(sql`
        ALTER TABLE langchain_agent_tasks
        ADD COLUMN telegram_notify BOOLEAN DEFAULT FALSE
      `);
      console.log('Added telegram_notify column');
    }
    
    console.log('Successfully added columns to langchain_agent_tasks table');
  } catch (error) {
    console.error('Error adding columns to langchain_agent_tasks:', error);
    throw error;
  }
}

/**
 * Create the new langchain_agent_task_tools table
 */
async function createAgentTaskToolsTable() {
  console.log('Creating langchain_agent_task_tools table...');
  
  try {
    // Check if table already exists
    const { rows: tableExists } = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_agent_task_tools'
      );
    `);
    
    if (tableExists[0].exists) {
      console.log('langchain_agent_task_tools table already exists');
      return;
    }
    
    // Create the table
    await db.execute(sql`
      CREATE TABLE langchain_agent_task_tools (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES langchain_agent_tasks(id) ON DELETE CASCADE,
        tool_id INTEGER NOT NULL REFERENCES langchain_tools(id) ON DELETE CASCADE,
        priority INTEGER DEFAULT 0,
        parameters JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create an index for performance
    await db.execute(sql`
      CREATE INDEX idx_agent_task_tools_task_id ON langchain_agent_task_tools(task_id)
    `);
    
    console.log('Successfully created langchain_agent_task_tools table');
  } catch (error) {
    console.error('Error creating langchain_agent_task_tools table:', error);
    throw error;
  }
}