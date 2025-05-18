/**
 * Unified Function Registry
 * 
 * This is a unified approach to function registration, utilizing LangChain tools
 * as the single source of truth for all agent functions.
 */

import { db } from '../db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { z } from 'zod';

interface ExecuteParams {
  // Any valid JSON object
  [key: string]: any;
}

interface FunctionContext {
  userId?: number;
  userRole?: string;
  agentId?: number;
  conversationId?: number;
  [key: string]: any;
}

export class UnifiedFunctionRegistry {
  /**
   * Register a new function
   * @param functionData The function data to register
   * @returns The registered function
   */
  static async registerFunction(functionData: Omit<schema.InsertLangchainTool, "id">) {
    try {
      console.log(`Registering function: ${functionData.name}`);
      
      // Check if function already exists
      const [existingTool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.name, functionData.name));
      
      if (existingTool) {
        // Update existing function
        const [updatedTool] = await db
          .update(schema.langchainTools)
          .set({
            description: functionData.description,
            toolType: functionData.toolType,
            parameters: functionData.parameters,
            implementation: functionData.implementation,
            // Don't update created_at
            updatedAt: new Date()
          })
          .where(eq(schema.langchainTools.name, functionData.name))
          .returning();
        
        console.log(`Updated existing function: ${updatedTool.name}`);
        return updatedTool;
      }
      
      // Create new function
      const [newTool] = await db
        .insert(schema.langchainTools)
        .values({
          ...functionData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      console.log(`Registered new function: ${newTool.name}`);
      return newTool;
    } catch (error) {
      console.error(`Error registering function ${functionData.name}:`, error);
      throw new Error(`Failed to register function: ${error}`);
    }
  }
  
  /**
   * Execute a function
   * @param name Function name to execute
   * @param params Parameters to pass to the function
   * @param context Execution context (user ID, role, etc.)
   * @returns Function result
   */
  static async executeFunction(name: string, params: ExecuteParams, context: FunctionContext = {}) {
    try {
      if (!name) {
        throw new Error("Missing function name");
      }
      
      console.log(`[Unified Function Registry] Executing function: ${name}`);
      
      // Get the function from the database
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.name, name));
      
      if (!tool) {
        throw new Error(`Function ${name} not found`);
      }
      
      if (!tool.enabled) {
        throw new Error(`Function ${name} is disabled`);
      }
      
      // Check if the function supports the access level
      if (tool.metadata && tool.metadata.accessLevel) {
        const accessLevel = String(tool.metadata.accessLevel).toLowerCase();
        // Skip access check if "public" or role matches
        if (accessLevel !== 'public' && context.userRole && 
            accessLevel !== context.userRole.toLowerCase()) {
          throw new Error(`Access denied: Function ${name} requires ${accessLevel} access`);
        }
      }

      // Create a tool instance from the implementation string
      // In a real implementation, we would have a factory to instantiate the tool
      // For now, we're using a simplified approach
      if (tool.implementation === 'ReadFromDBTool') {
        // Implementation for ReadFromDB tool
        console.log(`[Unified Function Registry] Redirecting to ReadFromDB LangChain tool with params:`, params);
        
        // For any operation like "list tables", route to listAllTables
        if (params.input && typeof params.input === 'string' && 
            (params.input.toLowerCase().includes('list tables') || 
             params.input.toLowerCase().includes('show tables'))) {
          console.log(`[Unified Function Registry] Detected list tables command, redirecting to listAllTables`);
          
          // Route to listAllTables function which should be registered
          // This is a temporary solution until we fully migrate
          try {
            return await this.executeFunction('listAllTables', { includeSystemTables: false }, context);
          } catch (error) {
            console.error(`Error executing listAllTables:`, error);
            // Fall back to a direct SQL query
            const result = await db.execute(sql`
              SELECT table_name
              FROM information_schema.tables
              WHERE table_schema = 'public'
              ORDER BY table_name;
            `);
            
            return { 
              type: 'tableList',
              tables: result.rows.map((row: any) => row.table_name),
              message: 'Tables retrieved from database'
            };
          }
        }
        
        // Direct DB query (simplified implementation)
        // In a real implementation, we would have a secure query processor
        console.log(`[Unified Function Registry] Executing database query: ${params.input}`);
        try {
          // Very basic and not secure - just for demo
          if (params.input.startsWith('QUERY:')) {
            // Extract the query string
            // Extract the query part by handling PARAMS if present
            let queryString = params.input.trim();
            
            // If the query contains PARAMS:, extract just the SQL part
            if (queryString.includes('PARAMS:')) {
              queryString = queryString
                .split('PARAMS:')[0]  // Get only the part before PARAMS:
                .replace('QUERY:', '') // Remove the QUERY: prefix
                .trim();
            } else {
              queryString = queryString
                .replace('QUERY:', '') // Remove the QUERY: prefix
                .trim();
            }
            
            console.log('Executing SQL query:', queryString);
            
            // Execute the query
            const result = await db.execute(sql.raw(queryString));
            return { 
              type: 'queryResult',
              data: result.rows,
              message: 'Query executed successfully'
            };
          }
          
          return { 
            error: 'Invalid query format', 
            message: 'Please use format: QUERY: SELECT * FROM table_name'
          };
        } catch (error) {
          console.error(`Error executing database query:`, error);
          return { error: String(error) };
        }
      } 
      else if (tool.implementation === 'CompileReportTool') {
        // Implementation for CompileReport tool
        console.log(`[Unified Function Registry] Executing CompileReport with params:`, params);
        return { 
          type: 'report',
          content: `# Mock Report\n\nThis is a placeholder for a compiled report based on the provided data.`,
          message: 'Report compiled successfully'
        };
      }
      else {
        // No fallback to legacy functions - all functions must be registered in langchain_tools
        console.log(`[Unified Function Registry] Function not found: ${name}`);
        throw new Error(`Function ${name} not found. All functions must be registered in langchain_tools.`);
      }
    } catch (error) {
      console.error(`[Unified Function Registry] Error executing function ${name}:`, error);
      return { error: String(error) };
    }
  }
  
  /**
   * Get all functions
   * @returns List of all functions
   */
  static async getAllFunctions(filterOptions: { enabled?: boolean } = {}) {
    try {
      let query = db.select().from(schema.langchainTools);
      
      // Add filters
      if (filterOptions.enabled !== undefined) {
        query = query.where(eq(schema.langchainTools.enabled, filterOptions.enabled));
      }
      
      const tools = await query;
      return tools;
    } catch (error) {
      console.error('Error getting all functions:', error);
      throw new Error(`Failed to get functions: ${error}`);
    }
  }
  
  /**
   * Get functions for a user based on their role
   * @param userId User ID
   * @param userRole User role
   * @returns List of functions the user can access
   */
  static async getFunctionsForUser(userId: number, userRole: string) {
    try {
      // Get all enabled functions
      const allFunctions = await this.getAllFunctions({ enabled: true });
      
      // Filter functions based on access level
      const accessibleFunctions = allFunctions.filter(tool => {
        // If no access level, assume public
        if (!tool.metadata || !tool.metadata.accessLevel) {
          return true;
        }
        
        const accessLevel = String(tool.metadata.accessLevel).toLowerCase();
        // Allow access if function is public or user has the required role
        return accessLevel === 'public' || accessLevel === userRole.toLowerCase();
      });
      
      return accessibleFunctions;
    } catch (error) {
      console.error(`Error getting functions for user ${userId}:`, error);
      throw new Error(`Failed to get functions for user: ${error}`);
    }
  }
}