import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { AgentService } from './agent-service';
import * as schema from '@shared/schema';
import { db } from './db';
import session from 'express-session';
import { webSocketService } from './websocket-service';

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
});

const settingUpdateSchema = z.object({
  value: z.string(),
});

const notificationSchema = z.object({
  recipient: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['alert', 'report', 'reminder', 'status']).optional().default('alert'),
});

// Authentication helper
/**
 * Middleware to require authentication
 */
function requireAuth(req: Request, res: Response, next: any) {
  console.log('Auth check - Session:', req.session ? 'exists' : 'missing');
  console.log('Auth check - UserId:', req.session?.userId ? req.session.userId : 'missing');
  console.log('Auth check - IsAuthenticated:', req.isAuthenticated ? (req.isAuthenticated() ? 'yes' : 'no') : 'method missing');
  
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
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
}

/**
 * Middleware to require specific role
 * @param roles Array of allowed roles
 */
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!req.session || !req.session.userId || !req.session.userRole) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ 
        message: 'Access denied', 
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
      
      const conversation = await agentService.createConversation(userId, validatedData.title);
      
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
      const accessLevel = userRole === 'Admin' ? 'admin' : userRole === 'Operator' ? 'restricted' : 'public';
      
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
        title: validatedData.title,
        description: validatedData.description,
        status: 'pending',
        type: validatedData.type,
        priority: validatedData.priority,
        createdBy: userId,
        assignedTo: userId, // Assign to the creator by default
        parameters: validatedData.parameters || {},
      };
      
      if (validatedData.scheduledFor) {
        taskData.scheduledFor = new Date(validatedData.scheduledFor);
      }
      
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
          where: (fields, { eq, or }) => or(
            eq(fields.createdBy, userId),
            eq(fields.assignedTo, userId)
          ),
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