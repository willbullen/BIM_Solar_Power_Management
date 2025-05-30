import OpenAI from "openai";
import { LangChainIntegration } from "./langchain-integration";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";

/**
 * LangChain API service for testing agents and checking system status
 */
export class LangChainApiService {
  private openai: OpenAI | null = null;
  private langchainService: LangChainIntegration;
  
  constructor(langchainService: LangChainIntegration) {
    this.langchainService = langchainService;
    this.initializeOpenAI();
  }
  
  /**
   * Initialize OpenAI client
   */
  private initializeOpenAI() {
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
    } catch (error) {
      console.error("Failed to initialize OpenAI client:", error);
    }
  }
  
  /**
   * Get available tools from the database
   */
  async getAvailableTools(): Promise<any[]> {
    try {
      return await db.select().from(schema.langchainTools);
    } catch (error) {
      console.error("Error fetching tools:", error);
      return [];
    }
  }
  
  /**
   * Get all agents from the database
   */
  async getAgents(): Promise<any[]> {
    try {
      return await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
    } catch (error) {
      console.error("Error fetching agents:", error);
      return [];
    }
  }
  
  /**
   * Get a specific agent by ID
   */
  async getAgentById(agentId: number): Promise<any> {
    try {
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, agentId));
      
      if (!agent) {
        return null;
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
        .where(eq(schema.langchainAgentTools.agentId, agentId))
        .orderBy(schema.langchainAgentTools.priority);
      
      return { 
        ...agent, 
        tools: tools.map(t => ({ ...t.tool, priority: t.priority }))
      };
    } catch (error) {
      console.error(`Error fetching agent with ID ${agentId}:`, error);
      return null;
    }
  }
  
  /**
   * Check the health status of the LangChain system
   */
  async getHealthStatus(): Promise<{ status: string; details?: any }> {
    try {
      // Check if OpenAI API is responsive
      const openaiConnected = await this.checkOpenAiConnection();
      
      // Check if LangChain is properly initialized
      const langchainConnected = !!this.langchainService;
      
      // Check available tools
      const tools = await this.getAvailableTools();
      const toolsAvailable = tools && tools.length > 0;
      
      const allSystemsGo = openaiConnected && langchainConnected && toolsAvailable;
      
      return {
        status: allSystemsGo ? 'healthy' : 'degraded',
        details: {
          timestamp: new Date().toISOString(),
          components: {
            openai: openaiConnected ? 'healthy' : 'unavailable',
            langchain: langchainConnected ? 'healthy' : 'unavailable',
            tools: toolsAvailable ? 'available' : 'unavailable',
          }
        }
      };
    } catch (error) {
      console.error("Health check failed:", error);
      return {
        status: 'error',
        details: {
          message: error instanceof Error ? error.message : "Unknown error during health check",
          timestamp: new Date().toISOString()
        }
      };
    }
  }
  
  /**
   * Get detailed status of the LangChain system
   */
  async getSystemStatus(): Promise<any> {
    try {
      // Check if OpenAI API is responsive
      const openaiConnected = await this.checkOpenAiConnection();
      
      // Check if LangChain is properly initialized
      const langchainConnected = !!this.langchainService;
      
      // Get tools information
      const tools = await this.getAvailableTools();
      const toolsAvailable = tools && tools.length > 0;
      const toolsCount = tools ? tools.length : 0;
      
      // Get agents information
      const agents = await this.getAgents();
      const activeAgents = agents.filter(agent => agent.enabled).length;
      
      return {
        openaiConnected,
        langchainConnected,
        toolsAvailable,
        toolsCount,
        agents: {
          total: agents.length,
          active: activeAgents
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error("Failed to get system status:", error);
      return {
        openaiConnected: false,
        langchainConnected: false,
        toolsAvailable: false,
        toolsCount: 0,
        agents: {
          total: 0,
          active: 0
        },
        error: error instanceof Error ? error.message : "Unknown error during status check",
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Execute agent - uses the LangChain integration to invoke the agent with the proper tools
   */
  async executeAgent(agent: any, prompt: string, conversationId: number | null): Promise<any> {
    try {
      console.log(`Testing agent "${agent.name}" with prompt: ${prompt}`);
      
      // Create a start timestamp for measuring execution time
      const startTime = new Date();
      
      // Generate a unique run ID
      const runId = `test-${Date.now()}`;
      
      // Create a run record with 'running' status first
      const runData = {
        runId: runId,
        agentId: agent.id,
        userId: null as unknown as number, // Type cast to satisfy schema
        conversationId: typeof conversationId === 'number' ? conversationId : null,
        input: JSON.stringify({ prompt }), // Store as string since column is TEXT not JSONB
        startTime: startTime,
        status: 'running',
        run_type: 'test', // Required field per database schema
        metadata: { 
          testMode: true,
          model: agent.modelName || "gpt-4o"
        }
      };
      
      // Create initial run record
      await db
        .insert(schema.langchainRuns)
        .values([runData as any]);
      
      // Execute using LangChain integration
      let response;
      
      if (this.langchainService) {
        // Use the LangChain integration which will utilize the agent's tools
        console.log(`Using LangChain integration to process prompt for agent ${agent.id}`);
        response = await this.langchainService.processMessage(prompt, conversationId || 0, 0);
      } else if (this.openai) {
        // Fallback to direct OpenAI as a last resort
        console.log(`LangChain integration not available, falling back to direct OpenAI call`);
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "system",
              content: `You are an AI assistant named ${agent.name} with the following description: ${agent.description || "No description provided."} ${agent.systemPrompt || ""}`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 500
        });
        
        response = completion.choices[0].message.content;
      } else {
        throw new Error("Neither LangChain integration nor OpenAI client are available");
      }
      
      // Calculate end time and duration
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Update the run record with results
      await db
        .update(schema.langchainRuns)
        .set({
          endTime: endTime,
          status: 'completed',
          output: JSON.stringify({ response: response || "" }),
          metadata: {
            ...runData.metadata,
            executionTimeMs: durationMs,
            usedLangchainIntegration: !!this.langchainService
          }
        })
        .where(eq(schema.langchainRuns.runId, runId));
      
      return {
        text: response,
        runId: runId
      };
    } catch (error) {
      console.error("Error executing agent:", error);
      throw error;
    }
  }
  
  /**
   * Test a specific agent with a prompt
   */
  async testAgent(agentId: number, prompt: string): Promise<any> {
    try {
      // Get the agent from the database
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent with ID ${agentId} not found`);
      }
      
      if (!agent.enabled) {
        throw new Error(`Agent '${agent.name}' is disabled. Enable it before testing.`);
      }
      
      // Create a simple conversation context - note that the database expects a numeric ID
      const conversationId = null; // Set to null because we don't have a real conversation ID for tests
      
      // Execute agent with prompt
      const response = await this.executeAgent(
        agent,
        prompt,
        conversationId
      );
      
      // Get the run details to include token usage and execution time
      // Make sure we're querying with a string for the runId to avoid conversion issues
      const [runDetails] = await db
        .select()
        .from(schema.langchainRuns)
        .where(eq(schema.langchainRuns.runId, String(response.runId)));
        
      // Calculate execution time
      const startTime = runDetails?.startTime ? new Date(runDetails.startTime) : new Date();
      const endTime = runDetails?.endTime ? new Date(runDetails.endTime) : new Date();
      const executionTimeMs = endTime.getTime() - startTime.getTime();
      
      // Extract token usage and cost from metadata if available
      const metadata = runDetails?.metadata as any || {};
      const tokenUsage = {
        promptTokens: metadata.promptTokens || 0,
        completionTokens: metadata.completionTokens || 0,
        totalTokens: metadata.totalTokens || 0,
        cost: metadata.cost || 0.0
      };
      
      return {
        agentId,
        agentName: agent.name,
        prompt,
        response: response?.text || "No response generated",
        runId: response.runId,
        executionTimeMs,
        tokenUsage,
        modelName: agent.modelName || "default",
        hasToolCalls: runDetails?.toolCalls ? true : false,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Failed to test agent ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if OpenAI API is responsive
   */
  private async checkOpenAiConnection(): Promise<boolean> {
    if (!this.openai) {
      return false;
    }
    
    try {
      // Make a simple API call to test connectivity
      await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "system", content: "Connection test" }],
        max_tokens: 5
      });
      return true;
    } catch (error) {
      console.error("OpenAI connection check failed:", error);
      return false;
    }
  }
}