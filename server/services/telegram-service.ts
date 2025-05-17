/**
 * Telegram Integration Service
 * Handles communication with Telegram API and manages Telegram bot interactions
 */

import TelegramBot from 'node-telegram-bot-api';
import type { Message, SendMessageOptions } from 'node-telegram-bot-api';
import { randomUUID } from 'crypto';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { 
  telegramUsers, 
  telegramMessages, 
  telegramSettings, 
  agentConversations, 
  agentMessages
} from '../../shared/schema';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm/expressions';
import { AgentService } from '../agent-service';

/**
 * Telegram Service Singleton
 * 
 * Manages the Telegram bot and provides an interface for interacting with the Telegram API.
 * Implemented as a singleton to prevent multiple bot instances.
 */
export class TelegramService {
  private bot: TelegramBot | null = null;
  private agentService!: AgentService; // Using definite assignment assertion
  private _initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private static instance: TelegramService | null = null;
  
  /**
   * Check if the Telegram bot is initialized and running
   * @returns true if the bot is initialized and running
   */
  public get isInitialized(): boolean {
    return this._initialized && this.bot !== null;
  }
  
  public get isActive(): boolean {
    return this._initialized && this.bot !== null;
  }
  
  /**
   * Complete shutdown of the service
   * Public method to allow manual restarts
   */
  public async shutdownService(): Promise<void> {
    console.log('Performing complete Telegram service shutdown...');
    await this.shutdownBot();
    this._initialized = false;
    console.log('Telegram service shutdown completed');
  }
  
  /**
   * Creates a new TelegramService instance or returns the existing one
   */
  constructor() {
    // Singleton pattern
    if (TelegramService.instance) {
      return TelegramService.instance;
    }
    
    // Initialize the AgentService
    this.agentService = new AgentService();
    
    // Set the instance
    TelegramService.instance = this;
    
    // Register shutdown handlers
    process.once('SIGINT', () => this.shutdownBot());
    process.once('SIGTERM', () => this.shutdownBot());
    
    console.log('TelegramService initialized with AgentService');
  }
  
