import { db } from "../db";
import * as schema from "@shared/schema";
import { DbUtils } from "./db-utils";
import { eq } from "drizzle-orm";

/**
 * Function registry for agent capabilities
 * This utility helps register, validate, and execute functions for the AI agent
 */
export class FunctionRegistry {
  /**
   * Register a new function or update an existing one
   * @param functionData Function definition to register
   * @returns The registered function
   */
  static async registerFunction(
    functionData: Omit<schema.InsertAgentFunction, "id">
  ): Promise<schema.AgentFunction> {
    try {
      // Use our enhanced DbUtils for safer query execution
      const existingFunction = await DbUtils.select<schema.AgentFunction>(
        "agent_functions",
        { name: functionData.name },
        { limit: 1 }
      );
      
      if (existingFunction.length > 0) {
        // Update existing function
        return await DbUtils.update<schema.AgentFunction>(
          "agent_functions",
          functionData,
          { name: functionData.name }
        );
      } else {
        // Create new function
        return await DbUtils.insert<schema.AgentFunction>(
          "agent_functions",
          functionData
        );
      }
    } catch (error) {
      console.error("Error registering function:", error);
      throw new Error(`Failed to register function: ${error}`);
    }
  }
  
  /**
   * Get a function by name
   * @param name Function name to retrieve
   * @returns The function or null if not found
   */
  static async getFunction(name: string): Promise<schema.AgentFunction | null> {
    const functions = await DbUtils.select<schema.AgentFunction>(
      "agent_functions",
      { name },
      { limit: 1 }
    );
    return functions.length > 0 ? functions[0] : null;
  }
  
  /**
   * Get functions by module
   * @param module The module name to filter by
   * @returns Array of functions in that module
   */
  static async getFunctionsByModule(module: string): Promise<schema.AgentFunction[]> {
    return await DbUtils.select<schema.AgentFunction>(
      "agent_functions",
      { module }
    );
  }
  
  /**
   * Get functions by tag
   * @param tag The tag to filter by
   * @returns Array of functions with that tag
   */
  static async getFunctionsByTag(tag: string): Promise<schema.AgentFunction[]> {
    // Can't filter arrays with simple where conditions, use raw SQL
    const query = `
      SELECT * FROM "agent_functions"
      WHERE $1 = ANY(tags)
    `;
    
    return await DbUtils.executeRaw<schema.AgentFunction>(query, [tag]);
  }
  
  /**
   * Execute a function with the given parameters
   * @param name Function name to execute
   * @param parameters Parameters to pass to the function
   * @param context Execution context including user information
   * @returns Function execution result
   */
  static async executeFunction(
    name: string,
    parameters: any,
    context: {
      userId: number;
      userRole: string;
      conversationId?: number;
    }
  ): Promise<any> {
    try {
      // Get the function definition using our enhanced DbUtils
      const functionsList = await DbUtils.select<schema.AgentFunction>(
        "agent_functions",
        { name },
        { limit: 1 }
      );
      
      const functionDef = functionsList.length > 0 ? functionsList[0] : null;
      
      if (!functionDef) {
        throw new Error(`Function ${name} not found`);
      }
      
      // Check if user has permission to execute this function
      if (!FunctionRegistry.hasExecutePermission(functionDef, context.userRole)) {
        throw new Error(`Insufficient permissions to execute function ${name}`);
      }
      
      // Validate parameters against function schema
      const validParams = FunctionRegistry.validateParameters(parameters, functionDef.parameters);
      
      // Create a secure execution sandbox
      const secureExecute = (funcCode: string, params: any, dbUtils: any) => {
        const func = new Function('params', 'dbUtils', 'context', funcCode);
        return func(params, dbUtils, context);
      };
      
      // Create an enhanced database helper with user role restrictions
      const dbHelper = {
        async select<T>(tableName: string, whereConditions = {}, options = {}): Promise<T[]> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to read from this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "read")) {
            throw new Error(`Access denied: Cannot read from table ${validTableName}`);
          }
          
          return await DbUtils.select<T>(validTableName, whereConditions, options);
        },
        
