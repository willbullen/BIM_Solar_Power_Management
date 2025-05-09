/**
 * MCP Routes
 * 
 * API routes for the Multi-Capability Planning (MCP) framework
 */

import express from 'express';
import { MCPService, TaskStatus, TaskPriority } from './services/mcp-service';
import { requireAuthentication } from './auth';

const router = express.Router();
const mcpService = MCPService.getInstance();

// Require authentication for all MCP routes
router.use(requireAuthentication);

/**
 * Get all capabilities
 */
router.get('/capabilities', (req, res) => {
  const capabilities = mcpService.getSupportedCapabilities();
  res.json(capabilities);
});

/**
 * Get all tasks
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await mcpService.getAllTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * Get task by ID
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await mcpService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

/**
 * Get tasks by status
 */
router.get('/tasks/status/:status', async (req, res) => {
  try {
    const status = req.params.status as TaskStatus;
    const validStatuses = ['pending', 'scheduled', 'in-progress', 'completed', 'failed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const tasks = await mcpService.getTasksByStatus(status);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks by status:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * Get tasks by user ID
 */
router.get('/user-tasks', async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const tasks = await mcpService.getTasksByUserId(userId);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

/**
 * Create a new task
 */
router.post('/tasks', async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const { 
      name, 
      description, 
      capability, 
      provider, 
      parameters, 
      status, 
      priority, 
      scheduledFor,
      parentTaskId,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!name || !description || !capability || !provider || !parameters) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['name', 'description', 'capability', 'provider', 'parameters'] 
      });
    }
    
    // Check if capability is supported
    if (!mcpService.isCapabilitySupported(provider, capability)) {
      return res.status(400).json({ 
        error: `Capability ${capability} not supported by provider ${provider}`,
        supportedCapabilities: mcpService.getSupportedCapabilities()
      });
    }
    
    // Create task
    const task = await mcpService.createTask({
      name,
      description,
      capability,
      provider,
      parameters,
      status: status || TaskStatus.PENDING,
      priority: priority || TaskPriority.MEDIUM,
      createdBy: userId,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      parentTaskId,
      metadata
    });
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * Update task
 */
router.patch('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await mcpService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Update task
    const updatedTask = await mcpService.updateTask(taskId, req.body);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * Cancel task
 */
router.post('/tasks/:id/cancel', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await mcpService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Cancel task
    const cancelledTask = await mcpService.cancelTask(taskId);
    res.json(cancelledTask);
  } catch (error) {
    console.error('Error cancelling task:', error);
    res.status(500).json({ error: 'Failed to cancel task' });
  }
});

/**
 * Execute task manually
 */
router.post('/tasks/:id/execute', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await mcpService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Execute task
    const executedTask = await mcpService.executeTask(taskId);
    res.json(executedTask);
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ error: 'Failed to execute task' });
  }
});

/**
 * Delete task
 */
router.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await mcpService.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Delete task
    await mcpService.deleteTask(taskId);
    res.status(204).end();
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * Execute sentiment analysis on text
 */
router.post('/analyze/sentiment', async (req, res) => {
  try {
    const { text, conversationId, detailed } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required for sentiment analysis' });
    }
    
    const userId = (req.user as any).id;
    
    // Execute sentiment analysis capability directly
    const result = await mcpService.executeCapability('analysis', 'sentiment_analysis', {
      text,
      userId,
      conversationId,
      detailed: detailed || false
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing sentiment analysis:', error);
    res.status(500).json({ error: 'Failed to perform sentiment analysis' });
  }
});

/**
 * Summarize data
 */
router.post('/analyze/summarize', async (req, res) => {
  try {
    const { data, format, maxLength, focusAreas } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'Data is required for summarization' });
    }
    
    // Execute data summarization capability directly
    const result = await mcpService.executeCapability('analysis', 'data_summarization', {
      data,
      format: format || 'text',
      maxLength,
      focusAreas
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing data summarization:', error);
    res.status(500).json({ error: 'Failed to perform data summarization' });
  }
});

/**
 * Detect anomalies in data
 */
router.post('/analyze/anomalies', async (req, res) => {
  try {
    const { data, timeField, valueField, method, threshold } = req.body;
    
    if (!data || !timeField || !valueField) {
      return res.status(400).json({ 
        error: 'Missing required fields for anomaly detection',
        required: ['data', 'timeField', 'valueField']
      });
    }
    
    // Execute anomaly detection capability directly
    const result = await mcpService.executeCapability('analysis', 'anomaly_detection', {
      data,
      timeField,
      valueField,
      method,
      threshold
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing anomaly detection:', error);
    res.status(500).json({ error: 'Failed to perform anomaly detection' });
  }
});

/**
 * Analyze trends in data
 */
router.post('/analyze/trends', async (req, res) => {
  try {
    const { data, timeField, valueFields, windowSize } = req.body;
    
    if (!data || !timeField || !valueFields) {
      return res.status(400).json({ 
        error: 'Missing required fields for trend analysis',
        required: ['data', 'timeField', 'valueFields']
      });
    }
    
    // Execute trend analysis capability directly
    const result = await mcpService.executeCapability('analysis', 'trend_analysis', {
      data,
      timeField,
      valueFields,
      windowSize
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing trend analysis:', error);
    res.status(500).json({ error: 'Failed to perform trend analysis' });
  }
});

/**
 * Decompose a task into subtasks
 */
router.post('/plan/decompose', async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Task description is required for decomposition' });
    }
    
    const userId = (req.user as any).id;
    
    // Execute task decomposition capability directly
    const result = await mcpService.executeCapability('planning', 'task_decomposition', {
      task,
      userId
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing task decomposition:', error);
    res.status(500).json({ error: 'Failed to perform task decomposition' });
  }
});

/**
 * Error handler for MCP routes
 */
router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('MCP Route Error:', err);
  res.status(500).json({ error: 'Internal server error in MCP service' });
});

/**
 * Register MCP routes with the application
 */
export function registerMcpRoutes(app: express.Express) {
  app.use('/api/mcp', router);
  console.log('MCP routes registered');
}