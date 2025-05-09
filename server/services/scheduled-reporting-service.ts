import { db } from "../db";
import * as schema from "../../shared/schema";
import { eq } from "drizzle-orm";
import { AIService } from "../ai-service";
import { agentNotificationService } from "./agent-notification-service";

/**
 * Service for handling scheduled reports
 */
export class ScheduledReportingService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Get all report templates
   */
  async getAllTemplates(category?: string): Promise<schema.ReportTemplate[]> {
    try {
      let query = db.select().from(schema.reportTemplates);
      
      if (category) {
        query = query.where(eq(schema.reportTemplates.category, category));
      }
      
      return await query.orderBy(schema.reportTemplates.name);
    } catch (error) {
      console.error("Error getting report templates:", error);
      throw error;
    }
  }

  /**
   * Get a report template by ID
   */
  async getTemplateById(id: number): Promise<schema.ReportTemplate | null> {
    try {
      const result = await db.select().from(schema.reportTemplates)
        .where(eq(schema.reportTemplates.id, id))
        .limit(1);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error getting report template with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new report template
   */
  async createTemplate(data: schema.InsertReportTemplate): Promise<schema.ReportTemplate> {
    try {
      const result = await db.insert(schema.reportTemplates).values(data).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating report template:", error);
      throw error;
    }
  }

  /**
   * Update a report template
   */
  async updateTemplate(id: number, data: Partial<schema.InsertReportTemplate>): Promise<schema.ReportTemplate> {
    try {
      const result = await db.update(schema.reportTemplates)
        .set({
          ...data,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.reportTemplates.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error(`Error updating report template with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a report template
   */
  async deleteTemplate(id: number): Promise<boolean> {
    try {
      // First check if there are any scheduled reports using this template
      const reports = await db.select({ count: db.fn.count() })
        .from(schema.scheduledReports)
        .where(eq(schema.scheduledReports.templateId, id));
      
      if (Number(reports[0].count) > 0) {
        throw new Error("Cannot delete template with active scheduled reports");
      }
      
      const result = await db.delete(schema.reportTemplates)
        .where(eq(schema.reportTemplates.id, id));
      
      return !!result.rowCount;
    } catch (error) {
      console.error(`Error deleting report template with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all scheduled reports
   */
  async getAllScheduledReports(userId?: number): Promise<schema.ScheduledReport[]> {
    try {
      let query = db.select().from(schema.scheduledReports);
      
      if (userId) {
        query = query.where(eq(schema.scheduledReports.userId, userId));
      }
      
      return await query.orderBy(schema.scheduledReports.nextRun);
    } catch (error) {
      console.error("Error getting scheduled reports:", error);
      throw error;
    }
  }

  /**
   * Get a scheduled report by ID
   */
  async getScheduledReportById(id: number): Promise<schema.ScheduledReport | null> {
    try {
      const result = await db.select().from(schema.scheduledReports)
        .where(eq(schema.scheduledReports.id, id))
        .limit(1);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error getting scheduled report with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new scheduled report
   */
  async createScheduledReport(data: schema.InsertScheduledReport): Promise<schema.ScheduledReport> {
    try {
      // Calculate next run time based on schedule
      const nextRun = this.calculateNextRunTime(data.schedule);
      
      const result = await db.insert(schema.scheduledReports).values({
        ...data,
        nextRun
      }).returning();
      
      return result[0];
    } catch (error) {
      console.error("Error creating scheduled report:", error);
      throw error;
    }
  }

  /**
   * Update a scheduled report
   */
  async updateScheduledReport(id: number, data: Partial<schema.InsertScheduledReport>): Promise<schema.ScheduledReport> {
    try {
      // If schedule was updated, recalculate next run time
      let nextRun;
      if (data.schedule) {
        nextRun = this.calculateNextRunTime(data.schedule);
      }
      
      const result = await db.update(schema.scheduledReports)
        .set({
          ...data,
          ...(nextRun ? { nextRun } : {}),
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.scheduledReports.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error(`Error updating scheduled report with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.scheduledReports)
        .where(eq(schema.scheduledReports.id, id));
      
      return !!result.rowCount;
    } catch (error) {
      console.error(`Error deleting scheduled report with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Execute a scheduled report manually
   */
  async executeReportManually(id: number): Promise<any> {
    try {
      const report = await this.getScheduledReportById(id);
      if (!report) {
        throw new Error(`Report with ID ${id} not found`);
      }
      
      const template = await this.getTemplateById(report.templateId);
      if (!template) {
        throw new Error(`Template with ID ${report.templateId} not found`);
      }
      
      // Parse parameters
      const parameters = report.parameters ? JSON.parse(report.parameters) : {};
      
      // Generate report content
      const reportContent = await this.generateReportFromTemplate(template, parameters);
      
      // Update last run time
      await db.update(schema.scheduledReports)
        .set({
          lastRun: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.scheduledReports.id, id));
      
      // Send notifications to recipients
      await this.sendReportNotifications(report, reportContent);
      
      return { 
        success: true,
        reportId: id,
        executedAt: new Date().toISOString(),
        content: reportContent
      };
    } catch (error) {
      console.error(`Error executing report with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Process all reports that are due to run
   * This would typically be called by a scheduler/cron job
   */
  async processScheduledReports(): Promise<{ processed: number, errors: number }> {
    try {
      const now = new Date().toISOString();
      
      // Find all reports due to run (nextRun <= now and active)
      const dueReports = await db.select().from(schema.scheduledReports)
        .where(eq(schema.scheduledReports.active, true))
        .where(db.sql`${schema.scheduledReports.nextRun} <= ${now}`);
      
      console.log(`Processing ${dueReports.length} scheduled reports`);
      
      let processed = 0;
      let errors = 0;
      
      for (const report of dueReports) {
        try {
          // Execute report
          await this.executeReportManually(report.id);
          
          // Update next run time
          const nextRun = this.calculateNextRunTime(report.schedule);
          await db.update(schema.scheduledReports)
            .set({
              nextRun,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.scheduledReports.id, report.id));
          
          processed++;
        } catch (error) {
          console.error(`Error processing scheduled report ${report.id}:`, error);
          errors++;
        }
      }
      
      return { processed, errors };
    } catch (error) {
      console.error("Error processing scheduled reports:", error);
      throw error;
    }
  }

  /**
   * Calculate the next run time based on a cron expression
   * Simple implementation for common schedules
   */
  private calculateNextRunTime(schedule: string): string {
    const now = new Date();
    let nextRun = new Date(now);
    
    // Simple schedule parser for common patterns
    // In a real app, use a cron parser library
    if (schedule === '@hourly') {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(0, 0, 0);
    } else if (schedule === '@daily') {
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
    } else if (schedule === '@weekly') {
      nextRun.setDate(nextRun.getDate() + (7 - nextRun.getDay()));
      nextRun.setHours(0, 0, 0, 0);
    } else if (schedule === '@monthly') {
      nextRun.setMonth(nextRun.getMonth() + 1);
      nextRun.setDate(1);
      nextRun.setHours(0, 0, 0, 0);
    } else if (schedule.startsWith('every')) {
      // Format: "every X hours/days/weeks/months"
      const parts = schedule.split(' ');
      if (parts.length === 3) {
        const value = parseInt(parts[1], 10);
        const unit = parts[2];
        
        if (!isNaN(value)) {
          if (unit === 'minutes' || unit === 'minute') {
            nextRun.setMinutes(nextRun.getMinutes() + value);
          } else if (unit === 'hours' || unit === 'hour') {
            nextRun.setHours(nextRun.getHours() + value);
          } else if (unit === 'days' || unit === 'day') {
            nextRun.setDate(nextRun.getDate() + value);
          } else if (unit === 'weeks' || unit === 'week') {
            nextRun.setDate(nextRun.getDate() + (value * 7));
          } else if (unit === 'months' || unit === 'month') {
            nextRun.setMonth(nextRun.getMonth() + value);
          }
        }
      }
    }
    
    return nextRun.toISOString();
  }

  /**
   * Generate report content from a template and parameters
   */
  private async generateReportFromTemplate(template: schema.ReportTemplate, parameters: any): Promise<string> {
    try {
      // Get data needed for the report based on category
      let reportData: any = {};
      
      if (template.category === 'energy') {
        // Fetch power and environmental data for the report
        const powerData = await db.select().from(schema.powerData)
          .orderBy(schema.powerData.timestamp, "desc")
          .limit(parameters.limit || 100);
          
        const environmentalData = await db.select().from(schema.environmentalData)
          .orderBy(schema.environmentalData.timestamp, "desc")
          .limit(parameters.limit || 100);
          
        reportData = { powerData, environmentalData };
      } else if (template.category === 'performance') {
        // For performance reports, calculate efficiency metrics
        const powerData = await db.select().from(schema.powerData)
          .orderBy(schema.powerData.timestamp, "desc")
          .limit(parameters.limit || 100);
          
        const environmentalData = await db.select().from(schema.environmentalData)
          .orderBy(schema.environmentalData.timestamp, "desc")
          .limit(parameters.limit || 100);
          
        // Calculate averages and other metrics
        const avgPower = powerData.reduce((sum, item) => sum + item.powerUsage, 0) / powerData.length;
        const maxPower = Math.max(...powerData.map(item => item.powerUsage));
        
        reportData = { 
          powerData, 
          environmentalData,
          metrics: {
            averagePower: avgPower,
            maxPower,
            periodStart: powerData[powerData.length - 1]?.timestamp,
            periodEnd: powerData[0]?.timestamp
          }
        };
      } else if (template.category === 'forecast') {
        // For forecast reports, include prediction data
        reportData = await this.aiService.generatePredictions({ parameters }, parameters.horizon || '7d');
      }
      
      // Apply template transformations or use AI service to generate report
      let reportContent: string;
      
      if (template.category === 'executive') {
        // Use AI to generate an executive summary
        const result = await this.aiService.generateExecutiveReport(reportData, parameters.type || 'summary');
        reportContent = result.content;
      } else {
        // Simple template substitution for other reports
        reportContent = this.applyTemplateSubstitutions(template.template, reportData);
      }
      
      return reportContent;
    } catch (error) {
      console.error("Error generating report content:", error);
      throw error;
    }
  }
  
  /**
   * Apply simple template substitutions
   */
  private applyTemplateSubstitutions(template: string, data: any): string {
    let result = template;
    
    // Replace {{key}} with the corresponding value from data
    const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
    
    for (const match of matches) {
      const key = match.slice(2, -2).trim();
      let replacement = '';
      
      // Handle nested properties using dot notation
      const parts = key.split('.');
      let value = data;
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }
      
      if (value !== null && value !== undefined) {
        replacement = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
      
      result = result.replace(match, replacement);
    }
    
    return result;
  }
  
  /**
   * Send report notifications to recipients
   */
  private async sendReportNotifications(report: schema.ScheduledReport, content: string): Promise<void> {
    try {
      if (!report.recipients || report.recipients.length === 0) {
        console.log(`No recipients for report ${report.id}`);
        return;
      }
      
      for (const recipient of report.recipients) {
        try {
          // Determine if recipient is a user ID or external identifier (email, phone, etc.)
          if (!isNaN(parseInt(recipient, 10))) {
            // If it's a number, treat as user ID and create in-app notification
            const userId = parseInt(recipient, 10);
            await agentNotificationService.createNotification({
              userId,
              title: `Report: ${report.name}`,
              message: `Your scheduled report "${report.name}" has been generated.`,
              type: 'info',
              priority: 'medium',
              source: 'scheduler',
              category: 'report',
              data: content.substring(0, 1000), // Store a preview of the content
              read: false
            });
          } else if (recipient.includes('@')) {
            // Email address - would integrate with email service
            console.log(`Would send email to ${recipient} with report ${report.id}`);
            // This is where you'd call an email service
          } else {
            // Other identification - possibly mobile number for SMS
            console.log(`Would send notification to ${recipient} with report ${report.id}`);
            // This is where you'd call SMS or other notification service
          }
        } catch (error) {
          console.error(`Error sending notification to recipient ${recipient}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error sending notifications for report ${report.id}:`, error);
      throw error;
    }
  }
}

// Export service as a singleton
export const scheduledReportingService = new ScheduledReportingService();