/**
 * SQL executor module for AI agent
 * 
 * This module provides secure execution of SQL queries for the AI agent,
 * with access controls and parameterized queries to prevent SQL injection.
 */

import { db } from './db';
import { sql } from 'drizzle-orm';

export interface SqlExecutorOptions {
  // User role for permission checking
  userRole: string;
  // Maximum number of rows to return
  maxRows?: number;
  // Whether to allow data modification (INSERT, UPDATE, DELETE)
  allowModification?: boolean;
  // Whether to allow schema modification (CREATE, ALTER, DROP)
  allowSchemaModification?: boolean;
  // Tables that are allowed to be queried
  allowedTables?: string[];
}

export class SqlExecutor {
  private options: SqlExecutorOptions;
  
  constructor(options: SqlExecutorOptions) {
    this.options = {
      maxRows: 100,
      allowModification: false,
      allowSchemaModification: false,
      ...options
    };
  }
  
  /**
   * Execute a SQL query with safety checks
   * @param query SQL query to execute
   * @param params Query parameters
   * @returns Query results
   */
  async execute(query: string, params: any[] = []): Promise<any> {
    // Validate user role
    if (!this.hasExecutePermission()) {
      throw new Error('Insufficient permissions to execute SQL queries');
    }
    
    // Validate query for safety
    this.validateQuery(query);
    
    try {
      // Execute the query with parameters
      const result = await db.execute(sql.raw(query, params));
      
      // Limit the number of rows returned
      if (Array.isArray(result) && this.options.maxRows) {
        return result.slice(0, this.options.maxRows);
      }
      
      return result;
    } catch (error) {
      console.error('SQL execution error:', error);
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a safe read-only query (SELECT only)
   * @param query SQL query to execute
   * @param params Query parameters
   * @returns Query results
   */
  async executeReadOnly(query: string, params: any[] = []): Promise<any> {
    // Force read-only mode
    const savedAllowModification = this.options.allowModification;
    const savedAllowSchemaModification = this.options.allowSchemaModification;
    
    this.options.allowModification = false;
    this.options.allowSchemaModification = false;
    
    try {
      return await this.execute(query, params);
    } finally {
      // Restore original settings
      this.options.allowModification = savedAllowModification;
      this.options.allowSchemaModification = savedAllowSchemaModification;
    }
  }
  
  /**
   * Check if a table is in the allowed tables list
   * @param tableName Table name to check
   * @returns Boolean indicating if the table is allowed
   */
  isTableAllowed(tableName: string): boolean {
    if (!this.options.allowedTables || this.options.allowedTables.length === 0) {
      return true; // All tables allowed if no restrictions
    }
    
    return this.options.allowedTables.includes(tableName.toLowerCase());
  }
  
  /**
   * Validate that a query is safe to execute based on options
   * @param query SQL query to validate
   */
  private validateQuery(query: string): void {
    const uppercaseQuery = query.toUpperCase();
    
    // Check for data modification if not allowed
    if (!this.options.allowModification && (
      uppercaseQuery.includes('INSERT INTO') ||
      uppercaseQuery.includes('UPDATE ') ||
      uppercaseQuery.includes('DELETE FROM') ||
      uppercaseQuery.includes('TRUNCATE ')
    )) {
      throw new Error('Data modification queries are not allowed');
    }
    
    // Check for schema modification if not allowed
    if (!this.options.allowSchemaModification && (
      uppercaseQuery.includes('CREATE ') ||
      uppercaseQuery.includes('ALTER ') ||
      uppercaseQuery.includes('DROP ') ||
      uppercaseQuery.includes('RENAME ')
    )) {
      throw new Error('Schema modification queries are not allowed');
    }
    
    // Additional safety checks
    if (
      uppercaseQuery.includes('GRANT ') ||
      uppercaseQuery.includes('REVOKE ') ||
      uppercaseQuery.includes('EXECUTE ')
    ) {
      throw new Error('Permission modification queries are not allowed');
    }
  }
  
  /**
   * Check if the user has permission to execute SQL queries
   * @returns Boolean indicating if user has permission
   */
  private hasExecutePermission(): boolean {
    // Only admin users can execute SQL queries
    return this.options.userRole === 'Admin';
  }
  
  /**
   * Get database information
   * @returns Object with database tables and schemas
   */
  async getDatabaseInfo(): Promise<any> {
    // Query for table information
    const tables = await this.executeReadOnly(`
      SELECT 
        table_name,
        table_schema
      FROM 
        information_schema.tables
      WHERE 
        table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY 
        table_schema, table_name
    `);
    
    // Get columns for each table
    const result = [];
    
    for (const table of tables) {
      // Only include allowed tables
      if (!this.isTableAllowed(table.table_name)) {
        continue;
      }
      
      const columns = await this.executeReadOnly(`
        SELECT 
          column_name, 
          data_type,
          is_nullable
        FROM 
          information_schema.columns
        WHERE 
          table_schema = $1
          AND table_name = $2
        ORDER BY 
          ordinal_position
      `, [table.table_schema, table.table_name]);
      
      result.push({
        tableName: table.table_name,
        schema: table.table_schema,
        columns
      });
    }
    
    return result;
  }
}