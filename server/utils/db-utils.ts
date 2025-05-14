import { db } from "../db";
import { sql, SQL } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * Database utility functions for secure parameterized queries
 */
export class DbUtils {
  /**
   * Executes a parameterized SELECT query
   * @param tableName The database table to query
   * @param columns The columns to select (defaults to *)
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @param options Additional query options (limit, offset, orderBy)
   * @returns Results of the query
   */
  static async select<T>(
    tableName: string,
    whereConditions: Record<string, any> = {},
    options: {
      columns?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: "asc" | "desc" }[];
    } = {}
  ): Promise<T[]> {
    // Construct column selection
    const columnSelection = options.columns?.length 
      ? options.columns.join(", ") 
      : "*";
    
    // Start building the query
    let query = `SELECT ${columnSelection} FROM "${tableName}"`;
    const params: any[] = [];
    
    // Add WHERE conditions if any
    const conditions = Object.entries(whereConditions).filter(([_, value]) => value !== undefined);
    
    if (conditions.length > 0) {
      query += " WHERE ";
      const whereClause = conditions.map(([key, _], index) => {
        params.push(conditions[index][1]);
        return `"${key}" = $${params.length}`;
      }).join(" AND ");
      query += whereClause;
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
  static async insert<T>(
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
    return result[0];
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
    
    // Build WHERE clause
    const whereClause = Object.entries(whereConditions).map(([key, value]) => {
      params.push(value);
      return `"${key}" = $${params.length}`;
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
    
    // Build WHERE clause
    const whereClause = Object.entries(whereConditions).map(([key, value]) => {
      params.push(value);
      return `"${key}" = $${params.length}`;
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
   * Execute a raw SQL query with parameters
   * @param query The SQL query with $1, $2, etc. placeholders
   * @param params The parameters to inject into the query
   * @returns Query results
   */
  static async executeRaw<T>(query: string, params: any[] = []): Promise<T[]> {
    return await db.execute<T>(sql.raw(query, ...params));
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
    // Normalize user role for case-insensitive comparison
    const normalizedRole = userRole.toLowerCase();
    
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
        "write": ["power_data", "environmental_data", "equipment", "langchain_*"], 
        "delete": ["langchain_agent_messages", "langchain_agent_tasks"]
      },
      "user": {
        "read": ["power_data", "environmental_data", "equipment", "langchain_agent_conversations", "langchain_agent_messages", "langchain_agent_tasks"],
        "write": ["langchain_agent_conversations", "langchain_agent_messages", "langchain_agent_tasks"],
        "delete": ["langchain_agent_messages"]
      }
    };
    
    // Get permissions for the specified role (default to empty arrays if not found)
    const permissions = rolePermissions[normalizedRole] || {
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
}