/**
 * LangChain Agent Routes
 * 
 * This file defines the Express routes for the LangChain agent functionality.
 */

import { Express, Request, Response } from "express";
import { langchainAgent } from "./agent";
import { z } from "zod";

// Define session interface with userId and userRole
interface Session {
  userId?: number;
  userRole?: string;
}

/**
 * Middleware to require authentication
 */
async function requireAuth(req: Request, res: Response, next: any) {
  // Check session-based auth
  const session = req.session as Session;
  if (session.userId) {
    return next();
  }
  
  // Check header-based auth
  const userId = req.headers["x-auth-user-id"];
  if (userId) {
    return next();
  }
  
  return res.status(401).json({ error: "Authentication required" });
}

/**
 * Register LangChain agent routes
 */
export function registerLangChainRoutes(app: Express) {
  // Message schema for validation
  const MessageSchema = z.object({
    message: z.string().min(1, "Message is required"),
  });
  
  // Query schema for validation
  const QuerySchema = z.object({
    table: z.string(),
    columns: z.array(z.string()).optional(),
    where: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    orderBy: z.array(
      z.object({
        column: z.string(),
        direction: z.enum(["ASC", "DESC"]).default("ASC"),
      })
    ).optional(),
    limit: z.number().int().positive().max(1000).optional(),
    offset: z.number().int().nonnegative().optional(),
  });
  
  // Report schema for validation
  const ReportSchema = z.object({
    title: z.string(),
    description: z.string(),
    data: z.array(
      z.object({
        source: z.string(),
        rows: z.array(z.record(z.any())),
        tableDescription: z.string().optional(),
      })
    ),
    analysisInstructions: z.array(z.string()),
    format: z.enum(["markdown", "pdf"]).default("markdown"),
    filename: z.string().optional(),
  });
  
  // Endpoint to send a message to the agent
  app.post("/api/langchain/message", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = MessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
      }
      
      const { message } = validation.data;
      
      // Execute the agent
      const response = await langchainAgent.executeAgent(message);
      
      return res.json({ response });
    } catch (error) {
      console.error("Error in langchain message endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to get conversation history
  app.get("/api/langchain/history", requireAuth, (req: Request, res: Response) => {
    try {
      const history = langchainAgent.getConversationHistory();
      
      // Convert the history to a simpler format for the frontend
      const formattedHistory = history.map(message => ({
        role: message._getType() === "human" ? "user" : "assistant",
        content: message.content,
      }));
      
      return res.json({ history: formattedHistory });
    } catch (error) {
      console.error("Error in langchain history endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to clear conversation history
  app.delete("/api/langchain/history", requireAuth, (req: Request, res: Response) => {
    try {
      langchainAgent.clearConversationHistory();
      return res.json({ success: true });
    } catch (error) {
      console.error("Error in langchain clear history endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to execute a database query directly
  app.post("/api/langchain/query", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = QuerySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
      }
      
      const { table, columns, where, orderBy, limit, offset } = validation.data;
      
      // Execute the query
      const result = await langchainAgent.executeDbQuery(table, columns, where);
      
      return res.json(result);
    } catch (error) {
      console.error("Error in langchain query endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to generate a report directly
  app.post("/api/langchain/report", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validation = ReportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.format() });
      }
      
      // Generate the report
      const result = await langchainAgent.generateReport(validation.data);
      
      return res.json(result);
    } catch (error) {
      console.error("Error in langchain report endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to get available tables
  app.get("/api/langchain/tables", requireAuth, async (req: Request, res: Response) => {
    try {
      // Execute a query to get table information
      const tableInfoResult = await langchainAgent.executeDbQuery("information_schema.tables", 
        ["table_name", "table_schema"], 
        { table_schema: "public" }
      );
      
      // Extract table names from the result
      const tables = tableInfoResult.rows.map(row => row.table_name);
      
      return res.json({ tables });
    } catch (error) {
      console.error("Error in langchain tables endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint to get columns for a table
  app.get("/api/langchain/tables/:tableName/columns", requireAuth, async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      
      // Execute a query to get column information
      const columnInfoResult = await langchainAgent.executeDbQuery("information_schema.columns",
        ["column_name", "data_type", "is_nullable"],
        { table_name: tableName, table_schema: "public" }
      );
      
      return res.json(columnInfoResult);
    } catch (error) {
      console.error("Error in langchain columns endpoint:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}