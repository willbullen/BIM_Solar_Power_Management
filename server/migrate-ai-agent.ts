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
 * Create default agent functions
 */
async function createDefaultAgentFunctions() {
  // Create a temporary table to hold the default functions
  await db.execute(sql`
    CREATE TEMP TABLE temp_agent_functions (
      name VARCHAR(100) NOT NULL,
      description TEXT NOT NULL,
      module VARCHAR(50) NOT NULL,
      parameters JSONB NOT NULL,
      return_type VARCHAR(100) NOT NULL,
      function_code TEXT NOT NULL,
      access_level VARCHAR(20) NOT NULL,
      tags TEXT[] NOT NULL
    );
  `);
  
  // Insert default functions into the temporary table
  await db.execute(sql`
    INSERT INTO temp_agent_functions (name, description, module, parameters, return_type, function_code, access_level, tags) VALUES
    (
      'queryPowerData',
      'Query power data from the database within a specific time range',
      'data',
      '{"type":"object","properties":{"startDate":{"type":"string","description":"Start date in ISO format (e.g. 2025-05-01T00:00:00Z)"},"endDate":{"type":"string","description":"End date in ISO format (e.g. 2025-05-08T00:00:00Z)"},"limit":{"type":"number","description":"Maximum number of records to return"}},"required":["startDate","endDate"]}',
      'PowerData[]',
      'async function queryPowerData(params) { const { startDate, endDate, limit = 100 } = params; return db.query.powerData.findMany({ where: (fields, { gte, lte }) => ({ and: [ gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }), limit }); }',
      'restricted',
      ARRAY['data', 'power', 'query']
    ),
    (
      'queryEnvironmentalData',
      'Query environmental data from the database within a specific time range',
      'data',
      '{"type":"object","properties":{"startDate":{"type":"string","description":"Start date in ISO format (e.g. 2025-05-01T00:00:00Z)"},"endDate":{"type":"string","description":"End date in ISO format (e.g. 2025-05-08T00:00:00Z)"},"limit":{"type":"number","description":"Maximum number of records to return"}},"required":["startDate","endDate"]}',
      'EnvironmentalData[]',
      'async function queryEnvironmentalData(params) { const { startDate, endDate, limit = 100 } = params; return db.query.environmentalData.findMany({ where: (fields, { gte, lte }) => ({ and: [ gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }), limit }); }',
      'restricted',
      ARRAY['data', 'environmental', 'query']
    ),
    (
      'getEquipmentList',
      'Get a list of all equipment in the system',
      'equipment',
      '{"type":"object","properties":{"active":{"type":"boolean","description":"Filter by active status"}}}',
      'Equipment[]',
      'async function getEquipmentList(params) { const { active } = params; if (active !== undefined) { return db.query.equipment.findMany({ where: (fields, { eq }) => eq(fields.active, active) }); } return db.query.equipment.findMany(); }',
      'public',
      ARRAY['equipment', 'query']
    ),
    (
      'getEquipmentEfficiency',
      'Get efficiency data for a specific piece of equipment',
      'equipment',
      '{"type":"object","properties":{"equipmentId":{"type":"number","description":"ID of the equipment to get efficiency data for"},"startDate":{"type":"string","description":"Start date in ISO format (optional)"},"endDate":{"type":"string","description":"End date in ISO format (optional)"}},"required":["equipmentId"]}',
      'EquipmentEfficiency[]',
      'async function getEquipmentEfficiency(params) { const { equipmentId, startDate, endDate } = params; let query = { where: (fields, { eq }) => eq(fields.equipmentId, equipmentId) }; if (startDate && endDate) { query.where = (fields, { eq, gte, lte }) => ({ and: [ eq(fields.equipmentId, equipmentId), gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }); } return db.query.equipmentEfficiency.findMany(query); }',
      'restricted',
      ARRAY['equipment', 'efficiency', 'query']
    ),
    (
      'createEnergyInsight',
      'Create a new energy insight record in the database',
      'insights',
      '{"type":"object","properties":{"title":{"type":"string","description":"Title of the insight"},"description":{"type":"string","description":"Detailed description of the insight"},"type":{"type":"string","description":"Type of insight (efficiency, anomaly, recommendation, prediction)"},"priority":{"type":"string","description":"Priority level (low, medium, high, critical)"},"metadata":{"type":"object","description":"Additional metadata for the insight"}},"required":["title","description","type"]}',
      'Issue',
      'async function createEnergyInsight(params) { const { title, description, type, priority = "medium", metadata = {} } = params; return db.insert(schema.issues).values({ title, description, status: "open", type: type || "feature", priority: priority, assigneeId: null, submitterId: 1, createdAt: new Date(), updatedAt: new Date(), metadata: metadata }).returning(); }',
      'admin',
      ARRAY['insights', 'create']
    );
  `);
  
  // Insert functions from temporary table to agent_functions if they don't already exist
  await db.execute(sql`
    INSERT INTO agent_functions (name, description, module, parameters, return_type, function_code, access_level, tags)
    SELECT t.name, t.description, t.module, t.parameters, t.return_type, t.function_code, t.access_level, t.tags
    FROM temp_agent_functions t
    LEFT JOIN agent_functions a ON t.name = a.name
    WHERE a.name IS NULL;
  `);
  
  // Drop the temporary table
  await db.execute(sql`DROP TABLE temp_agent_functions;`);
}

// Run the migration
migrate().then(() => {
  console.log("Migration completed successfully");
  process.exit(0);
}).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});