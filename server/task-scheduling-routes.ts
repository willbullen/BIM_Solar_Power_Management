import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import * as schema from '../shared/schema-task-scheduler';
import { langchainTools } from '../shared/schema';
import { authenticateUser as requireAuth } from './auth';
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
  telegramNotify: z.boolean().default(true),
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
async function formatTaskWithTools(task: any) {
  // Fetch associated tools for this task
  const taskTools = await db
    .select()
    .from(schema.agentTaskTools)
    .where(eq(schema.agentTaskTools.taskId, task.id));
    
  // Convert to expected format
  return {
    ...task,
    tools: taskTools || []
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
        conditions.push(sql`scheduled_for >= ${new Date(from as string)}`);
      }
      
      // Filter by agent if provided
      if (agentId) {
        conditions.push(eq(schema.agentTasks.agentId, parseInt(agentId as string)));
      }
      
      // Execute query with filters
      let query = db.select().from(schema.agentTasks);
        
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
        
      const tasks = await query.orderBy(desc(schema.agentTasks.scheduledFor));
      
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
      const taskData = {
        task: validatedData.task,
        agentId: validatedData.agentId,
        userId: userId,
        status: 'pending' as const,
        scheduledFor: validatedData.scheduledFor ? new Date(validatedData.scheduledFor) : null,
        recurrence: validatedData.recurrence || null,
        priority: validatedData.priority,
        dependsOn: validatedData.dependsOn || null,
        notifyOnComplete: validatedData.notifyOnComplete,
        notifyOnFail: validatedData.notifyOnFail,
        telegramNotify: validatedData.telegramNotify,
        data: {},
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
      let conditions: any[] = [eq(schema.agentTasks.id, taskId)];
      
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
      let conditions: any[] = [eq(schema.agentTasks.id, taskId)];
      
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
      const updateData: any = {};
      
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
      let conditions: any[] = [eq(schema.agentTasks.id, taskId)];
      
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
      let conditions: any[] = [eq(schema.agentTasks.id, taskId)];
      
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
      
      // If no tools, return empty array
      if (taskTools.length === 0) {
        return res.json([]);
      }
      
      // Get full tool details
      const toolIds = taskTools.map(tt => tt.toolId);
      
      // Fetch tools by IDs
      const tools = await db
        .select()
        .from(langchainTools)
        .where(sql`id IN (${toolIds.join(',')})`)
      
      // Merge full tool details with task-specific settings
      const mergedTools = taskTools.map(tt => {
        const fullTool = tools.find(t => t.id === tt.toolId);
        return {
          ...fullTool,
          priority: tt.priority,
          parameters: tt.parameters
        };
      });
      
      res.json(mergedTools);
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
      let conditions: any[] = [eq(schema.agentTasks.id, taskId)];
      
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
          status: 'in-progress' as const, 
          updatedAt: new Date() 
        })
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      // Execute the task asynchronously
      // In a real implementation, this would dispatch the task to a worker
      // For now, we'll just simulate execution
      setTimeout(async () => {
        try {
          const taskTools = await db
            .select()
            .from(schema.agentTaskTools)
            .where(eq(schema.agentTaskTools.taskId, taskId));
            
          // Execute LangChain agent with tools
          let result = { success: true, message: "Task completed successfully", data: {} };
          let status = 'completed' as const;
          
          try {
            // Here we would call the actual agent execution
            // For now just simulate it
            const tools = await Promise.all(taskTools.map(async (tt) => {
              const [tool] = await db
                .select()
                .from(langchainTools)
                .where(eq(langchainTools.id, tt.toolId));
              return {
                ...tool,
                parameters: tt.parameters
              };
            }));
            
            // Simulate agent execution
            result.data = {
              agentId: existingTask.agentId,
              tools: tools.map(t => t.name),
              executionTime: Math.floor(Math.random() * 5000) + 1000,
              executedAt: new Date().toISOString()
            };
            
            // 10% chance of failure for simulation
            if (Math.random() < 0.1) {
              result.success = false;
              result.message = "Task execution failed";
              status = 'failed' as const;
            }
            
          } catch (agentError: any) {
            console.error('Agent execution error:', agentError);
            result = {
              success: false,
              message: `Agent execution failed: ${agentError.message || 'Unknown error'}`,
              data: { error: agentError.toString() }
            };
            status = 'failed' as const;
          }
          
          // Update task with result
          await db
            .update(schema.agentTasks)
            .set({
              status,
              result,
              updatedAt: new Date(),
              completedAt: status === 'completed' ? new Date() : null
            })
            .where(eq(schema.agentTasks.id, taskId));
            
          // Handle recurrence if task is completed successfully
          if (status === 'completed' && existingTask.recurrence) {
            const newScheduledDate = calculateNextOccurrence(
              existingTask.scheduledFor || new Date(),
              existingTask.recurrence
            );
            
            if (newScheduledDate) {
              // Create a new recurring task
              const recurringTaskData = {
                task: existingTask.task,
                agentId: existingTask.agentId,
                userId: existingTask.userId,
                status: 'pending' as const,
                scheduledFor: newScheduledDate,
                recurrence: existingTask.recurrence,
                priority: existingTask.priority,
                dependsOn: existingTask.dependsOn,
                notifyOnComplete: existingTask.notifyOnComplete,
                notifyOnFail: existingTask.notifyOnFail,
                telegramNotify: existingTask.telegramNotify,
                data: existingTask.data,
                result: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                completedAt: null
              };
              
              // Insert the new recurring task
              const [newTask] = await db
                .insert(schema.agentTasks)
                .values(recurringTaskData)
                .returning();
                
              // Copy over the tools
              if (taskTools.length > 0) {
                const newToolInserts = taskTools.map(tool => ({
                  taskId: newTask.id,
                  toolId: tool.toolId,
                  priority: tool.priority,
                  parameters: tool.parameters,
                  createdAt: new Date()
                }));
                
                await db
                  .insert(schema.agentTaskTools)
                  .values(newToolInserts);
              }
            }
          }
          
          // Send notifications if configured
          if ((status === 'completed' && existingTask.notifyOnComplete) || 
              (status === 'failed' && existingTask.notifyOnFail)) {
            // Here we would handle notifications - not implemented yet
            console.log(`Sending notification for task ${taskId} completion status: ${status}`);
            
            // If Telegram notifications are enabled
            if (existingTask.telegramNotify) {
              // Here we would send Telegram notification - not implemented yet
              console.log(`Sending Telegram notification for task ${taskId}`);
            }
          }
          
        } catch (error: any) {
          console.error('Error during task execution:', error);
          
          // Update task status to failed
          await db
            .update(schema.agentTasks)
            .set({
              status: 'failed' as const,
              result: {
                success: false,
                message: `Task execution failed: ${error.message || 'Unknown error'}`,
                data: { error: error.toString() }
              },
              updatedAt: new Date()
            })
            .where(eq(schema.agentTasks.id, taskId));
        }
      }, 500); // Small delay to allow response to return first
      
      // Return the updated task
      res.json({ 
        message: 'Task execution initiated', 
        task: await formatTaskWithTools(updatedTask) 
      });
    } catch (error) {
      console.error('Error executing task:', error);
      res.status(500).json({ message: 'Failed to execute task' });
    }
  });
  
  // Get all available tools for tasks
  app.get('/api/tasks/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      // Fetch all tools that can be used with tasks
      const tools = await db
        .select()
        .from(langchainTools)
        .where(eq(langchainTools.enabled, true))
        .orderBy(langchainTools.name);
      
      res.json(tools);
    } catch (error) {
      console.error('Error fetching task tools:', error);
      res.status(500).json({ message: 'Failed to fetch available tools' });
    }
  });
}

// Helper function to calculate next occurrence based on recurrence pattern
function calculateNextOccurrence(currentDate: Date, recurrence: string): Date | null {
  const nextDate = new Date(currentDate);
  
  switch (recurrence) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      break;
    default:
      return null; // Unknown recurrence pattern
  }
  
  return nextDate;
}