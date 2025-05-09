/**
 * Multi-Capability Planning (MCP) Service
 * 
 * This service orchestrates multiple AI capabilities and enables advanced
 * planning and execution of complex agent tasks. It provides a framework
 * for managing multiple capability providers, scheduling tasks,
 * and implementing advanced features like sentiment analysis,
 * summarization, and proactive insights generation.
 */

import { db } from '../db';
import { schema } from '../../shared/schema';
import { AgentService } from '../agent-service';
import { AIService } from '../ai-service';
import { AgentNotificationService } from './agent-notification-service';
import { ScheduledReportingService } from './scheduled-reporting-service';
import OpenAI from 'openai';

// Define capability provider interface
export interface CapabilityProvider {
  name: string;
  description: string;
  capabilities: string[];
  execute(capability: string, params: any): Promise<any>;
  isAvailable(): Promise<boolean>;
}

// Task status options
export enum TaskStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Task priority options
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Define task interface
export interface MCPTask {
  id?: number;
  name: string;
  description: string;
  capability: string;
  provider: string;
  parameters: Record<string, any>;
  status: TaskStatus;
  priority: TaskPriority;
  createdBy: number;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: Record<string, any>;
  parentTaskId?: number;
  metadata?: Record<string, any>;
}

/**
 * Multi-Capability Planning Service
 */
