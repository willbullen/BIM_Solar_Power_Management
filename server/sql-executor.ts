import { db } from "./db";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

interface SQLExecutionResult {
  rows: any[];
  command: string;
  rowCount: number;
  duration: number;
  success: boolean;
  error?: string;
  columns?: { name: string; type: string }[];
}

/**
 * Execute a SQL query with security checks
 * 
 * @param sqlQuery The SQL query to execute
 * @param userRole The role of the user executing the query (for permission checks)
 * @returns The result of the query execution
 */
export async function executeSQL(sqlQuery: string, userRole: string = 'admin'): Promise<SQLExecutionResult> {
  const startTime = Date.now();
  let result: SQLExecutionResult = {
    rows: [],
    command: '',
    rowCount: 0,
    duration: 0,
    success: false
  };
  
  try {
    // Security checks
    validateSqlQuery(sqlQuery, userRole);
    
    // Execute the query
    const queryResult = await db.execute(sql.raw(sqlQuery));
    
    // Determine query type
    const commandMatch = sqlQuery.trim().match(/^(\w+)/i);
    const command = commandMatch ? commandMatch[1].toUpperCase() : 'UNKNOWN';
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Format results
    result = {
      rows: Array.isArray(queryResult) ? queryResult : [],
      command,
      rowCount: Array.isArray(queryResult) ? queryResult.length : 0,
      duration,
      success: true
    };
    
    // Extract column information if results exist
    if (result.rows.length > 0) {
      result.columns = Object.keys(result.rows[0]).map(key => {
        return {
          name: key,
          type: getColumnType(result.rows[0][key])
        };
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      rows: [],
      command: sqlQuery.trim().split(' ')[0].toUpperCase(),
      rowCount: 0,
      duration,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Validate a SQL query for security concerns
 * @param sqlQuery The SQL query to validate
 * @param userRole The role of the user executing the query
 * @throws Error if the query is not allowed
 */
function validateSqlQuery(sqlQuery: string, userRole: string): void {
  // Normalize query for easier pattern matching
  const normalizedQuery = sqlQuery.trim().toLowerCase();
  
  // Check for potentially destructive operations
  const hasDestructiveOperations = 
    normalizedQuery.includes('drop table') ||
    normalizedQuery.includes('drop database') ||
    normalizedQuery.includes('truncate table') ||
    normalizedQuery.includes('delete from') ||
    normalizedQuery.includes('alter table') && normalizedQuery.includes('drop column');
  
  // Check for operations that modify data
  const hasDataModification =
    normalizedQuery.startsWith('insert into') ||
    normalizedQuery.startsWith('update ') ||
    normalizedQuery.startsWith('delete ') ||
    normalizedQuery.startsWith('alter ');
  
  // Only admins can execute destructive operations
  if (hasDestructiveOperations && userRole !== 'admin') {
    throw new Error('Destructive operations are only allowed for admins');
  }
  
  // Only admins and managers can modify data
  if (hasDataModification && !['admin', 'manager'].includes(userRole)) {
    throw new Error('Data modification is only allowed for admins and managers');
  }
  
  // Check for statements that could have security implications
  if (normalizedQuery.includes('execute ') || normalizedQuery.includes('exec ')) {
    throw new Error('Execute statements are not allowed');
  }
  
  // Prevent CREATE TABLE statements (migrations should be handled differently)
  if (normalizedQuery.includes('create table')) {
    throw new Error('CREATE TABLE operations are not allowed through this interface');
  }
}

/**
 * Get the data type of a value
 * @param value The value to check
 * @returns The data type as a string
 */
function getColumnType(value: any): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'decimal';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'text';
  if (value instanceof Date) return 'timestamp';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'json';
  return 'unknown';
}

/**
 * Handle SQL query execution from the AI agent
 * This is the function that will be registered with the AI agent
 */
export async function handleAgentSqlQuery(
  sqlQuery: string, 
  userRole: string, 
  options: { 
    explain?: boolean;
    maxRows?: number;
  } = {}
): Promise<any> {
  try {
    // Check if we need to run EXPLAIN
    let queryToRun = sqlQuery;
    if (options.explain) {
      queryToRun = `EXPLAIN ANALYZE ${sqlQuery}`;
    }
    
    // Execute the query
    const result = await executeSQL(queryToRun, userRole);
    
    // Limit the number of rows if specified
    if (options.maxRows && result.rows.length > options.maxRows) {
      result.rows = result.rows.slice(0, options.maxRows);
      result.rowCount = options.maxRows;
      result.truncated = true;
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}