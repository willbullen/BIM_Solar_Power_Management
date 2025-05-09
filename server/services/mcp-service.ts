import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { AIService } from "../ai-service";
import { agentNotificationService } from "./agent-notification-service";

// Interface for capability providers
export interface CapabilityProvider {
  execute: (input: any, params?: any) => Promise<any>;
  name: string;
  description: string;
  category: string;
  parameters?: Record<string, any>;
  requiresAuth?: boolean;
  requiredRole?: string[];
}

/**
 * Multi-Capability Planning (MCP) Service
 * Provides a framework for integrating and orchestrating multiple AI capabilities
 */
export class MCPService {
  private aiService: AIService;
  private capabilityProviders: Map<string, CapabilityProvider>;
  
  constructor() {
    this.aiService = new AIService();
    this.capabilityProviders = new Map();
    
    // Register default capabilities
    this.registerDefaultCapabilities();
  }
  
  /**
   * Register default capability providers
   */
  private registerDefaultCapabilities() {
    // Text analysis capabilities
    this.registerCapability({
      name: 'sentiment-analysis',
      description: 'Analyze sentiment in text',
      category: 'text-analysis',
      execute: this.analyzeSentiment.bind(this),
      parameters: {
        text: { type: 'string', required: true },
        detailed: { type: 'boolean', default: false },
      }
    });
    
    this.registerCapability({
      name: 'text-summarization',
      description: 'Generate summaries from text',
      category: 'text-analysis',
      execute: this.summarizeText.bind(this),
      parameters: {
        text: { type: 'string', required: true },
        maxLength: { type: 'number', default: 200 },
        format: { type: 'string', default: 'paragraph', enum: ['paragraph', 'bullets'] },
      }
    });
    
    // Data analysis capabilities
    this.registerCapability({
      name: 'anomaly-detection',
      description: 'Detect anomalies in power and environmental data',
      category: 'data-analysis',
      execute: this.detectAnomalies.bind(this),
      parameters: {
        dataType: { type: 'string', required: true, enum: ['power', 'environmental', 'both'] },
        threshold: { type: 'number', default: 2.5 },
        timeRange: { type: 'string', default: '24h' },
      }
    });
    
    this.registerCapability({
      name: 'trend-analysis',
      description: 'Analyze trends in time-series data',
      category: 'data-analysis',
      execute: this.analyzeTrends.bind(this),
      parameters: {
        dataType: { type: 'string', required: true, enum: ['power', 'environmental', 'efficiency', 'both'] },
        timeRange: { type: 'string', default: '7d' },
        granularity: { type: 'string', default: '1h', enum: ['15m', '1h', '6h', '1d'] },
      }
    });
    
    // Task management capabilities
    this.registerCapability({
      name: 'task-decomposition',
      description: 'Break down complex tasks into smaller subtasks',
      category: 'task-management',
      execute: this.decomposeTask.bind(this),
      parameters: {
        task: { type: 'string', required: true },
        maxSubtasks: { type: 'number', default: 5 },
        assignee: { type: 'string' },
      }
    });
    
    // Insights generation
    this.registerCapability({
      name: 'energy-insights',
      description: 'Generate insights about energy usage patterns',
      category: 'insights',
      execute: this.generateEnergyInsights.bind(this),
      parameters: {
        timeRange: { type: 'string', default: '7d' },
        includeRecommendations: { type: 'boolean', default: true },
      }
    });
  }
  
  /**
   * Register a new capability provider
   */
  registerCapability(provider: CapabilityProvider) {
    this.capabilityProviders.set(provider.name, provider);
  }
  
