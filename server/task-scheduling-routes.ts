import { Router, Request, Response } from 'express';
import { eq, and, or, gte, isNull, desc, sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from '../shared/schema';
import { requireAuth } from './middleware/auth';
import { z } from 'zod';
import { AgentService } from './agent-service';

// Create instance of AgentService
const agentService = new AgentService();

// Define validation schemas
const createTaskSchema = z.object({
  task: z.string().min(1, "Task description is required"),
  agentId: z.number().int().positive("Valid agent ID is required"),
  scheduledFor: z.string().optional(),
  recurrence: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dependsOn: z.number().int().positive().optional(),
  notifyOnComplete: z.boolean().default(true),
  notifyOnFail: z.boolean().default(true),
  telegramNotify: z.boolean().default(false),
  tools: z.array(z.object({
    toolId: z.number().int().positive(),
    priority: z.number().int().default(0),
    parameters: z.record(z.any()).optional()
  })).default([])
});

const updateTaskSchema = z.object({
  task: z.string().min(1).optional(),
  agentId: z.number().int().positive().optional(),
  status: z.enum(["pending", "in-progress", "completed", "failed"]).optional(),
  scheduledFor: z.string().optional().nullable(),
  recurrence: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dependsOn: z.number().int().positive().optional().nullable(),
  notifyOnComplete: z.boolean().optional(),
  notifyOnFail: z.boolean().optional(),
  telegramNotify: z.boolean().optional(),
  tools: z.array(z.object({
    toolId: z.number().int().positive(),
    priority: z.number().int().default(0),
    parameters: z.record(z.any()).optional()
  })).optional()
});

// Format tasks with their associated tools
async function formatTaskWithTools(task: schema.AgentTask) {
  // Fetch associated tools for this task
  const taskTools = await db
    .select()
    .from(schema.agentTaskTools)
    .where(eq(schema.agentTaskTools.taskId, task.id));
    
  // Convert to expected format
  return {
    ...task,
    tools: taskTools
  };
}

export function registerTaskSchedulingRoutes(app: Router) {
  // Get all scheduled tasks with filtering options
  app.get('/api/tasks/scheduled', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      const { status, from, to, agentId } = req.query;
      
      // Build query conditions
      let conditions: any[] = [];
      
      // Filter by user unless admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Filter by status if provided
      if (status) {
        conditions.push(eq(schema.agentTasks.status, status as string));
      }
      
      // Filter by date range if provided
      if (from) {
        conditions.push(gte(schema.agentTasks.scheduledFor, new Date(from as string)));
      }
      
      // Filter by agent if provided
      if (agentId) {
        conditions.push(eq(schema.agentTasks.agentId, parseInt(agentId as string)));
      }
      
      // Only get tasks that have scheduledFor
      conditions.push(or(
        sql`${schema.agentTasks.scheduledFor} IS NOT NULL`, 
        gte(schema.agentTasks.scheduledFor, new Date())
      ));
      
      // Execute query with filters
      const tasks = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions))
        .orderBy(desc(schema.agentTasks.scheduledFor));
      
      // Fetch tools for each task
      const tasksWithTools = await Promise.all(
        tasks.map(formatTaskWithTools)
      );
      
      res.json(tasksWithTools);
    } catch (error) {
      console.error('Error fetching scheduled tasks:', error);
      res.status(500).json({ message: 'Failed to fetch scheduled tasks' });
    }
  });
  
  // Create a new scheduled task
  app.post('/api/tasks/scheduled', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session!.userId;
      const validatedData = createTaskSchema.parse(req.body);
      
      // Prepare task data
      const taskData: Omit<schema.InsertAgentTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'> = {
        task: validatedData.task,
        agentId: validatedData.agentId,
        userId: userId,
        status: 'pending',
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : undefined,
        recurrence: validatedData.recurrence,
        priority: validatedData.priority,
        dependsOn: validatedData.dependsOn,
        notifyOnComplete: validatedData.notifyOnComplete,
        notifyOnFail: validatedData.notifyOnFail,
        telegramNotify: validatedData.telegramNotify,
        data: {}, // Additional data can be stored here
        result: null
      };
      
      // Create the task
      const [task] = await db
        .insert(schema.agentTasks)
        .values(taskData)
        .returning();
      
      // Associate tools with the task if provided
      if (validatedData.tools && validatedData.tools.length > 0) {
        const toolInserts = validatedData.tools.map((tool) => ({
          taskId: task.id,
          toolId: tool.toolId,
          priority: tool.priority || 0,
          parameters: tool.parameters || {}
        }));
        
        // Insert tool associations
        await db
          .insert(schema.agentTaskTools)
          .values(toolInserts);
      }
      
      // Fetch the complete task with tools
      const completeTask = await formatTaskWithTools(task);
      
      res.status(201).json(completeTask);
    } catch (error) {
      console.error('Error creating scheduled task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create scheduled task' });
    }
  });
  
  // Get a specific task by ID
  app.get('/api/tasks/scheduled/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      
      // Build query conditions
      let conditions = [eq(schema.agentTasks.id, taskId)];
      
      // Only filter by user if not an admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Execute query
      const [task] = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions));
      
      if (!task) {
        return res.status(404).json({ message: 'Task not found' });
      }
      
      // Get complete task with tools
      const completeTask = await formatTaskWithTools(task);
      
      res.json(completeTask);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ message: 'Failed to fetch task' });
    }
  });
  
  // Update a task
  app.patch('/api/tasks/scheduled/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      const validatedData = updateTaskSchema.parse(req.body);
      
      // Build query conditions
      let conditions = [eq(schema.agentTasks.id, taskId)];
      
      // Only filter by user if not an admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Check if task exists and user has permission
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions));
      
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found or permission denied' });
      }
      
      // Prepare update data
      const updateData: Partial<schema.AgentTask> = {};
      
      if (validatedData.task !== undefined) updateData.task = validatedData.task;
      if (validatedData.agentId !== undefined) updateData.agentId = validatedData.agentId;
      if (validatedData.status !== undefined) updateData.status = validatedData.status;
      if (validatedData.scheduledFor !== undefined) {
        updateData.scheduledFor = validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null;
      }
      if (validatedData.recurrence !== undefined) updateData.recurrence = validatedData.recurrence;
      if (validatedData.priority !== undefined) updateData.priority = validatedData.priority;
      if (validatedData.dependsOn !== undefined) updateData.dependsOn = validatedData.dependsOn;
      if (validatedData.notifyOnComplete !== undefined) updateData.notifyOnComplete = validatedData.notifyOnComplete;
      if (validatedData.notifyOnFail !== undefined) updateData.notifyOnFail = validatedData.notifyOnFail;
      if (validatedData.telegramNotify !== undefined) updateData.telegramNotify = validatedData.telegramNotify;
      
      // Set completedAt if status is changing to completed
      if (validatedData.status === 'completed' && existingTask.status !== 'completed') {
        updateData.completedAt = new Date();
      }
      
      // Always update the updatedAt timestamp
      updateData.updatedAt = new Date();
      
      // Update the task
      const [updatedTask] = await db
        .update(schema.agentTasks)
        .set(updateData)
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      // Update task tools if provided
      if (validatedData.tools) {
        // First delete all existing tools for this task
        await db
          .delete(schema.agentTaskTools)
          .where(eq(schema.agentTaskTools.taskId, taskId));
        
        // Then insert the new tools
        if (validatedData.tools.length > 0) {
          const toolInserts = validatedData.tools.map((tool) => ({
            taskId: taskId,
            toolId: tool.toolId,
            priority: tool.priority || 0,
            parameters: tool.parameters || {}
          }));
          
          await db
            .insert(schema.agentTaskTools)
            .values(toolInserts);
        }
      }
      
      // Get complete updated task with tools
      const completeTask = await formatTaskWithTools(updatedTask);
      
      res.json(completeTask);
    } catch (error) {
      console.error('Error updating task:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update task' });
    }
  });
  
  // Delete a task
  app.delete('/api/tasks/scheduled/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      
      // Build query conditions
      let conditions = [eq(schema.agentTasks.id, taskId)];
      
      // Only filter by user if not an admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Check if task exists and user has permission
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions));
      
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found or permission denied' });
      }
      
      // First delete all tools associated with this task
      await db
        .delete(schema.agentTaskTools)
        .where(eq(schema.agentTaskTools.taskId, taskId));
      
      // Then delete the task
      await db
        .delete(schema.agentTasks)
        .where(eq(schema.agentTasks.id, taskId));
      
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ message: 'Failed to delete task' });
    }
  });
  
  // Get tools for a specific task
  app.get('/api/tasks/scheduled/:id/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      
      // Build query conditions
      let conditions = [eq(schema.agentTasks.id, taskId)];
      
      // Only filter by user if not an admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Check if task exists and user has permission
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions));
      
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found or permission denied' });
      }
      
      // Get tools for this task
      const taskTools = await db
        .select()
        .from(schema.agentTaskTools)
        .where(eq(schema.agentTaskTools.taskId, taskId))
        .orderBy(schema.agentTaskTools.priority);
      
      // Get full tool details
      const toolIds = taskTools.map(tt => tt.toolId);
      
      let tools = [];
      if (toolIds.length > 0) {
        const fullTools = await db
          .select()
          .from(schema.langchainTools)
          .where(sql`${schema.langchainTools.id} IN (${toolIds.join(',')})`);
        
        // Merge full tool details with task-specific settings
        tools = taskTools.map(tt => {
          const fullTool = fullTools.find(t => t.id === tt.toolId);
          return {
            ...fullTool,
            priority: tt.priority,
            parameters: tt.parameters
          };
        });
      }
      
      res.json(tools);
    } catch (error) {
      console.error('Error fetching task tools:', error);
      res.status(500).json({ message: 'Failed to fetch task tools' });
    }
  });
  
  // Execute a scheduled task immediately
  app.post('/api/tasks/scheduled/:id/execute', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session!.userId;
      const userRole = req.session!.userRole || '';
      
      // Build query conditions
      let conditions = [eq(schema.agentTasks.id, taskId)];
      
      // Only filter by user if not an admin
      if (userRole !== 'Admin') {
        conditions.push(eq(schema.agentTasks.userId, userId));
      }
      
      // Check if task exists and user has permission
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(and(...conditions));
      
      if (!existingTask) {
        return res.status(404).json({ message: 'Task not found or permission denied' });
      }
      
      // Update task status to in-progress
      const [updatedTask] = await db
        .update(schema.agentTasks)
        .set({ 
          status: 'in-progress', 
          updatedAt: new Date() 
        })
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      // Execute the task asynchronously
      // In a real implementation, this would dispatch the task to a worker
      // For now, we'll just simulate execution
      setTimeout(async () => {
        try {
          // Simulate execution time
          const executionTime = Math.floor(Math.random() * 5000) + 1000;
          await new Promise(resolve => setTimeout(resolve, executionTime));
          
          // Simulate success or failure (90% success rate)
          const success = Math.random() > 0.1;
          
          // Update task status
          await db
            .update(schema.agentTasks)
            .set({
              status: success ? 'completed' : 'failed',
              result: success 
                ? { success: true, message: 'Task executed successfully', executionTime }
                : { success: false, message: 'Task execution failed', error: 'Simulated failure', executionTime },
              updatedAt: new Date(),
              completedAt: success ? new Date() : null
            })
            .where(eq(schema.agentTasks.id, taskId));
            
          console.log(`Task ${taskId} execution ${success ? 'completed' : 'failed'}`);
          
          // If task was successful and has recurrence, schedule next run
          if (success && existingTask.recurrence) {
            // Logic to calculate next run based on recurrence pattern
            // would go here in a real implementation
          }
        } catch (error) {
          console.error(`Error executing task ${taskId}:`, error);
          
          // Update task as failed
          await db
            .update(schema.agentTasks)
            .set({
              status: 'failed',
              result: { success: false, message: 'Task execution failed with error', error: String(error) },
              updatedAt: new Date()
            })
            .where(eq(schema.agentTasks.id, taskId));
        }
      }, 100);
      
      res.json({ 
        message: 'Task execution started', 
        task: updatedTask 
      });
    } catch (error) {
      console.error('Error executing task:', error);
      res.status(500).json({ message: 'Failed to execute task' });
    }
  });
  
  // Get all available tools for task assignment
  app.get('/api/tasks/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      // Get all enabled tools
      const tools = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.enabled, true))
        .orderBy(schema.langchainTools.name);
      
      res.json(tools);
    } catch (error) {
      console.error('Error fetching available tools:', error);
      res.status(500).json({ message: 'Failed to fetch available tools' });
    }
  });
}