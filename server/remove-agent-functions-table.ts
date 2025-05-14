/**
 * Remove Agent Functions Table Migration Script
 * 
 * This script completely removes the agent_functions table after all functions
 * have been successfully migrated to langchain_tools.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Drops the agent_functions table from the database
 * This will force removal regardless of content since migration has been done
 * @param {boolean} force - Whether to force removal even if functions exist in the table
 */
export async function removeAgentFunctionsTable(force: boolean = false): Promise<void> {
  try {
    console.log('Starting removal of deprecated agent_functions table...');
    
    // First, check if the table exists
    const tableExistsResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'agent_functions'
      );
    `);
    
    const tableExists = tableExistsResult.rows[0]?.exists === 't' || tableExistsResult.rows[0]?.exists === true;
    
    if (!tableExists) {
      console.log('agent_functions table does not exist, nothing to remove.');
      return;
    }
    
    // Check if all functions have been migrated
    const functionsResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM agent_functions;
    `);
    
    const functionCount = parseInt(functionsResult.rows[0]?.count as string || '0');
    
    if (functionCount > 0 && !force) {
      console.log(`WARNING: Found ${functionCount} functions still in agent_functions table.`);
      console.log('Please run the migration first to ensure all functions are migrated to langchain_tools.');
      console.log('Alternatively, use force=true to remove the table anyway.');
      return;
    }
    
    // Drop the agent_functions table
    console.log(`Removing agent_functions table${functionCount > 0 ? ' (forced)' : ''}...`);
    await db.execute(sql`DROP TABLE IF EXISTS agent_functions;`);
    
    console.log('agent_functions table successfully removed.');
  } catch (error) {
    console.error('Error removing agent_functions table:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
export async function migrate(): Promise<void> {
  try {
    console.log('Starting agent_functions removal migration...');
    await removeAgentFunctionsTable();
    console.log('agent_functions removal migration completed successfully.');
  } catch (error) {
    console.error('Error during agent_functions removal migration:', error);
    throw error;
  }
}

// Direct execution not needed as this will be called from index.ts