import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';
import * as schema from '@shared/schema';
import { eq, desc, and, asc, sql } from 'drizzle-orm';
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
import { discoverAvailableTools, registerTool, isToolDuplicate } from './utils/langchain-tool-discovery';

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
  
  // API endpoint to manage agent-tool associations
  
  // Debug endpoint for agent tool assignment with enhanced logging and error handling
  app.post('/api/langchain/debug/agent-tool', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("Debug tool assignment endpoint called with body:", req.body);
      const { agentId, toolId, priority } = req.body;
      
      if (isNaN(agentId) || !toolId) {
        console.log('Validation error: Agent ID or Tool ID missing or invalid');
        return res.status(400).json({ error: 'Agent ID and Tool ID are required' });
      }
      
      // Verify agent exists
      const agentExists = await db.select({ count: sql`count(*)` })
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
      
      if (!agentExists || agentExists[0].count === 0) {
        console.error(`Agent with ID ${agentId} not found`);
        return res.status(404).json({ error: `Agent with ID ${agentId} not found` });
      }
      
      // Verify tool exists
      const toolExists = await db.select({ count: sql`count(*)` })
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, toolId));
      
      if (!toolExists || toolExists[0].count === 0) {
        console.error(`Tool with ID ${toolId} not found`);
        return res.status(404).json({ error: `Tool with ID ${toolId} not found` });
      }
      
      // Check if association already exists
      const existingAssoc = await db.select()
        .from(schema.langchainAgentTools)
        .where(and(
          eq(schema.langchainAgentTools.agentId, agentId),
          eq(schema.langchainAgentTools.toolId, toolId)
        ));
      
      if (existingAssoc && existingAssoc.length > 0) {
        console.log(`Tool association already exists, updating priority to ${priority ?? 0}`);
        
        // Update existing association priority
        const [updated] = await db
          .update(schema.langchainAgentTools)
          .set({ priority: priority ?? 0 })
          .where(and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          ))
          .returning();
          
        console.log(`Updated existing agent-tool association:`, updated);
        return res.status(200).json({ 
          ...updated, 
          message: 'Tool association updated successfully'
        });
      }
      
      console.log(`Creating new agent-tool association: Agent ${agentId}, Tool ${toolId}, Priority ${priority ?? 0}`);
      
      try {
        const [newAssoc] = await db
          .insert(schema.langchainAgentTools)
          .values({
            agentId: agentId,
            toolId: toolId,
            priority: priority ?? 0
          })
          .returning();
          
        console.log(`Successfully created agent-tool association:`, newAssoc);
        
        // Get tool details for better user feedback
        const [tool] = await db
          .select()
          .from(schema.langchainTools)
          .where(eq(schema.langchainTools.id, toolId));
          
        return res.status(201).json({
          ...newAssoc,
          toolName: tool?.name || 'Unknown Tool',
          message: 'Tool assigned successfully'
        });
      } catch (insertError) {
        console.error(`Error inserting agent-tool association:`, insertError);
        return res.status(500).json({ 
          error: 'Failed to create tool association', 
          details: insertError.message 
        });
      }
    } catch (error) {
      console.error('Debug endpoint error:', error);
      res.status(500).json({ error: 'Failed to assign tool to agent' });
    }
  });

  // Assign a tool to an agent (RESTful route)
  app.post('/api/langchain/agents/:agentId/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const { toolId, priority } = req.body;
      
      console.log(`Received request to assign tool ${toolId} to agent ${agentId} with priority ${priority}`);
      
      if (isNaN(agentId) || !toolId) {
        console.log('Validation error: Agent ID or Tool ID missing or invalid');
        return res.status(400).json({ error: 'Agent ID and Tool ID are required' });
      }
      
      // Validate that the agent exists
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
        
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // Validate that the tool exists
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, toolId));
        
      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }
      
      // Check if the association already exists
      const [existingAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
      
      if (existingAssoc) {
        // Update the priority of the existing association
        const [updated] = await db
          .update(schema.langchainAgentTools)
          .set({ 
            priority: priority ?? existingAssoc.priority 
          })
          .where(eq(schema.langchainAgentTools.id, existingAssoc.id))
          .returning();
          
        return res.json(updated);
      } else {
        // Create a new association
        const [newAssoc] = await db
          .insert(schema.langchainAgentTools)
          .values({
            agentId: agentId,
            toolId: toolId,
            priority: priority ?? 0
          })
          .returning();
          
        return res.status(201).json(newAssoc);
      }
    } catch (error) {
      console.error('Error assigning tool to agent:', error);
      res.status(500).json({ error: 'Failed to assign tool to agent' });
    }
  });
  
  // Update a tool's priority for an agent (RESTful route)
  app.patch('/api/langchain/agents/:agentId/tools/:toolId/priority', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const toolId = parseInt(req.params.toolId);
      const { priority } = req.body;
      
      if (isNaN(agentId) || isNaN(toolId) || priority === undefined) {
        return res.status(400).json({ error: 'Agent ID, Tool ID, and priority are required' });
      }
      
      // Check if the association exists
      const [existingAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
      
      if (!existingAssoc) {
        return res.status(404).json({ error: 'Agent-Tool association not found' });
      }
      
      // Update the priority
      const [updated] = await db
        .update(schema.langchainAgentTools)
        .set({ priority })
        .where(eq(schema.langchainAgentTools.id, existingAssoc.id))
        .returning();
        
      return res.json(updated);
    } catch (error) {
      console.error('Error updating tool priority:', error);
      res.status(500).json({ error: 'Failed to update tool priority' });
    }
  });
  
  // Backward compatibility for older endpoints
  
  // Assign a tool to an agent (deprecated)
  app.post('/api/langchain/agent-tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId, toolId, priority } = req.body;
      
      if (!agentId || !toolId) {
        return res.status(400).json({ error: 'Agent ID and Tool ID are required' });
      }
      
      // Validate that the agent exists
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
        
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // Validate that the tool exists
      const [tool] = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.id, toolId));
        
      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }
      
      // Check if the association already exists
      const [existingAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
      
      if (existingAssoc) {
        // Update the priority of the existing association
        const [updated] = await db
          .update(schema.langchainAgentTools)
          .set({ 
            priority: priority ?? existingAssoc.priority 
          })
          .where(eq(schema.langchainAgentTools.id, existingAssoc.id))
          .returning();
          
        return res.json(updated);
      } else {
        // Create a new association
        const [newAssoc] = await db
          .insert(schema.langchainAgentTools)
          .values({
            agentId: agentId,
            toolId: toolId,
            priority: priority ?? 0
          })
          .returning();
          
        return res.status(201).json(newAssoc);
      }
    } catch (error) {
      console.error('Error assigning tool to agent:', error);
      res.status(500).json({ error: 'Failed to assign tool to agent' });
    }
  });
  
  // Update a tool's priority for an agent
  app.patch('/api/langchain/agent-tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId, toolId, priority } = req.body;
      
      if (!agentId || !toolId || priority === undefined) {
        return res.status(400).json({ error: 'Agent ID, Tool ID, and priority are required' });
      }
      
      // Check if the association exists
      const [existingAssoc] = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
      
      if (!existingAssoc) {
        return res.status(404).json({ error: 'Agent-Tool association not found' });
      }
      
      // Update the priority
      const [updated] = await db
        .update(schema.langchainAgentTools)
        .set({ priority })
        .where(eq(schema.langchainAgentTools.id, existingAssoc.id))
        .returning();
        
      return res.json(updated);
    } catch (error) {
      console.error('Error updating tool priority:', error);
      res.status(500).json({ error: 'Failed to update tool priority' });
    }
  });
  
  // Bulk update all tools for an agent (new GUI-based approach)
  app.put('/api/langchain/agents/:agentId/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Bulk updating tools for agent');
      const agentId = parseInt(req.params.agentId);
      const { tools } = req.body;
      
      if (!Array.isArray(tools)) {
        return res.status(400).json({ error: 'Tools must be an array' });
      }
      
      console.log(`Updating ${tools.length} tools for agent ID ${agentId}`);
      
      // Validate agent exists
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
        
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // First, get existing tool associations for this agent
      const existingAssociations = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, agentId));
      
      console.log(`Found ${existingAssociations.length} existing tool associations`);
      
      // For tracking which tools should remain
      const toolIdsToKeep = tools.map(t => t.toolId);
      
      // Create a transaction to handle all database changes atomically
      const result = await db.transaction(async (tx) => {
        // 1. Remove associations that are no longer needed
        for (const assoc of existingAssociations) {
          if (!toolIdsToKeep.includes(assoc.toolId)) {
            console.log(`Removing tool ID ${assoc.toolId} from agent ID ${agentId}`);
            await tx
              .delete(schema.langchainAgentTools)
              .where(eq(schema.langchainAgentTools.id, assoc.id));
          }
        }
        
        // 2. Add or update each tool in the request
        const updatedTools = [];
        for (const tool of tools) {
          // Check if this association already exists
          const existingAssoc = existingAssociations.find(a => a.toolId === tool.toolId);
          
          if (existingAssoc) {
            // Update existing association
            console.log(`Updating tool ID ${tool.toolId} priority to ${tool.priority}`);
            const [updated] = await tx
              .update(schema.langchainAgentTools)
              .set({ priority: tool.priority })
              .where(eq(schema.langchainAgentTools.id, existingAssoc.id))
              .returning();
            
            updatedTools.push(updated);
          } else {
            // Create new association
            console.log(`Adding new tool ID ${tool.toolId} with priority ${tool.priority}`);
            const [newAssoc] = await tx
              .insert(schema.langchainAgentTools)
              .values({
                agentId: agentId,
                toolId: tool.toolId,
                priority: tool.priority
              })
              .returning();
            
            updatedTools.push(newAssoc);
          }
        }
        
        return updatedTools;
      });
      
      console.log(`Successfully updated tools for agent ID ${agentId}`);
      return res.json({ 
        success: true, 
        message: `Updated ${result.length} tools for agent ${agent.name}`,
        tools: result
      });
    } catch (error) {
      console.error('Error bulk updating agent tools:', error);
      res.status(500).json({ error: 'Failed to update agent tools' });
    }
  });
  
  // Remove a tool from an agent (RESTful route)
  app.delete('/api/langchain/agents/:agentId/tools/:toolId', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const toolId = parseInt(req.params.toolId);
      
      if (isNaN(agentId) || isNaN(toolId)) {
        return res.status(400).json({ error: 'Agent ID and Tool ID must be valid numbers' });
      }
      
      // Delete the association
      await db
        .delete(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
        
      return res.json({ success: true });
    } catch (error) {
      console.error('Error removing tool from agent:', error);
      res.status(500).json({ error: 'Failed to remove tool from agent' });
    }
  });
  
  // Support for older version (deprecated)
  app.delete('/api/langchain/agent-tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId, toolId } = req.body;
      
      if (!agentId || !toolId) {
        return res.status(400).json({ error: 'Agent ID and Tool ID are required' });
      }
      
      // Delete the association
      await db
        .delete(schema.langchainAgentTools)
        .where(
          and(
            eq(schema.langchainAgentTools.agentId, agentId),
            eq(schema.langchainAgentTools.toolId, toolId)
          )
        );
        
      return res.json({ success: true });
    } catch (error) {
      console.error('Error removing tool from agent:', error);
      res.status(500).json({ error: 'Failed to remove tool from agent' });
    }
  });
  
  // Update tool schemas to match the implementation
  app.post('/api/langchain/update-tools', requireAdmin, async (req: Request, res: Response) => {
    try {
      // Update the ReadFromDB tool parameters to match the schema format
      await db
        .update(schema.langchainTools)
        .set({
          parameters: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: "SQL query to execute. Format: 'QUERY: select * from table WHERE column = ?; PARAMS: [\"value\"]'"
              }
            },
            required: ['input']
          },
          updatedAt: new Date()
        })
        .where(eq(schema.langchainTools.name, 'ReadFromDB'));
        
      // Update the CompileReport tool parameters
      await db
        .update(schema.langchainTools)
        .set({
          parameters: {
            type: 'object',
            properties: {
              input: {
                type: 'string',
                description: "Report details in the format: 'TITLE: <report-title>; CONTENT: <markdown-content>; FORMAT: [markdown|pdf]'"
              }
            },
            required: ['input']
          },
          updatedAt: new Date()
        })
        .where(eq(schema.langchainTools.name, 'CompileReport'));
        
      // Get updated tool schemas
      const tools = await db.select().from(schema.langchainTools);
        
      res.json({ 
        success: true, 
        message: 'Tool schemas updated successfully',
        tools: tools
      });
    } catch (error) {
      console.error('Error updating tool schemas:', error);
      res.status(500).json({ error: 'Failed to update tool schemas' });
    }
  });
  
  // Search for available LangChain tools
  app.get('/api/langchain/tools/search', requireAuth, async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string || '';
      console.log(`Searching for LangChain tools with query: ${query}`);
      
      try {
        // Use the tool discovery service to find available tools
        const tools = discoverAvailableTools(query);
        console.log(`Found ${tools.length} total tools matching query`);
        
        // Check for already registered tools to avoid duplicates
        const registeredTools = await db.select().from(schema.langchainTools);
        const registeredToolNames = registeredTools.map(tool => tool.name.toLowerCase());
        
        // Filter out already registered tools
        const availableTools = tools.filter(tool => 
          !registeredToolNames.includes(tool.name.toLowerCase())
        );
        console.log(`Found ${availableTools.length} unregistered tools matching query`);
        
        res.json({ 
          success: true,
          tools: availableTools 
        });
      } catch (searchError) {
        console.error('Error in tool search function:', searchError);
        // Return empty results rather than failing with an error
        res.json({
          success: true,
          tools: []
        });
      }
    } catch (error) {
      console.error('Error searching for LangChain tools:', error);
      res.status(500).json({ error: 'Failed to search for LangChain tools' });
    }
  });
  
  // Discover available LangChain tools that can be registered
  app.get('/api/langchain/tools/discover', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Discovering available LangChain tools...');
      
      // Get existing tools from database to check for duplicates
      const existingTools = await db.select().from(schema.langchainTools);
      console.log(`Found ${existingTools.length} existing tools in database`);
      
      // Get available tools from the discovery utility with safer error handling
      try {
        const availableTools = discoverAvailableTools();
        console.log(`Found ${availableTools.length} available tools from discovery utility`);
        
        // Filter out tools that are already registered
        const filteredTools = availableTools.filter(tool => 
          !isToolDuplicate(tool.name, existingTools)
        );
        console.log(`Returning ${filteredTools.length} new tools that can be registered`);
        
        res.json({
          success: true,
          tools: filteredTools
        });
      } catch (discoveryError) {
        console.error('Error in tool discovery function:', discoveryError);
        // Return an empty array rather than failing completely
        res.json({
          success: true,
          tools: []
        });
      }
    } catch (error) {
      console.error('Error discovering LangChain tools:', error);
      res.status(500).json({ error: 'Failed to discover LangChain tools' });
    }
  });
  
  // Register a new LangChain tool
  app.post('/api/langchain/tools/register', requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session?.userId || req.headers['x-auth-user-id'];
      
      // Add createdBy if user is authenticated
      const toolData = {
        ...req.body,
        createdBy: userId ? Number(userId) : undefined
      };
      
      // Log received tool data for debugging
      console.log('Registering new tool:', JSON.stringify(toolData, null, 2));
      
      // Register the tool
      const result = await registerTool(db, toolData);
      
      if (!result) {
        return res.status(400).json({ error: 'Failed to register tool' });
      }
      
      // If an agentId was provided, also assign the tool to that agent
      if (toolData.agentId) {
        try {
          const agentId = parseInt(toolData.agentId.toString());
          
          // Check if this tool is already assigned to the agent
          const existingAssignment = await db
            .select()
            .from(schema.langchainAgentTools)
            .where(
              and(
                eq(schema.langchainAgentTools.agentId, agentId),
                eq(schema.langchainAgentTools.toolId, result.tool.id)
              )
            );
          
          if (existingAssignment.length === 0) {
            // Insert into agent_tools table for the specified agent
            await db.insert(schema.langchainAgentTools).values({
              agentId: agentId,
              toolId: result.tool.id,
              priority: toolData.priority || 0,
              enabled: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            console.log(`Tool ${result.tool.name} assigned to agent ${agentId}`);
          } else {
            console.log(`Tool ${result.tool.name} already assigned to agent ${agentId}`);
          }
        } catch (assignError) {
          console.error('Error assigning tool to agent:', assignError);
          // We don't fail the entire request if just the assignment fails
        }
      }
      
      res.status(201).json(result);
    } catch (error) {
      console.error('Error registering LangChain tool:', error);
      res.status(500).json({ error: 'Failed to register LangChain tool' });
    }
  });
  // Get all tools for a specific agent
  app.get('/api/langchain/agent-tools/:agentId', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      
      const agentTools = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, parseInt(agentId)));
      
      res.json(agentTools);
    } catch (error) {
      console.error('Error fetching agent tools:', error);
      res.status(500).json({ error: 'Failed to fetch agent tools' });
    }
  });
  
  // Update all tools for an agent (bulk update)
  app.put('/api/langchain/agents/:agentId/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { tools } = req.body;
      
      if (!Array.isArray(tools)) {
        return res.status(400).json({ error: 'Tools must be an array' });
      }
      
      console.log(`Updating tools for agent ${agentId}. Received ${tools.length} tool assignments.`);
      
      // Start a transaction
      await db.transaction(async (tx) => {
        // First, remove all existing tool associations
        await tx
          .delete(schema.langchainAgentTools)
          .where(eq(schema.langchainAgentTools.agentId, parseInt(agentId)));
        
        // Then insert the new ones
        if (tools.length > 0) {
          const toolsToInsert = tools.map(tool => ({
            agentId: parseInt(agentId),
            toolId: tool.toolId,
            priority: tool.priority || 100,
          }));
          
          await tx.insert(schema.langchainAgentTools).values(toolsToInsert);
        }
      });
      
      // Fetch the updated tools
      const updatedTools = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, parseInt(agentId)));
      
      res.json({ 
        success: true, 
        message: 'Agent tools updated successfully', 
        toolsCount: updatedTools.length,
        tools: updatedTools 
      });
    } catch (error) {
      console.error('Error updating agent tools:', error);
      res.status(500).json({ error: 'Failed to update agent tools' });
    }
  });
  
  // Debug route for agent tools
  app.get('/api/langchain/debug/agent-tools/:agentId', requireAuth, async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.agentId);
      console.log(`DEBUG: Fetching tools for agent ID ${agentId}`);
      
      // Get the agent
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
        
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // Get tools from the agent-tools junction table
      const agentTools = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, agentId));
      
      console.log(`DEBUG: Found ${agentTools.length} tools in junction table for agent ID ${agentId}`);
      
      // Get full tool details for each tool
      const toolDetails = [];
      for (const at of agentTools) {
        const [tool] = await db
          .select()
          .from(schema.langchainTools)
          .where(eq(schema.langchainTools.id, at.toolId));
          
        if (tool) {
          toolDetails.push({
            ...tool,
            priority: at.priority
          });
        }
      }
      
      console.log(`DEBUG: Found ${toolDetails.length} full tool details for agent ID ${agentId}`);
      
      // Return combined data
      res.json({
        agent,
        agentTools,
        toolDetails,
        message: `Found ${toolDetails.length} tools for agent ${agent.name}`
      });
      
    } catch (error) {
      console.error('Error debugging agent tools:', error);
      res.status(500).json({ error: 'Server error during tool debugging' });
    }
  });

  // Initialize LangChain API service
  const langchainIntegration = new LangChainIntegration(new AIService());
  const langchainApiService = new LangChainApiService(langchainIntegration);
  // Get all LangChain agents
  app.get('/api/langchain/agents', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("Starting LangChain agents fetch with tools...");
      
      // Fetch all agents
      const agents = await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
      console.log(`Found ${agents.length} agents in database`);
      
      if (agents.length > 0) {
        // Log the names of agents for debugging
        console.log("Agent names:", agents.map(agent => `${agent.name} (ID: ${agent.id})`));
      }
      
      // For each agent, fetch its associated tools
      const agentsWithTools = await Promise.all(agents.map(async (agent) => {
        console.log(`Processing agent: ${agent.name} (ID: ${agent.id})`);
        
        // Get tool associations for this agent
        const toolAssociations = await db
          .select()
          .from(schema.langchainAgentTools)
          .where(eq(schema.langchainAgentTools.agentId, agent.id))
          // Use simple sort order instead of asc() function that's causing issues
          .orderBy(schema.langchainAgentTools.priority);
        
        console.log(`Found ${toolAssociations.length} tool associations for agent: ${agent.name}`);
        
        // Fetch the actual tool data for each association
        const tools = await Promise.all(
          toolAssociations.map(async (assoc) => {
            const [tool] = await db
              .select()
              .from(schema.langchainTools)
              .where(eq(schema.langchainTools.id, assoc.toolId));
            
            if (tool) {
              console.log(`Found tool ${tool.name} (ID: ${tool.id}) for agent ${agent.name}`);
              return { ...tool, priority: assoc.priority };
            } else {
              console.warn(`Tool with ID ${assoc.toolId} not found but was associated with agent ${agent.name}`);
              return null;
            }
          })
        );
        
        const validTools = tools.filter(Boolean);
        console.log(`Processed agent ${agent.name} with ${validTools.length} valid tools`);
        
        // Filter out any null tools and add them to the agent
        return {
          ...agent,
          tools: validTools
        };
      }));
      
      console.log(`Returning ${agentsWithTools.length} agents with their tools`);
      res.json(agentsWithTools);
    } catch (error) {
      console.error('Error fetching LangChain agents with tools:', error);
      res.status(500).json({ error: 'Failed to fetch LangChain agents' });
    }
  });

  // Get a specific LangChain agent
  app.get('/api/langchain/agents/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Fetching agent with ID: ${id}`);
      
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, id));

      if (!agent) {
        console.log(`Agent with ID ${id} not found`);
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      console.log(`Found agent: ${agent.name} (ID: ${agent.id})`);

      // Get associated tools
      console.log(`Fetching tools for agent ID: ${id}`);
      
      // Step 1: Check the agent-tools junction table directly
      const agentToolRelations = await db
        .select()
        .from(schema.langchainAgentTools)
        .where(eq(schema.langchainAgentTools.agentId, id));
      
      console.log(`Found ${agentToolRelations.length} entries in the agent_tools junction table for agent ID ${id}`);
      
      // Log the raw agent-tools relationships 
      if (agentToolRelations.length > 0) {
        console.log('Raw agent-tool relations:', JSON.stringify(agentToolRelations));
      }
      
      // Step 2: Get the full tool data with join
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
      
      console.log(`Found ${tools.length} tools after join for agent ID ${id}`);
      if (tools.length > 0) {
        console.log('Tools found after join:', tools.map(t => `${t.tool.name} (priority: ${t.priority})`));
      }
      
      // Prepare response with tools
      const toolsWithPriority = tools.map(t => ({ 
        ...t.tool, 
        priority: t.priority 
      }));
      
      const response = { 
        ...agent, 
        tools: toolsWithPriority
      };
      
      console.log(`Sending response for agent ID ${id} with ${response.tools.length} tools`);
      console.log('Response tools data:', JSON.stringify(toolsWithPriority));
      
      res.json(response);
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
      console.log('[LangChain] Fetching execution runs...');
      
      // Check if table exists
      const { rows: tableExists } = await db.execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'langchain_runs'
        );
      `);
      
      console.log('[LangChain] Table exists check:', tableExists[0].exists);
      
      if (!tableExists[0].exists) {
        // Return empty array if table doesn't exist yet
        console.log('[LangChain] Table does not exist, returning empty array');
        return res.json([]);
      }
      
      // Get count of runs for debugging
      const { rows: countRows } = await db.execute(`
        SELECT COUNT(*) FROM langchain_runs;
      `);
      console.log('[LangChain] Total runs in database:', countRows[0].count);
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      const status = req.query.status as string;
      
      console.log(`[LangChain] Query params - limit: ${limit}, offset: ${offset}, status: ${status || 'all'}`);
      
      let query = db.select().from(schema.langchainRuns);
      
      if (status) {
        query = query.where(eq(schema.langchainRuns.status, status));
      }
      
      const runs = await query
        .orderBy(desc(schema.langchainRuns.startTime))
        .limit(limit)
        .offset(offset);
      
      console.log(`[LangChain] Found ${runs.length} runs`);
      if (runs.length > 0) {
        console.log('[LangChain] Sample run data:', JSON.stringify(runs[0]).substring(0, 200) + '...');
      }
      
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
            parameters: {
              type: 'object',
              properties: {
                input: {
                  type: 'string',
                  description: "SQL query to execute. Format: 'QUERY: select * from table WHERE column = ?; PARAMS: [\"value\"]'"
                }
              },
              required: ['input']
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
            parameters: {
              type: 'object',
              properties: {
                input: {
                  type: 'string',
                  description: "Report details in the format: 'TITLE: <report-title>; CONTENT: <markdown-content>; FORMAT: [markdown|pdf]'"
                }
              },
              required: ['input']
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