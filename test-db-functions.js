/**
 * Test script for AI Agent database functions registration
 * 
 * This script is used to test the registration and execution of 
 * database query, analysis, and SQL functions for the AI agent.
 * 
 * Usage: node test-db-functions.js
 */

// Import the registration function
const { registerDatabaseFunctions } = require('./server/utils/db-agent-functions');
const { registerSqlFunctions } = require('./server/utils/sql-agent-functions');
const { UnifiedFunctionRegistry } = require('./server/utils/unified-function-registry');

async function testDatabaseFunctions() {
  try {
    console.log('Starting registration of AI agent database functions...');
    
    // Register database query and analysis functions
    await registerDatabaseFunctions();
    
    // Register SQL execution functions
    await registerSqlFunctions();
    
    console.log('Database functions registered successfully with the AI agent');
    
    // List all registered functions
    console.log('\nRetrieving list of registered functions:');
    const allFunctions = await listAllFunctions();
    console.log(`Found ${allFunctions.length} registered functions`);
    
    // Print function names and descriptions
    allFunctions.forEach(func => {
      console.log(`- ${func.name}: ${func.description}`);
    });
    
    console.log('\nFunction registration test completed successfully');
  } catch (error) {
    console.error('Error testing database functions:', error);
  }
}

async function listAllFunctions() {
  try {
    // Get all functions from the database
    const allFunctions = await UnifiedFunctionRegistry.getAllFunctions();
    return allFunctions;
  } catch (error) {
    console.error('Error listing functions:', error);
    return [];
  }
}

// Run the test
testDatabaseFunctions()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });