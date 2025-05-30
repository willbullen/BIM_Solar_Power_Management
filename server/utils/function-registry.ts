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
  const adminOnlyTables = ['users', 'user_sessions', 'langchain_agents'];
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
        'langchain_agent_conversations', 
        'langchain_agent_messages',
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
    functionData: Omit<schema.InsertLangchainTool, "id">
  ): Promise<schema.LangchainTool> {
    try {
      // Check if function already exists
      const existingFunction = await db.query.langchainTools.findFirst({
        where: (fields, { eq }) => eq(fields.name, functionData.name)
      });
      
      if (existingFunction) {
        // Update existing function
        const [updatedFunction] = await db.update(schema.langchainTools)
          .set({
            ...functionData
          })
          .where(eq(schema.langchainTools.name, functionData.name))
          .returning();
        
        return updatedFunction;
      } else {
        // Create new function
        const [newFunction] = await db.insert(schema.langchainTools)
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
  static async getFunction(name: string): Promise<schema.LangchainTool | null> {
    const func = await db.query.langchainTools.findFirst({
      where: (fields, { eq }) => eq(fields.name, name)
    });
    return func || null;
  }
  
  /**
   * Get all registered functions
   * @param accessLevel Optional access level filter
   * @returns Array of all registered functions
   */
  static async getAllFunctions(accessLevel?: string): Promise<schema.LangchainTool[]> {
    // In the new schema, accessLevel is stored in metadata.accessLevel instead of a direct field
    if (accessLevel) {
      const allTools = await db.query.langchainTools.findMany({
        orderBy: (fields, { asc }) => [asc(fields.name)]
      });
      // Filter tools by accessLevel in metadata
      return allTools.filter(tool => {
        const metadata = tool.metadata as any;
        return metadata && metadata.accessLevel === accessLevel;
      });
    } else {
      return await db.query.langchainTools.findMany({
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
    name: string | undefined,
    parameters: any,
    context: {
      userId: number;
      userRole: string;
    }
  ): Promise<any> {
    try {
      // Fix for "Missing parameter 'name'" error in Telegram bot
      // Ensure name is never undefined and log the issue
      if (!name) {
        console.warn(`[Function Registry] Function name is undefined, using default name`);
        name = 'unnamed_function';
      }
      
      console.log(`[Function Registry] Executing function: ${name} with parameters:`, 
        typeof parameters === 'object' ? JSON.stringify(parameters) : parameters);
      
      // Handle special case for listAllTables coming from Telegram or other text interfaces
      if (name === 'listAllTables' && (
          typeof parameters === 'string' || 
          parameters === null || 
          parameters === undefined ||
          (typeof parameters === 'object' && Object.keys(parameters).length === 0)
      )) {
        console.log('[Function Registry] Converting string/empty parameter to object for listAllTables');
        parameters = { includeSystemTables: false };
      }
      
      // Get the function definition
      // Handle the case where name might be undefined (typescript check)
      const functionName = name || 'unnamed_function';
      const functionDef = await db.query.langchainTools.findFirst({
        where: (fields, { eq }) => eq(fields.name, functionName)
      });
      
      if (!functionDef) {
        console.error(`[Function Registry] Function ${functionName} not found`);
        
        // Special case for unnamed functions to avoid complete failure
        if (functionName === 'unnamed_function') {
          return {
            error: 'Function name was missing or undefined',
            success: false,
            message: 'Could not execute function because name was missing'
          };
        }
        
        throw new Error(`Function ${functionName} not found`);
      }
      
      console.log(`[Function Registry] Found function definition for ${name}`);
      
      // Check if user has permission to execute this function
      if (!FunctionRegistry.hasExecutePermission(functionDef, context.userRole)) {
        console.error(`[Function Registry] Insufficient permissions for user ${context.userId} with role ${context.userRole} to execute function ${name}`);
        throw new Error(`Insufficient permissions to execute function ${name}`);
      }
      
      // Validate parameters against function schema
      const validParams = FunctionRegistry.validateParameters(parameters, functionDef.parameters);
      console.log(`[Function Registry] Parameters validated successfully for ${name}`);
      
      // Create a secure execution sandbox that supports async functions
      const secureExecute = async (funcCode: string, params: any, dbUtils: any) => {
        console.log(`[Function Registry] Creating execution sandbox for ${name}`);
        // Wrap the function code in an async function to support await
        const asyncWrapper = `
          try {
            return (async function() { 
              ${funcCode}
            })();
          } catch (error) {
            console.error('[Function Execution Error]', error);
            return { error: error.message, success: false };
          }
        `;
        const func = new Function('params', 'dbUtils', 'context', asyncWrapper);
        console.log(`[Function Registry] Executing ${name} in sandbox`);
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
      console.log(`[Function Registry] Executing ${name} in the sandbox`);
      try {
        if (!functionDef.implementation) {
          throw new Error(`Function ${name} has no implementation defined`);
        }
        // Cast to string to satisfy TypeScript's type checking
        const implementation = String(functionDef.implementation);
        const result = await secureExecute(implementation, validParams, dbHelper);
        console.log(`[Function Registry] ${name} executed successfully, result:`, typeof result === 'object' ? JSON.stringify(result) : result);
        return result;
      } catch (sandboxError: any) {
        console.error(`[Function Registry] Error in sandbox execution of ${name}:`, sandboxError);
        // Return a formatted error result instead of throwing
        return {
          error: sandboxError?.message || String(sandboxError),
          success: false,
          message: `Error executing function ${name}: ${sandboxError?.message || String(sandboxError)}`
        };
      }
    } catch (error: any) {
      console.error(`[Function Registry] Error executing function ${name}:`, error);
      // Return a formatted error instead of throwing to prevent complete failure
      return {
        error: error?.message || String(error),
        success: false,
        message: `Error executing function ${name}: ${error?.message || String(error)}`
      };
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
  private static hasExecutePermission(func: schema.LangchainTool, userRole: string): boolean {
    // Normalize roles for case-insensitive comparison
    const normalizedUserRole = userRole.toLowerCase();
    
    // Get access level from metadata
    const metadata = func.metadata as any || {};
    const accessLevel = metadata.accessLevel || 'public';
    const normalizedAccessLevel = accessLevel.toLowerCase();
    
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
        console.warn(`Unknown function access level: ${accessLevel} for function ${func.name}`);
        return false;
    }
  }
}