export class MCPService {
  private static instance: MCPService;
  private providers: Map<string, CapabilityProvider> = new Map();
  private agentService: AgentService;
  private aiService: AIService;
  private notificationService: AgentNotificationService;
  private scheduledReportingService: ScheduledReportingService;
  private openai: OpenAI;
  private taskScheduler: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }
  
  /**
   * Private constructor for singleton
   */
  private constructor() {
    this.agentService = new AgentService();
    this.aiService = new AIService();
    this.notificationService = new AgentNotificationService();
    this.scheduledReportingService = new ScheduledReportingService();
    
    // Initialize OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set, MCP Service will have limited functionality');
    }
    this.openai = new OpenAI({ apiKey: apiKey || 'dummy-key' });
    
    // Register built-in providers
    this.registerBuiltInProviders();
    
    // Start task scheduler
    this.startTaskScheduler();
    
    console.log('MCP Service initialized');
  }
  
  /**
   * Register built-in capability providers
   */
  private registerBuiltInProviders() {
    // Register Core Provider
    this.registerProvider({
      name: 'core',
      description: 'Core system capabilities',
      capabilities: [
        'task_scheduling',
        'notification_management',
        'report_generation'
      ],
      async execute(capability: string, params: any): Promise<any> {
        // Implementation will be added in a separate method
        throw new Error('Not implemented');
      },
      async isAvailable(): Promise<boolean> {
        return true; // Core provider is always available
      }
    });
    
    // Register Analysis Provider
    this.registerProvider({
      name: 'analysis',
      description: 'Data analysis and insight generation',
      capabilities: [
        'sentiment_analysis',
        'data_summarization',
        'trend_analysis',
        'anomaly_detection'
      ],
      async execute(capability: string, params: any): Promise<any> {
        // Implementation will be added in a separate method
        throw new Error('Not implemented');
      },
      async isAvailable(): Promise<boolean> {
        return !!process.env.OPENAI_API_KEY;
      }
    });
    
    // Register Planning Provider
    this.registerProvider({
      name: 'planning',
      description: 'Task planning and optimization',
      capabilities: [
        'task_decomposition',
        'resource_optimization',
        'scheduling_optimization',
        'proactive_planning'
      ],
      async execute(capability: string, params: any): Promise<any> {
        // Implementation will be added in a separate method
        throw new Error('Not implemented');
      },
      async isAvailable(): Promise<boolean> {
        return !!process.env.OPENAI_API_KEY;
      }
    });
  }
  
  /**
   * Start the task scheduler
   */
  private startTaskScheduler() {
    if (this.taskScheduler) {
      clearInterval(this.taskScheduler);
    }
    
    // Check for tasks every 30 seconds
    this.taskScheduler = setInterval(() => {
      this.processScheduledTasks();
    }, 30000);
    
    console.log('MCP Task Scheduler started');
  }
  
  /**
   * Process scheduled tasks
   */
  private async processScheduledTasks() {
    if (this.isProcessing) {
      return; // Already processing
    }
    
    try {
      this.isProcessing = true;
      
      // Get tasks that are scheduled and due to run
      const now = new Date();
      const tasks = await db.select().from(schema.mcpTasks)
        .where(schema.mcpTasks.status.equals(TaskStatus.SCHEDULED))
        .where(schema.mcpTasks.scheduledFor.lte(now));
      
      if (tasks.length === 0) {
        return;
      }
      
      console.log(`Found ${tasks.length} scheduled tasks ready to execute`);
      
      // Process each task
      for (const task of tasks) {
        await this.executeTask(task.id);
      }
    } catch (error) {
      console.error('Error processing scheduled tasks:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Register a new capability provider
   */
  public registerProvider(provider: CapabilityProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} already registered, replacing`);
    }
    this.providers.set(provider.name, provider);
    console.log(`Registered capability provider: ${provider.name}`);
  }
  
  /**
   * Get a list of all registered providers
   */
  public getProviders(): CapabilityProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get a provider by name
   */
  public getProvider(name: string): CapabilityProvider | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Create a new task
   */
  public async createTask(task: Omit<MCPTask, 'id'>): Promise<MCPTask> {
    // Validate task
    const provider = this.providers.get(task.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${task.provider}`);
    }
    
    if (!provider.capabilities.includes(task.capability)) {
      throw new Error(`Capability ${task.capability} not supported by provider ${task.provider}`);
    }
    
    // Create task in database
    const [createdTask] = await db.insert(schema.mcpTasks).values({
      name: task.name,
      description: task.description,
      capability: task.capability,
      provider: task.provider,
      parameters: task.parameters,
      status: task.status,
      priority: task.priority,
      createdBy: task.createdBy,
      scheduledFor: task.scheduledFor,
      parentTaskId: task.parentTaskId,
      metadata: task.metadata
    }).returning();
    
    console.log(`Created MCP task: ${createdTask.id} - ${createdTask.name}`);
    
    // If task is scheduled for future, do nothing else
    if (task.status === TaskStatus.SCHEDULED && task.scheduledFor && task.scheduledFor > new Date()) {
      return createdTask;
    }
    
    // If task is pending or scheduled for now, execute it
    if (task.status === TaskStatus.PENDING || task.status === TaskStatus.SCHEDULED) {
      // Execute asynchronously
      this.executeTask(createdTask.id).catch(error => {
        console.error(`Error executing task ${createdTask.id}:`, error);
      });
    }
    
    return createdTask;
  }
  
  /**
   * Execute a task by ID
   */
  public async executeTask(taskId: number): Promise<MCPTask> {
    // Get task from database
    const tasks = await db.select().from(schema.mcpTasks)
      .where(schema.mcpTasks.id.equals(taskId));
    
    if (tasks.length === 0) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    const task = tasks[0];
    
    // Update task status to in-progress
    const [updatedTask] = await db.update(schema.mcpTasks)
      .set({
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date()
      })
      .where(schema.mcpTasks.id.equals(taskId))
      .returning();
    
    try {
      // Get provider
      const provider = this.providers.get(task.provider);
      if (!provider) {
        throw new Error(`Provider not found: ${task.provider}`);
      }
      
      // Check if provider is available
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        throw new Error(`Provider ${task.provider} is not available`);
      }
      
      // Execute task using provider
      const result = await this.executeCapability(
        task.provider,
        task.capability,
        task.parameters
      );
      
      // Update task with result
      const [completedTask] = await db.update(schema.mcpTasks)
        .set({
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
          result
        })
        .where(schema.mcpTasks.id.equals(taskId))
        .returning();
      
      console.log(`Completed MCP task: ${taskId} - ${task.name}`);
      
      // If this task has children tasks, check if they should be executed
      await this.processChildTasks(taskId, result);
      
      return completedTask;
    } catch (error) {
      // Update task with error
      const [failedTask] = await db.update(schema.mcpTasks)
        .set({
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          result: { error: error instanceof Error ? error.message : String(error) }
        })
        .where(schema.mcpTasks.id.equals(taskId))
        .returning();
      
      console.error(`Failed MCP task: ${taskId} - ${task.name}:`, error);
      
      return failedTask;
    }
  }
  
  /**
   * Process child tasks after parent completion
   */
  private async processChildTasks(parentTaskId: number, parentResult: any): Promise<void> {
    // Get child tasks
    const childTasks = await db.select().from(schema.mcpTasks)
      .where(schema.mcpTasks.parentTaskId.equals(parentTaskId))
      .where(schema.mcpTasks.status.equals(TaskStatus.PENDING));
    
    if (childTasks.length === 0) {
      return;
    }
    
    console.log(`Processing ${childTasks.length} child tasks for parent ${parentTaskId}`);
    
    // Process each child task
    for (const childTask of childTasks) {
      // Update parameters with parent result if specified in metadata
      if (childTask.metadata?.inheritParentResult) {
        const updatedParams = { ...childTask.parameters, parentResult };
        await db.update(schema.mcpTasks)
          .set({ parameters: updatedParams })
          .where(schema.mcpTasks.id.equals(childTask.id));
      }
      
      // Execute child task
      this.executeTask(childTask.id).catch(error => {
        console.error(`Error executing child task ${childTask.id}:`, error);
      });
    }
  }
  
  /**
   * Execute a capability using a provider
   */
  private async executeCapability(
    providerName: string,
    capability: string,
    params: any
  ): Promise<any> {
    // Get provider
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    
    // Check if provider is available
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      throw new Error(`Provider ${providerName} is not available`);
    }
    
    // Core provider is handled directly in this service
    if (providerName === 'core') {
      return this.executeCoreCapability(capability, params);
    }
    
    // Analysis provider is handled directly in this service
    if (providerName === 'analysis') {
      return this.executeAnalysisCapability(capability, params);
    }
    
    // Planning provider is handled directly in this service
    if (providerName === 'planning') {
      return this.executePlanningCapability(capability, params);
    }
    
    // For external providers, delegate to their execute method
    return provider.execute(capability, params);
  }
  
  /**
   * Execute a core capability
   */
  private async executeCoreCapability(capability: string, params: any): Promise<any> {
    switch (capability) {
      case 'task_scheduling':
        return this.executeTaskSchedulingCapability(params);
      
      case 'notification_management':
        return this.executeNotificationManagementCapability(params);
      
      case 'report_generation':
        return this.executeReportGenerationCapability(params);
      
      default:
        throw new Error(`Unknown core capability: ${capability}`);
    }
  }
  
  /**
   * Execute an analysis capability
   */
  private async executeAnalysisCapability(capability: string, params: any): Promise<any> {
    switch (capability) {
      case 'sentiment_analysis':
        return this.executeSentimentAnalysisCapability(params);
      
      case 'data_summarization':
        return this.executeDataSummarizationCapability(params);
      
      case 'trend_analysis':
        return this.executeTrendAnalysisCapability(params);
      
      case 'anomaly_detection':
        return this.executeAnomalyDetectionCapability(params);
      
      default:
        throw new Error(`Unknown analysis capability: ${capability}`);
    }
  }
  
  /**
   * Execute a planning capability
   */
  private async executePlanningCapability(capability: string, params: any): Promise<any> {
    switch (capability) {
      case 'task_decomposition':
        return this.executeTaskDecompositionCapability(params);
      
      case 'resource_optimization':
        return this.executeResourceOptimizationCapability(params);
      
      case 'scheduling_optimization':
        return this.executeSchedulingOptimizationCapability(params);
      
      case 'proactive_planning':
        return this.executeProactivePlanningCapability(params);
      
      default:
        throw new Error(`Unknown planning capability: ${capability}`);
    }
  }
  
  /**
   * Execute task scheduling capability
   */
  private async executeTaskSchedulingCapability(params: any): Promise<any> {
    const { action, taskId, scheduledFor } = params;
    
    switch (action) {
      case 'schedule':
        if (!taskId) {
          throw new Error('taskId is required for schedule action');
        }
        
        if (!scheduledFor) {
          throw new Error('scheduledFor is required for schedule action');
        }
        
        // Update task schedule
        const [updatedTask] = await db.update(schema.mcpTasks)
          .set({
            status: TaskStatus.SCHEDULED,
            scheduledFor: new Date(scheduledFor)
          })
          .where(schema.mcpTasks.id.equals(taskId))
          .returning();
        
        return { success: true, task: updatedTask };
      
      case 'cancel':
        if (!taskId) {
          throw new Error('taskId is required for cancel action');
        }
        
        // Cancel scheduled task
        const [cancelledTask] = await db.update(schema.mcpTasks)
          .set({
            status: TaskStatus.CANCELLED
          })
          .where(schema.mcpTasks.id.equals(taskId))
          .returning();
        
        return { success: true, task: cancelledTask };
      
      case 'list_scheduled':
        // Get all scheduled tasks
        const scheduledTasks = await db.select().from(schema.mcpTasks)
          .where(schema.mcpTasks.status.equals(TaskStatus.SCHEDULED));
        
        return { tasks: scheduledTasks };
      
      default:
        throw new Error(`Unknown task scheduling action: ${action}`);
    }
  }
  
  /**
   * Execute notification management capability
   */
  private async executeNotificationManagementCapability(params: any): Promise<any> {
    const { action, userId, title, message, type, priority, metadata } = params;
    
    switch (action) {
      case 'send':
        if (!userId) {
          throw new Error('userId is required for send action');
        }
        
        if (!title || !message) {
          throw new Error('title and message are required for send action');
        }
        
        // Create notification
        const notification = await this.notificationService.createNotification({
          userId,
          title,
          message,
          type: type || 'mcp',
          priority: priority || 'normal',
          metadata: metadata || {}
        });
        
        return { success: true, notification };
      
      case 'list':
        if (!userId) {
          throw new Error('userId is required for list action');
        }
        
        // Get notifications for user
        const notifications = await this.notificationService.getNotificationsByUserId(userId);
        
        return { notifications };
      
      default:
        throw new Error(`Unknown notification action: ${action}`);
    }
  }
  
  /**
   * Execute report generation capability
   */
  private async executeReportGenerationCapability(params: any): Promise<any> {
    const { action, reportId, reportData } = params;
    
    switch (action) {
      case 'generate':
        if (!reportId) {
          throw new Error('reportId is required for generate action');
        }
        
        // Execute report manually
        await this.scheduledReportingService.executeReportManually(reportId);
        
        return { success: true };
      
      case 'create':
        if (!reportData) {
          throw new Error('reportData is required for create action');
        }
        
        // Create new report
        const report = await this.scheduledReportingService.createScheduledReport(reportData);
        
        return { success: true, report };
      
      default:
        throw new Error(`Unknown report action: ${action}`);
    }
  }
  
  /**
   * Execute sentiment analysis capability
   */
  private async executeSentimentAnalysisCapability(params: any): Promise<any> {
    const { text, userId, conversationId, detailed } = params;
    
    if (!text) {
      throw new Error('text is required for sentiment analysis');
    }
    
    try {
      // Analyze sentiment using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: detailed 
              ? 'Analyze the sentiment in the following text. Provide a detailed analysis including sentiment (positive, negative, neutral), emotional tone, key themes, and any notable language patterns.'
              : 'Analyze the sentiment in the following text. Return a JSON object with sentiment (positive, negative, or neutral), confidence (0-1), and a brief explanation.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: detailed ? undefined : { type: 'json_object' }
      });
      
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in response');
      }
      
      // If the result is requested for a specific conversation, store it
      if (conversationId && userId) {
        await this.storeSentimentAnalysis(userId, conversationId, content);
      }
      
      // Return sentiment analysis result
      return detailed 
        ? { analysis: content }
        : { analysis: JSON.parse(content) };
    } catch (error) {
      console.error('Error performing sentiment analysis:', error);
      throw new Error(`Sentiment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Store sentiment analysis results for a conversation
   */
  private async storeSentimentAnalysis(
    userId: number,
    conversationId: number,
    analysis: string
  ): Promise<void> {
    try {
      // Store sentiment analysis as a system message
      await this.agentService.addMessage(conversationId, {
        role: 'system',
        content: `Sentiment Analysis:\n${analysis}`,
        metadata: {
          type: 'sentiment_analysis',
          visible_to_user: false
        }
      });
    } catch (error) {
      console.error('Error storing sentiment analysis:', error);
    }
  }
  
  /**
   * Execute data summarization capability
   */
  private async executeDataSummarizationCapability(params: any): Promise<any> {
    const { data, format, maxLength, focusAreas } = params;
    
    if (!data) {
      throw new Error('data is required for summarization');
    }
    
    let dataString = '';
    
    if (typeof data === 'string') {
      dataString = data;
    } else {
      try {
        dataString = JSON.stringify(data, null, 2);
      } catch (error) {
        throw new Error('Failed to stringify data for summarization');
      }
    }
    
    try {
      // Generate summary using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Summarize the following data${focusAreas ? ` with focus on ${focusAreas}` : ''}.${
              maxLength ? ` Keep the summary within ${maxLength} words.` : ''
            }${
              format === 'bullets' ? ' Format the summary as bullet points.' :
              format === 'json' ? ' Return the summary as a JSON object.' :
              ''
            }`
          },
          {
            role: 'user',
            content: dataString
          }
        ],
        response_format: format === 'json' ? { type: 'json_object' } : undefined
      });
      
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in response');
      }
      
      // Return summary
      return format === 'json' 
        ? { summary: JSON.parse(content) }
        : { summary: content };
    } catch (error) {
      console.error('Error performing data summarization:', error);
      throw new Error(`Data summarization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute trend analysis capability
   */
  private async executeTrendAnalysisCapability(params: any): Promise<any> {
    const { data, timeField, valueFields, windowSize } = params;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('data array is required for trend analysis');
    }
    
    if (!timeField) {
      throw new Error('timeField is required for trend analysis');
    }
    
    if (!valueFields || !Array.isArray(valueFields) || valueFields.length === 0) {
      throw new Error('valueFields array is required for trend analysis');
    }
    
    try {
      // Sort data by time field
      const sortedData = [...data].sort((a, b) => {
        const aTime = new Date(a[timeField]).getTime();
        const bTime = new Date(b[timeField]).getTime();
        return aTime - bTime;
      });
      
      // Calculate trends for each value field
      const trends: Record<string, any> = {};
      
      for (const field of valueFields) {
        if (typeof sortedData[0][field] !== 'number') {
          trends[field] = { error: `Field ${field} is not numeric` };
          continue;
        }
        
        // Extract values
        const values = sortedData.map(item => item[field]);
        
        // Calculate moving average if windowSize provided
        let movingAverages: number[] = [];
        if (windowSize && windowSize > 1 && windowSize < values.length) {
          for (let i = 0; i <= values.length - windowSize; i++) {
            const sum = values.slice(i, i + windowSize).reduce((a, b) => a + b, 0);
            movingAverages.push(sum / windowSize);
          }
        }
        
        // Calculate trend direction
        const firstValue = values[0];
        const lastValue = values[values.length - 1];
        const changePercent = ((lastValue - firstValue) / firstValue) * 100;
        
        // Calculate rate of change
        const timeDiff = (new Date(sortedData[sortedData.length - 1][timeField]).getTime() - 
                          new Date(sortedData[0][timeField]).getTime()) / (1000 * 60 * 60); // hours
        const rateOfChange = timeDiff > 0 ? changePercent / timeDiff : 0;
        
        // Determine trend direction
        let direction = 'stable';
        if (changePercent > 5) direction = 'increasing';
        if (changePercent < -5) direction = 'decreasing';
        
        // Calculate variance
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        
        trends[field] = {
          direction,
          changePercent,
          rateOfChange,
          mean,
          variance,
          volatility: Math.sqrt(variance) / mean, // Coefficient of variation
          start: firstValue,
          end: lastValue,
          movingAverage: movingAverages.length > 0 ? movingAverages : undefined
        };
      }
      
      return {
        trends,
        period: {
          start: sortedData[0][timeField],
          end: sortedData[sortedData.length - 1][timeField],
          dataPoints: sortedData.length
        }
      };
    } catch (error) {
      console.error('Error performing trend analysis:', error);
      throw new Error(`Trend analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute anomaly detection capability
   */
  private async executeAnomalyDetectionCapability(params: any): Promise<any> {
    const { data, timeField, valueField, method, threshold } = params;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('data array is required for anomaly detection');
    }
    
    if (!timeField) {
      throw new Error('timeField is required for anomaly detection');
    }
    
    if (!valueField) {
      throw new Error('valueField is required for anomaly detection');
    }
    
    try {
      // Sort data by time field
      const sortedData = [...data].sort((a, b) => {
        const aTime = new Date(a[timeField]).getTime();
        const bTime = new Date(b[timeField]).getTime();
        return aTime - bTime;
      });
      
      // Extract values
      const values = sortedData.map(item => item[valueField]);
      
      // Determine method to use
      const detectionMethod = method || 'std_dev';
      const detectionThreshold = threshold || 2.0;
      
      // Find anomalies based on method
      const anomalies = [];
      
      if (detectionMethod === 'std_dev') {
        // Standard deviation method
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        
        const upperBound = mean + (stdDev * detectionThreshold);
        const lowerBound = mean - (stdDev * detectionThreshold);
        
        // Find values outside bounds
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (value > upperBound || value < lowerBound) {
            anomalies.push({
              index: i,
              time: sortedData[i][timeField],
              value: value,
              expected: mean,
              deviation: (value - mean) / stdDev,
              type: value > upperBound ? 'high' : 'low'
            });
          }
        }
      } else if (detectionMethod === 'iqr') {
        // Interquartile Range method
        const sortedValues = [...values].sort((a, b) => a - b);
        const q1Index = Math.floor(sortedValues.length * 0.25);
        const q3Index = Math.floor(sortedValues.length * 0.75);
        const q1 = sortedValues[q1Index];
        const q3 = sortedValues[q3Index];
        const iqr = q3 - q1;
        
        const upperBound = q3 + (iqr * detectionThreshold);
        const lowerBound = q1 - (iqr * detectionThreshold);
        
        // Find values outside bounds
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (value > upperBound || value < lowerBound) {
            anomalies.push({
              index: i,
              time: sortedData[i][timeField],
              value: value,
              expected: (q1 + q3) / 2,
              deviation: value > upperBound ? (value - upperBound) / iqr : (lowerBound - value) / iqr,
              type: value > upperBound ? 'high' : 'low'
            });
          }
        }
      }
      
      return {
        anomalies,
        method: detectionMethod,
        threshold: detectionThreshold,
        anomalyCount: anomalies.length,
        dataPoints: values.length,
        anomalyPercentage: (anomalies.length / values.length) * 100
      };
    } catch (error) {
      console.error('Error performing anomaly detection:', error);
      throw new Error(`Anomaly detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Execute task decomposition capability
   */
  private async executeTaskDecompositionCapability(params: any): Promise<any> {
    const { task, userId } = params;
    
    if (!task) {
      throw new Error('task description is required for task decomposition');
    }
    
    if (!userId) {
      throw new Error('userId is required for task decomposition');
    }
    
    try {
      // Generate task decomposition using OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Decompose the following task into smaller subtasks. Return a JSON object with an array of subtasks, each with name, description, and estimated effort level (low, medium, high). Include dependencies between tasks if applicable.`
          },
          {
            role: 'user',
            content: task
          }
        ],
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in response');
      }
      
      const decomposition = JSON.parse(content);
      
      // Create subtasks in the database
      const createdTasks = [];
      
      for (const subtask of decomposition.subtasks) {
        // Create the MCP task
        const createdTask = await this.createTask({
          name: subtask.name,
          description: subtask.description,
          capability: 'task_scheduling', // Default to scheduling capability
          provider: 'core', // Default to core provider
          parameters: {
            action: 'schedule',
            scheduledFor: new Date(Date.now() + 3600000) // Default to 1 hour from now
          },
          status: TaskStatus.PENDING,
          priority: this.mapEffortToPriority(subtask.effort),
          createdBy: userId,
          metadata: {
            originalTask: task,
            effort: subtask.effort,
            dependencies: subtask.dependencies
          }
        });
        
        createdTasks.push(createdTask);
      }
      
      return {
        decomposition,
        createdTasks
      };
    } catch (error) {
      console.error('Error performing task decomposition:', error);
      throw new Error(`Task decomposition failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Map effort level to task priority
   */
  private mapEffortToPriority(effort: string): TaskPriority {
    switch (effort.toLowerCase()) {
      case 'low':
        return TaskPriority.LOW;
      case 'medium':
        return TaskPriority.MEDIUM;
      case 'high':
        return TaskPriority.HIGH;
      default:
        return TaskPriority.MEDIUM;
    }
  }
  
  /**
   * Execute resource optimization capability
   */
  private async executeResourceOptimizationCapability(params: any): Promise<any> {
    // This is a placeholder for resource optimization capability
    // In a real implementation, this would use advanced optimization algorithms
    return {
      message: 'Resource optimization capability not fully implemented',
      optimizationPerformed: false
    };
  }
  
  /**
   * Execute scheduling optimization capability
   */
  private async executeSchedulingOptimizationCapability(params: any): Promise<any> {
    // This is a placeholder for scheduling optimization capability
    // In a real implementation, this would use advanced scheduling algorithms
    return {
      message: 'Scheduling optimization capability not fully implemented',
      optimizationPerformed: false
    };
  }
  
  /**
   * Execute proactive planning capability
   */
  private async executeProactivePlanningCapability(params: any): Promise<any> {
    // This is a placeholder for proactive planning capability
    // In a real implementation, this would use advanced planning algorithms
    return {
      message: 'Proactive planning capability not fully implemented',
      planningPerformed: false
    };
  }
  
  /**
   * Get all tasks
   */
  public async getAllTasks(): Promise<MCPTask[]> {
    return await db.select().from(schema.mcpTasks);
  }
  
  /**
   * Get task by ID
   */
  public async getTaskById(taskId: number): Promise<MCPTask | null> {
    const tasks = await db.select().from(schema.mcpTasks)
      .where(schema.mcpTasks.id.equals(taskId))
      .limit(1);
    
    return tasks.length > 0 ? tasks[0] : null;
  }
  
  /**
   * Get tasks by user ID
   */
  public async getTasksByUserId(userId: number): Promise<MCPTask[]> {
    return await db.select().from(schema.mcpTasks)
      .where(schema.mcpTasks.createdBy.equals(userId));
  }
  
  /**
   * Get tasks by status
   */
  public async getTasksByStatus(status: TaskStatus): Promise<MCPTask[]> {
    return await db.select().from(schema.mcpTasks)
      .where(schema.mcpTasks.status.equals(status));
  }
  
  /**
   * Cancel task by ID
   */
  public async cancelTask(taskId: number): Promise<MCPTask> {
    const [cancelledTask] = await db.update(schema.mcpTasks)
      .set({
        status: TaskStatus.CANCELLED
      })
      .where(schema.mcpTasks.id.equals(taskId))
      .returning();
    
    return cancelledTask;
  }
  
  /**
   * Update task by ID
   */
  public async updateTask(taskId: number, updates: Partial<MCPTask>): Promise<MCPTask> {
    const [updatedTask] = await db.update(schema.mcpTasks)
      .set(updates)
      .where(schema.mcpTasks.id.equals(taskId))
      .returning();
    
    return updatedTask;
  }
  
  /**
   * Delete task by ID
   */
  public async deleteTask(taskId: number): Promise<void> {
    await db.delete(schema.mcpTasks)
      .where(schema.mcpTasks.id.equals(taskId));
  }
  
  /**
   * Get supported capabilities
   */
  public getSupportedCapabilities(): Record<string, string[]> {
    const capabilities: Record<string, string[]> = {};
    
    for (const [name, provider] of this.providers.entries()) {
      capabilities[name] = provider.capabilities;
    }
    
    return capabilities;
  }
  
  /**
   * Check if a capability is supported
   */
  public isCapabilitySupported(providerName: string, capability: string): boolean {
    const provider = this.providers.get(providerName);
    if (!provider) {
      return false;
    }
    
    return provider.capabilities.includes(capability);
  }
}