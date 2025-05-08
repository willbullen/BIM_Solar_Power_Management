import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { AIService } from "./ai-service";
import { DbUtils } from "./utils/db-utils";
import { FunctionRegistry } from "./utils/function-registry";
import { eq, and, or, asc, desc, sql } from "drizzle-orm";

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
      modelName: "gpt-4", // Default model, can be configured via agent settings
      temperature: 0.7,    // Default temperature, can be configured via agent settings
    });
    
    this.aiService = new AIService(); // Leverage existing AI service for analytics
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
   * Generate a response from the agent
   */
  async generateResponse(
    conversationId: number, 
    userId: number,
    userRole: string,
    maxTokens: number = 1000
  ): Promise<schema.AgentMessage> {
    // Get the conversation history
    const messages = await db.query.agentMessages.findMany({
      where: (fields, { eq }) => eq(fields.conversationId, conversationId),
      orderBy: (fields, { asc }) => [asc(fields.timestamp)],
    });

    // Get conversation context (e.g., current data being analyzed)
    const conversation = await db.query.agentConversations.findFirst({
      where: (fields, { eq }) => eq(fields.id, conversationId),
    });

    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    // Prepare the messages for the OpenAI API
    const openaiMessages = messages.map(msg => ({
      role: msg.role as any,
      content: msg.content,
    }));

    // Get available functions based on user role
    const availableFunctions = await this.getAvailableFunctions(userRole);
    
    // Create function definitions for OpenAI in the expected format
    const functions = availableFunctions.map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));

    try {
      // Call the OpenAI API with function calling capability
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: openaiMessages,
        max_tokens: maxTokens,
        functions: functions.length > 0 ? functions : undefined,
        function_call: functions.length > 0 ? "auto" : undefined,
      });

      const assistantResponse = response.choices[0]?.message;
      
      // Check if the model wants to call a function
      if (assistantResponse?.function_call) {
        const functionName = assistantResponse.function_call.name;
        let functionArgs = {};
        
        try {
          functionArgs = JSON.parse(assistantResponse.function_call.arguments);
        } catch (e) {
          console.error("Failed to parse function arguments:", e);
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
          const functionResult = await FunctionRegistry.executeFunction(
            functionName,
            functionArgs,
            { userId, userRole }
          );
          
          // Save the function result
          await db.update(schema.agentMessages)
            .set({
              functionResult: functionResult
            })
            .where(eq(schema.agentMessages.id, functionCallMessage.id));
          
          // Add the function result as a new message
          await db.insert(schema.agentMessages).values({
            conversationId,
            role: "function",
            content: JSON.stringify(functionResult),
            metadata: { 
              functionName,
              executedAt: new Date()
            }
          });
          
          return functionCallMessage;
        } catch (funcError) {
          console.error(`Function execution error (${functionName}):`, funcError);
          
          // Update the message with the error
          await db.update(schema.agentMessages)
            .set({
              functionResult: { error: String(funcError) }
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
   * Execute an agent function and store the result
   */
  async executeFunction(
    name: string, 
    parameters: any, 
    userId: number, 
    userRole: string
  ): Promise<any> {
    try {
      return await FunctionRegistry.executeFunction(
        name,
        parameters,
        { userId, userRole }
      );
    } catch (error) {
      console.error(`Error executing function ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a list of available agent functions
   */
  async getAvailableFunctions(userRole: string = 'user'): Promise<schema.AgentFunction[]> {
    let accessLevels: string[] = ['public'];
    
    // Add role-specific levels based on user role
    if (userRole === 'admin') {
      accessLevels = ['public', 'user', 'manager', 'admin']; // Admin can access everything
    } else if (userRole === 'manager') {
      accessLevels.push('user', 'manager'); // Managers can access user and manager functions
    } else if (userRole === 'user') {
      accessLevels.push('user'); // Users can access user functions
    }
    
    const functions = await db.query.agentFunctions.findMany({
      where: (fields, { inArray }) => inArray(fields.accessLevel, accessLevels)
    });

    return functions;
  }

  /**
   * Register a new function
   */
  async registerFunction(functionData: Omit<schema.InsertAgentFunction, "id">): Promise<schema.AgentFunction> {
    return await FunctionRegistry.registerFunction(functionData);
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
      dueDate: new Date(), // This would be calculated based on the schedule
      metadata: {
        reportType,
        recipient,
        schedule,
        parameters
      },
      creatorId: null,
      assigneeId: null
    });
    
    return task;
  }
}