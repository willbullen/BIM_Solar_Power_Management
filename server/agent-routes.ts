import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { AgentService } from './agent-service';
import * as schema from '@shared/schema';
import { db } from './db';
import session from 'express-session';

// Extend Express.Session to include user properties
declare module 'express-session' {
  interface Session {
    userId?: number;
    userRole?: string;
  }
}

// Create an instance of the agent service
const agentService = new AgentService();

// Validation schemas
const conversationSchema = z.object({
  title: z.string().min(1).max(100),
  agentId: z.number().optional(),
});

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const functionCallSchema = z.object({
  name: z.string().min(1),
  parameters: z.any(),
});

const taskSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1),
  type: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  scheduledFor: z.string().optional(),
  parameters: z.any().optional(),
  agentId: z.number().optional(),
});

const settingUpdateSchema = z.object({
  value: z.string(),
});

const notificationSchema = z.object({
  recipient: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['alert', 'report', 'reminder', 'status']).optional().default('alert'),
});

// Create a storage instance
import { DatabaseStorage } from './storage';
const storage = new DatabaseStorage();

// Authentication helper
/**
 * Middleware to require authentication
 * This middleware checks for authentication in the following order:
 * 1. Session-based authentication (req.session.userId)
 * 2. Passport authentication (req.isAuthenticated())
 * 3. Header-based authentication (X-Auth-User-Id and X-Auth-Username)
 */
async function requireAuth(req: Request, res: Response, next: any) {
  console.log('Auth check - Session:', req.session ? 'exists' : 'missing');
  console.log('Auth check - UserId:', req.session?.userId ? req.session.userId : 'missing');
  console.log('Auth check - IsAuthenticated:', req.isAuthenticated ? (req.isAuthenticated() ? 'yes' : 'no') : 'method missing');
  
  // Check if headers contain auth info as fallback (from local storage)
  const headerUserId = req.header('X-Auth-User-Id');
  const headerUsername = req.header('X-Auth-Username');
  
  if (headerUserId && headerUsername) {
    console.log('Auth check - Using header-based authentication');
    
    try {
      // Validate the header credentials
      const userId = parseInt(headerUserId, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ error: 'Invalid user ID in header' });
      }
      
      // Verify user exists
      const user = await storage.getUser(userId);
      if (!user || user.username !== headerUsername) {
        return res.status(401).json({ error: 'Invalid authentication credentials' });
      }
      
      // If valid, store in session for future requests
      if (req.session) {
        req.session.userId = userId;
        req.session.userRole = user.role;
        
        // Save session immediately
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session from header auth:', err);
          } else {
            console.log('Session restored from header auth for user:', userId);
          }
        });
      }
      
      // Continue to the next middleware/route handler
      next();
      return;
    } catch (error) {
      console.error('Header auth validation error:', error);
      // Continue with other auth methods
    }
  }
  
  // Standard session-based authentication check
  if (!req.session || !req.session.userId) {
    // For better debugging, check passport authentication as well
    if (req.isAuthenticated && req.isAuthenticated()) {
      // If passport says we're authenticated but session doesn't have userId, fix it
      if (req.user && 'id' in req.user) {
        console.log('Fixing session - user authenticated but userId missing from session');
        req.session.userId = (req.user as any).id;
        req.session.userRole = (req.user as any).role;
        next();
        return;
      }
    }
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

/**
 * Middleware to require specific role
 * Checks both session and header-based authentication
 * @param roles Array of allowed roles
 */
function requireRole(roles: string[]) {
  return async (req: Request, res: Response, next: any) => {
    // Check header auth first
    const headerUserId = req.header('X-Auth-User-Id');
    const headerUsername = req.header('X-Auth-Username');
    
    if (headerUserId && headerUsername) {
      try {
        // Validate the header credentials
        const userId = parseInt(headerUserId, 10);
        if (isNaN(userId)) {
          return res.status(401).json({ error: 'Invalid user ID in header' });
        }
        
        // Verify user exists and has the required role
        const user = await storage.getUser(userId);
        if (!user || user.username !== headerUsername) {
          return res.status(401).json({ error: 'Invalid authentication credentials' });
        }
        
        // Store in session for future requests
        if (req.session) {
          req.session.userId = userId;
          req.session.userRole = user.role;
          
          // Save session immediately
          req.session.save((err) => {
            if (err) {
              console.error('Error saving session from header auth in requireRole:', err);
            }
          });
        }
        
        // Check if user has the required role
        if (!roles.includes(user.role)) {
          return res.status(403).json({ 
            error: 'Access denied', 
            required: roles,
            current: user.role
          });
        }
        
        // Continue to the next middleware/route handler
        next();
        return;
      } catch (error) {
        console.error('Header auth validation error in requireRole:', error);
        // Continue with standard session check
      }
    }
    
    // Standard session check
    if (!req.session || !req.session.userId || !req.session.userRole) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        required: roles,
        current: req.session.userRole
      });
    }
    
    next();
  };
}

