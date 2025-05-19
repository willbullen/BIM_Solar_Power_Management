import { db } from './db';
import * as schema from '../shared/schema';
import TelegramBot from 'node-telegram-bot-api';
import { eq } from 'drizzle-orm';

/**
 * Service for managing Telegram bot integration
 */
export class TelegramService {
  private static instance: TelegramService;
  private bot: TelegramBot | null = null;
  private initialized = false;
  private agentService: any; // Will be set with setAgentService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of TelegramService
   */
  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  /**
   * Initialize the Telegram bot with token
   */
  public initialize(token: string): boolean {
    try {
      if (this.bot) {
        console.log('Telegram bot already initialized');
        return true;
      }

      if (!token) {
        console.error('No Telegram bot token provided');
        return false;
      }

      this.bot = new TelegramBot(token, { polling: true });
      this.setupEventHandlers();
      this.initialized = true;
      console.log('Telegram bot initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Telegram bot:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Check if the bot is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && this.bot !== null;
  }

  /**
   * Set the agent service for handling messages
   */
  public setAgentService(agentService: any): void {
    this.agentService = agentService;
    console.log('TelegramService initialized with AgentService');
  }

  /**
   * Send a message to a specific chat
   */
  public async sendMessage(chatId: number | string, text: string): Promise<any> {
    if (!this.isInitialized()) {
      throw new Error('Telegram bot not initialized');
    }

    try {
      return await this.bot!.sendMessage(chatId, text);
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      throw error;
    }
  }

  /**
   * Shutdown the bot
   */
  public shutdown(): void {
    if (this.bot) {
      try {
        // Stop polling
        this.bot.stopPolling();
        this.initialized = false;
        this.bot = null;
        console.log('Telegram bot shutdown successfully');
      } catch (error) {
        console.error('Error shutting down Telegram bot:', error);
      }
    }
  }

  /**
   * Set up event handlers for the bot
   */
  private setupEventHandlers(): void {
    if (!this.bot) return;

    // Handle incoming messages
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text || '';
      
      if (text.startsWith('/start')) {
        await this.handleStartCommand(chatId, msg);
      } else if (text.startsWith('/help')) {
        await this.handleHelpCommand(chatId);
      } else {
        await this.handleRegularMessage(chatId, text, msg);
      }
    });
  }

  /**
   * Handle /start command
   */
  private async handleStartCommand(chatId: number, msg: TelegramBot.Message): Promise<void> {
    try {
      const welcomeMessage = 'Welcome to the LangChain Task Manager Bot! 🤖\n\n' +
        'I can help you manage your tasks and notify you of task status changes. ' +
        'Use /help to see available commands.';
      
      await this.bot!.sendMessage(chatId, welcomeMessage);
      
      // Check if this Telegram user is already registered
      const existingUser = await db
        .select()
        .from(schema.telegramUsers)
        .where(eq(schema.telegramUsers.telegramId, chatId.toString()))
        .limit(1);
      
      if (existingUser.length === 0) {
        // If not registered, send verification instructions
        const verificationMessage = 'To link your account, please get a verification code from the app ' +
          'and send it here with the format: /verify YOUR_CODE';
        
        await this.bot!.sendMessage(chatId, verificationMessage);
      }
    } catch (error) {
      console.error('Error handling start command:', error);
    }
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(chatId: number): Promise<void> {
    try {
      const helpMessage = 'Available commands:\n\n' +
        '/start - Start the bot and get welcome message\n' +
        '/help - Show this help message\n' +
        '/verify CODE - Link your Telegram account to your app account\n' +
        '/tasks - List your current tasks\n' +
        '/status TASK_ID - Check the status of a specific task';
      
      await this.bot!.sendMessage(chatId, helpMessage);
    } catch (error) {
      console.error('Error handling help command:', error);
    }
  }

  /**
   * Handle regular messages (not commands)
   */
  private async handleRegularMessage(chatId: number, text: string, msg: TelegramBot.Message): Promise<void> {
    try {
      // Check if user is verified/linked to an account
      const telegramUser = await db
        .select()
        .from(schema.telegramUsers)
        .where(eq(schema.telegramUsers.telegramId, chatId.toString()))
        .limit(1);
      
      if (telegramUser.length === 0) {
        // User not verified, remind to verify
        await this.bot!.sendMessage(chatId, 'You need to verify your account first. Please use /verify CODE command with the verification code from the app.');
        return;
      }
      
      // User is verified, handle the message with agent if available
      if (this.agentService) {
        // Find the main assistant agent
        const agentId = await this.findMainAssistantAgentId();
        
        if (agentId) {
          const response = await this.processMessageWithAgent(text, telegramUser[0].userId, agentId);
          await this.bot!.sendMessage(chatId, response);
        } else {
          await this.bot!.sendMessage(chatId, "I couldn't process your message because no assistant agent is available.");
        }
      } else {
        await this.bot!.sendMessage(chatId, "I received your message, but I'm not currently configured to process it.");
      }
    } catch (error) {
      console.error('Error handling regular message:', error);
      await this.bot!.sendMessage(chatId, "Sorry, I encountered an error processing your message.");
    }
  }

  /**
   * Find the main assistant agent for processing messages
   */
  private async findMainAssistantAgentId(): Promise<number | null> {
    try {
      console.log('Finding Main Assistant Agent for Telegram message processing');
      
      // Get all agents
      const agents = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.enabled, true));
      
      console.log(`Found ${agents.length} agents`);
      
      // Find the main assistant agent (you might want to add a specific field or tag for this)
      // For now, we'll take the first enabled agent
      if (agents.length > 0) {
        return agents[0].id;
      }
      
      return null;
    } catch (error) {
      console.error('Error finding main assistant agent:', error);
      return null;
    }
  }

  /**
   * Process a message with a specific agent
   */
  private async processMessageWithAgent(message: string, userId: number, agentId: number): Promise<string> {
    try {
      if (!this.agentService) {
        return "Agent service not available";
      }
      
      // Use the agent service to process the message
      // This would typically create a conversation and add the user's message
      
      // For now, return a placeholder response
      return `I received your message: "${message}". This will be processed by an agent soon.`;
    } catch (error) {
      console.error('Error processing message with agent:', error);
      return "Sorry, I encountered an error processing your message with the agent.";
    }
  }
}