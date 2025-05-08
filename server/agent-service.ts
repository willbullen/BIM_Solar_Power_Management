import OpenAI from "openai";
import { ChatOpenAI } from "@langchain/openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { AIService } from "./ai-service";

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
  async generateResponse(conversationId: number, maxTokens: number = 1000): Promise<schema.AgentMessage> {
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

    try {
      // Call the OpenAI API
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: openaiMessages,
        max_tokens: maxTokens,
      });

      const responseContent = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response at this time.";

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
  async executeFunction(name: string, parameters: any): Promise<any> {
    try {
      // Get the function definition from the database
      const functionDef = await db.query.agentFunctions.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.name, name),
          eq(fields.enabled, true)
        )
      });

      if (!functionDef) {
        throw new Error(`Function ${name} not found or not enabled`);
      }

      // Execute the function (this is a security risk in production - function code should be validated)
      // In a real-world scenario, use a map of predefined functions instead of eval
      const funcCode = functionDef.functionCode;
      const func = new Function('params', 'db', 'schema', 'aiService', funcCode);
      
      // Pass the database and schema to the function for database operations
      return await func(parameters, db, schema, this.aiService);
    } catch (error) {
      console.error(`Error executing function ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a list of available agent functions
   */
  async getAvailableFunctions(accessLevel: string = 'public'): Promise<schema.AgentFunction[]> {
    const functions = await db.query.agentFunctions.findMany({
      where: (fields, { eq, and, or }) => and(
        eq(fields.enabled, true),
        or(
          eq(fields.accessLevel, 'public'),
          eq(fields.accessLevel, accessLevel)
        )
      )
    });

    return functions;
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