/**
 * Test script for transaction handling in DatabaseService
 * 
 * This script tests the transaction functionality implemented in 
 * the DatabaseService.Core.executeTransaction method.
 */

const { DatabaseService } = require('./server/utils/database-service');
const { SqlExecutor } = require('./server/sql-executor');

async function testSqlTransaction() {
  console.log('Testing SQL transaction handling...');
  
  try {
    // Create a test table if it doesn't exist
    await DatabaseService.Core.executeRaw(`
      CREATE TABLE IF NOT EXISTS transaction_test (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL
      )
    `);
    
    console.log('Test table created or verified');
    
    // Test transaction with multiple operations
    console.log('Testing transaction with multiple inserts...');
    await DatabaseService.Core.executeTransaction(`
      INSERT INTO transaction_test (name, value) VALUES ('test1', 100);
      INSERT INTO transaction_test (name, value) VALUES ('test2', 200);
    `);
    
    // Verify data was inserted
    const result = await DatabaseService.Core.executeRaw(
      'SELECT * FROM transaction_test ORDER BY id DESC LIMIT 5'
    );
    
    console.log('Transaction test results:', result);
    
    // Test transaction with SqlExecutor
    console.log('Testing transaction with SqlExecutor...');
    const executor = new SqlExecutor({
      userRole: 'Admin', // Should work with case-insensitive role check
      allowModification: true
    });
    
    await executor.executeInTransaction(`
      INSERT INTO transaction_test (name, value) VALUES ('executor-test', 300);
    `);
    
    // Verify executor insert worked
    const executorResult = await executor.executeReadOnly(
      'SELECT * FROM transaction_test WHERE name = $1',
      ['executor-test']
    );
    
    console.log('SqlExecutor transaction test results:', executorResult);
    
    console.log('Transaction tests completed successfully!');
  } catch (error) {
    console.error('Transaction test error:', error);
  }
}

// Run the tests
testSqlTransaction().catch(err => console.error('Test error:', err));