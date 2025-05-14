import { db } from "../db";
import * as schema from "@shared/schema";
import { DatabaseService } from "./database-service";
import { eq } from "drizzle-orm";

// Utility functions for table name validation and permissions
function validateTableName(tableName: string): string {
  // Basic validation to prevent SQL injection via table names
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  if (safeTableName !== tableName) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  return safeTableName;
}

function hasTablePermission(tableName: string, userRole?: string, operation: 'read' | 'write' | 'delete' = 'read'): boolean {
  // Normalize role to lowercase for case-insensitive comparison
  const role = (userRole || 'user').toLowerCase();
  
  // Admin has access to everything
  if (role === 'admin') {
    return true;
  }
  
  // Restricted tables that require admin access
  const adminOnlyTables = ['users', 'user_sessions', 'agent_settings'];
  if (adminOnlyTables.includes(tableName)) {
    return false;
  }
  
  // User role can read most tables but can't write/delete to sensitive ones
  if (role === 'user') {
    if (operation === 'read') {
      // Users can read most tables except very sensitive ones
      return !['api_keys', 'user_secrets'].includes(tableName);
    } else {
      // Users can only write to certain tables
      const userWritableTables = [
        'agent_conversations', 
        'agent_messages',
        'feedback',
        'issues',
        'todo_items'
      ];
      return userWritableTables.includes(tableName);
    }
  }
  
  // Default deny for unknown roles
  return false;
}

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
      // Check if function already exists
      const existingFunction = await db.query.agentFunctions.findFirst({
        where: (fields, { eq }) => eq(fields.name, functionData.name)
      });
      
      if (existingFunction) {
        // Update existing function
        const [updatedFunction] = await db.update(schema.agentFunctions)
          .set({
            ...functionData
          })
          .where(eq(schema.agentFunctions.name, functionData.name))
          .returning();
        
        return updatedFunction;
      } else {
        // Create new function
        const [newFunction] = await db.insert(schema.agentFunctions)
          .values({
            ...functionData
          })
          .returning();
        
        return newFunction;
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
    const func = await db.query.agentFunctions.findFirst({
      where: (fields, { eq }) => eq(fields.name, name)
    });
    return func || null;
  }
  
  /**
   * Get all registered functions
   * @param accessLevel Optional access level filter
   * @returns Array of all registered functions
   */
  static async getAllFunctions(accessLevel?: string): Promise<schema.AgentFunction[]> {
    if (accessLevel) {
      return await db.query.agentFunctions.findMany({
        where: (fields, { eq }) => eq(fields.accessLevel, accessLevel),
        orderBy: (fields, { asc }) => [asc(fields.name)]
      });
    } else {
      return await db.query.agentFunctions.findMany({
        orderBy: (fields, { asc }) => [asc(fields.name)]
      });
    }
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
    }
  ): Promise<any> {
    try {
      // Get the function definition
      const functionDef = await db.query.agentFunctions.findFirst({
        where: (fields, { eq }) => eq(fields.name, name)
      });
      
      if (!functionDef) {
        throw new Error(`Function ${name} not found`);
      }
      
      // Check if user has permission to execute this function
      if (!FunctionRegistry.hasExecutePermission(functionDef, context.userRole)) {
        throw new Error(`Insufficient permissions to execute function ${name}`);
      }
      
      // Validate parameters against function schema
      const validParams = FunctionRegistry.validateParameters(parameters, functionDef.parameters);
      
      // Create a secure execution sandbox that supports async functions
      const secureExecute = async (funcCode: string, params: any, dbUtils: any) => {
        // Wrap the function code in an async function to support await
        const asyncWrapper = `
          return (async function() { 
            ${funcCode}
          })();
        `;
        const func = new Function('params', 'dbUtils', 'context', asyncWrapper);
        return await func(params, dbUtils, context);
      };
      
      // Create a database helper with user role restrictions
      const dbHelper = {
        async select<T>(tableName: string, whereConditions = {}, options = {}): Promise<T[]> {
          // Validate table name to prevent SQL injection
          const validTableName = validateTableName(tableName);
          
          // Check if user has permission to read from this table
          if (!hasTablePermission(validTableName, context?.userRole, "read")) {
            throw new Error(`Access denied: Cannot read from table ${validTableName}`);
          }
          
          return await DatabaseService.Core.select<T>(validTableName, whereConditions, options);
        },
        
        async insert<T>(tableName: string, data: Record<string, any>): Promise<T> {
          // Validate table name to prevent SQL injection
          const validTableName = validateTableName(tableName);
          
          // Check if user has permission to write to this table
          if (!hasTablePermission(validTableName, context?.userRole, "write")) {
            throw new Error(`Access denied: Cannot write to table ${validTableName}`);
          }
          
          return await DatabaseService.Core.insert<T>(validTableName, data);
        },
        
        async update<T>(tableName: string, data: Record<string, any>, whereConditions: Record<string, any>): Promise<T[]> {
          // Validate table name to prevent SQL injection
          const validTableName = validateTableName(tableName);
          
          // Check if user has permission to write to this table
          if (!hasTablePermission(validTableName, context?.userRole, "write")) {
            throw new Error(`Access denied: Cannot update table ${validTableName}`);
          }
          
          return await DatabaseService.Core.update<T>(validTableName, data, whereConditions);
        },
        
        async delete<T>(tableName: string, whereConditions: Record<string, any>): Promise<T[]> {
          // Validate table name to prevent SQL injection
          const validTableName = validateTableName(tableName);
          
          // Check if user has permission to delete from this table
          if (!hasTablePermission(validTableName, context?.userRole, "delete")) {
            throw new Error(`Access denied: Cannot delete from table ${validTableName}`);
          }
          
          return await DatabaseService.Core.delete<T>(validTableName, whereConditions);
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
      
      return validatedParams;
    } catch (error) {
      console.error("Parameter validation error:", error);
      throw error;
    }
  }
  
  /**
   * Check if a user has permission to execute a function
   * @param func Function definition
   * @param userRole User's role
   * @returns True if the user has permission, false otherwise
   */
  private static hasExecutePermission(func: schema.AgentFunction, userRole: string): boolean {
    // Normalize roles for case-insensitive comparison
    const normalizedUserRole = userRole.toLowerCase();
    const normalizedAccessLevel = func.accessLevel.toLowerCase();
    
    // Admin can execute any function
    if (normalizedUserRole === "admin") {
      return true;
    }
    
    // Check function access level
    switch (normalizedAccessLevel) {
      case "public":
        // Public functions can be executed by any role
        return true;
      case "admin":
        // Admin-only functions
        return normalizedUserRole === "admin";
      case "manager":
        // Manager functions can be executed by managers and admins
        return normalizedUserRole === "manager" || normalizedUserRole === "admin";
      case "user":
        // User functions can be executed by users, managers and admins
        return normalizedUserRole === "user" || normalizedUserRole === "manager" || normalizedUserRole === "admin";
      case "restricted":
        // Restricted functions can only be executed by admins and managers
        return normalizedUserRole === "admin" || normalizedUserRole === "manager";
      default:
        // Log unexpected access level for debugging
        console.warn(`Unknown function access level: ${func.accessLevel} for function ${func.name}`);
        return false;
    }
  }
}