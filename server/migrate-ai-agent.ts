import { db } from "./db";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * This script migrates the database to add AI agent capabilities
 */
export async function migrate() {
  console.log("Starting AI agent database migration...");
  
  try {
    // Create all the AI agent related tables
    await createAgentTables();
    console.log("Successfully created AI agent tables");
    
    // Create default agent settings
    await createDefaultAgentSettings();
    console.log("Successfully created default agent settings");
    
    // Create default agent functions
    await createDefaultAgentFunctions();
    console.log("Successfully created default agent functions");
    
    // Register sample functions for demonstration (dynamic import to avoid circular dependencies)
    try {
      const { registerSampleFunctions } = await import('./utils/sample-functions');
      console.log('Registering sample AI agent functions...');
      await registerSampleFunctions();
      console.log('Sample AI agent functions registered successfully');
    } catch (error) {
      console.error('Error registering sample functions:', error);
    }
    
    console.log("AI agent database migration completed successfully");
  } catch (error) {
    console.error("Error during AI agent database migration:", error);
    throw error;
  }
}

/**
 * Create all the AI agent related tables
 */
async function createAgentTables() {
  // Agent Functions - DEPRECATED - Using langchain_tools exclusively
  console.log('Skipping agent_functions table creation (deprecated)');
  // We use langchain_tools exclusively - see server/migrate-function-system.ts
  // and server/langchain-migration.ts for the new function system
  
  // Agent Conversations
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "agent_conversations" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER NOT NULL,
      "title" VARCHAR(100) NOT NULL,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Agent Messages
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "agent_messages" (
      "id" SERIAL PRIMARY KEY,
      "conversation_id" INTEGER NOT NULL,
      "role" VARCHAR(20) NOT NULL,
      "content" TEXT NOT NULL,
      "timestamp" TIMESTAMP NOT NULL DEFAULT NOW(),
      "function_call" JSONB,
      "function_result" JSONB
    );
  `);
  
  // Agent Tasks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "agent_tasks" (
      "id" SERIAL PRIMARY KEY,
      "title" VARCHAR(100) NOT NULL,
      "description" TEXT NOT NULL,
      "status" VARCHAR(20) NOT NULL,
      "type" VARCHAR(50) NOT NULL,
      "priority" VARCHAR(20) NOT NULL DEFAULT 'medium',
      "created_by" INTEGER NOT NULL,
      "assigned_to" INTEGER,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "scheduled_for" TIMESTAMP,
      "completed_at" TIMESTAMP,
      "parameters" JSONB,
      "result" JSONB
    );
  `);
  
  // Agent Settings
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "agent_settings" (
      "id" SERIAL PRIMARY KEY,
      "name" VARCHAR(100) NOT NULL UNIQUE,
      "value" TEXT NOT NULL,
      "description" TEXT,
      "type" VARCHAR(20) NOT NULL DEFAULT 'string',
      "category" VARCHAR(50) NOT NULL DEFAULT 'general',
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_by" INTEGER
    );
  `);
  
  // MCP Tasks (Machine Control Protocol Tasks)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "mcp_tasks" (
      "id" SERIAL PRIMARY KEY,
      "equipment_id" INTEGER NOT NULL,
      "action" VARCHAR(50) NOT NULL,
      "parameters" JSONB,
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "executed_at" TIMESTAMP,
      "created_by" INTEGER NOT NULL,
      "result" JSONB
    );
  `);
  
  // Signal Notifications
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "signal_notifications" (
      "id" SERIAL PRIMARY KEY,
      "recipient" VARCHAR(100) NOT NULL,
      "message" TEXT NOT NULL,
      "type" VARCHAR(20) NOT NULL DEFAULT 'alert',
      "sent_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
      "delivered_at" TIMESTAMP,
      "error" TEXT
    );
  `);
}

/**
 * Create default agent settings
 */
async function createDefaultAgentSettings() {
  // Create a temporary table to hold the default settings
  await db.execute(sql`
    CREATE TEMP TABLE temp_agent_settings (
      name VARCHAR(100) NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL,
      category VARCHAR(50) NOT NULL
    );
  `);
  
  // Insert default settings into the temporary table
  await db.execute(sql`
    INSERT INTO temp_agent_settings (name, value, description, type, category) VALUES
    ('agent_enabled', 'true', 'Whether the AI agent is enabled for the application', 'boolean', 'general'),
    ('openai_model', 'gpt-4', 'The OpenAI model used for AI agent operations', 'string', 'models'),
    ('agent_temperature', '0.7', 'Temperature setting for the AI agent''s language model', 'number', 'models'),
    ('agent_max_tokens', '2000', 'Maximum tokens for agent responses', 'number', 'models'),
    ('agent_history_limit', '20', 'Maximum number of messages to include in conversation history', 'number', 'limits'),
    ('agent_system_prompt', 'You are an advanced AI Energy Advisor for Emporium Power Monitoring. Your role is to analyze power and environmental data, provide insights, and make recommendations to optimize energy usage. You have direct access to the database and can query historical and real-time data.', 'System prompt for the AI agent', 'string', 'prompts');
  `);
  
  // Insert settings from temporary table to agent_settings if they don't already exist
  await db.execute(sql`
    INSERT INTO agent_settings (name, value, description, type, category)
    SELECT t.name, t.value, t.description, t.type, t.category
    FROM temp_agent_settings t
    LEFT JOIN agent_settings a ON t.name = a.name
    WHERE a.name IS NULL;
  `);
  
  // Drop the temporary table
  await db.execute(sql`DROP TABLE temp_agent_settings;`);
}

/**
 * Create default agent functions - DEPRECATED
 * Now using langchain_tools exclusively - see server/migrate-function-system.ts
 */
async function createDefaultAgentFunctions() {
  console.log('Skipping creation of default agent_functions (deprecated)');
  console.log('Function creation now handled by migrate-function-system.ts and langchain_tools table');
  
  // Note: All functions have been migrated to langchain_tools
  // Please refer to server/migrate-function-system.ts for the new function system
  // The LangChain tools-based migration provides more flexibility and integration
  // with AI models and unifies the function execution mechanisms.
  
  // No longer creating agent_functions as they have been completely replaced
  return;
}

// Run the migration
migrate().then(() => {
  console.log("Migration completed successfully");
  process.exit(0);
}).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});