        async insert<T>(tableName: string, data: Record<string, any>): Promise<T> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to write to this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "write")) {
            throw new Error(`Access denied: Cannot write to table ${validTableName}`);
          }
          
          return await DbUtils.insert<T>(validTableName, data);
        },
        
        async bulkInsert<T>(tableName: string, records: Record<string, any>[]): Promise<T[]> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to write to this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "write")) {
            throw new Error(`Access denied: Cannot write to table ${validTableName}`);
          }
          
          return await DbUtils.bulkInsert<T>(validTableName, records);
        },
        
        async update<T>(tableName: string, data: Record<string, any>, whereConditions: Record<string, any>): Promise<T> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to write to this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "write")) {
            throw new Error(`Access denied: Cannot update table ${validTableName}`);
          }
          
          return await DbUtils.update<T>(validTableName, data, whereConditions);
        },
        
        async delete(tableName: string, whereConditions: Record<string, any>): Promise<number> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to delete from this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "delete")) {
            throw new Error(`Access denied: Cannot delete from table ${validTableName}`);
          }
          
          return await DbUtils.delete(validTableName, whereConditions);
        },
        
        async count(tableName: string, whereConditions = {}): Promise<number> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to read from this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "read")) {
            throw new Error(`Access denied: Cannot read from table ${validTableName}`);
          }
          
          return await DbUtils.count(validTableName, whereConditions);
        },
        
        async aggregate<T>(
          tableName: string,
          aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
          column: string,
          whereConditions = {},
          groupBy?: string[]
        ): Promise<T> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to read from this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "read")) {
            throw new Error(`Access denied: Cannot read from table ${validTableName}`);
          }
          
          return await DbUtils.aggregate<T>(validTableName, aggregation, column, whereConditions, groupBy);
        },
        
        // Allow transaction handling but only with functions that check permissions
        async transaction<T>(callback: () => Promise<T>): Promise<T> {
          return await DbUtils.transaction(callback);
        },
        
        // Allow executing retries with permission-checked operations
        async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 300): Promise<T> {
          return await DbUtils.withRetry(operation, retries, delay);
        },
        
        // Include metadata about the table structure
        async getTableMetadata(tableName: string): Promise<Record<string, { type: string, nullable: boolean }>> {
          // Validate table name to prevent SQL injection
          const validTableName = DbUtils.validateTableName(tableName);
          
          // Check if user has permission to read from this table
          if (!DbUtils.hasTablePermission(validTableName, context.userRole, "read")) {
            throw new Error(`Access denied: Cannot read metadata for table ${validTableName}`);
          }
          
          return await DbUtils.getTableMetadata(validTableName);
        }
      };
      
      // Execute the function in the sandbox
      return await secureExecute(functionDef.functionCode, validParams, dbHelper);
    } catch (error) {
      console.error(`Error executing function ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Search for functions matching a query
   * @param query Text to search in function names and descriptions
   * @param userRole User role for filtering by access level
   * @returns Matching functions
   */
  static async searchFunctions(query: string, userRole: string): Promise<schema.AgentFunction[]> {
    // Determine accessible access levels based on user role
    const accessLevels = FunctionRegistry.getAccessibleLevels(userRole);
    
    // Construct the query
    const sqlQuery = `
      SELECT * FROM "agent_functions"
      WHERE (name ILIKE $1 OR description ILIKE $1)
      AND access_level = ANY($2)
    `;
    
    // Add % wildcards for ILIKE search
    const searchPattern = `%${query}%`;
    
    return await DbUtils.executeRaw<schema.AgentFunction>(sqlQuery, [searchPattern, accessLevels]);
  }
  
  /**
   * Validate function parameters against parameter schema
   * @param params Parameters to validate
   * @param paramSchema Schema definition for parameters
   * @returns Validated parameters
   */
  private static validateParameters(params: any, paramSchema: any): any {
    try {
      // For simplicity, just doing basic validation
      // In a production environment, use a schema validation library like Zod
      
      // Clone params to avoid modifying the original
      const validatedParams = { ...params };
      
      // Check required parameters
      if (paramSchema.required) {
        for (const requiredParam of paramSchema.required) {
          if (validatedParams[requiredParam] === undefined) {
            throw new Error(`Missing required parameter: ${requiredParam}`);
          }
        }
      }
      
      // Add default values for missing optional parameters
      if (paramSchema.properties) {
        for (const [propName, propDef] of Object.entries<any>(paramSchema.properties)) {
          if (validatedParams[propName] === undefined && propDef.default !== undefined) {
            validatedParams[propName] = propDef.default;
          }
        }
      }
      
      // Validate types (basic type checking)
      if (paramSchema.properties) {
        for (const [propName, propDef] of Object.entries<any>(paramSchema.properties)) {
          if (validatedParams[propName] !== undefined) {
            const value = validatedParams[propName];
            const type = propDef.type;
            
            // Check type compatibility
            if (type === 'string' && typeof value !== 'string') {
              throw new Error(`Parameter '${propName}' must be a string`);
            } else if (type === 'number' && typeof value !== 'number') {
              throw new Error(`Parameter '${propName}' must be a number`);
            } else if (type === 'boolean' && typeof value !== 'boolean') {
              throw new Error(`Parameter '${propName}' must be a boolean`);
            } else if (type === 'array' && !Array.isArray(value)) {
              throw new Error(`Parameter '${propName}' must be an array`);
            } else if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
              throw new Error(`Parameter '${propName}' must be an object`);
            }
          }
        }
      }
      
      return validatedParams;
    } catch (error) {
      console.error("Parameter validation error:", error);
      throw error;
    }
  }
  
  /**
   * Get accessible access levels based on user role
   * @param userRole User role
   * @returns Array of accessible access levels
   */
  private static getAccessibleLevels(userRole: string): string[] {
    // Everyone can access public functions
    const accessLevels = ['public'];
    
    // Add role-specific levels
    if (userRole === 'admin') {
      accessLevels.push('user', 'manager', 'admin', 'restricted');
    } else if (userRole === 'manager') {
      accessLevels.push('user', 'manager');
    } else if (userRole === 'user') {
      accessLevels.push('user');
    }
    
    return accessLevels;
  }
  
  /**
   * Check if a user has permission to execute a function
   * @param func Function definition
   * @param userRole User's role
   * @returns True if the user has permission, false otherwise
   */
  private static hasExecutePermission(func: schema.AgentFunction, userRole: string): boolean {
    // Admin can execute any function
    if (userRole === "admin") {
      return true;
    }
    
    // Check function access level
    switch (func.accessLevel) {
      case "public":
        // Public functions can be executed by any role
        return true;
      case "admin":
        // Admin-only functions
        return userRole === "admin";
      case "manager":
        // Manager functions can be executed by managers and admins
        return userRole === "manager" || userRole === "admin";
      case "user":
        // User functions can be executed by users, managers and admins
        return userRole === "user" || userRole === "manager" || userRole === "admin";
      case "restricted":
        // Restricted functions are admin-only by default
        return userRole === "admin";
      default:
        return false;
    }
  }
}