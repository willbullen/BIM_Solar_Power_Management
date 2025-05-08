import { db } from "../db";
import * as schema from "@shared/schema";
import { DbUtils } from "./db-utils";

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
            ...functionData,
            updatedAt: new Date()
          })
          .where(({ name }) => name.eq(functionData.name))
          .returning();
        
        return updatedFunction;
      } else {
        // Create new function
        const [newFunction] = await db.insert(schema.agentFunctions)
          .values({
            ...functionData,
            createdAt: new Date(),
            updatedAt: new Date()
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
    return await db.query.agentFunctions.findFirst({
      where: (fields, { eq }) => eq(fields.name, name)
    });
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
        where: (fields, { eq, and }) => and(
          eq(fields.name, name),
          eq(fields.enabled, true)
        )
      });
      
      if (!functionDef) {
        throw new Error(`Function ${name} not found or not enabled`);
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
      
      // Create a database helper with user role restrictions
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
      default:
        return false;
    }
  }
}