  /**
   * Get all available capabilities
   */
  getAvailableCapabilities(userRole?: string): CapabilityProvider[] {
    const capabilities: CapabilityProvider[] = [];
    
    // Convert Map to array for safer iteration
    Array.from(this.capabilityProviders.entries()).forEach(([_, provider]) => {
      // Skip capabilities that require authentication if no user role is provided
      if (provider.requiresAuth && !userRole) {
        return;
      }
      
      // Skip capabilities that require specific roles if user doesn't have them
      if (provider.requiredRole && userRole && 
          !provider.requiredRole.includes(userRole) && 
          userRole !== 'Admin') {
        return;
      }
      
      capabilities.push(provider);
    });
    
    return capabilities;
  }
  
  /**
   * Get capability provider by name
   */
  getCapability(name: string): CapabilityProvider | undefined {
    return this.capabilityProviders.get(name);
  }
  
  /**
   * Execute a capability
   */
  private async executeCapability(
    capabilityName: string, 
    input: any, 
    params?: any,
    userRole?: string
  ): Promise<any> {
    const provider = this.capabilityProviders.get(capabilityName);
    
    if (!provider) {
      throw new Error(`Capability "${capabilityName}" not found`);
    }
    
    // Check permissions
    if (provider.requiresAuth && !userRole) {
      throw new Error(`Authentication required to use capability "${capabilityName}"`);
    }
    
    if (provider.requiredRole && userRole && 
        !provider.requiredRole.includes(userRole) && 
        userRole !== 'Admin') {
      throw new Error(`Insufficient permissions to use capability "${capabilityName}"`);
    }
    
    // Execute the capability
    return await provider.execute(input, params);
  }
  
  /**
   * Create a new MCP task
   */
  async createTask(taskData: schema.InsertMcpTask): Promise<schema.McpTask> {
    try {
      // Handle input formatting and defaults
      const taskValues = {
        name: taskData.name,
        description: taskData.description,
        capability: taskData.capability,
        provider: taskData.provider,
        createdBy: taskData.createdBy,
        status: taskData.status || 'pending',
        priority: taskData.priority || 'medium',
        input: JSON.stringify(taskData.input || {}),
        parameters: JSON.stringify(taskData.parameters || {}),
        scheduledFor: taskData.scheduledFor,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.insert(schema.mcpTasks).values(taskValues).returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating MCP task:", error);
      throw error;
    }
  }
  
  /**
   * Get all MCP tasks
   */
  async getAllTasks(filter?: { 
    status?: string, 
    capability?: string,
    userId?: number
  }): Promise<schema.McpTask[]> {
    try {
      let query = db.select().from(schema.mcpTasks);
      
      // Apply filters
      if (filter) {
        if (filter.status) {
          query = query.where(eq(schema.mcpTasks.status, filter.status));
        }
        
        if (filter.capability) {
          query = query.where(eq(schema.mcpTasks.capability, filter.capability));
        }
        
        if (filter.userId) {
          query = query.where(eq(schema.mcpTasks.createdBy, filter.userId));
        }
      }
      
      return await query.orderBy(desc(schema.mcpTasks.createdAt));
    } catch (error) {
      console.error("Error fetching MCP tasks:", error);
      throw error;
    }
  }
  
  /**
   * Get task by ID
   */
  async getTaskById(taskId: number): Promise<schema.McpTask | null> {
    try {
      const result = await db.select().from(schema.mcpTasks)
        .where(eq(schema.mcpTasks.id, taskId))
        .limit(1);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error fetching MCP task with ID ${taskId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: number, 
    status: string, 
    result?: any
  ): Promise<schema.McpTask> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString()
      };
      
      // Set appropriate timestamps based on status
      if (status === 'in-progress' && !result?.startedAt) {
        updateData.startedAt = new Date().toISOString();
      } else if (['completed', 'failed', 'canceled'].includes(status)) {
        updateData.completedAt = new Date().toISOString();
      }
      
      // If result is provided, store it
      if (result !== undefined) {
        updateData.result = JSON.stringify(result);
      }
      
      const updated = await db.update(schema.mcpTasks)
        .set(updateData)
        .where(eq(schema.mcpTasks.id, taskId))
        .returning();
      
      // If we got results, create a notification
      if (result && (status === 'completed' || status === 'failed')) {
        const task = updated[0];
        
        await agentNotificationService.createNotification({
          userId: task.createdBy,
          title: `Task ${status}: ${task.name}`,
          message: status === 'completed' 
            ? `Your task "${task.name}" has been completed successfully.` 
            : `Your task "${task.name}" has failed: ${result.error || 'Unknown error'}`,
          type: status === 'completed' ? 'success' : 'alert',
          priority: 'medium',
          source: 'mcp',
          category: 'task',
          data: JSON.stringify({
            taskId: task.id,
            capability: task.capability,
            result: result
          }),
          read: false
        });
      }
      
      return updated[0];
    } catch (error) {
      console.error(`Error updating MCP task ${taskId} status:`, error);
      throw error;
    }
  }
  
