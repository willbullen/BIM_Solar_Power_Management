import { LangChainIntegration } from './langchain-integration';
import { AIService } from './ai-service';
import { db } from './db';
import * as schema from '@shared/schema';

/**
 * Create LangChain database tables if they don't exist
 */
async function createLangChainTables() {
  console.log('Creating LangChain tables...');
  
  try {
    // Check if langchain_agents table exists
    const { rows: agentTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_agents'
      );
    `);
    
    if (!agentTableExists[0].exists) {
      console.log('Creating langchain_agents table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_agents" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "model_name" TEXT NOT NULL,
          "temperature" REAL,
          "max_tokens" INTEGER,
          "streaming" BOOLEAN,
          "system_prompt" TEXT,
          "max_iterations" INTEGER,
          "verbose" BOOLEAN,
          "enabled" BOOLEAN DEFAULT true,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW(),
          "created_by" INTEGER REFERENCES "users"("id"),
          "metadata" JSONB DEFAULT '{}'::jsonb
        );
      `);
    } else {
      console.log('langchain_agents table already exists');
    }
    
    // Check if langchain_tools table exists
    const { rows: toolsTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_tools'
      );
    `);
    
    if (!toolsTableExists[0].exists) {
      console.log('Creating langchain_tools table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_tools" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "tool_type" TEXT NOT NULL,
          "implementation" TEXT,
          "enabled" BOOLEAN DEFAULT true,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW(),
          "created_by" INTEGER REFERENCES "users"("id"),
          "parameters" JSONB DEFAULT '{}'::jsonb,
          "is_built_in" BOOLEAN DEFAULT false,
          "metadata" JSONB DEFAULT '{}'::jsonb
        );
      `);
    } else {
      console.log('langchain_tools table already exists');
    }
    
    // Check if langchain_agent_tools table exists
    const { rows: agentToolsTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_agent_tools'
      );
    `);
    
    if (!agentToolsTableExists[0].exists) {
      console.log('Creating langchain_agent_tools table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_agent_tools" (
          "id" SERIAL PRIMARY KEY,
          "agent_id" INTEGER NOT NULL REFERENCES "langchain_agents"("id"),
          "tool_id" INTEGER NOT NULL REFERENCES "langchain_tools"("id"),
          "priority" INTEGER DEFAULT 0,
          "created_at" TIMESTAMP DEFAULT NOW()
        );
      `);
    } else {
      console.log('langchain_agent_tools table already exists');
    }
    
    // Check if langchain_prompt_templates table exists
    const { rows: promptTemplatesTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_prompt_templates'
      );
    `);
    
    if (!promptTemplatesTableExists[0].exists) {
      console.log('Creating langchain_prompt_templates table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_prompt_templates" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "content" TEXT NOT NULL,
          "template_type" TEXT NOT NULL,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "updated_at" TIMESTAMP DEFAULT NOW(),
          "created_by" INTEGER REFERENCES "users"("id"),
          "metadata" JSONB DEFAULT '{}'::jsonb
        );
      `);
    } else {
      console.log('langchain_prompt_templates table already exists');
    }
    
    // Check if langchain_runs table exists
    const { rows: runsTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_runs'
      );
    `);
    
    if (!runsTableExists[0].exists) {
      console.log('Creating langchain_runs table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_runs" (
          "id" SERIAL PRIMARY KEY,
          "run_id" TEXT NOT NULL UNIQUE,
          "parent_run_id" TEXT,
          "agent_id" INTEGER REFERENCES "langchain_agents"("id"),
          "user_id" INTEGER REFERENCES "users"("id"),
          "conversation_id" INTEGER REFERENCES "agent_conversations"("id"),
          "run_type" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "input" TEXT,
          "output" TEXT,
          "error" TEXT,
          "start_time" TIMESTAMP,
          "end_time" TIMESTAMP,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "metadata" JSONB DEFAULT '{}'::jsonb
        );
      `);
    } else {
      console.log('langchain_runs table already exists');
    }
    
    // Check if langchain_tool_executions table exists
    const { rows: toolExecutionsTableExists } = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'langchain_tool_executions'
      );
    `);
    
    if (!toolExecutionsTableExists[0].exists) {
      console.log('Creating langchain_tool_executions table...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS "langchain_tool_executions" (
          "id" SERIAL PRIMARY KEY,
          "run_id" TEXT NOT NULL REFERENCES "langchain_runs"("run_id"),
          "tool_id" INTEGER REFERENCES "langchain_tools"("id"),
          "input" TEXT,
          "output" TEXT,
          "error" TEXT,
          "start_time" TIMESTAMP,
          "end_time" TIMESTAMP,
          "created_at" TIMESTAMP DEFAULT NOW(),
          "metadata" JSONB DEFAULT '{}'::jsonb
        );
      `);
    } else {
      console.log('langchain_tool_executions table already exists');
    }
    
    console.log('LangChain tables created successfully');
  } catch (error) {
    console.error('Error creating LangChain tables:', error);
    throw error;
  }
}

/**
 * Initialize LangChain agents, tools, and database tables
 */
export async function migrate() {
  console.log('Starting LangChain integration database migration...');
  
  try {
    // First create the database tables
    await createLangChainTables();
    
    // Create a new AI service and LangChain integration
    const aiService = new AIService();
    const langChainIntegration = new LangChainIntegration(aiService);
    
    // Initialize LangChain tools and agent
    await langChainIntegration.initialize();
    
    console.log('LangChain integration database migration completed successfully');
  } catch (error) {
    console.error('Error during LangChain integration database migration:', error);
    throw error;
  }
}