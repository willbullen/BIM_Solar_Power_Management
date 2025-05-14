/**
 * Telegram Integration Service
 * Handles communication with Telegram API and manages Telegram bot interactions
 */

import TelegramBot from 'node-telegram-bot-api';
import type { Message, SendMessageOptions } from 'node-telegram-bot-api';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { telegramUsers, telegramMessages, telegramSettings, agentConversations, agentMessages } from '../../shared/schema';
import { eq, and, desc, isNull, inArray } from 'drizzle-orm/expressions';
import { AgentService } from '../agent-service';
import { randomUUID } from 'crypto';

export class TelegramService {
  private bot: TelegramBot | null = null;
  private agentService: AgentService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.agentService = new AgentService();
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
      
      if (user.length === 0 || !user[0].isVerified || !user[0].telegramId) {
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
    if (this.isInitialized) {
      console.log('Telegram service already initialized');
      return;
    }

    if (this.initializationPromise) {
      console.log('Telegram service initialization already in progress');
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      // Get settings from database
      const settings = await db.select().from(telegramSettings).limit(1);
      
      if (settings.length === 0 || !settings[0].isEnabled) {
        console.log('Telegram integration not enabled or configured');
        return;
      }

      const { botToken, botUsername } = settings[0];
      
      // Skip initialization if using placeholder token
      if (botToken === 'PLACEHOLDER_TOKEN') {
        console.log('Telegram bot using placeholder token, skipping initialization');
        return;
      }

      console.log(`Initializing Telegram bot @${botUsername}...`);
      
      // Create bot instance
      this.bot = new TelegramBot(botToken, { polling: true });
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      console.log('Telegram bot initialized successfully');
      this.isInitialized = true;
    } catch (error) {
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
        const welcomeMessage = `Welcome back to the Emporium Power Monitoring AI Agent!
        
Your account is ${existingUser[0].isVerified ? 'verified' : 'not verified yet'}.
        
${existingUser[0].isVerified ? 'You can ask me questions about power usage, environmental data, or request reports.' : 'Please verify your account using /verify YOUR_CODE to start using the AI Agent.'}`;
        
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
    
    try {
      // Check if verification code is valid
      const pendingVerification = await db.select()
        .from(telegramUsers)
        .where(and(
          eq(telegramUsers.verificationCode, verificationCode),
          eq(telegramUsers.isVerified, false)
        ))
        .limit(1);
      
      if (pendingVerification.length > 0) {
        // Update user record with verification and Telegram details
        await db.update(telegramUsers)
          .set({
            isVerified: true,
            telegramUsername: username,
            telegramFirstName: firstName,
            telegramLastName: lastName,
            chatId: chatId.toString(),
            telegramId: telegramId,
            verificationCode: null,
            updatedAt: new Date(),
            lastAccessed: new Date()
          })
          .where(eq(telegramUsers.id, pendingVerification[0].id));
        
        await this.bot?.sendMessage(chatId, `Your account has been successfully verified! You can now interact with the AI Agent.

Try asking questions about power usage, environmental data, or request reports.`);
      } else {
        // Check if user is already in the system but using a new code
        const existingUser = await db.select()
          .from(telegramUsers)
          .where(eq(telegramUsers.telegramId, telegramId))
          .limit(1);
        
        if (existingUser.length > 0 && existingUser[0].isVerified) {
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
      
      if (user.length === 0 || !user[0].isVerified) {
        await this.bot?.sendMessage(chatId, `You need to verify your account before using the AI Agent. Please use /verify YOUR_CODE to complete verification.`);
        return;
      }
      
      // Update last accessed time
      await db.update(telegramUsers)
        .set({ lastAccessed: new Date() })
        .where(eq(telegramUsers.id, user[0].id));
      
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
      const activeConversation = await db.select()
        .from(agentConversations)
        .where(eq(agentConversations.userId, user[0].userId))
        .orderBy(desc(agentConversations.createdAt))
        .limit(1);
      
      if (activeConversation.length > 0) {
        conversationId = activeConversation[0].id;
      } else {
        // Create a new conversation
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
          aiResponse = await this.agentService.generateResponse(
            conversationId,
            user[0].userId,
            'user',     // Default user role
            1000,       // Default max tokens
            agentId     // Pass the agent ID to use for processing
          );
        } catch (error) {
          // Cast the unknown error to an object with message property
          const generateError = error as { message?: string };
          console.error('Error during AI response generation:', generateError);
          
          // Check for the specific function name parameter error
          if (generateError?.message && generateError.message.includes('Missing parameter \'name\'')) {
            console.error('Function name parameter error detected in Telegram message processing');
            
            // Log additional debugging information
            console.log('Function call error context:', {
              conversationId,
              userId: user[0].userId,
              telegramUserId: user[0].id
            });
            
            // Inform the user with a more specific error message
            await this.bot?.sendMessage(chatId, 
              "I encountered an issue while trying to execute a function. " +
              "This is likely a temporary problem. Please try again with a different request or later."
            );
            return;
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
      // Generate a unique verification code
      const verificationCode = randomUUID().substring(0, 8);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // Code expires in 7 days
      
      // Check if user already has a Telegram account
      const existingUser = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (existingUser.length > 0) {
        // Update existing user
        await db.update(telegramUsers)
          .set({
            verificationCode: verificationCode,
            verificationExpires: expirationDate,
            isVerified: false,
            updatedAt: new Date()
          })
          .where(eq(telegramUsers.id, existingUser[0].id));
      } else {
        // Create new user record with pending verification
        await db.insert(telegramUsers)
          .values({
            userId: userId,
            telegramId: 'pending_verification',
            chatId: 'pending_verification',
            verificationCode: verificationCode,
            verificationExpires: expirationDate,
            isVerified: false,
          });
      }
      
      return verificationCode;
    } catch (error) {
      console.error('Error creating verification code:', error);
      throw error;
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
        .where(and(
          eq(telegramUsers.userId, userId),
          eq(telegramUsers.isVerified, true),
          eq(telegramUsers.notificationsEnabled, true)
        ))
        .limit(1);
      
      if (telegramUser.length === 0) {
        console.log(`No verified Telegram user found for userId ${userId}`);
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
        .where(and(
          eq(telegramUsers.userId, userId),
          eq(telegramUsers.isVerified, true),
          eq(telegramUsers.receiveReports, true)
        ))
        .limit(1);
      
      if (telegramUser.length === 0) {
        console.log(`No verified Telegram user configured for reports for userId ${userId}`);
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
      // Get all verified users
      const verifiedUsers = await db.select()
        .from(telegramUsers)
        .where(eq(telegramUsers.isVerified, true));
      
      let successCount = 0;
      
      // Send message to each user
      for (const user of verifiedUsers) {
        try {
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
      const totalUsers = await db.select({ count: sql`count(*)` })
        .from(telegramUsers)
        .where(eq(telegramUsers.isVerified, true));
      
      const totalMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages);
      
      const inboundMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages)
        .where(eq(telegramMessages.direction, 'inbound'));
      
      const outboundMessages = await db.select({ count: sql`count(*)` })
        .from(telegramMessages)
        .where(eq(telegramMessages.direction, 'outbound'));
      
      return {
        verifiedUsers: totalUsers[0]?.count || 0,
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
      
      // Reinitialize bot if token or status changed
      if (settings.botToken || settings.isEnabled !== undefined) {
        // Stop current bot if exists
        if (this.bot) {
          this.bot.stopPolling();
          this.bot = null;
        }
        
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Reinitialize if enabled
        if (settings.isEnabled !== false) {
          await this.initialize();
        }
      }
    } catch (error) {
      console.error('Error updating Telegram settings:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const telegramService = new TelegramService();