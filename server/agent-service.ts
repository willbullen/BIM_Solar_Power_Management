import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { AIService } from "./ai-service";
import { FunctionRegistry } from "./function-registry";
import { DatabaseAccess } from "./database-access";

// Define the core agent capabilities and functions
export class AgentService {
  private openai: OpenAI;
  private model: ChatOpenAI;
  private aiService: AIService;
  private functionRegistry: FunctionRegistry;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "gpt-4", // Default model, can be configured via agent settings
      temperature: 0.7,    // Default temperature, can be configured via agent settings
    });
    
    this.aiService = new AIService(); // Leverage existing AI service for analytics
    this.functionRegistry = new FunctionRegistry(this.aiService);
  }

  /**
   * Create a new conversation with the AI agent
   */
  async createConversation(userId: number, title: string): Promise<schema.AgentConversation> {
    const [conversation] = await db.insert(schema.agentConversations)
      .values({
        userId,
        title,
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
   */
  private async addSystemMessage(conversationId: number): Promise<void> {
    // Get the system prompt from settings
    const systemPromptSetting = await db.query.agentSettings.findFirst({
      where: (fields, { eq }) => eq(fields.name, "agent_system_prompt")
    });

    const systemPrompt = systemPromptSetting?.value || 
      "You are an advanced AI Energy Advisor for Emporium Power Monitoring. Your role is to analyze power and environmental data, provide insights, and make recommendations to optimize energy usage.";

    await db.insert(schema.agentMessages).values({
      conversationId,
      role: "system",
      content: systemPrompt,
      metadata: {}
    });
  }

  /**
   * Add a user message to a conversation
   */
  async addUserMessage(conversationId: number, content: string): Promise<schema.AgentMessage> {
    const [message] = await db.insert(schema.agentMessages)
      .values({
        conversationId,
        role: "user",
        content,
        metadata: {}
      })
      .returning();
    
    return message;
  }

  /**
   * Generate a response from the agent with function calling capabilities
   */
  async generateResponse(conversationId: number, maxTokens: number = 1000): Promise<schema.AgentMessage> {
    // Get the conversation history
    const messages = await db.query.agentMessages.findMany({
      where: (fields, { eq }) => eq(fields.conversationId, conversationId),
      orderBy: (fields, { asc }) => [asc(fields.timestamp)],
    });

    // Get conversation context (e.g., current data being analyzed)
    const conversation = await db.query.agentConversations.findFirst({
      where: (fields, { eq }) => eq(fields.id, conversationId),
      with: {
        user: true
      }
    });

    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    // Get the user's role for function access control
    const userRole = conversation.user?.role || 'public';
    const accessLevel = userRole === 'Admin' ? 'admin' : 
                     userRole === 'Operator' ? 'restricted' : 'public';
    
    // Get available functions for this user's access level
    const availableFunctions = await this.functionRegistry.getAvailableFunctions(accessLevel);
    
    // Format functions for OpenAI function calling
    const functionDefinitions = availableFunctions.map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));

    // Prepare the messages for the OpenAI API
    const openaiMessages = messages.map(msg => ({
      role: msg.role as any,
      content: msg.content,
      // Include any function calls or results from previous messages
      function_call: msg.functionCall ? { name: msg.functionCall.name, arguments: JSON.stringify(msg.functionCall.arguments) } : undefined,
    }));

    try {
      // Model settings from agent configuration
      const modelSettings = await this.getModelSettings();
      
      // Call the OpenAI API with function calling enabled
      const response = await this.openai.chat.completions.create({
        model: modelSettings.model,
        messages: openaiMessages,
        max_tokens: maxTokens,
        temperature: modelSettings.temperature,
        functions: functionDefinitions.length > 0 ? functionDefinitions : undefined,
        function_call: functionDefinitions.length > 0 ? 'auto' : undefined,
      });

      const responseMessage = response.choices[0]?.message;
      const functionCall = responseMessage?.function_call;
      
      // If the model wants to call a function
      if (functionCall && functionCall.name) {
        console.log(`AI attempting to call function: ${functionCall.name}`);
        
        try {
          // Parse the function arguments from string to object
          const functionArgs = JSON.parse(functionCall.arguments || '{}');
          
          // Execute the function
          const functionResult = await this.executeFunction(
            functionCall.name,
            functionArgs,
            userRole
          );
          
          // Save both the function call and result to the database
          const [assistantMessage] = await db.insert(schema.agentMessages)
            .values({
              conversationId,
              role: "assistant",
              content: responseMessage?.content || "",
              functionCall: {
                name: functionCall.name,
                arguments: functionArgs
              },
              functionResponse: functionResult,
              metadata: { 
                completionId: response.id,
                functionExecution: true
              }
            })
            .returning();
          
          // Automatically generate a follow-up response that incorporates the function result
          await this.generateFunctionFollowupResponse(conversationId, assistantMessage);
          
          return assistantMessage;
        } catch (funcError) {
          // Handle function execution error
          console.error(`Error executing function ${functionCall.name}:`, funcError);
          
          // Save the function error to the database
          const [errorMessage] = await db.insert(schema.agentMessages)
            .values({
              conversationId,
              role: "assistant",
              content: responseMessage?.content || "I tried to perform an operation but encountered an error.",
              functionCall: {
                name: functionCall.name,
                arguments: JSON.parse(functionCall.arguments || '{}')
              },
              functionResponse: { error: String(funcError) },
              metadata: { 
                completionId: response.id,
                functionExecutionError: true,
                error: String(funcError)
              }
            })
            .returning();
          
          return errorMessage;
        }
      } else {
        // Normal message without function call
        const responseContent = responseMessage?.content || "I apologize, but I couldn't generate a response at this time.";

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
      
      // Save error response to the database
      const [errorMessage] = await db.insert(schema.agentMessages)
        .values({
          conversationId,
          role: "assistant",
          content: "I'm sorry, but I encountered an error while processing your request. Please try again later.",
          metadata: { error: String(error) }
        })
        .returning();

      return errorMessage;
    }
  }
  
  /**
   * Generate a follow-up response after a function call
   */
  private async generateFunctionFollowupResponse(
    conversationId: number, 
    functionCallMessage: schema.AgentMessage
  ): Promise<schema.AgentMessage | null> {
    try {
      // Get the updated conversation history including the function call and result
      const messages = await db.query.agentMessages.findMany({
        where: (fields, { eq }) => eq(fields.conversationId, conversationId),
        orderBy: (fields, { asc }) => [asc(fields.timestamp)],
      });
      
      // Format messages for OpenAI API
      const openaiMessages = messages.map(msg => {
        const baseMessage: any = {
          role: msg.role as any,
          content: msg.content,
        };
        
        // Add function call information if present
        if (msg.functionCall) {
          baseMessage.function_call = {
            name: msg.functionCall.name,
            arguments: JSON.stringify(msg.functionCall.arguments)
          };
        }
        
        // For the assistant's message with a function call, add the function's result
        if (msg.id === functionCallMessage.id && msg.functionResponse) {
          return [
            baseMessage,
            {
              role: "function",
              name: msg.functionCall?.name,
              content: JSON.stringify(msg.functionResponse)
            }
          ];
        }
        
        return baseMessage;
      });
      
      // Flatten the array (since function results create nested arrays)
      const flattenedMessages = openaiMessages.flat();
      
      // Get model settings
      const modelSettings = await this.getModelSettings();
      
      // Generate a follow-up response that incorporates the function result
      const response = await this.openai.chat.completions.create({
        model: modelSettings.model,
        messages: flattenedMessages,
        temperature: modelSettings.temperature,
      });
      
      const responseContent = response.choices[0]?.message?.content || 
        "I've processed the data but couldn't generate a meaningful interpretation.";
      
      // Save the follow-up response
      const [followupMessage] = await db.insert(schema.agentMessages)
        .values({
          conversationId,
          role: "assistant",
          content: responseContent,
          metadata: { 
            completionId: response.id,
            isFollowup: true,
            functionResultProcessing: true
          }
        })
        .returning();
      
      return followupMessage;
    } catch (error) {
      console.error("Error generating function follow-up response:", error);
      return null;
    }
  }
  
  /**
   * Get model settings from agent configuration
   */
  private async getModelSettings(): Promise<{ model: string, temperature: number }> {
    // Get model settings from the database
    const modelSetting = await db.query.agentSettings.findFirst({
      where: (fields, { eq }) => eq(fields.name, "agent_model")
    });
    
    const temperatureSetting = await db.query.agentSettings.findFirst({
      where: (fields, { eq }) => eq(fields.name, "agent_temperature")
    });
    
    // Default settings if not found in the database
    return {
      model: modelSetting?.value || "gpt-4",
      temperature: temperatureSetting?.value ? parseFloat(temperatureSetting.value) : 0.7
    };
  }

  /**
   * Execute an agent function and store the result
   */
  async executeFunction(name: string, parameters: any, userRole: string = 'public'): Promise<any> {
    try {
      // Use the function registry to execute the function securely
      return await this.functionRegistry.executeFunction(name, parameters, userRole);
    } catch (error) {
      console.error(`Error executing function ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a list of available agent functions
   */
  async getAvailableFunctions(accessLevel: string = 'public'): Promise<schema.AgentFunction[]> {
    // Use the function registry to get available functions
    return await this.functionRegistry.getAvailableFunctions(accessLevel);
  }
  
  /**
   * Create a database access object for the current user
   */
  createDatabaseAccess(userId?: number, userRole: string = 'public'): DatabaseAccess {
    return new DatabaseAccess(userId, userRole);
  }

  /**
   * Create a new task for the agent to execute
   */
  async createTask(taskData: Omit<schema.InsertAgentTask, 'createdAt' | 'updatedAt'>): Promise<schema.AgentTask> {
    const [task] = await db.insert(schema.agentTasks)
      .values(taskData)
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
      .where(({ id }) => id.eq(taskId))
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
      .where(({ name: settingName }) => settingName.eq(name))
      .returning();
    
    return updatedSetting;
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
      .where(({ id }) => id.eq(notification.id))
      .returning();
    
    return sentNotification;
  }
}