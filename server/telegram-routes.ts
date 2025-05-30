/**
 * Routes for Telegram integration
 */

import { Express, Request, Response } from 'express';
import { telegramService } from './services/telegram-service';
import { db, pool } from './db';
import * as schema from '../shared/schema';
import { 
  telegramSettings, 
  telegramUsers, 
  telegramMessages 
} from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm/expressions';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

// Express session with user ID
declare module 'express-session' {
  interface Session {
    userId?: number;
    userRole?: string;
  }
}

/**
 * Authentication middleware
 */
function requireAuth(req: Request, res: Response, next: any) {
  if (req.session?.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
}

/**
 * Admin role middleware
 */
function requireAdmin(req: Request, res: Response, next: any) {
  if (req.session?.userRole === 'Admin') {
    next();
  } else {
    res.status(403).json({ error: 'Unauthorized, admin access required' });
  }
}

/**
 * Register Telegram routes
 */
export function registerTelegramRoutes(app: Express) {
  // Initialize Telegram service on application startup
  telegramService.initialize().catch(error => {
    console.error('Failed to initialize Telegram service:', error);
  });
  
  /**
   * Get the bot username for UI display
   * This endpoint is public (no auth) as it's needed for the connection setup screen
   */
  app.get('/api/telegram/bot-info', async (req: Request, res: Response) => {
    try {
      const settings = await db.select().from(telegramSettings).limit(1);
      
      if (!settings || settings.length === 0) {
        console.log('No Telegram bot settings found, returning default username');
        return res.json({ botUsername: 'telegrambot' });
      }
      
      console.log('Returning bot username:', settings[0].botUsername);
      res.json({ 
        botUsername: settings[0].botUsername,
        isEnabled: settings[0].isEnabled
      });
    } catch (error) {
      console.error('Error fetching Telegram bot info:', error);
      // Return a default value even on error to prevent the UI from breaking
      res.json({ botUsername: 'telegrambot', isEnabled: false });
    }
  });

  /**
   * Get Telegram settings
   */
  app.get('/api/telegram/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await db.select().from(telegramSettings).limit(1);
      
      if (settings.length === 0) {
        return res.status(404).json({ error: 'Telegram settings not found' });
      }
      
      // Mask the bot token for security
      const { botToken, ...safeSettings } = settings[0];
      const maskedSettings = {
        ...safeSettings,
        botToken: botToken ? '•'.repeat(Math.min(botToken.length, 8)) : null,
        hasToken: !!botToken && botToken !== 'PLACEHOLDER_TOKEN'
      };
      
      res.json(maskedSettings);
    } catch (error) {
      console.error('Error fetching Telegram settings:', error);
      res.status(500).json({ error: 'Failed to fetch Telegram settings' });
    }
  });

  /**
   * Update Telegram settings
   */
  app.patch('/api/telegram/settings', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const updateSchema = z.object({
        botToken: z.string().optional(),
        botUsername: z.string().optional(),
        webhookUrl: z.string().nullable().optional(),
        isEnabled: z.boolean().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      // Create update data
      const updateData = {
        ...validatedData
        // updatedBy field removed as it doesn't exist in the schema
      };
      
      await telegramService.updateSettings(updateData);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating Telegram settings:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update Telegram settings' });
      }
    }
  });

  /**
   * Generate verification code for Telegram integration
   */
  app.post('/api/telegram/generate-code', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const verificationCode = await telegramService.createVerificationCode(userId);
      
      res.json({ 
        verificationCode,
        instructions: `To connect Telegram to your account, send the following message to our Telegram bot:\n\n/verify ${verificationCode}`
      });
    } catch (error) {
      console.error('Error generating verification code:', error);
      res.status(500).json({ error: 'Failed to generate verification code' });
    }
  });
  
  /**
   * Generate verification code for Telegram integration (alternate endpoint)
   * This endpoint exists to match the client-side API call
   */
  app.post('/api/telegram/verify', requireAuth, async (req: Request, res: Response) => {
    try {
      console.log('Generating verification code for user');
      const userId = req.session.userId!;
      console.log('User ID from session:', userId);
      
      // Check if we have a valid user ID
      if (!userId) {
        console.error('Missing user ID in session');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      console.log('Starting verification code generation');
      const verificationCode = await telegramService.createVerificationCode(userId);
      console.log('Generated verification code:', verificationCode);
      
      // Use direct SQL to get the bot username from the langchain_telegram_settings table
      // This avoids any schema mismatch issues with metadata column
      const settingsQuery = `
        SELECT bot_username FROM langchain_telegram_settings LIMIT 1
      `;
      const settingsResult = await pool.query(settingsQuery);
      const botUsername = settingsResult.rows.length > 0 ? settingsResult.rows[0].bot_username : 'envirobot';
      
      const response = { 
        verificationCode,
        botUsername,
        instructions: `To connect Telegram to your account, send the following message to our Telegram bot @${botUsername}:\n\n/verify ${verificationCode}`
      };
      
      console.log('Sending verification response:', JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error('Error generating verification code:', error);
      res.status(500).json({ error: 'Failed to generate verification code', details: String(error) });
    }
  });

  /**
   * Get user's Telegram connection status
   */
  app.get('/api/telegram/status', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get user ID from session or headers
      const userId = req.session?.userId || 
        (req.headers['x-auth-user-id'] ? parseInt(req.headers['x-auth-user-id'] as string) : undefined);
      
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Use raw SQL to avoid schema inconsistencies
      const result = await db.execute(sql`
        SELECT 
          id, user_id, telegram_id, username, first_name, last_name,
          is_verified, verification_code, verification_expires,
          notifications_enabled, receive_alerts, receive_reports
        FROM langchain_telegram_users
        WHERE user_id = ${userId}
        LIMIT 1
      `);
      
      if (result.rows.length === 0) {
        return res.json({ 
          connected: false,
          status: 'Not connected',
          botActive: telegramService.isActive
        });
      }
      
      const user = result.rows[0];
      // Safely handle boolean columns with explicit check for the database column names
      const isVerified = user.is_verified === true;
      const notificationsEnabled = user.notifications_enabled !== false;
      
      let status = isVerified ? 'Connected and verified' : 'Connected';
      if (user.verification_code) {
        status = 'Pending verification';
      }
      
      res.json({
        connected: isVerified,
        status,
        notificationsEnabled,
        receiveAlerts: user.receive_alerts !== false,
        receiveReports: user.receive_reports !== false,
        telegramUsername: user.username,
        verificationCode: user.verification_code,
        verificationExpires: user.verification_expires,
        botActive: telegramService.isActive
      });
    } catch (error) {
      console.error('Error fetching Telegram status:', error);
      res.status(500).json({ error: 'Failed to fetch Telegram status' });
    }
  });
  
  /**
   * Restart the Telegram bot service
   * This helps recover from conflicts and issues without restarting the entire application
   */
  app.post('/api/telegram/restart-bot', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      console.log('Manual restart of Telegram bot requested');
      
      // Force shutdown and clear any existing sessions
      await telegramService.shutdownService();
      
      // Wait 5 seconds to ensure complete shutdown
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Initialize the service again
      await telegramService.initialize();
      
      console.log('Telegram bot service restarted successfully');
      res.json({ 
        success: true, 
        status: 'Telegram bot restarted successfully',
        isActive: telegramService.isActive
      });
    } catch (error) {
      console.error('Error restarting Telegram bot:', error);
      res.status(500).json({ 
        error: 'Failed to restart Telegram bot', 
        details: String(error),
        isActive: telegramService.isActive
      });
    }
  });
  
  /**
   * Disconnect user's Telegram integration
   * Allows users to disconnect and reconnect for testing
   */
  app.post('/api/telegram/disconnect', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      console.log(`Disconnecting Telegram for user ID: ${userId}`);
      
      // Update user's telegram record to mark as unverified with a direct SQL query
      const disconnectQuery = `
        UPDATE langchain_telegram_users
        SET is_verified = FALSE,
            verification_code = NULL,
            verification_expires = NULL,
            updated_at = NOW()
        WHERE user_id = $1
      `;
      
      await pool.query(disconnectQuery, [userId]);
      
      console.log(`Successfully disconnected Telegram for user ID: ${userId}`);
      res.json({ 
        success: true, 
        message: 'Telegram disconnected successfully'
      });
    } catch (error) {
      console.error('Error disconnecting Telegram:', error);
      res.status(500).json({ 
        error: 'Failed to disconnect Telegram', 
        details: String(error)
      });
    }
  });
  
  /**
   * Get current user's Telegram information
   */
  app.get('/api/telegram/user', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Use a more specific selection to avoid querying columns that might not exist
      // Use direct SQL to avoid schema mismatch issues
      const userResult = await db.execute(sql`
        SELECT id, user_id, telegram_id, username, first_name, last_name,
               is_verified, notifications_enabled, receive_reports, receive_alerts,
               created_at, updated_at
        FROM langchain_telegram_users
        WHERE user_id = ${userId}
        LIMIT 1
      `);

      const telegramUser = userResult.rows.length > 0 ? [{
        id: userResult.rows[0].id,
        userId: userResult.rows[0].user_id,
        telegramId: userResult.rows[0].telegram_id,
        username: userResult.rows[0].username,
        firstName: userResult.rows[0].first_name,
        lastName: userResult.rows[0].last_name,
        notificationsEnabled: userResult.rows[0].notifications_enabled || false,
        receiveReports: userResult.rows[0].receive_reports || false,
        receiveAlerts: userResult.rows[0].receive_alerts || false,
        createdAt: userResult.rows[0].created_at,
        updatedAt: userResult.rows[0].updated_at
      }] : [];
      
      if (telegramUser.length === 0) {
        return res.json(null);
      }
      
      res.json(telegramUser[0]);
    } catch (error) {
      console.error('Error fetching Telegram user:', error);
      res.status(500).json({ error: 'Failed to fetch Telegram user information' });
    }
  });

  /**
   * Update user's Telegram preferences
   */
  app.patch('/api/telegram/preferences', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const updateSchema = z.object({
        notificationsEnabled: z.boolean().optional(),
        receiveAlerts: z.boolean().optional(),
        receiveReports: z.boolean().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      const telegramUser = await db.select().from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (telegramUser.length === 0) {
        return res.status(404).json({ error: 'Telegram connection not found' });
      }
      
      // Update the preference fields directly using raw SQL to avoid schema issues
      const currentUser = telegramUser[0];
      
      // Extract current values from database (avoiding metadata column)
      const userPreferences = await db.execute(sql`
        SELECT notifications_enabled, receive_alerts, receive_reports
        FROM langchain_telegram_users
        WHERE user_id = ${userId}
        LIMIT 1
      `);
      
      const currentPrefs = userPreferences.rows[0] || {
        notifications_enabled: false,
        receive_alerts: false,
        receive_reports: false
      };
      
      // Update the preferences directly using SQL
      await db.execute(sql`
        UPDATE langchain_telegram_users
        SET notifications_enabled = ${validatedData.notificationsEnabled !== undefined 
            ? validatedData.notificationsEnabled 
            : currentPrefs.notifications_enabled},
            receive_alerts = ${validatedData.receiveAlerts !== undefined 
            ? validatedData.receiveAlerts 
            : currentPrefs.receive_alerts},
            receive_reports = ${validatedData.receiveReports !== undefined 
            ? validatedData.receiveReports
            : currentPrefs.receive_reports},
            updated_at = NOW()
        WHERE id = ${telegramUser[0].id}
      `);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating Telegram preferences:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update Telegram preferences' });
      }
    }
  });

  /**
   * Disconnect Telegram
   */
  app.delete('/api/telegram/connection', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const telegramUser = await db.select().from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (telegramUser.length === 0) {
        return res.status(404).json({ error: 'Telegram connection not found' });
      }
      
      // Delete messages
      await db.delete(telegramMessages)
        .where(eq(telegramMessages.telegramUserId, telegramUser[0].id));
      
      // Delete user
      await db.delete(telegramUsers)
        .where(eq(telegramUsers.id, telegramUser[0].id));
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error disconnecting Telegram:', error);
      res.status(500).json({ error: 'Failed to disconnect Telegram' });
    }
  });

  /**
   * Get Telegram conversation history
   */
  app.get('/api/telegram/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const telegramUser = await db.select().from(telegramUsers)
        .where(eq(telegramUsers.userId, userId))
        .limit(1);
      
      if (telegramUser.length === 0) {
        return res.json([]);
      }
      
      // Get limit and offset from query parameters
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const messages = await db.select()
        .from(telegramMessages)
        .where(eq(telegramMessages.telegramUserId, telegramUser[0].id))
        .orderBy(desc(telegramMessages.timestamp))
        .limit(limit)
        .offset(offset);
      
      res.json(messages);
    } catch (error) {
      console.error('Error fetching Telegram messages:', error);
      res.status(500).json({ error: 'Failed to fetch Telegram messages' });
    }
  });

  /**
   * Get Telegram statistics (admin only)
   */
  app.get('/api/telegram/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await telegramService.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching Telegram statistics:', error);
      res.status(500).json({ error: 'Failed to fetch Telegram statistics' });
    }
  });

  /**
   * Send a test message via Telegram, with optional Langchain Agent integration
   */
  app.post('/api/telegram/test-message', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      // Updated schema to include optional agentId and useAgent flag
      const messageSchema = z.object({
        message: z.string().min(1).max(4096),
        agentId: z.number().optional(),
        useAgent: z.boolean().optional()
      });
      
      const validatedData = messageSchema.parse(req.body);
      
      let success = false;
      
      // If useAgent flag is true, use the Langchain agent system
      if (validatedData.useAgent) {
        let agentId = validatedData.agentId;
        
        console.log(`📝 TEST MESSAGE REQUEST - Initial agentId from client: ${agentId || 'not provided'}`);
        console.log(`📝 Request body: ${JSON.stringify(validatedData)}`);
        
        // If no specific agent ID is provided, try to find the Main Assistant Agent
        if (!agentId) {
          try {
            // Fetch all agents - mimicking the exact pattern used in the Settings page
            console.log("📝 Fetching all agents to find Main Assistant Agent for test message");
            const agents = await db.select().from(schema.langchainAgents).orderBy(desc(schema.langchainAgents.updatedAt));
            console.log(`📝 Found ${agents.length} agents in database`);
            
            if (agents.length > 0) {
              // Log the names of agents for debugging
              console.log("📝 Agent names:", agents.map(agent => `${agent.name} (ID: ${agent.id}, enabled: ${agent.enabled})`));
              
              // Use the EXACT SAME APPROACH as the Settings page
              const mainAgent = agents.find(agent => agent.name === 'Main Assistant Agent' && agent.enabled) || agents[0];
              agentId = mainAgent.id;
              
              console.log(`📝 Using agent "${mainAgent.name}" (ID: ${agentId}) for test message`);
            } else {
              console.log('📝 No agents found in the database');
            }
          } catch (error) {
            console.error('📝 Error looking up Main Assistant Agent in test-message:', error);
            
            // Log more detailed information about the error
            if (error instanceof Error) {
              console.error(`📝 Error details: ${error.message}`);
              console.error(`📝 Error stack: ${error.stack}`);
            }
          }
        } else {
          console.log(`📝 Using explicitly provided agent ID: ${agentId}`);
        }
        
        console.log(`Using Langchain agent ${agentId || 'default'} for Telegram test message`);
        
        console.log(`📝 About to call telegramService.sendMessageWithAgent with userId: ${userId}, message: "${validatedData.message.substring(0, 30)}...", agentId: ${agentId || 'undefined'}`);
        
        // Process using the selected or default Langchain agent
        try {
          success = await telegramService.sendMessageWithAgent(
            userId,
            validatedData.message,
            agentId
          );
          
          console.log(`📝 sendMessageWithAgent call completed with result: ${success}`);
        } catch (error) {
          console.error(`📝 Error in sendMessageWithAgent:`, error);
          // Rethrow the error to be handled by the outer try/catch
          throw error;
        }
      } else {
        // Regular message sending without agent processing
        success = await telegramService.sendNotification(
          userId,
          validatedData.message,
          'Test Message'
        );
      }
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Failed to send message. Make sure your Telegram account is connected and verified.' });
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to send test message' });
      }
    }
  });

  /**
   * Broadcast a message to all verified users (admin only)
   */
  app.post('/api/telegram/broadcast', requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      
      const messageSchema = z.object({
        message: z.string().min(1).max(4096)
      });
      
      const validatedData = messageSchema.parse(req.body);
      
      const recipientCount = await telegramService.broadcastMessage(
        validatedData.message,
        userId
      );
      
      res.json({ 
        success: true,
        recipientCount
      });
    } catch (error) {
      console.error('Error broadcasting message:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to broadcast message' });
      }
    }
  });
}