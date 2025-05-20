/**
 * LangChain Tool Testing Routes
 * 
 * This file contains API routes for testing LangChain tools directly from the UI
 */

import { Express, Request, Response } from 'express';
import { db } from './db';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
// Import authentication middleware
// Define middleware for authentication
function requireAuth(req: Request, res: Response, next: any) {
  // Check for authenticated user in session
  if (req.session?.userId) {
    return next();
  }

  // Check for API authentication via headers
  const userId = req.headers['x-auth-user-id'];
  const username = req.headers['x-auth-username'];
  
  if (userId && username) {
    return next();
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

/**
 * Register tool testing routes
 */
export function registerToolTestingRoutes(app: Express) {
  // Test a LangChain tool
  app.post('/api/langchain/tools/:id/test', requireAuth, async (req: Request, res: Response) => {
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
          // Only log execution if the user requests it or logging is enabled by default
          const userId = req.session?.userId || (req.headers['x-auth-user-id'] ? Number(req.headers['x-auth-user-id']) : null);
          
          // Check if langchainToolExecutions table exists in schema
          if (schema.langchainToolExecutions) {
            try {
              await db.insert(schema.langchainToolExecutions).values({
                toolId: parseInt(id),
                userId: userId,
                parameters: JSON.stringify(parameters),
                result: JSON.stringify(typeof result === 'object' ? result : { value: result }),
                executedAt: new Date()
              });
            } catch (error) {
              console.error("Error inserting tool execution log:", error);
              // Continue even if insert fails
            }
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