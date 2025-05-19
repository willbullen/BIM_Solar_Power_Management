import { Request, Response, Express } from 'express';
import { db } from './db';
import * as schema from '../shared/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AgentService } from './agent-service';
import { authenticateUser } from './auth';

/**
 * Register task-related routes for LangChain agents
 */
export function registerLangChainTaskRoutes(app: Express) {
  const agentService = new AgentService();
  const telegramService = TelegramService.getInstance();

  // Get all tasks
  app.get('/api/langchain/tasks', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      
      const tasks = await db
        .select()
        .from(schema.agentTasks)
        .where(eq(schema.agentTasks.userId, userId));
      
      return res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // Get a specific task
  app.get('/api/langchain/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId;
      
      const [task] = await db
        .select()
        .from(schema.agentTasks)
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.userId, userId)
          )
        );
      
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      return res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      return res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // Create a new task
  app.post('/api/langchain/tasks', requireAuth, async (req: Request, res: Response) => {
    try {
      const { title, description, agentId, startTime, endTime, priority, tools } = req.body;
      const userId = req.session.userId;
      
      // Validate required fields
      if (!title || !description || !agentId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Create task
      const [task] = await db
        .insert(schema.agentTasks)
        .values({
          task: title,
          agentId,
          userId,
          status: 'pending',
          data: {
            description,
            startTime,
            endTime,
            priority,
            tools
          }
        })
        .returning();
      
      // If task has tools, register them for execution
      if (tools && tools.length > 0) {
        console.log(`Task ${task.id} has ${tools.length} tools registered: ${tools.join(', ')}`);
      }

      // Schedule the task if startTime is in the future
      if (startTime) {
        const startDate = new Date(startTime);
        if (startDate > new Date()) {
          // Add scheduling logic here
          console.log(`Task ${task.id} scheduled for ${startDate.toISOString()}`);
        }
      }
      
      return res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // Update a task
  app.put('/api/langchain/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId;
      const { title, description, agentId, startTime, endTime, priority, tools, status } = req.body;
      
      // Check if task exists and belongs to user
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.userId, userId)
          )
        );
      
      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Update the task
      const [updatedTask] = await db
        .update(schema.agentTasks)
        .set({
          task: title || existingTask.task,
          agentId: agentId || existingTask.agentId,
          status: status || existingTask.status,
          data: {
            ...existingTask.data,
            description: description || existingTask.data?.description,
            startTime: startTime || existingTask.data?.startTime,
            endTime: endTime || existingTask.data?.endTime,
            priority: priority || existingTask.data?.priority,
            tools: tools || existingTask.data?.tools
          },
          updatedAt: new Date()
        })
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      return res.json(updatedTask);
    } catch (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // Delete a task
  app.delete('/api/langchain/tasks/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId;
      
      // Check if task exists and belongs to user
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.userId, userId)
          )
        );
      
      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Delete the task
      await db
        .delete(schema.agentTasks)
        .where(eq(schema.agentTasks.id, taskId));
      
      return res.json({ success: true, message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  // Execute a task immediately
  app.post('/api/langchain/tasks/:id/execute', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId;
      
      // Check if task exists and belongs to user
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.userId, userId)
          )
        );
      
      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Update task status to running
      const [updatedTask] = await db
        .update(schema.agentTasks)
        .set({
          status: 'running',
          updatedAt: new Date()
        })
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      // Get the agent for this task
      const [agent] = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.id, existingTask.agentId));
      
      if (!agent) {
        await db
          .update(schema.agentTasks)
          .set({
            status: 'failed',
            result: { error: 'Agent not found' },
            updatedAt: new Date()
          })
          .where(eq(schema.agentTasks.id, taskId));
        
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      // Extract tools to use for this task
      const taskTools = existingTask.data?.tools || [];
      
      // Execute the task asynchronously
      executeTaskAsync(existingTask, agent, taskTools, userId);
      
      return res.json({
        success: true,
        message: 'Task execution started',
        task: updatedTask
      });
    } catch (error) {
      console.error('Error executing task:', error);
      return res.status(500).json({ error: 'Failed to execute task' });
    }
  });

  // Stop a running task
  app.post('/api/langchain/tasks/:id/stop', requireAuth, async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const userId = req.session.userId;
      
      // Check if task exists and belongs to user
      const [existingTask] = await db
        .select()
        .from(schema.agentTasks)
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.userId, userId)
          )
        );
      
      if (!existingTask) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Only running tasks can be stopped
      if (existingTask.status !== 'running') {
        return res.status(400).json({ error: 'Only running tasks can be stopped' });
      }
      
      // Update task status to failed
      const [updatedTask] = await db
        .update(schema.agentTasks)
        .set({
          status: 'failed',
          result: { error: 'Task stopped by user' },
          updatedAt: new Date()
        })
        .where(eq(schema.agentTasks.id, taskId))
        .returning();
      
      return res.json({
        success: true,
        message: 'Task stopped',
        task: updatedTask
      });
    } catch (error) {
      console.error('Error stopping task:', error);
      return res.status(500).json({ error: 'Failed to stop task' });
    }
  });

  // Get all available LangChain agents
  app.get('/api/langchain/agents', requireAuth, async (req: Request, res: Response) => {
    try {
      const agents = await db
        .select()
        .from(schema.langchainAgents)
        .where(eq(schema.langchainAgents.enabled, true));
      
      return res.json(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }
  });

  // Get all available LangChain tools
  app.get('/api/langchain/tools', requireAuth, async (req: Request, res: Response) => {
    try {
      const tools = await db
        .select()
        .from(schema.langchainTools)
        .where(eq(schema.langchainTools.enabled, true));
      
      return res.json(tools);
    } catch (error) {
      console.error('Error fetching tools:', error);
      return res.status(500).json({ error: 'Failed to fetch tools' });
    }
  });

  /**
   * Asynchronously execute a task with the specified agent and tools
   * This is a helper function for the execute endpoint
   */
  async function executeTaskAsync(task: any, agent: any, tools: string[], userId: number) {
    try {
      console.log(`Executing task ${task.id} with agent ${agent.name} and tools: ${tools.join(', ')}`);
      
      // Get the actual tools to use
      let availableTools: any[] = [];
      
      if (tools && tools.length > 0) {
        availableTools = await db
          .select()
          .from(schema.langchainTools)
          .where(
            and(
              inArray(schema.langchainTools.name, tools),
              eq(schema.langchainTools.enabled, true)
            )
          );
      }
      
      // Prepare task inputs
      const taskInput = {
        task: task.task,
        description: task.data?.description,
        tools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description
        }))
      };
      
      // Simulate task execution
      setTimeout(async () => {
        try {
          // In a real scenario, this would execute the agent with the tools
          
          // For demo purposes, just update the task status after a delay
          const result = {
            status: 'completed',
            output: `Task ${task.id} completed successfully with agent ${agent.name}`,
            tools: availableTools.map(tool => tool.name),
            timestamp: new Date().toISOString()
          };
          
          // Update task status to completed
          await db
            .update(schema.agentTasks)
            .set({
              status: 'completed',
              result,
              updatedAt: new Date()
            })
            .where(eq(schema.agentTasks.id, task.id));
          
          // Send notification via Telegram if available
          if (telegramService && telegramService.isInitialized()) {
            const user = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, userId))
              .limit(1);
            
            if (user.length > 0) {
              const telegramUser = await db
                .select()
                .from(schema.telegramUsers)
                .where(eq(schema.telegramUsers.userId, userId))
                .limit(1);
              
              if (telegramUser.length > 0) {
                const chatId = telegramUser[0].telegramId;
                await telegramService.sendMessage(chatId, 
                  `✅ Task Completed: ${task.task}\n\nAgent: ${agent.name}\n\nResult: ${result.output}`
                );
              }
            }
          }
          
          console.log(`Task ${task.id} execution completed successfully`);
        } catch (error) {
          console.error(`Error executing task ${task.id}:`, error);
          
          // Update task status to failed
          await db
            .update(schema.agentTasks)
            .set({
              status: 'failed',
              result: { error: String(error) },
              updatedAt: new Date()
            })
            .where(eq(schema.agentTasks.id, task.id));
        }
      }, 5000); // Simulate execution delay
      
    } catch (error) {
      console.error(`Error in executeTaskAsync for task ${task.id}:`, error);
      
      // Update task status to failed
      await db
        .update(schema.agentTasks)
        .set({
          status: 'failed',
          result: { error: String(error) },
          updatedAt: new Date()
        })
        .where(eq(schema.agentTasks.id, task.id));
    }
  }
}