// Register agent routes
export function registerAgentRoutes(app: Express) {
  // Get all conversations for the current user
  app.get('/api/agent/conversations', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      
      const conversations = await db.query.agentConversations.findMany({
        where: (fields, { eq }) => eq(fields.userId, userId),
        orderBy: (fields, { desc }) => [desc(fields.updatedAt)],
      });
      
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ message: 'Failed to fetch conversations' });
    }
  });

  // Create a new conversation
  app.post('/api/agent/conversations', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const validatedData = conversationSchema.parse(req.body);
      
      const conversation = await agentService.createConversation(
        userId, 
        validatedData.title,
        validatedData.agentId
      );
      
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create conversation' });
    }
  });

  // Get a specific conversation with its messages
  app.get('/api/agent/conversations/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.session!.userId;
      
      // Get the conversation
      const conversation = await db.query.agentConversations.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.id, conversationId),
          eq(fields.userId, userId)
        ),
      });
      
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // Get the messages
      const messages = await db.query.agentMessages.findMany({
        where: (fields, { eq }) => eq(fields.conversationId, conversationId),
        orderBy: (fields, { asc }) => [asc(fields.timestamp)],
      });
      
      res.json({ conversation, messages });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ message: 'Failed to fetch conversation' });
    }
  });
  
  // Delete a conversation and all its messages
  app.delete('/api/agent/conversations/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      let userId = req.session?.userId;
      
      // Also check headers for auth if session doesn't have userId
      if (!userId && req.headers['x-auth-user-id']) {
        userId = parseInt(req.headers['x-auth-user-id'] as string);
      }
      
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      console.log(`Deleting conversation ${conversationId} for user ${userId}`);
      
      const agentService = new AgentService();
      const success = await agentService.deleteConversation(conversationId, userId);
      
      if (!success) {
        return res.status(404).json({ message: 'Conversation not found or not authorized to delete' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ message: 'Failed to delete conversation' });
    }
  });
  
  // Get messages for a specific conversation
  app.get('/api/agent/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.session!.userId;
      
      // Check if the conversation exists and belongs to the user
      const conversation = await db.query.agentConversations.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.id, conversationId),
          eq(fields.userId, userId)
        ),
      });
      
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // Get the messages
      const messages = await db.query.agentMessages.findMany({
        where: (fields, { eq }) => eq(fields.conversationId, conversationId),
        orderBy: (fields, { asc }) => [asc(fields.timestamp)],
      });
      
      res.json(messages);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      res.status(500).json({ message: 'Failed to fetch conversation messages' });
    }
  });

  // Add a message to a conversation and get a response
  app.post('/api/agent/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || 'user';
      const validatedData = messageSchema.parse(req.body);
      
      // Check if the conversation exists and belongs to the user
      const conversation = await db.query.agentConversations.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.id, conversationId),
          eq(fields.userId, userId)
        ),
      });
      
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // Add the user message
      const userMessage = await agentService.addUserMessage(conversationId, validatedData.content);
      
      // Generate a response with user role for proper permissions
      const assistantMessage = await agentService.generateResponse(
        conversationId,
        userId,
        userRole,
        1000 // default max tokens
      );
      
      res.status(201).json({ userMessage, assistantMessage });
    } catch (error) {
      console.error('Error processing message:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to process message' });
    }
  });
  
  // Delete a message from a conversation
  app.delete('/api/agent/conversations/:conversationId/messages/:messageId', requireAuth, async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const userId = req.session!.userId;
      
      const success = await agentService.deleteMessage(messageId, userId);
      
      if (success) {
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'Message not found or you do not have permission to delete it' });
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ success: false, message: 'Failed to delete message', error: String(error) });
    }
  });

  // Execute a function
  app.post('/api/agent/functions/execute', requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, parameters } = functionCallSchema.parse(req.body);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || 'user';
      
      // Execute the function with user permissions
      const result = await agentService.executeFunction(
        name, 
        parameters, 
        userId, 
        userRole
      );
      
      res.status(200).json({ result });
    } catch (error) {
      console.error('Error executing function:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      
      // More descriptive error messages for access denied
      if (String(error).includes('Access denied') || String(error).includes('permissions')) {
        return res.status(403).json({ 
          message: `Access denied: ${error instanceof Error ? error.message : String(error)}` 
        });
      }
      
      res.status(500).json({ 
        message: `Failed to execute function: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  // Get available functions
  app.get('/api/agent/functions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session!.userRole || 'public';
      // Normalize role to lowercase for consistent comparison
      const userRoleLower = userRole.toLowerCase();
      const accessLevel = userRoleLower === 'admin' ? 'admin' : userRoleLower === 'operator' ? 'restricted' : 'public';
      
      const functions = await agentService.getAvailableFunctions(accessLevel);
      
      res.json(functions);
    } catch (error) {
      console.error('Error fetching functions:', error);
      res.status(500).json({ message: 'Failed to fetch functions' });
    }
  });

  // Create a task
  app.post('/api/agent/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const validatedData = taskSchema.parse(req.body);
      
      const taskData: Omit<schema.InsertAgentTask, 'createdAt' | 'updatedAt'> = {
        task: validatedData.title, // Map title to task field
        data: {  // Map description and other metadata to data JSON field
          description: validatedData.description,
          type: validatedData.type,
          priority: validatedData.priority,
          parameters: validatedData.parameters || {},
          scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor).toISOString() : null
        },
        status: 'pending',
        userId: userId, // Previously createdBy/assignedTo now combined in userId
        agentId: validatedData.agentId || 2  // Default to "BillyBot Agent" if no agent specified
      };
      
      const task = await agentService.createTask(taskData);
      
      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create task' });
    }
  });

  // Get all tasks
  app.get('/api/agent/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      
      let tasks;
      if (userRole === 'Admin') {
        // Admins can see all tasks
        tasks = await db.query.agentTasks.findMany({
          orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        });
      } else {
        // Regular users can see only their tasks
        tasks = await db.query.agentTasks.findMany({
          where: (fields, { eq }) => eq(fields.userId, userId),
          orderBy: (fields, { desc }) => [desc(fields.createdAt)],
        });
      }
      
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: 'Failed to fetch tasks' });
    }
  });

  // Update a task status
  app.patch('/api/agent/tasks/:id/status', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status, result } = req.body;
      
      if (!['pending', 'in-progress', 'completed', 'failed'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      
      const updatedTask = await agentService.updateTaskStatus(taskId, status, result);
      
      res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task status:', error);
      res.status(500).json({ message: 'Failed to update task status' });
    }
  });

  // Get agent settings
  app.get('/api/agent/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session!.userRole || '';
      
      // Only admins can access all settings
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const category = req.query.category as string | undefined;
      const settings = await agentService.getSettings(category);
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  // Update a setting
  app.patch('/api/agent/settings/:name', requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session!.userRole || '';
      const userId = req.session!.userId;
      
      // Only admins can update settings
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const name = req.params.name;
      const { value } = settingUpdateSchema.parse(req.body);
      
      const updatedSetting = await agentService.updateSetting(name, value, userId);
      
      res.json(updatedSetting);
    } catch (error) {
      console.error('Error updating setting:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update setting' });
    }
  });

  // Send a notification
  app.post('/api/agent/notifications', requireAuth, async (req: Request, res: Response) => {
    try {
      const userRole = req.session!.userRole || '';
      
      // Only admins can send notifications
      if (userRole !== 'Admin') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      
      const { recipient, message, type } = notificationSchema.parse(req.body);
      
      const notification = await agentService.sendNotification(recipient, message, type);
      
      res.status(201).json(notification);
    } catch (error) {
      console.error('Error sending notification:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to send notification' });
    }
  });
}