  /**
   * Safely shut down the bot when the process is terminating
   * With added force-cleanup mechanism to ensure complete shutdown
   */
  /**
   * Force terminate any existing bot sessions using direct API call
   * This helps resolve issues with 409 Conflict errors
   */
  private async forceTerminateExternalSessions(botToken: string): Promise<boolean> {
    try {
      console.log('Force terminating any external bot sessions...');
      
      // First, try a more direct approach to terminate sessions - using getUpdates with a specific offset
      try {
        // First clear webhooks to make sure we don't have any active webhooks
        const clearWebhookUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`;
        await fetch(clearWebhookUrl);
        
        // Then use getUpdates with a very high offset to "catch up" and terminate other sessions
        const resetUrl = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&limit=1`;
        await fetch(resetUrl);
        
        // Wait a moment to ensure the above takes effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (directError) {
        console.error('Direct termination method failed, continuing with alternate approach:', directError);
      }
      
      // Create a direct fetch request to delete webhook and drop pending updates (backup approach)
      const webhookUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`;
      const response = await fetch(webhookUrl);
      const result = await response.json();
      
      if (result.ok) {
        console.log('Successfully terminated external sessions via direct API call');
        return true;
      } else {
        console.warn('External session termination response:', result);
        return false;
      }
    } catch (error) {
      console.error('Error terminating external bot sessions:', error);
      return false;
    }
  }

  private async shutdownBot(): Promise<void> {
    console.log('Shutting down Telegram bot...');
    
    if (this.bot) {
      try {
        // First attempt normal shutdown
        await this.bot.stopPolling();
        console.log('Telegram bot polling stopped successfully');
        
        // Add a delay to ensure shutdown completes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force clear any remaining webhooks to prevent conflicts on next start
        try {
          // @ts-ignore - Access private property for cleanup
          if (this.bot._polling) {
            // @ts-ignore
            this.bot._polling = false;
          }
          
          // Clear any event listeners to prevent memory leaks or conflicts
          // Manually remove known event listeners
          try {
            // @ts-ignore - TelegramBot extends EventEmitter but TypeScript doesn't recognize it
            if (typeof this.bot.eventNames === 'function') {
              // @ts-ignore
              const events = this.bot.eventNames();
              for (const event of events) {
                // @ts-ignore
                this.bot.removeAllListeners(event);
              }
            }
          } catch (e) {
            console.log('Could not remove event listeners, continuing anyway');
          }
          
          console.log('Telegram bot instance cleanup complete');
        } catch (hookError) {
          console.error('Error clearing Telegram webhooks/polling:', hookError);
        }
      } catch (error) {
        console.error('Error stopping Telegram bot polling:', error);
      } finally {
        // Always reset these regardless of errors above
        this.bot = null;
        this._initialized = false; // Update internal flag directly instead of using getter
        console.log('Telegram bot reference cleared');
      }
    } else {
      console.log('No active Telegram bot to shut down');
    }
  }
  
  /**
   * Send a message to the user's Telegram account with agent processing
   * 
   * @param userId The ID of the user in the system
   * @param message The message to send
   * @param agentId The ID of the Langchain agent to use for processing
   * @returns Whether the message was sent successfully
   */
  async sendMessageWithAgent(userId: number, message: string, agentId?: number): Promise<boolean> {
    try {
      // Look up the user's Telegram info
      const user = await db.select().from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (user.length === 0 || !user[0].telegramId) {
        console.log('User does not have a Telegram account');
        return false;
      }
      
      // Access verification status from direct column
      const isVerified = user[0].isVerified === true;
      
      if (!isVerified) {
        console.log('User does not have a verified Telegram account');
        return false;
      }
      
      // Create a new conversation or find an existing one
      let conversationId = null;
      const existingConvo = await db.select().from(agentConversations)
        .where(and(
          eq(agentConversations.userId, userId),
          eq(agentConversations.title, 'Telegram Conversation')
        ))
        .limit(1);
      
      if (existingConvo.length > 0) {
        conversationId = existingConvo[0].id;
      } else {
        // Create a new conversation
        const newConversation = await this.agentService.createConversation(
          userId, 
          'Telegram Conversation'
        );
        conversationId = newConversation.id;
      }
      
      // Add user message to conversation
      await this.agentService.addUserMessage(conversationId, message);
      
      // If no agent ID provided, try to find the Main Assistant Agent - USING EXACT APPROACH FROM SETTINGS PAGE
      if (!agentId) {
        try {
          console.log("Finding Main Assistant Agent for Telegram message in sendMessageWithAgent");
          
          // Fetch all agents - mimicking the exact pattern used in the Settings page
          console.log("Fetching all agents to find Main Assistant Agent");
          const agents = await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
          console.log(`Found ${agents.length} agents in database`);
          
          if (agents.length > 0) {
            // Log the names of agents for debugging
            console.log("Agent names:", agents.map(agent => `${agent.name} (ID: ${agent.id})`));
            
            // Use the EXACT SAME APPROACH as the Settings page
            const mainAgent = agents.find(agent => agent.name === 'Main Assistant Agent' && agent.enabled) || agents[0];
            agentId = mainAgent.id;
            
            console.log(`Using agent "${mainAgent.name}" (ID: ${agentId}) for Telegram message`);
          } else {
            console.log('No agents found in the database');
          }
        } catch (error) {
          console.error('Error finding Main Assistant Agent in sendMessageWithAgent:', error);
          
          // Log more detailed information about the error
          if (error instanceof Error) {
            console.error(`Error details: ${error.message}`);
            console.error(`Error stack: ${error.stack}`);
          }
          
          // Continue with default agent
        }
      }
      
      // Generate AI response using the specified Langchain agent
      const aiResponse = await this.agentService.generateResponse(
        conversationId,
        userId,
        'user',
        1000,     // Default max tokens
        agentId   // Use the provided agent ID (or undefined to use default)
      );
      
      // Check if we got a valid response
      if (!aiResponse) {
        console.error('No AI response generated in sendMessageWithAgent');
        return false;
      }
      
      const responseContent = aiResponse.content || "No response content available";
      
      // Store the message in our database
      await db.insert(telegramMessages)
        .values({
          telegramUserId: user[0].id,
          direction: 'outbound',
          messageText: responseContent,
          conversationId: conversationId,
          isProcessed: true,
        });
      
      // Send the AI response back to the user via Telegram
      if (!this.bot) {
        console.error('Telegram bot not initialized');
        return false;
      }
      
      await this.bot.sendMessage(
        user[0].telegramId, 
        responseContent
      );
      
      return true;
    } catch (error) {
      console.error('Error sending message with agent:', error);
      return false;
    }
  }

  /**
   * Initialize the Telegram bot with settings from the database
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      console.log('Telegram service already initialized');
      return;
    }

    if (this.initializationPromise) {
      console.log('Telegram service initialization already in progress');
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _initialize(): Promise<void> {
    try {
      // Ensure any existing bot instance is properly shut down
      await this.shutdownBot();

      // Get token from environment variable first, then fallback to database
      let botToken = process.env.TELEGRAM_BOT_TOKEN;
      let botUsername = '';

      // Get settings from database
      const settings = await db.select().from(telegramSettings).limit(1);
      
      if (settings.length === 0 || !settings[0].isEnabled) {
        console.log('Telegram integration not enabled or configured');
        return;
      }

      // If no environment variable, use the database token
      if (!botToken) {
        console.log('No environment token found, using token from database');
        botToken = settings[0].botToken;
      } else {
        console.log('Using Telegram bot token from environment variable');
      }
      
      botUsername = settings[0].botUsername;
      
      // Skip initialization if using placeholder token
      if (!botToken || botToken === 'PLACEHOLDER_TOKEN' || botToken === '$TELEGRAM_BOT_TOKEN') {
        console.log('Telegram bot using placeholder token, skipping initialization');
        return;
      }

      console.log(`Initializing Telegram bot @${botUsername}...`);
      
      // First, make sure any external sessions are terminated using direct API calls
      await this.forceTerminateExternalSessions(botToken);
      
      // Add a longer delay before creating a new instance to ensure any existing ones are cleaned up
      console.log('Waiting for any existing bot instances to fully terminate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        // Clear any pending updates first to resolve conflict errors
        console.log('Clearing pending updates...');
        const clearUpdatesUrl = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-1`;
        await fetch(clearUpdatesUrl);
        
        // Then use the direct API to clear webhooks - this is critical to prevent 409 conflicts
        console.log('Manually clearing webhooks with direct API call...');
        const webhookUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`;
        const response = await fetch(webhookUrl);
        const result = await response.json();
        
        if (result.ok) {
          console.log('Successfully cleared webhooks via direct API call');
        } else {
          console.warn('Webhook clearing response:', result);
          
          // If webhook clearing fails, it's likely due to an existing session
          // Let's wait longer and try again
          console.log('Webhook clearing unsuccessful, waiting and trying again...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Try one more time
          const retryResponse = await fetch(webhookUrl);
          const retryResult = await retryResponse.json();
          console.log('Webhook retry result:', retryResult);
        }
        
        // Longer delay to ensure full processing before starting a new bot instance
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (webhookError) {
        // Non-critical, just log the error
        console.warn('Could not clear webhooks via direct method:', webhookError);
      }
      
      // Create a new bot instance with improved options for reliability
      this.bot = new TelegramBot(botToken, { 
        polling: {
          interval: 5000, // Poll even less frequently to reduce chances of conflicts
          params: {
            timeout: 10,
            limit: 10,
            allowed_updates: ["message", "callback_query"] // Only get these update types
          }
        }
      });
      
      if (this.bot) {
        // Setup message handlers
        this.setupMessageHandlers();
        console.log('Telegram bot initialized successfully');
        this._initialized = true;
        
        // Handle polling errors properly to prevent crashes
        this.bot.on('polling_error', (error) => {
          console.error('Telegram polling error:', error);
          
          // If we get a conflict error, implement a more robust recovery strategy
          if (error.message && error.message.includes('terminated by other getUpdates request')) {
            console.log('Detected conflict with another bot instance, attempting enhanced recovery...');
            
            // Get the token for force termination
            db.select().from(telegramSettings).limit(1).then(settings => {
              if (settings.length > 0 && settings[0].botToken) {
                const { botToken } = settings[0];
                
                // First force terminate any external sessions
                this.forceTerminateExternalSessions(botToken)
                  .then(success => {
                    console.log('Force termination result:', success ? 'success' : 'failed');
                    
                    // Then attempt to restart our bot after a delay regardless of force termination result
                    setTimeout(async () => {
                      try {
                        // Fully shut down first
                        await this.shutdownBot();
                        console.log('Reinitializing Telegram bot after conflict...');
                        
                        // Wait a bit longer before reinitializing
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        
                        // Another force termination attempt just before reinitialization
                        await this.forceTerminateExternalSessions(botToken);
                        
                        // Then initialize again
                        this._initialize().catch(e => console.error('Failed to reinitialize after conflict:', e));
                      } catch (e) {
                        console.error('Error in conflict recovery:', e);
                      }
                    }, 15000); // Wait 15 seconds before trying again - longer delay for better recovery
                  });
              }
            }).catch(err => {
              console.error('Error getting bot token for recovery:', err);
            });
          }
        });
      } else {
        throw new Error('Failed to create Telegram bot instance');
      }
    } catch (error) {
      this._initialized = false;
      this.bot = null;
      console.error('Error initializing Telegram bot:', error);
      throw error;
    }
  }

  /**
   * Setup message handlers for the Telegram bot
   */
  private setupMessageHandlers(): void {
    if (!this.bot) {
      console.error('Cannot setup message handlers: Bot not initialized');
      return;
    }

    // Handle /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.handleStartCommand(msg);
    });

    // Handle /verify command with verification code
    this.bot.onText(/\/verify (.+)/, async (msg, match) => {
      if (!match || match.length < 2) {
        await this.bot?.sendMessage(msg.chat.id, 'Invalid verification code format. Please use /verify YOUR_CODE');
        return;
      }
      const verificationCode = match[1];
      await this.handleVerification(msg, verificationCode);
    });

    // Handle all messages
    this.bot.on('message', async (msg) => {
      // Skip commands, they're handled separately
      if (msg.text && msg.text.startsWith('/')) {
        return;
      }
      
      await this.handleIncomingMessage(msg);
    });
  }

  /**
   * Handle the /start command
   */
  private async handleStartCommand(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString() || '';
    
    try {
      // Check if user is already registered
      const existingUser = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.telegramId, telegramId))
        .limit(1);
      
      if (existingUser.length > 0) {
        // User exists, send welcome back message
        // Use direct SQL query to get the is_verified value from database
        const verifiedQuery = `
          SELECT is_verified FROM langchain_telegram_users 
          WHERE telegram_id = $1
          LIMIT 1
        `;
        const verifiedResult = await pool.query(verifiedQuery, [telegramId]);
        const isVerified = verifiedResult.rows.length > 0 && verifiedResult.rows[0].is_verified === true;
        
        const welcomeMessage = `Welcome back to the Emporium Power Monitoring AI Agent!
        
Your account is ${isVerified ? 'verified' : 'not verified yet'}.
        
${isVerified ? 'You can ask me questions about power usage, environmental data, or request reports.' : 'Please verify your account using /verify YOUR_CODE to start using the AI Agent.'}`;
        
        await this.bot?.sendMessage(chatId, welcomeMessage);
      } else {
        // New user, send welcome message
        const welcomeMessage = `Welcome to the Emporium Power Monitoring AI Agent!
        
I can help you monitor and analyze power usage, environmental data, and generate reports.
        
To get started, you need to verify your account. Please ask your system administrator for a verification code, then use:
/verify YOUR_CODE`;
        
        await this.bot?.sendMessage(chatId, welcomeMessage);
      }
    } catch (error) {
      console.error('Error handling start command:', error);
      await this.bot?.sendMessage(chatId, 'Sorry, there was an error processing your request. Please try again later.');
    }
  }

  /**
   * Handle account verification process
   */
  private async handleVerification(msg: Message, verificationCode: string): Promise<void> {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString() || '';
    const username = msg.from?.username || '';
    const firstName = msg.from?.first_name || '';
    const lastName = msg.from?.last_name || '';
    const languageCode = msg.from?.language_code || 'en';
    
    console.log(`Processing verification for code: ${verificationCode}`);
    
    try {
      // Use direct SQL to find user with matching verification code
      // This avoids the schema issues with the metadata column
      const pendingVerificationQuery = `
        SELECT * FROM langchain_telegram_users
        WHERE verification_code = $1
        AND is_verified = FALSE
        LIMIT 1
      `;
      const pendingVerificationResult = await pool.query(pendingVerificationQuery, [verificationCode]);
      
      console.log(`Found ${pendingVerificationResult.rows.length} users with matching verification code`);
      
      if (pendingVerificationResult.rows.length > 0) {
        const user = pendingVerificationResult.rows[0];
        console.log(`Verifying user with ID ${user.id} and code ${verificationCode}`);
        
        // Update user record directly with SQL to avoid schema issues
        const updateVerificationQuery = `
          UPDATE langchain_telegram_users
          SET is_verified = TRUE,
              verification_code = NULL,
              chat_id = $1,
              telegram_id = $2, 
              telegram_username = $3,
              telegram_first_name = $4,
              telegram_last_name = $5,
              language_code = $6,
              notifications_enabled = TRUE,
              receive_alerts = TRUE,
              receive_reports = TRUE,
              last_accessed = NOW(),
              updated_at = NOW()
          WHERE id = $7
        `;
        
        await pool.query(updateVerificationQuery, [
          chatId.toString(),
          telegramId,
          username,
          firstName,
          lastName,
          languageCode,
          user.id
        ]);
        
        await this.bot?.sendMessage(chatId, `Your account has been successfully verified! You can now interact with the AI Agent.

Try asking questions about power usage, environmental data, or request reports.`);
      } else {
        // Check if user is already verified in the system using this Telegram ID
        const existingUserQuery = `
          SELECT * FROM langchain_telegram_users
          WHERE telegram_id = $1
          AND is_verified = TRUE
          LIMIT 1
        `;
        const existingUserResult = await pool.query(existingUserQuery, [telegramId]);
        
        if (existingUserResult.rows.length > 0) {
          await this.bot?.sendMessage(chatId, `Your account is already verified. You can continue using the AI Agent.`);
        } else {
          await this.bot?.sendMessage(chatId, `Invalid or expired verification code. Please contact your system administrator for a valid code.`);
        }
      }
    } catch (error) {
      console.error('Error handling verification:', error);
      await this.bot?.sendMessage(chatId, 'Sorry, there was an error processing your verification. Please try again later.');
    }
  }

  /**
   * Handle incoming messages from Telegram users
   */
  private async handleIncomingMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const telegramId = msg.from?.id.toString() || '';
    const messageText = msg.text || '';
    
    if (!messageText) return; // Skip non-text messages
    
    try {
      // Check if user is verified
      const user = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.telegramId, telegramId))
        .limit(1);
      
      if (user.length === 0) {
        await this.bot?.sendMessage(chatId, `You need to verify your account before using the AI Agent. Please use /verify YOUR_CODE to complete verification.`);
        return;
      }
      
      // Check if user is verified using direct SQL query
      const verifiedCheckQuery = `
        SELECT is_verified FROM langchain_telegram_users
        WHERE id = $1
        LIMIT 1
      `;
      const verifiedResult = await pool.query(verifiedCheckQuery, [user[0].id]);
      
      if (!verifiedResult.rows.length || verifiedResult.rows[0].is_verified !== true) {
        await this.bot?.sendMessage(chatId, `You need to verify your account before using the AI Agent. Please use /verify YOUR_CODE to complete verification.`);
        return;
      }
      
      // Update last accessed time directly
      await db.execute(sql`
        UPDATE langchain_telegram_users
        SET last_accessed = NOW(),
            updated_at = NOW()
        WHERE id = ${user[0].id}
      `);
      
      // Store the incoming message
      const storedMessage = await db.insert(telegramMessages)
        .values({
          telegramUserId: user[0].id,
          direction: 'inbound',
          messageText: messageText,
          messageId: msg.message_id.toString(),
          isProcessed: false,
        })
        .returning();
      
      // Find or create a conversation for this user
      let conversationId: number;
      
      // Use direct SQL to get the user_id field
      const userQuery = `
        SELECT user_id FROM langchain_telegram_users
        WHERE id = $1
        LIMIT 1
      `;
      const userResult = await pool.query(userQuery, [user[0].id]);
      const userId = userResult.rows.length > 0 ? userResult.rows[0].user_id : null;
      
      // Find active conversation for this user
      const activeConversation = await db.select()
        .from(agentConversations)
        .where(userId ? eq(agentConversations.userId, userId) : sql`false`)
        .orderBy(desc(agentConversations.createdAt))
        .limit(1);
      
      if (activeConversation.length > 0) {
        conversationId = activeConversation[0].id;
      } else {
        // Create a new conversation
        // Only create a conversation if there's a userId
        if (!user[0].userId) {
          throw new Error('Cannot create conversation for Telegram user without associated system user ID');
        }
        
        const newConversation = await this.agentService.createConversation(
          user[0].userId, 
          'Telegram Conversation'
        );
        conversationId = newConversation.id;
      }
      
      // Update the message with conversation ID
      await db.update(telegramMessages)
        .set({ conversationId: conversationId })
        .where(eq(telegramMessages.id, storedMessage[0].id));
      
      // Send message to AI Agent
      await this.bot?.sendMessage(chatId, 'Processing your message...');
      
      const userMessage = await this.agentService.addUserMessage(
        conversationId,
        messageText
      );
      
      // Find the Main Assistant Agent - USING EXACT APPROACH FROM SETTINGS PAGE
      let agentId: number | undefined;
      try {
        console.log("Finding Main Assistant Agent for Telegram message processing");
        
        // Fetch all agents - mimicking the exact pattern used in the Settings page
        console.log("Fetching all agents to find Main Assistant Agent");
        const agents = await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
        console.log(`Found ${agents.length} agents in database`);
        
        if (agents.length > 0) {
          // Log the names of agents for debugging
          console.log("Agent names:", agents.map(agent => `${agent.name} (ID: ${agent.id})`));
          
          // Use the EXACT SAME APPROACH as the Settings page
          const mainAgent = agents.find(agent => agent.name === 'Main Assistant Agent' && agent.enabled) || agents[0];
          agentId = mainAgent.id;
          
          console.log(`Using agent "${mainAgent.name}" (ID: ${agentId}) for Telegram message processing`);
        } else {
          console.log('No agents found in the database');
          agentId = undefined; // Will use default agent in agent-service.ts
        }
      } catch (error) {
        console.error("Error finding agent for Telegram incoming message:", error);
        
        // Log more detailed information about the error
        if (error instanceof Error) {
          console.error(`Error details: ${error.message}`);
          console.error(`Error stack: ${error.stack}`);
        }
        
        agentId = undefined; // Will use default agent in agent-service.ts
      }
      
      // Check for special commands
      if (messageText.toLowerCase().startsWith("use agent")) {
        const parts = messageText.split(/\s+/);
        if (parts.length >= 3) {
          const agentName = parts.slice(2).join(" ");
          try {
            // Find agent by name
            const matchingAgents = await db.select()
              .from(schema.langchainAgents)
              .where(sql`name ILIKE ${`%${agentName}%`} AND enabled = true`)
              .limit(1);
              
            if (matchingAgents.length > 0) {
              agentId = matchingAgents[0].id;
              await this.bot?.sendMessage(chatId, `Switching to ${matchingAgents[0].name} for this conversation.`);
              return; // Exit early as this was just a command to switch agents
            } else {
              await this.bot?.sendMessage(chatId, `No enabled agent found matching "${agentName}". Using default agent.`);
            }
          } catch (error) {
            console.error("Error switching agents:", error);
          }
        }
      }
      
      try {
        console.log(`Generating AI response for Telegram - Conversation: ${conversationId}, User: ${user[0].userId}, Agent: ${agentId || 'default'}`);
        
        // Generate AI response using the selected Langchain agent
        // Add extensive try/catch to properly handle function call-related errors
        let aiResponse;
        try {
          // Verify that both user ID and agentService are available
          if (!user[0].userId) {
            console.error('Cannot generate response for Telegram user without associated system user ID');
            await this.bot?.sendMessage(chatId, 
              "Your Telegram account is verified but not properly linked to a system user. " +
              "Please contact your administrator for assistance."
            );
            return;
          }
          
          // Double check that the agentService is initialized
          if (!this.agentService) {
            console.error('AgentService not initialized in TelegramService');
            this.agentService = new AgentService(); // Try to recover by creating a new instance
          }
          
          // Log which agent we're using for debugging
          console.log(`Using agent ID ${agentId || 'default'} for Telegram message processing`);
          
          aiResponse = await this.agentService.generateResponse(
            conversationId,
            user[0].userId, 
            'user',     // Default user role
            1000,       // Default max tokens
            agentId     // Pass the agent ID to use for processing
          );
          
          console.log('AI response generation completed successfully');
        } catch (error) {
          // Cast the unknown error to an object with message property
          const generateError = error as { message?: string, stack?: string };
          console.error('Error during AI response generation:', generateError.message);
          console.error('Error stack:', generateError.stack);
          
          // Add detailed debugging
          console.log('Error context:', {
            conversationId,
            userId: user[0].userId,
            telegramUserId: user[0].id,
            hasAgentService: !!this.agentService,
            agentId
          });
          
          // Check for specific errors and handle them gracefully
          if (generateError?.message) {
            if (generateError.message.includes('Missing parameter \'name\'')) {
              console.error('Function name parameter error detected in Telegram message processing');
              await this.bot?.sendMessage(chatId, 
                "I encountered an issue while trying to execute a function. " +
                "This is likely a temporary problem. Please try again with a different request or later."
              );
              return;
            } else if (generateError.message.includes('Cannot read properties of undefined') || 
                       generateError.message.includes('is not a function')) {
              console.error('Object property access error in agent processing');
              await this.bot?.sendMessage(chatId, 
                "I'm having trouble accessing some of my capabilities at the moment. " +
                "Please try a simpler request or try again later."
              );
              return;
            }
          }
          
          // Re-throw for general error handling
          throw generateError;
        }
        
        // Verify AI response
        if (!aiResponse) {
          console.error('No AI response generated for Telegram message');
          await this.bot?.sendMessage(chatId, "I'm sorry, but I encountered an error processing your message. Please try again later.");
          return;
        }
        
        console.log(`Received AI response for Telegram: "${aiResponse.content?.substring(0, 100)}..."`);
        
        
        // Store outbound message
        await db.insert(telegramMessages)
          .values({
            telegramUserId: user[0].id,
            direction: 'outbound',
            messageText: aiResponse.content || "No response content",
            conversationId: conversationId,
            isProcessed: true,
          });
        
        // Send AI response back to user
        await this.bot?.sendMessage(chatId, aiResponse.content || "I processed your message but couldn't generate a proper response. Please try again.");
      } catch (responseError) {
        console.error('Error generating AI response:', responseError);
        await this.bot?.sendMessage(chatId, "I apologize, but I encountered an error while processing your request. Please try again later.");
        return;
      }
      
      // Mark the inbound message as processed
      await db.update(telegramMessages)
        .set({ isProcessed: true })
        .where(eq(telegramMessages.id, storedMessage[0].id));
      
    } catch (error) {
      console.error('Error handling incoming message:', error);
      await this.bot?.sendMessage(chatId, 'Sorry, there was an error processing your message. Please try again later.');
    }
  }

  /**
   * Create a verification code for a user
   */
  async createVerificationCode(userId: number): Promise<string> {
    try {
      console.log(`Generating verification code for user ID: ${userId}`);
      
      // Generate a unique verification code
      const verificationCode = randomUUID().substring(0, 8);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // Code expires in 7 days
      
      console.log(`Generated verification code: ${verificationCode}, expires: ${expirationDate.toISOString()}`);
      
      // Check if user already has a Telegram entry using direct SQL query
      // This avoids any schema mismatch issues with the metadata column
      const existingUserQuery = `
        SELECT id FROM langchain_telegram_users 
        WHERE user_id = $1
        LIMIT 1
      `;
      const existingUser = await pool.query(existingUserQuery, [userId]);
      
      if (existingUser.rows.length === 0) {
        // No existing record, create a new one
        console.log('No existing Telegram user entry, creating a new one with verification code');
        const insertQuery = `
          INSERT INTO langchain_telegram_users (
            user_id, telegram_id, first_name, chat_id,
            verification_code, verification_expires, is_verified,
            notifications_enabled, receive_alerts, receive_reports,
            created_at, updated_at, username
          ) VALUES (
            $1, 'pending_verification', 'Pending Verification', '0',
            $2, $3, FALSE,
            TRUE, TRUE, TRUE,
            NOW(), NOW(), 'pending'
          )
        `;
        await pool.query(insertQuery, [userId, verificationCode, expirationDate]);
        console.log('Successfully created new user record with verification code');
      } else {
        // Update existing record
        console.log('Updating existing Telegram user record with new verification code');
        const updateQuery = `
          UPDATE langchain_telegram_users
          SET verification_code = $1,
              verification_expires = $2,
              is_verified = FALSE,
              updated_at = NOW()
          WHERE user_id = $3
        `;
        await pool.query(updateQuery, [verificationCode, expirationDate, userId]);
        console.log('Successfully updated existing user record with new verification code');
      }
      
      console.log('Verification code generated successfully:', verificationCode);
      return verificationCode;
    } catch (error) {
      console.error('Error creating verification code:', error);
      console.error('Error details:', String(error));
      // Convert error to a cleaner format for the client
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate verification code: ${errorMessage}`);
    }
  }

  /**
   * Send a notification to a user via Telegram
   */
  async sendNotification(userId: number, message: string, title?: string): Promise<boolean> {
    if (!this.isInitialized || !this.bot) {
      console.warn('Telegram bot not initialized, cannot send notification');
      return false;
    }
    
    try {
      // Find user's Telegram details
      const telegramUser = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (telegramUser.length === 0) {
        console.log(`No Telegram user found for userId ${userId}`);
        return false;
      }
      
      // Check direct columns for verification and notification preferences
      if (!telegramUser[0].isVerified || telegramUser[0].notificationsEnabled === false) {
        console.log(`Telegram user for userId ${userId} is not verified or has notifications disabled`);
        return false;
      }
      
      if (!telegramUser[0].chatId) {
        console.log(`No chat ID found for Telegram user (userId ${userId})`);
        return false;
      }
      
      const fullMessage = title ? `${title}\n\n${message}` : message;
      
      // Send message to user
      await this.bot.sendMessage(telegramUser[0].chatId, fullMessage);
      
      // Store outbound message
      await db.insert(telegramMessages)
        .values({
          telegramUserId: telegramUser[0].id,
          direction: 'outbound',
          messageText: fullMessage,
          isProcessed: true,
        });
      
      return true;
    } catch (error) {
      console.error('Error sending Telegram notification:', error);
      return false;
    }
  }

  /**
   * Send a scheduled report to a user via Telegram
   */
  async sendReport(userId: number, reportTitle: string, reportContent: string): Promise<boolean> {
    if (!this.isInitialized || !this.bot) {
      console.warn('Telegram bot not initialized, cannot send report');
      return false;
    }
    
    try {
      // Find user's Telegram details
      const telegramUser = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (telegramUser.length === 0) {
        console.log(`No Telegram user found for userId ${userId}`);
        return false;
      }
      
      // Using raw database column names (snake_case)
      // We need a direct query to access the database fields correctly
      const userDetails = await pool.query(`
        SELECT is_verified, receive_reports 
        FROM langchain_telegram_users 
        WHERE user_id = $1 
        LIMIT 1
      `, [userId]);
      
      if (userDetails.rows.length === 0 || !userDetails.rows[0].is_verified || userDetails.rows[0].receive_reports === false) {
        console.log(`Telegram user for userId ${userId} is not verified or has reports disabled`);
        return false;
      }
      
      if (!telegramUser[0].chatId) {
        console.log(`No chat ID found for Telegram user (userId ${userId})`);
        return false;
      }
      
      // Prepare report message
      const reportMessage = `📊 ${reportTitle}\n\n${reportContent}`;
      
      // Send message to user
      await this.bot.sendMessage(telegramUser[0].chatId, reportMessage);
      
      // Store outbound message
      await db.insert(telegramMessages)
        .values({
          telegramUserId: telegramUser[0].id,
          direction: 'outbound',
          messageText: reportMessage,
          isProcessed: true,
        });
      
      return true;
    } catch (error) {
      console.error('Error sending Telegram report:', error);
      return false;
    }
  }

  /**
   * Broadcast a message to all verified users
   */
  async broadcastMessage(message: string, adminUserId: number): Promise<number> {
    if (!this.isInitialized || !this.bot) {
      console.warn('Telegram bot not initialized, cannot broadcast message');
      return 0;
    }
    
    try {
      // Get all users - we'll filter for verified in the loop
      const allUsers = await db.select()
        .from(telegramUsers);
      
      let successCount = 0;
      
      // Send message to each verified user
      for (const user of allUsers) {
        try {
          // Check direct columns for verification
          if (!user.isVerified || !user.chatId) {
            // Skip users who are not verified or don't have a chat ID
            continue;
          }
          
          await this.bot.sendMessage(user.chatId, message);
          
          // Store outbound message
          await db.insert(telegramMessages)
            .values({
              telegramUserId: user.id,
              direction: 'outbound',
              messageText: message,
              isProcessed: true,
            });
          
          successCount++;
        } catch (error) {
          console.error(`Error sending broadcast to user ${user.id}:`, error);
        }
      }
      
      return successCount;
    } catch (error) {
      console.error('Error broadcasting message:', error);
      return 0;
    }
  }

  /**
   * Get statistics about Telegram usage
   */
  async getStatistics(): Promise<any> {
    try {
      // For verified users, use the direct isVerified column
      // First get all users
      const allUsers = await db.select().from(telegramUsers);
      
      // Count users with isVerified = true
      const verifiedUsersCount = allUsers.filter(user => 
        user.isVerified === true
      ).length;
      
      const totalMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages);
      
      const inboundMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages)
        .where(eq(telegramMessages.direction, 'inbound'));
      
      const outboundMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages)
        .where(eq(telegramMessages.direction, 'outbound'));
      
      return {
        verifiedUsers: verifiedUsersCount,
        totalMessages: totalMessages[0]?.count || 0,
        inboundMessages: inboundMessages[0]?.count || 0,
        outboundMessages: outboundMessages[0]?.count || 0,
        botStatus: this.isInitialized ? 'Active' : 'Inactive'
      };
    } catch (error) {
      console.error('Error getting Telegram statistics:', error);
      throw error;
    }
  }

  /**
   * Update Telegram bot settings
   */
  async updateSettings(settings: { 
    botToken?: string, 
    botUsername?: string, 
    webhookUrl?: string | null, 
    isEnabled?: boolean
  }): Promise<void> {
    try {
      // Ensure any existing bot is properly stopped
      if (this.bot) {
        console.log('Stopping existing Telegram bot before settings update');
        try {
          this.bot.stopPolling();
          this.bot = null;
          // Short delay to ensure cleanup is complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (cleanupError) {
          console.error('Error stopping existing bot:', cleanupError);
        }
      }
      
      // Reset initialization state
      this._initialized = false;
      this.initializationPromise = null;
      
      // Get current settings
      const currentSettings = await db.select().from(telegramSettings).limit(1);
      
      if (currentSettings.length === 0) {
        throw new Error('Telegram settings not found');
      }
      
      // Update settings
      await db.update(telegramSettings)
        .set({
          botToken: settings.botToken || currentSettings[0].botToken,
          botUsername: settings.botUsername || currentSettings[0].botUsername,
          webhookUrl: settings.webhookUrl !== undefined ? settings.webhookUrl : currentSettings[0].webhookUrl,
          isEnabled: settings.isEnabled !== undefined ? settings.isEnabled : currentSettings[0].isEnabled,
          updatedAt: new Date()
        })
        .where(eq(telegramSettings.id, currentSettings[0].id));
      
      console.log('Telegram settings updated successfully');
      
      // Reinitialize bot with updated settings if enabled
      if ((settings.isEnabled === undefined && currentSettings[0].isEnabled) || 
          settings.isEnabled === true) {
        console.log('Reinitializing Telegram bot with updated settings');
        // Short delay before reinitializing
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.initialize();
      }
    } catch (error) {
      console.error('Error updating Telegram settings:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const telegramService = new TelegramService();