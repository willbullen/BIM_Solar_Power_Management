import { db } from "../db";
import { sql, SQL, InferSelectModel } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * Database utility functions for secure parameterized queries with RBAC
 */
export class DbUtils {
  /**
   * Executes a parameterized SELECT query
   * @param tableName The database table to query
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @param options Additional query options (limit, offset, orderBy, etc.)
   * @returns Results of the query
   */
  static async select<T extends Record<string, any>>(
    tableName: string,
    whereConditions: Record<string, any> = {},
    options: {
      columns?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: "asc" | "desc" }[];
      distinct?: boolean;
      groupBy?: string[];
      having?: Record<string, any>;
      joins?: Array<{
        type: "inner" | "left" | "right" | "full";
        table: string;
        on: Record<string, any>;
      }>;
    } = {}
  ): Promise<T[]> {
    // Construct column selection with table prefix if joins are used
    const hasJoins = options.joins && options.joins.length > 0;
    let columnSelection = "*";
    
    if (options.columns?.length) {
      if (hasJoins) {
        // With joins, add table prefixes to columns
        columnSelection = options.columns
          .map(col => {
            if (col.includes(".")) return col; // Already has a table prefix
            return `"${tableName}"."${col}"`;
          })
          .join(", ");
      } else {
        columnSelection = options.columns.join(", ");
      }
    } else if (hasJoins) {
      // Select all columns from primary table with table prefix
      columnSelection = `"${tableName}".*`;
    }
    
    // Start building the query with DISTINCT if requested
    let query = `SELECT ${options.distinct ? 'DISTINCT ' : ''}${columnSelection} FROM "${tableName}"`;
    const params: any[] = [];
    
    // Add JOINs if specified
    if (options.joins?.length) {
      for (const join of options.joins) {
        const joinType = join.type.toUpperCase();
        query += ` ${joinType} JOIN "${join.table}" ON `;
        
        const joinConditions = Object.entries(join.on).map(([leftKey, rightVal]) => {
          // Handle if the right side is a column reference from another table
          if (typeof rightVal === 'string' && rightVal.includes('.')) {
            return `"${tableName}"."${leftKey}" = ${rightVal}`;
          } else {
            params.push(rightVal);
            return `"${tableName}"."${leftKey}" = $${params.length}`;
          }
        }).join(" AND ");
        
        query += joinConditions;
      }
    }
    
    // Add WHERE conditions if any
    const conditions = Object.entries(whereConditions).filter(([_, value]) => value !== undefined);
    
    if (conditions.length > 0) {
      query += " WHERE ";
      const whereClause = conditions.map(([key, value], index) => {
        // Handle complex operators (>, <, LIKE, etc.)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const [operator, operand] = Object.entries(value)[0];
          params.push(operand);
          
          switch (operator.toLowerCase()) {
            case 'gt': return `"${key}" > $${params.length}`;
            case 'gte': return `"${key}" >= $${params.length}`;
            case 'lt': return `"${key}" < $${params.length}`;
            case 'lte': return `"${key}" <= $${params.length}`;
            case 'ne': return `"${key}" != $${params.length}`;
            case 'like': return `"${key}" LIKE $${params.length}`;
            case 'ilike': return `"${key}" ILIKE $${params.length}`;
            case 'in':
              // Special handling for IN operator with array values
              if (Array.isArray(operand)) {
                const placeholders = operand.map((_, i) => `$${params.length - operand.length + i + 1}`).join(', ');
                return `"${key}" IN (${placeholders})`;
              }
              return `"${key}" IN ($${params.length})`;
            default:
              return `"${key}" = $${params.length}`;
          }
        } else if (Array.isArray(value)) {
          // Handle array values (IN operator)
          const placeholders = value.map((val, i) => {
            params.push(val);
            return `$${params.length}`;
          }).join(', ');
          return `"${key}" IN (${placeholders})`;
        } else if (value === null) {
          // Handle NULL values
          return `"${key}" IS NULL`;
        } else {
          // Simple equals condition
          params.push(conditions[index][1]);
          return `"${key}" = $${params.length}`;
        }
      }).join(" AND ");
      query += whereClause;
    }
    
    // Add GROUP BY if specified
    if (options.groupBy?.length) {
      query += " GROUP BY " + options.groupBy.map(col => `"${col}"`).join(", ");
    }
    
    // Add HAVING if specified and groupBy is used
    if (options.having && options.groupBy?.length) {
      query += " HAVING ";
      const havingClauses = Object.entries(options.having).map(([key, value]) => {
        params.push(value);
        return `"${key}" = $${params.length}`;
      }).join(" AND ");
      query += havingClauses;
    }
    
    // Add ORDER BY if specified
    if (options.orderBy?.length) {
      query += " ORDER BY " + options.orderBy.map(order => 
        `"${order.column}" ${order.direction.toUpperCase()}`
      ).join(", ");
    }
    
    // Add LIMIT if specified
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    
    // Add OFFSET if specified
    if (options.offset !== undefined) {
      query += ` OFFSET ${options.offset}`;
    }
    
    // Execute the query using Drizzle's sql template
    return await db.execute<T>(sql.raw(query, ...params));
  }
  
  /**
   * Executes a parameterized INSERT query
   * @param tableName The database table to insert into
   * @param data Record containing data to insert
   * @returns The inserted record
   */
  static async insert<T extends Record<string, any>>(
    tableName: string,
    data: Record<string, any>
  ): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Generate placeholders for the values ($1, $2, etc.)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    
    // Build the query
    const query = `
      INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    // Execute the query and return the first result
    const result = await db.execute<T>(sql.raw(query, ...values));
    if (!result || result.length === 0) {
      throw new Error(`Failed to insert record into ${tableName}`);
    }
    return result[0] as T;
  }
  
  /**
   * Executes a bulk INSERT query for multiple records
   * @param tableName The database table to insert into
   * @param records Array of records to insert
   * @returns The inserted records
   */
  static async bulkInsert<T extends Record<string, any>>(
    tableName: string,
    records: Record<string, any>[]
  ): Promise<T[]> {
    if (!records.length) return [];
    
    // Get columns from the first record (assuming all records have the same structure)
    const columns = Object.keys(records[0]);
    const params: any[] = [];
    
    // Build VALUES clauses for all records
    const valuesClauses = records.map(record => {
      const values = columns.map(col => {
        params.push(record[col]);
        return `$${params.length}`;
      });
      return `(${values.join(", ")})`;
    }).join(", ");
    
    // Build the query
    const query = `
      INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(", ")})
      VALUES ${valuesClauses}
      RETURNING *
    `;
    
    // Execute the query and convert the result to the expected array type
    const result = await db.execute<T>(sql.raw(query, ...params));
    return Array.isArray(result) ? result : (result ? [result] as unknown as T[] : []);
  }
  
  /**
   * Executes a parameterized UPDATE query
   * @param tableName The database table to update
   * @param data Record containing data to update
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @returns The updated record
   */
  static async update<T>(
    tableName: string,
    data: Record<string, any>,
    whereConditions: Record<string, any>
  ): Promise<T> {
    const params: any[] = [];
    
    // Build SET clause
    const setClause = Object.entries(data).map(([key, value], index) => {
      params.push(value);
      return `"${key}" = $${params.length}`;
    }).join(", ");
    
    // Build WHERE clause with enhanced operator support
    const whereClause = Object.entries(whereConditions).map(([key, value]) => {
      // Handle complex operators (>, <, LIKE, etc.)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const [operator, operand] = Object.entries(value)[0];
        params.push(operand);
        
        switch (operator.toLowerCase()) {
          case 'gt': return `"${key}" > $${params.length}`;
          case 'gte': return `"${key}" >= $${params.length}`;
          case 'lt': return `"${key}" < $${params.length}`;
          case 'lte': return `"${key}" <= $${params.length}`;
          case 'ne': return `"${key}" != $${params.length}`;
          case 'like': return `"${key}" LIKE $${params.length}`;
          case 'ilike': return `"${key}" ILIKE $${params.length}`;
          default:
            return `"${key}" = $${params.length}`;
        }
      } else if (value === null) {
        // Handle NULL values
        return `"${key}" IS NULL`;
      } else {
        // Simple equals condition
        params.push(value);
        return `"${key}" = $${params.length}`;
      }
    }).join(" AND ");
    
    // Build the query
    const query = `
      UPDATE "${tableName}"
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING *
    `;
    
    // Execute the query and return the first result
    const result = await db.execute<T>(sql.raw(query, ...params));
    return result[0];
  }
  
  /**
   * Executes a parameterized DELETE query
   * @param tableName The database table to delete from
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @returns The number of rows deleted
   */
  static async delete(
    tableName: string,
    whereConditions: Record<string, any>
  ): Promise<number> {
    const params: any[] = [];
    
    // Build WHERE clause with enhanced operator support
    const whereClause = Object.entries(whereConditions).map(([key, value]) => {
      // Handle complex operators (>, <, LIKE, etc.)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const [operator, operand] = Object.entries(value)[0];
        params.push(operand);
        
        switch (operator.toLowerCase()) {
          case 'gt': return `"${key}" > $${params.length}`;
          case 'gte': return `"${key}" >= $${params.length}`;
          case 'lt': return `"${key}" < $${params.length}`;
          case 'lte': return `"${key}" <= $${params.length}`;
          case 'ne': return `"${key}" != $${params.length}`;
          case 'like': return `"${key}" LIKE $${params.length}`;
          case 'ilike': return `"${key}" ILIKE $${params.length}`;
          default:
            return `"${key}" = $${params.length}`;
        }
      } else if (value === null) {
        // Handle NULL values
        return `"${key}" IS NULL`;
      } else {
        // Simple equals condition
        params.push(value);
        return `"${key}" = $${params.length}`;
      }
    }).join(" AND ");
    
    // Build the query
    const query = `
      DELETE FROM "${tableName}"
      WHERE ${whereClause}
      RETURNING *
    `;
    
    // Execute the query and return the count of affected rows
    const result = await db.execute(sql.raw(query, ...params));
    return result.length;
  }
  
  /**
   * Executes a query to count records with optional conditions
   * @param tableName The database table to count from
   * @param whereConditions Optional filter conditions
   * @returns The count of matching records
   */
  static async count(
    tableName: string,
    whereConditions: Record<string, any> = {}
  ): Promise<number> {
    const params: any[] = [];
    
    // Build the query
    let query = `SELECT COUNT(*) as count FROM "${tableName}"`;
    
    // Add WHERE conditions if any
    const conditions = Object.entries(whereConditions).filter(([_, value]) => value !== undefined);
    
    if (conditions.length > 0) {
      query += " WHERE ";
      const whereClause = conditions.map(([key, value]) => {
        params.push(value);
        return `"${key}" = $${params.length}`;
      }).join(" AND ");
      query += whereClause;
    }
    
    // Execute the query
    const result = await db.execute<{ count: string }>(sql.raw(query, ...params));
    return parseInt(result[0]?.count || '0', 10);
  }
  
  /**
   * Execute aggregation functions (SUM, AVG, MIN, MAX) on a column
   * @param tableName The database table to aggregate
   * @param aggregation Aggregation function to apply
   * @param column Column to aggregate
   * @param whereConditions Optional filter conditions
   * @param groupBy Optional GROUP BY columns
   * @returns Aggregation results
   */
  static async aggregate<T>(
    tableName: string, 
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    column: string,
    whereConditions: Record<string, any> = {},
    groupBy?: string[]
  ): Promise<T> {
    const params: any[] = [];
    
    // Build the query with the aggregation function
    const aggFunction = aggregation.toUpperCase();
    let query = `SELECT ${aggFunction}("${column}") as result`;
    
    // Add GROUP BY columns to the SELECT if provided
    if (groupBy?.length) {
      query = `SELECT ${groupBy.map(col => `"${col}"`).join(', ')}, ${aggFunction}("${column}") as result`;
    }
    
    query += ` FROM "${tableName}"`;
    
    // Add WHERE conditions if any
    const conditions = Object.entries(whereConditions).filter(([_, value]) => value !== undefined);
    
    if (conditions.length > 0) {
      query += " WHERE ";
      const whereClause = conditions.map(([key, value]) => {
        params.push(value);
        return `"${key}" = $${params.length}`;
      }).join(" AND ");
      query += whereClause;
    }
    
    // Add GROUP BY if specified
    if (groupBy?.length) {
      query += " GROUP BY " + groupBy.map(col => `"${col}"`).join(", ");
    }
    
    // Execute the query
    return await db.execute<T>(sql.raw(query, ...params));
  }
  
  /**
   * Execute a raw SQL query with parameters
   * @param query The SQL query with $1, $2, etc. placeholders
   * @param params The parameters to inject into the query
   * @returns Query results
   */
  static async executeRaw<T>(query: string, params: any[] = []): Promise<T[]> {
    return await db.execute<T>(sql.raw(query, ...params));
  }
  
  /**
   * Execute a transaction with multiple queries
   * @param callback Function containing database operations to execute in a transaction
   * @returns Result of the transaction
   */
  static async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return await db.transaction(async () => {
      return await callback();
    });
  }
  
  /**
   * Execute a database operation with retry logic
   * @param operation Function to execute
   * @param retries Number of retries (default: 3)
   * @param delay Delay between retries in ms (default: 300)
   * @returns Operation result
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 300
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Only retry if we haven't reached the max retries
        if (attempt < retries) {
          // Wait for the specified delay before retrying
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Increase delay for each retry (exponential backoff)
          delay *= 2;
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Validates and sanitizes a table name to prevent SQL injection
   * @param tableName The table name to validate
   * @returns The validated table name
   * @throws Error if the table name is invalid
   */
  static validateTableName(tableName: string): string {
    // Only allow alphanumeric characters, underscores, and agent_ prefix
    const validTablePattern = /^[a-zA-Z0-9_]+$/;
    if (!validTablePattern.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    
    // Check if the table exists in our schema
    const schemaTableNames = Object.keys(schema)
      .filter(key => !key.includes("Relations") && !key.includes("Insert") && !key.startsWith("create"))
      .map(key => {
        // Convert camelCase to snake_case for table names
        return key.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1);
      });
    
    if (!schemaTableNames.includes(tableName)) {
      throw new Error(`Table not found in schema: ${tableName}`);
    }
    
    return tableName;
  }
  
  /**
   * Validates if a user has permission to access a table based on role
   * @param tableName The table to check access for
   * @param userRole The user's role
   * @param operation The operation (read, write, delete)
   * @returns True if the user has permission, false otherwise
   */
  static hasTablePermission(
    tableName: string,
    userRole: string,
    operation: "read" | "write" | "delete"
  ): boolean {
    // Define role-based access control rules
    const rolePermissions: Record<string, Record<string, string[]>> = {
      "admin": {
        // Admins can do everything
        "read": ["*"],
        "write": ["*"],
        "delete": ["*"]
      },
      "manager": {
        "read": ["*"],
        "write": ["power_data", "environmental_data", "equipment", "agent_*", "issues", "issue_comments"], 
        "delete": ["agent_messages", "agent_tasks", "issue_comments"]
      },
      "user": {
        "read": ["power_data", "environmental_data", "equipment", "agent_conversations", "agent_messages", "agent_tasks", "issues", "issue_comments"],
        "write": ["agent_conversations", "agent_messages", "agent_tasks", "issues", "issue_comments"],
        "delete": ["agent_messages", "issue_comments"]
      }
    };
    
    // Get permissions for the specified role (default to empty arrays if not found)
    const permissions = rolePermissions[userRole] || {
      "read": [],
      "write": [],
      "delete": []
    };
    
    // Check for wildcard permission
    if (permissions[operation].includes("*")) {
      return true;
    }
    
    // Check for direct table permission
    if (permissions[operation].includes(tableName)) {
      return true;
    }
    
    // Check for pattern-based permissions (e.g., agent_*)
    for (const pattern of permissions[operation]) {
      if (pattern.endsWith("*") && tableName.startsWith(pattern.slice(0, -1))) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get metadata about a table's columns
   * @param tableName The table to get metadata for
   * @returns Column metadata
   */
  static async getTableMetadata(tableName: string): Promise<Record<string, { type: string, nullable: boolean }>> {
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
    `;
    
    const columns = await db.execute<{ column_name: string, data_type: string, is_nullable: string }>(
      sql.raw(query, tableName)
    );
    
    // Convert to a more usable format
    const metadata: Record<string, { type: string, nullable: boolean }> = {};
    for (const column of columns) {
      metadata[column.column_name] = {
        type: column.data_type,
        nullable: column.is_nullable === 'YES'
      };
    }
    
    return metadata;
  }
}