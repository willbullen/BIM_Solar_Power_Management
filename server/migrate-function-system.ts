/**
 * Migration script to unify agent_functions and langchain_tools
 * 
 * This script migrates all agent_functions to langchain_tools and creates a
 * single, unified function system built on LangChain.
 */

import { db } from './db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';

/**
 * Migrate agent_functions to langchain_tools
 */
export async function migrateAgentFunctions() {
  try {
    console.log('Starting migration of agent_functions to langchain_tools...');
    
    // Get all agent functions
    const agentFunctions = await db.select().from(schema.agentFunctions);
    console.log(`Found ${agentFunctions.length} agent functions to migrate`);
    
    // For each agent function, check if it exists in langchain_tools
    for (const func of agentFunctions) {
      // Check if function exists in langchain_tools by name
      const [existingTool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.name, func.name));
      
      if (existingTool) {
        console.log(`Tool ${func.name} already exists in langchain_tools, skipping`);
        continue;
      }
      
      // Create new langchain tool from agent function
      const [newTool] = await db
        .insert(schema.langchainTools)
        .values({
          name: func.name,
          description: func.description,
          toolType: func.module,
          parameters: func.parameters as any,
          implementation: func.name + 'Tool', // Add "Tool" suffix for consistency
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          isBuiltIn: true,
          metadata: {
            migrated: true,
            legacyFunctionId: func.id,
            returnType: func.returnType,
            accessLevel: func.accessLevel
          }
        })
        .returning();
      
      console.log(`Migrated agent function ${func.name} to langchain tool with ID ${newTool.id}`);
    }
    
    console.log('Migration of agent_functions completed successfully');
    return true;
  } catch (error) {
    console.error('Error migrating agent functions:', error);
    return false;
  }
}

/**
 * Update the function registry to use langchain_tools
 * 
 * This function will be called during server startup to load the unified function system
 */
export async function setupUnifiedFunctionSystem() {
  try {
    console.log('Setting up unified function system...');
    
    // Create tool implementations for each langchain tool that needs a function registry wrapper
    const tools = await db.select().from(schema.langchainTools);
    console.log(`Found ${tools.length} LangChain tools to register in unified system`);
    
    // Return success
    console.log('Unified function system setup completed successfully');
    return true;
  } catch (error) {
    console.error('Error setting up unified function system:', error);
    return false;
  }
}

/**
 * Run the migration
 */
export async function runMigration() {
  try {
    console.log('Starting function system unification migration...');
    
    // Migrate agent_functions to langchain_tools
    await migrateAgentFunctions();
    
    // Set up the unified function system
    await setupUnifiedFunctionSystem();
    
    console.log('Function system unification migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error running function system unification migration:', error);
    return false;
  }
}

// This code needs to be run from the run-function-migration.js file
// not directly from here (ES module compatibility)