  /**
   * Delete task
   */
  async deleteTask(taskId: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.mcpTasks)
        .where(eq(schema.mcpTasks.id, taskId));
      
      return !!result.rowCount;
    } catch (error) {
      console.error(`Error deleting MCP task ${taskId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process pending tasks
   * This would typically be called by a scheduler/cron job
   */
  async processPendingTasks(): Promise<{ processed: number, errors: number }> {
    try {
      const pendingTasks = await db.select().from(schema.mcpTasks)
        .where(eq(schema.mcpTasks.status, 'pending'));
      
      console.log(`Processing ${pendingTasks.length} pending MCP tasks`);
      
      let processed = 0;
      let errors = 0;
      
      for (const task of pendingTasks) {
        try {
          // Mark task as in-progress
          await this.updateTaskStatus(task.id, 'in-progress');
          
          // Parse parameters safely
          let inputData = {};
          let paramsData = {};
          
          if (typeof task.input === 'string' && task.input) {
            try {
              inputData = JSON.parse(task.input);
            } catch (parseError) {
              console.warn(`Failed to parse input JSON for task ${task.id}:`, parseError);
              // Use the string as-is if parsing fails
              inputData = { text: task.input };
            }
          } else if (task.input) {
            // Already an object
            inputData = task.input;
          }
          
          if (typeof task.parameters === 'string' && task.parameters) {
            try {
              paramsData = JSON.parse(task.parameters);
            } catch (parseError) {
              console.warn(`Failed to parse parameters JSON for task ${task.id}:`, parseError);
            }
          } else if (task.parameters) {
            // Already an object
            paramsData = task.parameters;
          }
          
          // Execute the capability
          const result = await this.executeCapability(
            task.capability,
            inputData,
            paramsData
          );
          
          // Mark task as completed with result
          await this.updateTaskStatus(task.id, 'completed', result);
          
          processed++;
        } catch (error) {
          console.error(`Error processing MCP task ${task.id}:`, error);
          
          // Mark task as failed with error
          await this.updateTaskStatus(task.id, 'failed', { 
            error: error instanceof Error ? error.message : String(error) 
          });
          
          errors++;
        }
      }
      
      return { processed, errors };
    } catch (error) {
      console.error("Error processing pending MCP tasks:", error);
      throw error;
    }
  }
  
  /**
   * Execute a task manually
   */
  async executeTask(taskId: number): Promise<any> {
    try {
      const task = await this.getTaskById(taskId);
      
      if (!task) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      // Mark task as in-progress
      await this.updateTaskStatus(task.id, 'in-progress');
      
      try {
        // Parse parameters safely
        let inputData = {};
        let paramsData = {};
        
        if (typeof task.input === 'string' && task.input) {
          try {
            inputData = JSON.parse(task.input);
          } catch (parseError) {
            console.warn(`Failed to parse input JSON for task ${task.id}:`, parseError);
            // Use the string as-is if parsing fails
            inputData = { text: task.input };
          }
        } else if (task.input) {
          // Already an object
          inputData = task.input;
        }
        
        if (typeof task.parameters === 'string' && task.parameters) {
          try {
            paramsData = JSON.parse(task.parameters);
          } catch (parseError) {
            console.warn(`Failed to parse parameters JSON for task ${task.id}:`, parseError);
          }
        } else if (task.parameters) {
          // Already an object
          paramsData = task.parameters;
        }
        
        // Execute the capability
        const result = await this.executeCapability(
          task.capability,
          inputData,
          paramsData
        );
        
        // Mark task as completed with result
        await this.updateTaskStatus(task.id, 'completed', result);
        
        return result;
      } catch (error) {
        console.error(`Error executing MCP task ${task.id}:`, error);
        
        // Mark task as failed with error
        await this.updateTaskStatus(task.id, 'failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        throw error;
      }
    } catch (error) {
      console.error(`Error executing MCP task ${taskId}:`, error);
      throw error;
    }
  }
  
  /**
   * Analyze sentiment in text
   */
  private async analyzeSentiment(input: { text: string }, params: { detailed?: boolean } = {}): Promise<any> {
    try {
      // Use AI service to analyze sentiment
      const text = input.text;
      const detailed = params.detailed || false;
      
      // Simple keyword-based sentiment analysis as fallback
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'happy', 'positive', 'love', 'like', 'enjoy'];
      const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'sad', 'negative', 'hate', 'dislike', 'poor', 'worst'];
      
      const words = text.toLowerCase().split(/\W+/);
      let positiveScore = 0;
      let negativeScore = 0;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveScore++;
        if (negativeWords.includes(word)) negativeScore++;
      });
      
      const totalScore = positiveScore - negativeScore;
      const normalizedScore = Math.max(-1, Math.min(1, totalScore / 5)); // Normalize to [-1, 1]
      
      let sentiment: string;
      if (normalizedScore > 0.3) sentiment = 'positive';
      else if (normalizedScore < -0.3) sentiment = 'negative';
      else sentiment = 'neutral';
      
      // Use AI service for more detailed analysis if requested
      let detailedAnalysis = null;
      if (detailed) {
        detailedAnalysis = await this.aiService.generateDataAnalytics({
          text,
          task: 'sentiment_analysis'
        });
      }
      
      return {
        text,
        sentiment,
        score: normalizedScore,
        confidence: Math.abs(normalizedScore),
        metrics: {
          positiveScore,
          negativeScore,
          wordCount: words.length
        },
        ...(detailed && detailedAnalysis ? { detailed: detailedAnalysis } : {})
      };
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      throw error;
    }
  }
  
  /**
   * Generate summaries from text
   */
  private async summarizeText(
    input: { text: string }, 
    params: { maxLength?: number, format?: string } = {}
  ): Promise<any> {
    try {
      const text = input.text;
      const maxLength = params.maxLength || 200;
      const format = params.format || 'paragraph';
      
      // Call AI service for summarization
      const summary = await this.aiService.generateDataAnalytics({
        text,
        task: 'summarization',
        maxLength,
        format
      });
      
      return {
        originalText: text,
        originalLength: text.length,
        summary: summary.content,
        summaryLength: summary.content.length,
        compressionRatio: Math.round((summary.content.length / text.length) * 100),
        format
      };
    } catch (error) {
      console.error("Error summarizing text:", error);
      throw error;
    }
  }
  
  /**
   * Detect anomalies in power and environmental data
   */
  private async detectAnomalies(
    input: any, 
    params: { dataType?: string, threshold?: number, timeRange?: string } = {}
  ): Promise<any> {
    try {
      const dataType = params.dataType || 'both';
      const threshold = params.threshold || 2.5; // Standard deviations
      const timeRange = params.timeRange || '24h';
      
      // Get data based on type
      let powerData: any[] = [];
      let environmentalData: any[] = [];
      
      if (dataType === 'power' || dataType === 'both') {
        powerData = await db.select().from(schema.powerData)
          .orderBy(desc(schema.powerData.timestamp))
          .limit(100);
      }
      
      if (dataType === 'environmental' || dataType === 'both') {
        environmentalData = await db.select().from(schema.environmentalData)
          .orderBy(desc(schema.environmentalData.timestamp))
          .limit(100);
      }
      
      // Simple anomaly detection using z-scores
      const anomalies: any = {
        power: [],
        environmental: []
      };
      
      if (powerData.length > 0) {
        // Calculate mean and standard deviation for each power metric
        const metrics = ['mainGridPower', 'solarOutput', 'totalLoad', 'unaccountedLoad'];
        
        for (const metric of metrics) {
          const values = powerData.map(d => d[metric as keyof typeof d] as number);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
          
          // Find anomalies
          powerData.forEach((data, index) => {
            const value = data[metric as keyof typeof data] as number;
            const zScore = Math.abs((value - mean) / stdDev);
            
            if (zScore > threshold) {
              anomalies.power.push({
                timestamp: data.timestamp,
                metric,
                value,
                zScore,
                mean,
                stdDev,
                direction: value > mean ? 'high' : 'low'
              });
            }
          });
        }
      }
      
      if (environmentalData.length > 0) {
        // Calculate mean and standard deviation for each environmental metric
        const metrics = ['air_temp', 'ghi', 'dni'];
        
        for (const metric of metrics) {
          const values = environmentalData.map(d => d[metric as keyof typeof d] as number);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
          
          // Find anomalies
          environmentalData.forEach((data, index) => {
            const value = data[metric as keyof typeof data] as number;
            const zScore = Math.abs((value - mean) / stdDev);
            
            if (zScore > threshold) {
              anomalies.environmental.push({
                timestamp: data.timestamp,
                metric,
                value,
                zScore,
                mean,
                stdDev,
                direction: value > mean ? 'high' : 'low'
              });
            }
          });
        }
      }
      
      // Group anomalies by timestamp
      const anomalyGroups: any = {};
      
      [...anomalies.power, ...anomalies.environmental].forEach(anomaly => {
        const ts = new Date(anomaly.timestamp).toISOString();
        if (!anomalyGroups[ts]) {
          anomalyGroups[ts] = [];
        }
        anomalyGroups[ts].push(anomaly);
      });
      
      return {
        dataType,
        threshold,
        timeRange,
        anomalyCount: anomalies.power.length + anomalies.environmental.length,
        anomalies: {
          power: anomalies.power,
          environmental: anomalies.environmental
        },
        anomalyGroups,
        analysisTime: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      throw error;
    }
  }
  
  /**
   * Analyze trends in time-series data
   */
  private async analyzeTrends(
    input: any, 
    params: { dataType?: string, timeRange?: string, granularity?: string } = {}
  ): Promise<any> {
    try {
      const dataType = params.dataType || 'both';
      const timeRange = params.timeRange || '7d';
      const granularity = params.granularity || '1h';
      
      // Get data based on type
      let powerData: any[] = [];
      let environmentalData: any[] = [];
      
      if (dataType === 'power' || dataType === 'both') {
        powerData = await db.select().from(schema.powerData)
          .orderBy(desc(schema.powerData.timestamp))
          .limit(168); // Up to 7 days of hourly data
      }
      
      if (dataType === 'environmental' || dataType === 'both') {
        environmentalData = await db.select().from(schema.environmentalData)
          .orderBy(desc(schema.environmentalData.timestamp))
          .limit(168);
      }
      
      // Analyze trends using simple linear regression
      const trends: any = {};
      
      if (powerData.length > 0) {
        // Calculate trends for power metrics
        const metrics = ['mainGridPower', 'solarOutput', 'totalLoad'];
        
        for (const metric of metrics) {
          const values = powerData.map((d, i) => ({ 
            x: i, // Use index as x since we're looking at trends over intervals
            y: d[metric as keyof typeof d] as number,
            timestamp: d.timestamp
          }));
          
          // Calculate simple linear regression
          const n = values.length;
          const sumX = values.reduce((a, b) => a + b.x, 0);
          const sumY = values.reduce((a, b) => a + b.y, 0);
          const sumXY = values.reduce((a, b) => a + (b.x * b.y), 0);
          const sumXX = values.reduce((a, b) => a + (b.x * b.x), 0);
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          
          // Calculate min, max, avg
          const min = Math.min(...values.map(v => v.y));
          const max = Math.max(...values.map(v => v.y));
          const avg = sumY / n;
          
          // Store trend data
          trends[metric] = {
            slope,
            intercept,
            direction: slope > 0.001 ? 'increasing' : slope < -0.001 ? 'decreasing' : 'stable',
            strengthAbs: Math.abs(slope),
            min,
            max,
            avg,
            range: max - min,
            variance: values.reduce((a, b) => a + Math.pow(b.y - avg, 2), 0) / n,
            startValue: values[values.length - 1].y,
            endValue: values[0].y,
            changePercent: ((values[0].y - values[values.length - 1].y) / values[values.length - 1].y) * 100
          };
        }
      }
      
      if (environmentalData.length > 0) {
        // Calculate trends for environmental metrics
        const metrics = ['air_temp', 'ghi', 'dni'];
        
        for (const metric of metrics) {
          const values = environmentalData.map((d, i) => ({ 
            x: i,
            y: d[metric as keyof typeof d] as number,
            timestamp: d.timestamp
          }));
          
          // Skip if insufficient data
          if (values.length < 3) continue;
          
          // Calculate simple linear regression
          const n = values.length;
          const sumX = values.reduce((a, b) => a + b.x, 0);
          const sumY = values.reduce((a, b) => a + b.y, 0);
          const sumXY = values.reduce((a, b) => a + (b.x * b.y), 0);
          const sumXX = values.reduce((a, b) => a + (b.x * b.x), 0);
          
          const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;
          
          // Calculate min, max, avg
          const min = Math.min(...values.map(v => v.y));
          const max = Math.max(...values.map(v => v.y));
          const avg = sumY / n;
          
          // Store trend data
          trends[metric] = {
            slope,
            intercept,
            direction: slope > 0.001 ? 'increasing' : slope < -0.001 ? 'decreasing' : 'stable',
            strengthAbs: Math.abs(slope),
            min,
            max,
            avg,
            range: max - min,
            variance: values.reduce((a, b) => a + Math.pow(b.y - avg, 2), 0) / n,
            startValue: values[values.length - 1].y,
            endValue: values[0].y,
            changePercent: ((values[0].y - values[values.length - 1].y) / values[values.length - 1].y) * 100
          };
        }
      }
      
      // Generate insights based on trends
      let insights: string[] = [];
      
      // Power insights
      if (trends.totalLoad) {
        if (trends.totalLoad.direction === 'increasing' && trends.totalLoad.strengthAbs > 0.01) {
          insights.push(`Total power load is increasing significantly (${trends.totalLoad.changePercent.toFixed(1)}% change).`);
        } else if (trends.totalLoad.direction === 'decreasing' && trends.totalLoad.strengthAbs > 0.01) {
          insights.push(`Total power load is decreasing significantly (${Math.abs(trends.totalLoad.changePercent).toFixed(1)}% change).`);
        }
      }
      
      if (trends.solarOutput && trends.mainGridPower) {
        if (trends.solarOutput.direction === 'increasing' && trends.mainGridPower.direction === 'decreasing') {
          insights.push(`Solar output is increasing while grid power usage is decreasing, indicating effective solar utilization.`);
        } else if (trends.solarOutput.direction === 'decreasing' && trends.mainGridPower.direction === 'increasing') {
          insights.push(`Solar output is decreasing while grid power usage is increasing, possibly due to weather conditions or system issues.`);
        }
      }
      
      // Environmental insights
      if (trends.air_temp && trends.ghi) {
        if (trends.air_temp.direction === 'increasing' && trends.ghi.direction === 'increasing') {
          insights.push(`Both temperature and solar irradiance are increasing, typical of clear weather conditions.`);
        } else if (trends.air_temp.direction === 'decreasing' && trends.ghi.direction === 'decreasing') {
          insights.push(`Both temperature and solar irradiance are decreasing, indicating potential cloud cover or weather changes.`);
        }
      }
      
      return {
        dataType,
        timeRange,
        granularity,
        datapointCount: {
          power: powerData.length,
          environmental: environmentalData.length
        },
        trends,
        insights,
        analysisTime: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error analyzing trends:", error);
      throw error;
    }
  }
  
  /**
   * Break down complex tasks into smaller subtasks
   */
  private async decomposeTask(
    input: { task: string }, 
    params: { maxSubtasks?: number, assignee?: string } = {}
  ): Promise<any> {
    try {
      const taskDescription = input.task;
      const maxSubtasks = params.maxSubtasks || 5;
      const assignee = params.assignee;
      
      // Use AI service to decompose the task
      const decompositionResult = await this.aiService.generateDataAnalytics({
        task: 'task_decomposition',
        description: taskDescription,
        maxSubtasks
      });
      
      // Parse the AI-generated subtasks
      let subtasks: any[] = [];
      
      if (decompositionResult && decompositionResult.subtasks) {
        subtasks = decompositionResult.subtasks.map((st: any, index: number) => ({
          id: index + 1,
          name: st.title || `Subtask ${index + 1}`,
          description: st.description || '',
          priority: st.priority || 'medium',
          estimatedEffort: st.estimatedEffort || 'medium',
          prerequisites: st.prerequisites || [],
          assignee: assignee || null
        }));
      } else {
        // Fallback to simple decomposition if AI service fails
        const words = taskDescription.split(/\s+/);
        const subtaskCount = Math.min(maxSubtasks, Math.max(2, Math.ceil(words.length / 15)));
        
        for (let i = 0; i < subtaskCount; i++) {
          subtasks.push({
            id: i + 1,
            name: `Subtask ${i + 1}`,
            description: `Part ${i + 1} of ${taskDescription}`,
            priority: 'medium',
            estimatedEffort: 'medium',
            prerequisites: i > 0 ? [i] : [],
            assignee: assignee || null
          });
        }
      }
      
      return {
        originalTask: taskDescription,
        subtaskCount: subtasks.length,
        subtasks,
        workflow: {
          sequential: subtasks.every((st, i) => i === 0 || st.prerequisites.includes(i)),
          parallel: subtasks.every(st => st.prerequisites.length === 0)
        }
      };
    } catch (error) {
      console.error("Error decomposing task:", error);
      throw error;
    }
  }
  
  /**
   * Generate insights about energy usage patterns
   */
  private async generateEnergyInsights(
    input: any, 
    params: { timeRange?: string, includeRecommendations?: boolean } = {}
  ): Promise<any> {
    try {
      const timeRange = params.timeRange || '7d';
      const includeRecommendations = params.includeRecommendations !== false;
      
      // Get power and environmental data
      const powerData = await db.select().from(schema.powerData)
        .orderBy(desc(schema.powerData.timestamp))
        .limit(168);
      
      const environmentalData = await db.select().from(schema.environmentalData)
        .orderBy(desc(schema.environmentalData.timestamp))
        .limit(168);
      
      // Use AI service to generate insights
      const insights = await this.aiService.generateEnergyRecommendations({
        powerData,
        environmentalData,
        timeRange,
        includeRecommendations
      });
      
      return {
        timeRange,
        insights: insights.insights || [],
        recommendations: includeRecommendations ? (insights.recommendations || []) : [],
        metrics: insights.metrics || {},
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("Error generating energy insights:", error);
      throw error;
    }
  }
}

// Export service as a singleton
export const mcpService = new MCPService();