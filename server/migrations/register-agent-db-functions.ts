/**
 * Register all database-related functions for the AI agent
 * 
 * This script registers database querying, analysis, and SQL execution
 * functions with the AI agent function registry.
 * 
 * Run with: npx tsx server/register-agent-db-functions.ts
 */

import { DatabaseService } from './utils/database-service';
import { db } from './db';

async function main() {
  try {
    console.log('Starting registration of AI agent database functions...');
    
    // Register all database functions using unified service
    await DatabaseService.AgentFunctions.registerDatabaseFunctions();
    
    console.log('Database functions registered successfully with the AI agent');
  } catch (error) {
    console.error('Error registering database functions:', error);
  }
}

// Run the registration
main()
  .then(() => {
    console.log('Registration process completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Registration process failed:', err);
    process.exit(1);
  });