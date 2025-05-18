import { db } from '../db';

/**
 * Migration to create tables for task scheduling
 */
export async function migrateTaskScheduling() {
  console.log('Starting Task Scheduling migration...');
  
  try {
    // Check if the tables already exist
    const result = await db.execute(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'langchain_agent_tasks'
      )`
    );
    
    const exists = result.rows[0].exists;
    
    if (exists) {
      console.log('Task Scheduling tables already exist, skipping migration');
      return;
    }
    
    // Create the enums
    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
          CREATE TYPE task_status AS ENUM ('pending', 'in-progress', 'completed', 'failed');
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
          CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
        END IF;
      END$$;
    `);
    
    // Create the agent tasks table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS langchain_agent_tasks (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        task TEXT NOT NULL,
        status task_status NOT NULL DEFAULT 'pending',
        scheduled_for TIMESTAMP,
        recurrence TEXT,
        priority task_priority NOT NULL DEFAULT 'medium',
        depends_on INTEGER,
        notify_on_complete BOOLEAN NOT NULL DEFAULT TRUE,
        notify_on_fail BOOLEAN NOT NULL DEFAULT TRUE,
        telegram_notify BOOLEAN NOT NULL DEFAULT FALSE,
        data JSONB,
        result JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `);
    
    // Create the agent task tools table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS langchain_agent_task_tools (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL,
        tool_id INTEGER NOT NULL,
        priority INTEGER NOT NULL DEFAULT 0,
        parameters JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_task FOREIGN KEY(task_id) REFERENCES langchain_agent_tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_tool FOREIGN KEY(tool_id) REFERENCES langchain_tools(id) ON DELETE CASCADE
      )
    `);
    
    // Add foreign key constraint for agent_id and user_id
    await db.execute(`
      ALTER TABLE langchain_agent_tasks
      ADD CONSTRAINT fk_agent FOREIGN KEY(agent_id) REFERENCES langchain_agents(id) ON DELETE CASCADE,
      ADD CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      ADD CONSTRAINT fk_depends_on FOREIGN KEY(depends_on) REFERENCES langchain_agent_tasks(id) ON DELETE SET NULL
    `);
    
    // Add indexes for better performance
    await db.execute(`
      CREATE INDEX idx_tasks_agent_id ON langchain_agent_tasks(agent_id);
      CREATE INDEX idx_tasks_user_id ON langchain_agent_tasks(user_id);
      CREATE INDEX idx_tasks_status ON langchain_agent_tasks(status);
      CREATE INDEX idx_tasks_scheduled_for ON langchain_agent_tasks(scheduled_for);
      CREATE INDEX idx_task_tools_task_id ON langchain_agent_task_tools(task_id);
      CREATE INDEX idx_task_tools_tool_id ON langchain_agent_task_tools(tool_id);
    `);
    
    console.log('Successfully completed Task Scheduling migration');
  } catch (error) {
    console.error('Error during Task Scheduling migration:', error);
    throw error;
  }
}