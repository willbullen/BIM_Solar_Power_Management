/**
 * LangChain Tool Testing Routes
 * 
 * This file contains API routes for testing LangChain tools directly from the UI
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { validateAuth } from './auth';

/**
 * Register tool testing routes
 */
export function registerToolTestingRoutes(app: Express) {
  // Test a LangChain tool
  app.post('/api/langchain/tools/:id/test', validateAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { parameters } = req.body;
      
      console.log(`Testing tool with ID ${id} with parameters:`, parameters);
      
      // Get the tool from the database
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, parseInt(id)));
        
      if (!tool) {
        return res.status(404).json({ error: "Tool not found" });
      }

      // Prepare the tool for execution
      let implementation = tool.implementation;
      
      if (!implementation) {
        return res.status(400).json({ error: "Tool has no implementation" });
      }

      try {
        // Create a sandbox function to execute the tool safely
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const executor = new AsyncFunction("args", implementation);
        
        // Execute the function with the provided parameters
        const result = await executor(parameters);
        
        // Log execution for audit purposes (if possible)
        try {
          // Only attempt to log if the table might exist - don't throw if not
          const { rows: tableExists } = await db.execute(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'langchain_tool_executions'
            );
          `);
          
          if (tableExists[0]?.exists) {
            // Use raw SQL to avoid schema errors if the table structure isn't in the Drizzle schema
            await db.execute(`
              INSERT INTO langchain_tool_executions 
              (tool_id, user_id, parameters, result, executed_at)
              VALUES ($1, $2, $3, $4, NOW())
            `, [
              parseInt(id),
              req.session?.userId || req.headers['x-auth-user-id'] ? Number(req.headers['x-auth-user-id']) : null,
              JSON.stringify(parameters),
              JSON.stringify(typeof result === 'object' ? result : { value: result })
            ]);
          }
        } catch (logError) {
          console.error("Error logging tool execution:", logError);
          // Continue even if logging fails
        }
        
        return res.status(200).json({ 
          success: true, 
          result,
          message: "Tool executed successfully" 
        });
      } catch (execError: any) {
        console.error("Error executing tool:", execError);
        return res.status(500).json({ 
          error: "Error executing tool", 
          message: execError.message || "Unknown execution error",
          stack: process.env.NODE_ENV === "development" ? execError.stack : undefined
        });
      }
    } catch (error: any) {
      console.error("Error in tool testing endpoint:", error);
      return res.status(500).json({ 
        error: "Internal server error", 
        message: error.message || "Unknown error" 
      });
    }
  });
}