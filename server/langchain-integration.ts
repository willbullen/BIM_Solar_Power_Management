import { processMessage, createAgent, AgentConfig } from './langchain/agent';
import { db } from './db';
import * as schema from '@shared/schema';
import { AIService } from './ai-service';
import { eq, desc } from 'drizzle-orm';

/**
 * Service to integrate LangChain functionality with the existing AI service
 */
export class LangChainIntegration {
  private aiService: AIService;
  
  constructor(aiService: AIService) {
    this.aiService = aiService;
  }
  
  /**
   * Process a message using LangChain agent
   * @param message The user message to process
   * @param conversationId The conversation ID for context
   * @param userId The user ID sending the message
   */
  async processMessage(message: string, conversationId: number, userId: number): Promise<string> {
    try {
      // Get the default agent configuration
      const [defaultAgent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.enabled, true))
        .orderBy(desc(schema.langchainAgents.updatedAt))
        .limit(1);
      
      // Set up agent config
      const agentConfig: AgentConfig = defaultAgent 
        ? { agentId: defaultAgent.id } 
        : {
            modelName: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
            temperature: 0.7,
            maxTokens: 4000,
            streaming: false,
            systemPrompt: "You are an advanced AI assistant for Emporium Power Monitoring. Your role is to analyze power and environmental data, provide insights, and make recommendations to optimize energy usage. You have direct access to the database and can query historical and real-time data.",
            maxIterations: 5,
            verbose: false
          };
          
      // Process the message with the LangChain agent
      const response = await processMessage(message, conversationId, agentConfig);
      
      // Record the message and response in the database
      await this.saveMessageAndResponse(message, response, conversationId, userId);
      
      return response;
    } catch (error) {
      console.error('Error processing message with LangChain agent:', error);
      // Fallback to original AI service if LangChain fails
      return `Error using LangChain agent. Please try again later.`;
    }
  }
  
  /**
   * Save the user message and AI response to the database
   */
  private async saveMessageAndResponse(message: string, response: string, conversationId: number, userId: number): Promise<void> {
    try {
      // Save user message
      await db
        .insert(schema.agentMessages)
        .values({
          conversationId,
          role: 'user',
          content: message,
          timestamp: new Date(),
          metadata: {}
        });
        
      // Save assistant response
      await db
        .insert(schema.agentMessages)
        .values({
          conversationId,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          metadata: {}
        });
    } catch (error) {
      console.error('Error saving LangChain messages:', error);
    }
  }
  
  /**
   * Initialize LangChain default agent and tools
   */
  async initialize(): Promise<void> {
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
          eq(schema.langchainAgentTools.agentId, agentId),
          eq(schema.langchainAgentTools.toolId, readFromDBToolId)
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
          eq(schema.langchainAgentTools.agentId, agentId),
          eq(schema.langchainAgentTools.toolId, compileReportToolId)
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
      
      console.log('LangChain agent and tools initialized successfully');
    } catch (error) {
      console.error('Error initializing LangChain integration:', error);
    }
  }
}