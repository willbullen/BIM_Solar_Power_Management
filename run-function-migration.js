/**
 * Run the function system unification migration
 * 
 * This script will migrate agent_functions to langchain_tools
 * and set up the unified function system.
 * 
 * Usage: node --loader ts-node/esm run-function-migration.js
 */

// Using dynamic import for ES modules compatibility
async function main() {
  try {
    console.log('Starting function system unification migration...');
    
    // Dynamic import to handle ES module
    const { runMigration } = await import('./server/migrate-function-system.js');
    
    const result = await runMigration();
    
    if (result) {
      console.log('Function system unification migration completed successfully');
      process.exit(0);
    } else {
      console.error('Function system unification migration failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error running function system unification migration:', error);
    process.exit(1);
  }
}

// Run the migration
main();