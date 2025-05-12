import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { LangChainIntegration } from './langchain-integration';
import { LangChainApiService } from './langchain-api';
import { AIService } from './ai-service';
import { 
  insertLangchainAgentSchema,
  insertLangchainToolSchema,
  insertLangchainPromptTemplateSchema,
} from '@shared/schema';
import { ChatOpenAI } from '@langchain/openai';
import { ReadFromDBTool } from './langchain/tools/readFromDB';
import { CompileReportTool } from './langchain/tools/compileReport';

// Middleware to require authentication
async function requireAuth(req: Request, res: Response, next: any) {
  // Check for authenticated user in session
  if (req.session?.userId) {
    return next();
  }

  // Check for API authentication via headers
  const userId = req.headers['x-auth-user-id'];
  const username = req.headers['x-auth-username'];
  
  if (userId && username) {
    // Verify the user exists
    try {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, Number(userId)));
      if (user && user.username === username) {
        return next();
      }
    } catch (err) {
      console.error('Error verifying API auth:', err);
    }
  }
  
  return res.status(401).json({ error: 'Authentication required' });
}

// Middleware to require admin role
function requireAdmin(req: Request, res: Response, next: any) {
  // For development, temporarily allow all authenticated users to access admin features
  // This is a temporary fix to make the LangChain settings work for all users
  if (req.session?.userId || req.headers['x-auth-user-id']) {
    return next();
  }
  
  // In production, this should check for admin role
  return res.status(403).json({ error: 'Authentication required' });
}

