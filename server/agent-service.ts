import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { db, pool } from "./db";
import * as schema from "@shared/schema";
import { AIService } from "./ai-service";
import { DbUtils } from "./utils/db-utils";
// Only use the unified function registry - no more legacy registry
import { UnifiedFunctionRegistry } from "./utils/unified-function-registry";
import { eq, and, or, asc, desc, sql, inArray } from "drizzle-orm";

// Define the core agent capabilities and functions
export class AgentService {
  private openai: OpenAI;
  private model: ChatOpenAI;
  private aiService: AIService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4o", // Using the latest GPT-4o model for better performance
      temperature: 0.7,    // Default temperature, can be configured via agent settings
    });
    
    this.aiService = new AIService(); // Leverage existing AI service for analytics
  }

  /**
   * Create a new conversation with the AI agent
   * @param userId - The user ID who created the conversation
   * @param title - The title of the conversation
   * @param agentId - Optional agent ID to associate with this conversation
   */
  async createConversation(userId: number, title: string, agentId?: number): Promise<schema.AgentConversation> {
    const [conversation] = await db.insert(schema.agentConversations)
      .values({
        userId,
        title,
        agentId: agentId || null, // Use provided agent ID or null for default
        context: {},
        status: "active"
      })
      .returning();
    
    // Add the initial system message to set up the conversation
    await this.addSystemMessage(conversation.id);
    
    return conversation;
  }

  /**
   * Add a system message to a conversation to set up the agent context
   * Cleans up duplicate system messages and ensures only one exists
   */
  private async addSystemMessage(conversationId: number): Promise<void> {
    try {
      console.log(`Adding system message for conversation ${conversationId}`);
      // Check if system messages already exist for this conversation
      const existingSystemMessages = await db.query.agentMessages.findMany({
        where: (fields, { and, eq }) => and(
          eq(fields.conversationId, conversationId),
          eq(fields.role, "system")
        )
      });
      
      // Get the system prompt from settings
      const systemPromptSetting = await db.query.agentSettings.findFirst({
        where: (fields, { eq }) => eq(fields.name, "agent_system_prompt")
      });

      const systemPrompt = systemPromptSetting?.value || 
        "You are an advanced AI Energy Advisor for Emporium Power Monitoring. Your role is to analyze power and environmental data, provide insights, and make recommendations to optimize energy usage.";

      // If multiple system messages exist, delete all but one
      if (existingSystemMessages.length > 1) {
        console.log(`Found ${existingSystemMessages.length} system messages for conversation ${conversationId}. Cleaning up duplicates...`);
        
        // Keep the first one, delete the rest
        const [firstMessage, ...duplicates] = existingSystemMessages;
        
        // Delete all duplicate system messages
        for (const msg of duplicates) {
          await db.delete(schema.agentMessages).where(eq(schema.agentMessages.id, msg.id));
        }
        
        // Update the content of the first message to ensure it has the latest system prompt
        await db.update(schema.agentMessages)
          .set({ content: systemPrompt })
          .where(eq(schema.agentMessages.id, firstMessage.id));
        
        console.log(`Cleaned up ${duplicates.length} duplicate system messages.`);
      }
      // If exactly one system message exists, just update its content
      else if (existingSystemMessages.length === 1) {
        await db.update(schema.agentMessages)
          .set({ content: systemPrompt })
          .where(eq(schema.agentMessages.id, existingSystemMessages[0].id));
      }
      // If no system message exists, create one using raw SQL to avoid schema issues
      else {
        console.log(`No system message found, creating new one for conversation ${conversationId}`);
        // Use raw SQL to avoid schema issues with the timestamp column
        await db.execute(sql`
          INSERT INTO langchain_agent_messages 
          (conversation_id, role, content, metadata, created_at, updated_at)
          VALUES (
            ${conversationId}, 
            'system', 
            ${systemPrompt}, 
            '{}', 
            NOW(), 
            NOW()
          )
        `);
        console.log(`Successfully created system message for conversation ${conversationId}`);
      }
    } catch (error) {
      console.error(`Error adding system message to conversation ${conversationId}:`, error);
      throw error;
    }
  }

  /**
   * Add a user message to a conversation
   */
  async addUserMessage(conversationId: number, content: string): Promise<schema.AgentMessage> {
    try {
      // Our schema now matches the database schema with createdAt instead of timestamp
      const query = `
        INSERT INTO langchain_agent_messages 
        (conversation_id, role, content, metadata, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING *
      `;
      const result = await pool.query(query, [
        conversationId, 
        "user", 
        content, 
        JSON.stringify({})
      ]);
      
      if (result.rows && result.rows.length > 0) {
        console.log(`Successfully added user message to conversation ${conversationId} using raw SQL`);
        
        // Convert snake_case to camelCase for response
        const row = result.rows[0];
        return {
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          tokens: row.tokens || 0,
          metadata: row.metadata || {},
          functionCall: row.function_call,
          functionResponse: row.function_response
        } as schema.AgentMessage;
      } else {
        throw new Error("Failed to insert message (no rows returned)");
      }
    } catch (error) {
      console.error(`Error adding user message to conversation ${conversationId}:`, error);
      
      // Last resort manual approach with even more simplified query
      try {
        console.log("Trying simplified insertion method for message...");
        const simpleQuery = `
          INSERT INTO langchain_agent_messages 
          (conversation_id, role, content, metadata)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const simpleResult = await pool.query(simpleQuery, [
          conversationId, 
          "user", 
          content, 
          '{}'
        ]);
        
        if (simpleResult.rows && simpleResult.rows.length > 0) {
          const row = simpleResult.rows[0];
          return {
            id: row.id,
            conversationId: row.conversation_id,
            role: row.role,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            tokens: row.tokens || 0,
            metadata: row.metadata || {},
            functionCall: row.function_call,
            functionResponse: row.function_response
          } as schema.AgentMessage;
        }
      } catch (innerError) {
        console.error("Even simplified message insertion failed:", innerError);
      }
      
      // If all else fails, create a minimal object with required fields
      // This will allow the app to continue running even if database insertion fails
      console.warn("Creating fallback message object for continuity");
      return {
        id: -1,
        conversationId: conversationId,
        role: "user",
        content: content,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokens: 0,
        metadata: {},
        functionCall: undefined,
        functionResponse: undefined
      } as unknown as schema.AgentMessage;
    }
  }
  
  /**
   * Delete a message from a conversation
   * @param messageId ID of the message to delete
   * @param userId User requesting the deletion, for authorization
   * @returns Success boolean
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    try {
      // First check if the message belongs to this user's conversation
      const message = await db.query.agentMessages.findFirst({
        where: (fields, { eq }) => eq(fields.id, messageId),
        with: {
          conversation: true
        }
      });
      
      if (!message) {
        return false;
      }
      
      // Verify the conversation belongs to the user
      if (message.conversation.userId !== userId) {
        return false;
      }
      
      // Delete the message (including system messages)
      const result = await db.delete(schema.agentMessages)
        .where(eq(schema.agentMessages.id, messageId))
        .returning();
      
      // Update the conversation's updatedAt timestamp
      await db.update(schema.agentConversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.agentConversations.id, message.conversationId));
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting message:", error);
      return false;
    }
  }

  /**
   * Generate a response from the agent
   * @param conversationId The ID of the conversation
   * @param userId The ID of the user
   * @param userRole The role of the user (e.g., 'user', 'admin')
   * @param maxTokens The maximum number of tokens to generate
   * @param agentId Optional Langchain agent ID to use for response generation
   */
  async generateResponse(
    conversationId: number, 
    userId: number,
    userRole: string,
    maxTokens: number = 1000,
    agentId?: number
  ): Promise<schema.AgentMessage | null> {
    // Get the conversation history
    const messages = await db.query.agentMessages.findMany({
      where: (fields, { eq }) => eq(fields.conversationId, conversationId),
      orderBy: (fields, { asc }) => [asc(fields.createdAt)],
    });

    // Get conversation context (e.g., current data being analyzed)
    const conversation = await db.query.agentConversations.findFirst({
      where: (fields, { eq }) => eq(fields.id, conversationId),
    });

    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    // Prepare the messages for the OpenAI API with enhanced debugging
    console.log(`Preparing ${messages.length} messages for OpenAI API call`);
    
    const openaiMessages = messages.map(msg => {
      // Basic message structure
      const openaiMsg: any = {
        role: msg.role as any,
        content: msg.content,
      };
      
      // For 'function' role messages, we MUST include the name parameter
      // This fixes the "Missing parameter 'name': messages with role 'function' must have a 'name'" error
      if (msg.role === 'function') {
        if (msg.name) {
          console.log(`Adding name parameter to function message: ${msg.name}`);
          openaiMsg.name = msg.name;
        } else {
          // Always provide a name for function messages to avoid OpenAI API errors
          console.warn(`Function message missing name parameter, adding default name`);
          openaiMsg.name = 'unnamed_function';
        }
      }
      
      // Log the message structure
      console.log(`Prepared message - Role: ${msg.role}, Content length: ${msg.content?.length || 0}, Has name: ${!!openaiMsg.name}`);
      
      return openaiMsg;
    });

    // Get available functions based on user role and agent ID if provided
    const availableFunctions = await this.getAvailableFunctions(userRole, agentId);
    
    // Log the available functions for debugging
    console.log(`Available functions for user ${userId} with role ${userRole}:`, 
      availableFunctions.map(f => f.name).join(', '));
    
    // Create function definitions for OpenAI in the expected format
    const functions = availableFunctions.map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters as any // Type assertion to fix TypeScript error
    }));

    try {
      // Initialize default model settings
      let modelToUse = "gpt-4o"; // Default model
      let temperature = 0.7;     // Default temperature
      let tokensToUse = maxTokens; // Default max tokens
      let systemPromptOverride = null;

      // If a specific Langchain agent ID is provided, use its settings
      if (agentId) {
        try {
          // Find the requested agent in the database
          const agent = await db.query.langchainAgents.findFirst({
            where: (fields, { and, eq }) => and(
              eq(fields.id, agentId),
              eq(fields.enabled, true)
            )
          });

          if (agent) {
            console.log(`Using Langchain agent for response: ${agent.name} (ID: ${agent.id})`);
            modelToUse = agent.modelName || modelToUse;
            temperature = agent.temperature || temperature;
            tokensToUse = agent.maxTokens || tokensToUse;
            systemPromptOverride = agent.systemPrompt || null;

            // If there's a system prompt override from the agent, update the system message
            if (systemPromptOverride) {
              // Find the system message in the conversation
              const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
              if (systemMessageIndex >= 0) {
                // Update the system message content with the agent's prompt
                await db.update(schema.agentMessages)
                  .set({ content: systemPromptOverride })
                  .where(eq(schema.agentMessages.id, messages[systemMessageIndex].id));
                
                // Update the message in our local array too
                messages[systemMessageIndex].content = systemPromptOverride;
                openaiMessages[systemMessageIndex].content = systemPromptOverride;
              }
            }
          } else {
            console.warn(`Langchain agent with ID ${agentId} not found or disabled, using default model settings`);
          }
        } catch (agentError) {
          console.error(`Error fetching Langchain agent with ID ${agentId}:`, agentError);
          // Continue with default settings
        }
      } else {
        // Try to find the Main Assistant Agent to use by default
        try {
          // Cast the result to the correct type to avoid TypeScript errors
          const mainAssistantAgent = await db.select({
            id: schema.langchainAgents.id,
            name: schema.langchainAgents.name,
            modelName: schema.langchainAgents.modelName,
            temperature: schema.langchainAgents.temperature,
            maxTokens: schema.langchainAgents.maxTokens,
            systemPrompt: schema.langchainAgents.systemPrompt
          })
          .from(schema.langchainAgents)
          .where(and(
            eq(schema.langchainAgents.name, 'Main Assistant Agent'), 
            eq(schema.langchainAgents.enabled, true)
          ))
          .limit(1);
          
          if (mainAssistantAgent.length > 0) {
            console.log(`Using Langchain Main Assistant Agent by default: ${mainAssistantAgent[0].id}`);
            
            // Get the first (and should be only) agent
            const agent = mainAssistantAgent[0];
            
            // Get the agent ID to pass to getAvailableFunctions
            const mainAgentId = agent.id;
            
            // Set model parameters from the agent
            modelToUse = agent.modelName || modelToUse;
            temperature = agent.temperature || temperature;
            tokensToUse = agent.maxTokens || tokensToUse;
            
            // Use systemPrompt if available
            if (agent.systemPrompt) {
              systemPromptOverride = agent.systemPrompt;
            }
            
            // Get tools specifically for this agent
            if (mainAgentId) {
              console.log(`Fetching tools for Main Assistant Agent ID ${mainAgentId}`);
              const agentTools = await this.getAvailableFunctions(userRole, mainAgentId);
              
              // Create a new functions array with agent-specific tools
              const agentSpecificFunctions = agentTools.map(func => ({
                name: func.name,
                description: func.description,
                parameters: func.parameters as any
              }));
              
              // Replace the functions array
              functions.length = 0;  // Clear the array
              agentSpecificFunctions.forEach(func => functions.push(func));
            }
          } else {
            console.log('Main Assistant Agent not found, using default model settings');
          }
        } catch (agentError) {
          console.error('Error finding Main Assistant Agent:', agentError);
          // Continue with default settings
        }
      }
      
      console.log(`🧠 OpenAI Call - Using model: ${modelToUse}, Functions: ${functions.length}`);
      
      if (functions.length > 0) {
        console.log(`🧠 Available tools: ${functions.map(f => f.name).join(', ')}`);
      }
      
      // Set a timeout for the API call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("OpenAI API call timed out after 30 seconds")), 30000);
      });
      
      // Make the API call with a timeout
      let response;
      try {
        console.log(`🧠 Starting OpenAI API call with ${openaiMessages.length} messages`);
        
        response = await Promise.race([
          this.openai.chat.completions.create({
            model: modelToUse,
            messages: openaiMessages,
            temperature: temperature,
            max_tokens: tokensToUse,
            tools: functions.length > 0 ? functions.map(func => ({
              type: "function",
              function: func
            })) : undefined,
            tool_choice: functions.length > 0 ? "auto" : "none",
          }),
          timeoutPromise
        ]) as OpenAI.ChatCompletion;
        
        console.log(`🧠 OpenAI API call successful - Response ID: ${response.id}`);
        console.log(`🧠 Response - Tokens used: ${response.usage?.total_tokens || 'unknown'}`);
      } catch (error) {
        console.error(`🚨 OpenAI API call failed: ${error.message}`);
        if (error.response) {
          console.error(`🚨 API Error details: ${JSON.stringify(error.response.data || {})}`);
        }
        throw error;
      }

      const assistantResponse = response.choices[0]?.message;
      
      // Check if the model wants to call a function (handling both legacy and new format)
      if (assistantResponse?.tool_calls && assistantResponse.tool_calls.length > 0) {
        // New format with tool_calls
        const toolCall = assistantResponse.tool_calls[0];
        if (toolCall.type !== 'function') {
          throw new Error(`Unsupported tool type: ${toolCall.type}`);
        }
        
        // Ensure function name is always defined - important for Telegram compatibility
        let functionName = toolCall.function.name;
        if (!functionName) {
          console.warn(`Missing function name in toolCall. Using fallback name. Tool call:`, JSON.stringify(toolCall));
          functionName = 'unnamed_function';
        }
        
        let functionArgs = {};
        
        try {
          functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch (e) {
          console.error("Failed to parse function arguments:", e);
          console.log("Raw arguments:", toolCall.function.arguments);
        }
        
        // Special handling for listAllTables which may come in without proper parameters
        if (functionName === 'listAllTables' && (
          !functionArgs || 
          Object.keys(functionArgs).length === 0
        )) {
          console.log('Setting default parameters for listAllTables function');
          functionArgs = { includeSystemTables: false };
        }
        
        // Save the function call to the database
        const [functionCallMessage] = await db.insert(schema.agentMessages)
          .values({
            conversationId,
            role: "assistant",
            content: assistantResponse.content || "",
            functionCall: {
              name: functionName,
              arguments: functionArgs
            },
            metadata: { completionId: response.id, toolCallId: toolCall.id }
          })
          .returning();
        
        // Execute the function
        try {
          console.log(`Executing function "${functionName}" with args:`, JSON.stringify(functionArgs));
          
          // Use only the unified function registry - no more fallback to legacy
          console.log(`Executing with UnifiedFunctionRegistry: ${functionName}`);
          const functionResult = await UnifiedFunctionRegistry.executeFunction(
            functionName,
            functionArgs,
            { userId, userRole, agentId, conversationId }
          );
          
          // Save the function result
          await db.update(schema.agentMessages)
            .set({
              functionResponse: functionResult
            })
            .where(eq(schema.agentMessages.id, functionCallMessage.id));
          
          // Add the function result as a new message
          // Make sure the functionName is never undefined to avoid OpenAI API errors
          const functionNameToUse = functionName || 'unnamed_function';
          
          await db.insert(schema.agentMessages).values({
            conversationId,
            role: "function",
            name: functionNameToUse, // Required field for function role messages
            content: JSON.stringify(functionResult),
            metadata: { 
              functionName: functionNameToUse,
              executedAt: new Date(),
              toolCallId: toolCall.id
            }
          });
          
          return functionCallMessage;
        } catch (funcError) {
          console.error(`Function execution error (${functionName}):`, funcError);
          
          // Update the message with the error
          await db.update(schema.agentMessages)
            .set({
              functionResponse: { error: String(funcError) }
            })
            .where(eq(schema.agentMessages.id, functionCallMessage.id));
          
          return functionCallMessage;
        }
      } else if (assistantResponse?.function_call) {
        // Legacy format with function_call
        // Ensure function name is always defined
        let functionName = assistantResponse.function_call.name;
        if (!functionName) {
          console.warn(`Missing function name in function_call. Using fallback name.`);
          functionName = 'unnamed_function';
        }
        
        let functionArgs = {};
        
        try {
          functionArgs = JSON.parse(assistantResponse.function_call.arguments || '{}');
        } catch (e) {
          console.error("Failed to parse function arguments:", e);
          console.log("Raw arguments:", assistantResponse.function_call.arguments);
        }
        
        // Special handling for listAllTables without parameters
        if (functionName === 'listAllTables' && (
          !functionArgs || 
          Object.keys(functionArgs).length === 0
        )) {
          console.log('Setting default parameters for listAllTables function (legacy format)');
          functionArgs = { includeSystemTables: false };
        }
        
        // Save the function call to the database
        const [functionCallMessage] = await db.insert(schema.agentMessages)
          .values({
            conversationId,
            role: "assistant",
            content: assistantResponse.content || "",
            functionCall: {
              name: functionName,
              arguments: functionArgs
            },
            metadata: { completionId: response.id }
          })
          .returning();
        
        // Execute the function
        try {
          console.log(`Executing with UnifiedFunctionRegistry: ${functionName}`);
          const functionResult = await UnifiedFunctionRegistry.executeFunction(
            functionName,
            functionArgs,
            { userId, userRole }
          );
          
          // Save the function result
          await db.update(schema.agentMessages)
            .set({
              functionResponse: functionResult
            })
            .where(eq(schema.agentMessages.id, functionCallMessage.id));
          
          // Add the function result as a new message
          // Make sure the functionName is never undefined to avoid OpenAI API errors
          const functionNameToUse = functionName || 'unnamed_function';
          
          await db.insert(schema.agentMessages).values({
            conversationId,
            role: "function",
            name: functionNameToUse, // Required field for function role messages
            content: JSON.stringify(functionResult),
            metadata: { 
              functionName: functionNameToUse,
              executedAt: new Date()
            }
          });
          
          return functionCallMessage;
        } catch (funcError) {
          console.error(`Function execution error (${functionName}):`, funcError);
          
          // Update the message with the error
          await db.update(schema.agentMessages)
            .set({
              functionResponse: { error: String(funcError) }
            })
            .where(eq(schema.agentMessages.id, functionCallMessage.id));
          
          return functionCallMessage;
        }
      } else {
        // Regular text response
        const responseContent = assistantResponse?.content || 
          "I apologize, but I couldn't generate a response at this time.";

        // Save the response to the database
        const [assistantMessage] = await db.insert(schema.agentMessages)
          .values({
            conversationId,
            role: "assistant",
            content: responseContent,
            metadata: { completionId: response.id }
          })
          .returning();

        return assistantMessage;
      }
    } catch (error) {
      console.error("Error generating agent response:", error);
      
      // Prepare a user-friendly error message
      let errorMessage = "I'm sorry, but I encountered an error while processing your request. Please try again later.";
      
      // In development mode, include more details about the error
      if (process.env.NODE_ENV === 'development') {
        const errorDetails = error instanceof Error ? error.message : String(error);
        errorMessage += `\n\nError details (development mode): ${errorDetails}`;
      }
      
      // Save error response to the database
      const [savedErrorMessage] = await db.insert(schema.agentMessages)
        .values({
          conversationId,
          role: "assistant",
          content: errorMessage,
          metadata: { 
            error: String(error),
            errorType: error instanceof Error ? error.name : 'Unknown',
            timestamp: new Date().toISOString()
          }
        })
        .returning();

      return savedErrorMessage;
    }
  }

  /**
   * Execute an agent function and store the result
   */
  async executeFunction(
    name: string, 
    parameters: any, 
    userId: number, 
    userRole: string
  ): Promise<any> {
    try {
      console.log(`[AgentService] Executing function: ${name} with params:`, 
        typeof parameters === 'object' ? JSON.stringify(parameters) : parameters);
      
      // Special handling for listAllTables when called from Telegram
      if (name === 'listAllTables' && 
          (typeof parameters === 'string' || parameters === null || parameters === undefined)) {
        console.log(`[AgentService] Converting string parameters for listAllTables: "${parameters}"`);
        parameters = { includeSystemTables: false };
      }
      
      const result = await UnifiedFunctionRegistry.executeFunction(
        name,
        parameters,
        { userId, userRole }
      );
      
      console.log(`[AgentService] Function ${name} execution result:`, 
        typeof result === 'object' ? JSON.stringify(result) : result);
      
      return result;
    } catch (error: any) {
      console.error(`[AgentService] Error executing function ${name}:`, error);
      // Return a formatted error response instead of throwing
      return {
        error: error?.message || String(error),
        success: false,
        message: `Error executing function ${name}: ${error?.message || String(error)}`
      };
    }
  }

  /**
   * Get a list of available agent functions
   */
  async getAvailableFunctions(userRole: string = 'user', agentId?: number): Promise<schema.AgentFunction[]> {
    let accessLevels: string[] = ['public'];
    
    // Add role-specific levels based on user role
    if (userRole === 'admin') {
      accessLevels = ['public', 'user', 'manager', 'admin']; // Admin can access everything
    } else if (userRole === 'manager') {
      accessLevels.push('user', 'manager'); // Managers can access user and manager functions
    } else if (userRole === 'user') {
      accessLevels.push('user'); // Users can access user functions
    }
    
    // Initialize an empty array for functions
    // We now use langchain_tools exclusively instead of agent_functions
    const functions = [];

    // If an agent ID is provided, add tools associated with that agent
    if (agentId) {
      console.log(`Getting LangChain tools for agent ID: ${agentId}`);
      try {
        // Get tool associations for this agent
        const toolAssociations = await db
          .select()
          .from(schema.langchainAgentTools)
          .where(eq(schema.langchainAgentTools.agentId, agentId));
        
        if (toolAssociations.length > 0) {
          console.log(`Found ${toolAssociations.length} tool associations for agent ID: ${agentId}`);
          
          // Get the actual tools
          const toolIds = toolAssociations.map(assoc => assoc.toolId);
          console.log(`Fetching tools with IDs: ${toolIds.join(', ')}`);
          
          // Check if we have any tool IDs
          if (toolIds.length === 0) {
            console.log(`No tool associations found for agent ID: ${agentId}`);
            return functions; // Return standard functions
          }
          
          // Use the updated inArray syntax that accepts string array
          const langchainTools = await db
            .select()
            .from(schema.langchainTools)
            .where(and(
              // Use type-safe SQL in operator for IDs
              inArray(schema.langchainTools.id, toolIds),
              eq(schema.langchainTools.enabled, true)
            ));
          
          console.log(`Found ${langchainTools.length} enabled tools for agent ID: ${agentId}`);
          
          // Convert LangChain tools to agent functions format
          const langchainFunctions = langchainTools.map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description || "",
            module: "langchain",
            parameters: tool.parameters || {},
            returnType: "json",
            functionCode: tool.implementation || "",
            accessLevel: "public",
            tags: null
          }));
          
          // Add LangChain tools to available functions
          functions.push(...langchainFunctions);
          console.log(`Total available functions after adding LangChain tools: ${functions.length}`);
        }
      } catch (error) {
        console.error(`Error getting LangChain tools for agent ID ${agentId}:`, error);
      }
    }

    return functions;
  }

  /**
   * Register a new function
   */
  async registerFunction(functionData: Omit<schema.InsertTool, "id">): Promise<schema.Tool> {
    return await UnifiedFunctionRegistry.registerFunction(functionData);
  }

  /**
   * Create a new task for the agent to execute
   */
  async createTask(taskData: any): Promise<schema.AgentTask> {
    // Transform old schema to new schema if necessary
    let insertData: Omit<schema.InsertAgentTask, 'createdAt' | 'updatedAt'>;
    
    // Check if we're using old schema format (with title, description fields)
    if (taskData.title && !taskData.task) {
      insertData = {
        userId: taskData.createdBy,
        agentId: taskData.agentId || null,
        task: taskData.title,
        status: taskData.status || 'pending',
        data: {
          description: taskData.description,
          type: taskData.type,
          priority: taskData.priority || 'medium',
          parameters: taskData.parameters || {},
          scheduledFor: taskData.scheduledFor ? new Date(taskData.scheduledFor).toISOString() : null
        },
        result: null
      };
    } else {
      // Already in new format
      insertData = taskData;
    }
    
    const [task] = await db.insert(schema.agentTasks)
      .values(insertData)
      .returning();
    
    return task;
  }

  /**
   * Update a task's status
   */
  async updateTaskStatus(taskId: number, status: string, result?: any): Promise<schema.AgentTask> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    if (status === 'completed') {
      updateData.completedAt = new Date();
      if (result) {
        updateData.result = result;
      }
    }

    const [updatedTask] = await db.update(schema.agentTasks)
      .set(updateData)
      .where(sql`id = ${taskId}`)
      .returning();
    
    return updatedTask;
  }

  /**
   * Get agent settings
   */
  async getSettings(category?: string): Promise<schema.AgentSetting[]> {
    if (category) {
      return db.query.agentSettings.findMany({
        where: (fields, { eq }) => eq(fields.category, category)
      });
    }
    return db.query.agentSettings.findMany();
  }

  /**
   * Update an agent setting
   */
  async updateSetting(name: string, value: string, userId?: number): Promise<schema.AgentSetting> {
    const [updatedSetting] = await db.update(schema.agentSettings)
      .set({
        value,
        updatedAt: new Date(),
        updatedBy: userId
      })
      .where(sql`name = ${name}`)
      .returning();
    
    return updatedSetting;
  }

  /**
   * Delete a conversation and all its messages
   * @param conversationId ID of the conversation to delete
   * @param userId User requesting the deletion, for authorization
   * @returns Success boolean
   */
  async deleteConversation(conversationId: number, userId: number): Promise<boolean> {
    try {
      console.log(`AgentService: Attempting to delete conversation ${conversationId} for user ${userId}`);
      
      // First check if the conversation exists and belongs to this user
      const conversation = await db.query.agentConversations.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.id, conversationId),
          eq(fields.userId, userId)
        )
      });
      
      if (!conversation) {
        console.log(`Conversation ${conversationId} not found or not owned by user ${userId}`);
        return false;
      }
      
      console.log(`Found conversation with ID ${conversationId} for user ${userId}, deleting associated messages`);
      
      // Delete all messages in the conversation
      const deletedMessages = await db.delete(schema.agentMessages)
        .where(eq(schema.agentMessages.conversationId, conversationId))
        .returning();
      
      console.log(`Deleted ${deletedMessages.length} messages from conversation ${conversationId}`);
      
      // Delete the conversation
      const result = await db.delete(schema.agentConversations)
        .where(eq(schema.agentConversations.id, conversationId))
        .returning();
      
      console.log(`Conversation deletion result: ${result.length > 0 ? 'success' : 'failed'}`);
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return false;
    }
  }
  
  /**
   * Send a notification via Signal
   */
  async sendNotification(recipient: string, message: string, type: string = 'alert'): Promise<schema.SignalNotification> {
    const [notification] = await db.insert(schema.signalNotifications)
      .values({
        recipientNumber: recipient,
        message,
        type,
        status: 'pending'
      })
      .returning();
    
    // In a real implementation, this would actually send the message via Signal API
    // For now, we'll just mark it as sent
    const [sentNotification] = await db.update(schema.signalNotifications)
      .set({
        status: 'sent',
        sentAt: new Date()
      })
      .where(sql`id = ${notification.id}`)
      .returning();
    
    return sentNotification;
  }
  
  /**
   * Schedule a report to be sent at a specific time
   */
  async scheduleReport(
    recipient: string, 
    reportType: string, 
    schedule: string, 
    parameters: any = {}
  ): Promise<schema.AgentTask> {
    // Create a task for the scheduled report
    const task = await this.createTask({
      title: `Scheduled ${reportType} Report`,
      description: `Generate and send a ${reportType} report to ${recipient}`,
      type: 'scheduled_report',
      status: 'scheduled',
      priority: 'medium',
      scheduledFor: new Date(), // This would be calculated based on the schedule
      parameters: {
        reportType,
        recipient,
        schedule,
        parameters
      },
      createdBy: null,
      assignedTo: null
    });
    
    return task;
  }
}