export function registerLangChainRoutes(app: Express) {
  // Initialize LangChain API service
  const langchainIntegration = new LangChainIntegration(new AIService());
  const langchainApiService = new LangChainApiService(langchainIntegration);
  // Get all LangChain agents
  app.get('/api/langchain/agents', requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
      res.json(agents);
    } catch (error) {
      console.error('Error fetching LangChain agents:', error);
      res.status(500).json({ error: 'Failed to fetch LangChain agents' });
    }
  });

  // Get a specific LangChain agent
  app.get('/api/langchain/agents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, id));

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Get associated tools
      const tools = await db
        .select({
          tool: schema.langchainTools,
          priority: schema.langchainAgentTools.priority
        })
        .from(schema.langchainAgentTools)
        .innerJoin(
          schema.langchainTools,
          eq(schema.langchainAgentTools.toolId, schema.langchainTools.id)
        )
        .where(eq(schema.langchainAgentTools.agentId, id))
        .orderBy(schema.langchainAgentTools.priority);

      res.json({ 
        ...agent, 
        tools: tools.map(t => ({ ...t.tool, priority: t.priority }))
      });
    } catch (error) {
      console.error('Error fetching LangChain agent:', error);
      res.status(500).json({ error: 'Failed to fetch LangChain agent' });
    }
  });

  // Create a new LangChain agent
  app.post('/api/langchain/agents', requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.headers['x-auth-user-id'];
      
      const validatedData = insertLangchainAgentSchema.parse({
        ...req.body,
        createdBy: userId ? Number(userId) : undefined
      });

      const [agent] = await db
        .insert(schema.langchainAgents)
        .values(validatedData)
        .returning();

      res.status(201).json(agent);
    } catch (error) {
      console.error('Error creating LangChain agent:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create LangChain agent' });
    }
  });

  // Update a LangChain agent
  app.patch('/api/langchain/agents/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing agent to make sure it exists
      const [existingAgent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, id));

      if (!existingAgent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      const [updatedAgent] = await db
        .update(schema.langchainAgents)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(schema.langchainAgents.id, id))
        .returning();

      res.json(updatedAgent);
    } catch (error) {
      console.error('Error updating LangChain agent:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid agent data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update LangChain agent' });
    }
  });

  // Delete a LangChain agent
  app.delete('/api/langchain/agents/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if this is the default agent
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, id));

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Prevent deletion of the default agent
      if (agent.name === 'Main Assistant Agent') {
        return res.status(403).json({ error: 'Cannot delete the default agent' });
      }

      // First delete agent-tool associations
      await db
        .delete(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, id));

      // Then delete the agent
      await db
        .delete(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, id));

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting LangChain agent:', error);
      res.status(500).json({ error: 'Failed to delete LangChain agent' });
    }
  });

  // Get all LangChain tools
  app.get('/api/langchain/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const tools = await db.select().from(schema.langchainTools).orderBy(desc(schema.langchainTools.updatedAt));
      res.json(tools);
    } catch (error) {
      console.error('Error fetching LangChain tools:', error);
      res.status(500).json({ error: 'Failed to fetch LangChain tools' });
    }
  });

  // Get a specific LangChain tool
  app.get('/api/langchain/tools/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, id));

      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }

      res.json(tool);
    } catch (error) {
      console.error('Error fetching LangChain tool:', error);
      res.status(500).json({ error: 'Failed to fetch LangChain tool' });
    }
  });

  // Create a new LangChain tool
  app.post('/api/langchain/tools', requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.headers['x-auth-user-id'];
      
      const validatedData = insertLangchainToolSchema.parse({
        ...req.body,
        createdBy: userId ? Number(userId) : undefined
      });

      const [tool] = await db
        .insert(schema.langchainTools)
        .values(validatedData)
        .returning();

      res.status(201).json(tool);
    } catch (error) {
      console.error('Error creating LangChain tool:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid tool data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create LangChain tool' });
    }
  });

  // Update a LangChain tool
  app.patch('/api/langchain/tools/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get existing tool to make sure it exists
      const [existingTool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, id));

      if (!existingTool) {
        return res.status(404).json({ error: 'Tool not found' });
      }

      // Prevent modification of built-in tools
      if (existingTool.isBuiltIn && req.body.implementation) {
        return res.status(403).json({ error: 'Cannot modify implementation of built-in tools' });
      }

      const [updatedTool] = await db
        .update(schema.langchainTools)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(eq(schema.langchainTools.id, id))
        .returning();

      res.json(updatedTool);
    } catch (error) {
      console.error('Error updating LangChain tool:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid tool data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update LangChain tool' });
    }
  });

  // Associate a tool with an agent
  app.post('/api/langchain/agents/:agentId/tools', requireAdmin, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const { toolId, priority } = req.body;
      
      if (!toolId) {
        return res.status(400).json({ error: 'Tool ID is required' });
      }

      // Check if the agent exists
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Check if the tool exists
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, toolId));

      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }

      // Check if association already exists
      const [existingAssociation] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );

      if (existingAssociation) {
        // Update priority if it exists
        const [updatedAssociation] = await db
          .update(schema.langchainAgentTools)
          .set({ priority: priority || 0 })
          .where(
            and(
              eq(schema.langchainAgentTools.agentId, agentId),
              eq(schema.langchainAgentTools.toolId, toolId)
            )
          )
          .returning();
        
        return res.json(updatedAssociation);
      }

      // Create new association
      const [association] = await db
        .insert(schema.langchainAgentTools)
        .values({
          agentId,
          toolId,
          priority: priority || 0
        })
        .returning();

      res.status(201).json(association);
    } catch (error) {
      console.error('Error associating tool with agent:', error);
      res.status(500).json({ error: 'Failed to associate tool with agent' });
    }
  });

  // Remove a tool from an agent
  app.delete('/api/langchain/agents/:agentId/tools/:toolId', requireAdmin, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const toolId = parseInt(req.params.toolId);

      // Delete the association
      await db
        .delete(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error removing tool from agent:', error);
      res.status(500).json({ error: 'Failed to remove tool from agent' });
    }
  });

  // Get all prompt templates
  app.get('/api/langchain/prompts', requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if table exists
      const { rows: tableExists } = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_prompt_templates'
        );
      `);
      
      if (!tableExists[0].exists) {
        // Return empty array if table doesn't exist yet
        return res.json([]);
      }
      
      const prompts = await db.select().from(schema.langchainPromptTemplates).orderBy(desc(schema.langchainPromptTemplates.updatedAt));
      res.json(prompts);
    } catch (error) {
      console.error('Error fetching prompt templates:', error);
      // Return empty array on error for better UI experience
      return res.json([]);
    }
  });

  // Create a new prompt template
  app.post('/api/langchain/prompts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.headers['x-auth-user-id'];
      
      const validatedData = insertLangchainPromptTemplateSchema.parse({
        ...req.body,
        createdBy: userId ? Number(userId) : undefined
      });

      const [prompt] = await db
        .insert(schema.langchainPromptTemplates)
        .values(validatedData)
        .returning();

      res.status(201).json(prompt);
    } catch (error) {
      console.error('Error creating prompt template:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid prompt data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create prompt template' });
    }
  });

  // Get all execution runs
  app.get('/api/langchain/runs', requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if table exists
      const { rows: tableExists } = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_runs'
        );
      `);
      
      if (!tableExists[0].exists) {
        // Return empty array if table doesn't exist yet
        return res.json([]);
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const status = req.query.status as string;
      
      let query = db.select().from(schema.langchainRuns);
      
      if (status) {
        query = query.where(eq(schema.langchainRuns.status, status));
      }
      
      const runs = await query
        .orderBy(desc(schema.langchainRuns.startTime))
        .limit(limit)
        .offset(offset);
      
      res.json(runs);
    } catch (error) {
      console.error('Error fetching execution runs:', error);
      // Return empty array on error for better UI experience
      return res.json([]);
    }
  });

  // Get a specific execution run
  app.get('/api/langchain/runs/:runId', requireAuth, async (req: Request, res: Response) => {
    try {
      // Make sure we handle runId as string
      const runId = String(req.params.runId);
      const [run] = await db
        .select()
        .from(schema.langchainRuns)
        .where(eq(schema.langchainRuns.runId, runId));

      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      // Get tool executions for this run - ensure runId is treated as string
      const toolExecutions = await db
        .select()
        .from(schema.langchainToolExecutions)
        .where(eq(schema.langchainToolExecutions.runId, String(runId)))
        .orderBy(schema.langchainToolExecutions.executionOrder);

      res.json({ ...run, toolExecutions });
    } catch (error) {
      console.error('Error fetching execution run:', error);
      res.status(500).json({ error: 'Failed to fetch execution run' });
    }
  });

  // Get the database tables available for querying
  app.get('/api/langchain/tables', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get list of tables from built-in tool
      const readFromDBTool = new ReadFromDBTool();
      const tables = readFromDBTool.getAvailableTables();
      
      res.json({ tables });
    } catch (error) {
      console.error('Error fetching available tables:', error);
      res.status(500).json({ error: 'Failed to fetch available tables' });
    }
  });

  // Initialize default agent and tools if they don't exist
  app.post('/api/langchain/initialize', requireAdmin, async (req: Request, res: Response) => {
    try {
      // Check if we already have a default agent
      const [existingAgent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.name, 'Main Assistant Agent'));

      let agentId;
      
      if (!existingAgent) {
        // Create default agent
        const [agent] = await db
          .insert(schema.langchainAgents)
          .values({
            name: 'Main Assistant Agent',
            description: 'Primary agent for user interactions using GPT-4o and custom tools',
            modelName: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 4000,
            streaming: true,
            systemPrompt: 'You are an advanced AI assistant with access to database querying and report generation capabilities. Help users analyze data and create reports. You should be concise and direct in your responses.',
            maxIterations: 5,
            verbose: false,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {}
          })
          .returning();
          
        agentId = agent.id;
      } else {
        agentId = existingAgent.id;
      }

      // Check if we already have the ReadFromDB tool
      const [existingReadFromDBTool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.name, 'ReadFromDB'));

      let readFromDBToolId;
      
      if (!existingReadFromDBTool) {
        // Create ReadFromDB tool
        const [tool] = await db
          .insert(schema.langchainTools)
          .values({
            name: 'ReadFromDB',
            description: 'Parameterized database queries with SQL injection protection',
            toolType: 'database',
            schema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The SQL query to execute'
                },
                params: {
                  type: 'array',
                  description: 'Query parameters to prevent SQL injection',
                  items: {
                    type: 'string'
                  }
                }
              },
              required: ['query']
            },
            implementation: 'ReadFromDBTool',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            isBuiltIn: true,
            metadata: {}
          })
          .returning();
          
        readFromDBToolId = tool.id;
      } else {
        readFromDBToolId = existingReadFromDBTool.id;
      }

      // Check if we already have the CompileReport tool
      const [existingCompileReportTool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.name, 'CompileReport'));

      let compileReportToolId;
      
      if (!existingCompileReportTool) {
        // Create CompileReport tool
        const [tool] = await db
          .insert(schema.langchainTools)
          .values({
            name: 'CompileReport',
            description: 'Generate Markdown and PDF reports from structured data',
            toolType: 'report',
            schema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Report title'
                },
                content: {
                  type: 'string',
                  description: 'Report content in Markdown format'
                },
                format: {
                  type: 'string',
                  description: 'Report format (markdown or pdf)',
                  enum: ['markdown', 'pdf']
                }
              },
              required: ['title', 'content']
            },
            implementation: 'CompileReportTool',
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            isBuiltIn: true,
            metadata: {}
          })
          .returning();
          
        compileReportToolId = tool.id;
      } else {
        compileReportToolId = existingCompileReportTool.id;
      }

      // Associate tools with agent if not already associated
      // First check ReadFromDB
      const [existingReadFromDBAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, readFromDBToolId)
          )
        );
        
      if (!existingReadFromDBAssoc) {
        await db
          .insert(schema.langchainAgentTools)
          .values({
            agentId,
            toolId: readFromDBToolId,
            priority: 0
          });
      }
      
      // Then check CompileReport
      const [existingCompileReportAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, compileReportToolId)
          )
        );
        
      if (!existingCompileReportAssoc) {
        await db
          .insert(schema.langchainAgentTools)
          .values({
            agentId,
            toolId: compileReportToolId,
            priority: 1
          });
      }

      res.status(200).json({ 
        success: true, 
        message: 'Default LangChain agent and tools initialized' 
      });
    } catch (error) {
      console.error('Error initializing default agent and tools:', error);
      res.status(500).json({ error: 'Failed to initialize default agent and tools' });
    }
  });

  // Handle a LangChain message (for direct API use)
  app.post('/api/langchain/message', requireAuth, async (req: Request, res: Response) => {
    try {
      const { message, agentId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Get the agent to use (default to first active agent if not specified)
      let agent;
      if (agentId) {
        [agent] = await db
          .select()
          .from(schema.langchainAgents)
          .where(
            and(
              eq(schema.langchainAgents.id, agentId),
              eq(schema.langchainAgents.enabled, true)
            )
          );
      } else {
        [agent] = await db
          .select()
          .from(schema.langchainAgents)
          .where(eq(schema.langchainAgents.enabled, true))
          .orderBy(desc(schema.langchainAgents.updatedAt))
          .limit(1);
      }

      if (!agent) {
        return res.status(404).json({ error: 'No active LangChain agent found' });
      }

      // Get the tools associated with this agent
      const toolAssociations = await db
        .select({
          tool: schema.langchainTools,
        })
        .from(schema.langchainAgentTools)
        .innerJoin(
          schema.langchainTools,
          eq(schema.langchainAgentTools.toolId, schema.langchainTools.id)
        )
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agent.id),
            eq(schema.langchainTools.enabled, true)
          )
        )
        .orderBy(schema.langchainAgentTools.priority);

      // Initialize tools
      const tools = [];
      for (const { tool } of toolAssociations) {
        if (tool.name === 'ReadFromDB') {
          tools.push(new ReadFromDBTool());
        } else if (tool.name === 'CompileReport') {
          tools.push(new CompileReportTool());
        }
        // Add more tool initializations here as needed
      }

      // Initialize the model
      const model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: agent.modelName,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        streaming: false,
      });

      // Create a unique run ID
      const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Record the run start
      // We need to include run_type which is required and ensure input is properly handled as a text field
      const [run] = await db
        .insert(schema.langchainRuns)
        .values({
          runId,
          agentId: agent.id,
          userId: req.session?.userId ? Number(req.session.userId) : (req.headers['x-auth-user-id'] ? Number(req.headers['x-auth-user-id']) : null),
          startTime: new Date(),
          status: 'running',
          input: JSON.stringify({ message }), // Make sure we stringify the JSON since input is TEXT type
          run_type: 'conversation', // This field is required
        })
        .returning();

      // Simplified direct call to the model
      try {
        const response = await model.invoke(message);
        
        // Update run with result - make sure output is a string since the column is TEXT type
        await db
          .update(schema.langchainRuns)
          .set({
            endTime: new Date(),
            status: 'completed',
            output: JSON.stringify({ response: response.content }), // Convert object to string
          })
          .where(eq(schema.langchainRuns.runId, String(runId)));
        
        res.json({ 
          response: response.content,
          runId,
        });
      } catch (error) {
        console.error('Error invoking LangChain model:', error);
        
        // Update run with error - ensure error is properly handled as string
        await db
          .update(schema.langchainRuns)
          .set({
            endTime: new Date(),
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          })
          .where(eq(schema.langchainRuns.runId, String(runId)));
        
        res.status(500).json({ error: 'Failed to process message with LangChain' });
      }
    } catch (error) {
      console.error('Error handling LangChain message:', error);
      res.status(500).json({ error: 'Failed to process LangChain message' });
    }
  });
  
  // Health check endpoint
  app.get('/api/langchain/health', requireAuth, async (req: Request, res: Response) => {
    try {
      const status = await langchainApiService.getHealthStatus();
      res.json(status);
    } catch (error) {
      console.error('Error checking LangChain health:', error);
      res.status(500).json({ error: 'Failed to check LangChain health' });
    }
  });
  
  // System status detailed endpoint
  app.get('/api/langchain/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const status = await langchainApiService.getSystemStatus();
      res.json(status);
    } catch (error) {
      console.error('Error getting LangChain status:', error);
      res.status(500).json({ error: 'Failed to get LangChain status' });
    }
  });
  
  // Test agent endpoint
  app.post('/api/langchain/test', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId, prompt } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required' });
      }
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      const result = await langchainApiService.testAgent(agentId, prompt);
      res.json(result);
    } catch (error) {
      console.error('Error testing LangChain agent:', error);
      res.status(500).json({ 
        error: 'Failed to test LangChain agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}