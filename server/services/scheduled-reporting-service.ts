import { db } from '../db';
import { schema } from '../../shared/schema';
import { AgentService } from '../agent-service';
import { AgentNotificationService } from './agent-notification-service';
import { AIService } from '../ai-service';
import { DateTime } from 'luxon';

export interface ScheduledReport {
  id: number;
  name: string;
  description: string;
  schedule: string;
  recipients: string[];
  reportType: string;
  lastRun: Date | null;
  nextRun: Date | null;
  createdBy: number;
  isActive: boolean;
  templateId: number | null;
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  content: string;
  parameters: Record<string, any> | null;
  createdBy: number;
}

/**
 * Service for managing scheduled reports and report templates
 */
export class ScheduledReportingService {
  private agentService: AgentService;
  private notificationService: AgentNotificationService;
  private aiService: AIService;
  private activeTimers: Map<number, NodeJS.Timeout> = new Map();
  
  constructor() {
    this.agentService = new AgentService();
    this.notificationService = new AgentNotificationService();
    this.aiService = new AIService();
    
    // Initialize active scheduled reports
    this.initializeScheduledReports();
  }
  
  /**
   * Initialize all active scheduled reports
   */
  private async initializeScheduledReports(): Promise<void> {
    try {
      const activeReports = await db.select().from(schema.scheduledReports)
        .where(schema.scheduledReports.isActive.equals(true));
      
      activeReports.forEach(report => {
        this.scheduleNextRun(report);
      });
      
      console.log(`Scheduled reporting service initialized with ${activeReports.length} active reports`);
    } catch (error) {
      console.error('Error initializing scheduled reports:', error);
    }
  }
  
  /**
   * Schedule the next run for a report
   */
  private scheduleNextRun(report: ScheduledReport): void {
    // Clear any existing timer for this report
    if (this.activeTimers.has(report.id)) {
      clearTimeout(this.activeTimers.get(report.id)!);
      this.activeTimers.delete(report.id);
    }
    
    // Calculate next run time based on schedule
    const nextRun = this.calculateNextRunTime(report.schedule);
    if (!nextRun) {
      console.error(`Invalid schedule format for report ${report.id}: ${report.schedule}`);
      return;
    }
    
    // Update the next run time in the database
    this.updateNextRunTime(report.id, nextRun);
    
    // Calculate delay in milliseconds
    const now = new Date();
    const delay = nextRun.getTime() - now.getTime();
    
    if (delay <= 0) {
      // Run immediately if the scheduled time is in the past
      this.executeReport(report.id);
      return;
    }
    
    // Schedule the report execution
    const timer = setTimeout(() => {
      this.executeReport(report.id);
    }, delay);
    
    // Store the timer reference
    this.activeTimers.set(report.id, timer);
    
    console.log(`Scheduled report ${report.id} for execution at ${nextRun.toISOString()}`);
  }
  
  /**
   * Calculate the next run time based on schedule string
   * Schedule format: "<minute> <hour> <day> <month> <dayOfWeek>"
   * Examples:
   * - "0 9 * * 1-5" - Runs at 9:00 AM Monday through Friday
   * - "0 0 1 * *" - Runs at midnight on the first day of each month
   * - "0 */6 * * *" - Runs every 6 hours
   */
  private calculateNextRunTime(schedule: string): Date | null {
    try {
      // Simple cron-like parser
      const parts = schedule.split(' ');
      if (parts.length !== 5) {
        return null;
      }
      
      // For a simple implementation, we'll use a more basic approach
      // In a production system, use a proper cron parser library
      const now = DateTime.now();
      let nextRun = now.plus({ hours: 1 }); // Default to 1 hour from now
      
      // If this is a daily report (e.g., "0 9 * * *")
      if (parts[0] === '0' && /^\d+$/.test(parts[1]) && parts[2] === '*' && parts[3] === '*') {
        const hour = parseInt(parts[1], 10);
        nextRun = now.set({ hour, minute: 0, second: 0, millisecond: 0 });
        
        // If today's run time has already passed, schedule for tomorrow
        if (nextRun <= now) {
          nextRun = nextRun.plus({ days: 1 });
        }
      }
      
      // For hourly reports (e.g., "0 */6 * * *")
      else if (parts[0] === '0' && parts[1].startsWith('*/')) {
        const hourInterval = parseInt(parts[1].substring(2), 10);
        const currentHour = now.hour;
        const nextHour = currentHour + (hourInterval - (currentHour % hourInterval));
        
        nextRun = now.set({ hour: nextHour % 24, minute: 0, second: 0, millisecond: 0 });
        
        // If the calculated time is in the past, add the interval
        if (nextRun <= now) {
          nextRun = nextRun.plus({ hours: hourInterval });
        }
      }
      
      return nextRun.toJSDate();
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return null;
    }
  }
  
  /**
   * Update the next run time in the database
   */
  private async updateNextRunTime(reportId: number, nextRun: Date): Promise<void> {
    try {
      await db.update(schema.scheduledReports)
        .set({ nextRun })
        .where(schema.scheduledReports.id.equals(reportId));
    } catch (error) {
      console.error(`Error updating next run time for report ${reportId}:`, error);
    }
  }
  
  /**
   * Execute a scheduled report
   */
  private async executeReport(reportId: number): Promise<void> {
    try {
      // Get the report details
      const report = await db.select().from(schema.scheduledReports)
        .where(schema.scheduledReports.id.equals(reportId))
        .limit(1);
      
      if (!report || report.length === 0) {
        console.error(`Report ${reportId} not found`);
        return;
      }
      
      const reportData = report[0];
      
      // If the report is no longer active, don't execute it
      if (!reportData.isActive) {
        this.activeTimers.delete(reportId);
        return;
      }
      
      console.log(`Executing scheduled report: ${reportData.name}`);
      
      // Get the report template
      let template = null;
      if (reportData.templateId) {
        const templates = await db.select().from(schema.reportTemplates)
          .where(schema.reportTemplates.id.equals(reportData.templateId))
          .limit(1);
        
        if (templates && templates.length > 0) {
          template = templates[0];
        }
      }
      
      // Generate report content
      const content = await this.generateReportContent(reportData, template);
      
      // Send notifications to all recipients
      for (const recipient of reportData.recipients) {
        await this.notificationService.createNotification({
          userId: reportData.createdBy,
          title: `Scheduled Report: ${reportData.name}`,
          message: content,
          type: 'report',
          priority: 'normal',
          metadata: {
            reportId: reportData.id,
            reportType: reportData.reportType
          }
        });
      }
      
      // Update the last run time
      await db.update(schema.scheduledReports)
        .set({ 
          lastRun: new Date()
        })
        .where(schema.scheduledReports.id.equals(reportId));
      
      // Schedule the next run
      this.scheduleNextRun(reportData);
      
    } catch (error) {
      console.error(`Error executing report ${reportId}:`, error);
      
      // Even if there's an error, try to schedule the next run
      try {
        const report = await db.select().from(schema.scheduledReports)
          .where(schema.scheduledReports.id.equals(reportId))
          .limit(1);
        
        if (report && report.length > 0) {
          this.scheduleNextRun(report[0]);
        }
      } catch (innerError) {
        console.error(`Error rescheduling report ${reportId}:`, innerError);
      }
    }
  }
  
  /**
   * Generate report content based on the report type and template
   */
  private async generateReportContent(
    report: ScheduledReport, 
    template: ReportTemplate | null
  ): Promise<string> {
    let content = '';
    
    // If there's a template, use it as a base
    if (template) {
      content = template.content;
    }
    
    // Customize content based on report type
    switch (report.reportType) {
      case 'daily_summary':
        return await this.generateDailySummaryReport(content);
      case 'energy_efficiency':
        return await this.generateEnergyEfficiencyReport(content);
      case 'anomaly_detection':
        return await this.generateAnomalyDetectionReport(content);
      case 'forecast_accuracy':
        return await this.generateForecastAccuracyReport(content);
      default:
        // Generate a generic report if type is not recognized
        return content || `Scheduled Report: ${report.name}\n\n${report.description}\n\nGenerated on ${new Date().toLocaleString()}`;
    }
  }
  
  /**
   * Generate a daily summary report
   */
  private async generateDailySummaryReport(baseContent: string): Promise<string> {
    try {
      // Get the latest power and environmental data
      const latestPowerData = await db.select().from(schema.powerData)
        .orderBy(schema.powerData.timestamp.desc())
        .limit(24);
      
      const latestEnvData = await db.select().from(schema.environmentalData)
        .orderBy(schema.environmentalData.timestamp.desc())
        .limit(24);
      
      // Use the AI service to generate a report
      const reportData = {
        powerData: latestPowerData,
        environmentalData: latestEnvData
      };
      
      const report = await this.aiService.generateExecutiveReport(reportData, 'daily');
      
      // Combine with base content if provided
      if (baseContent) {
        return `${baseContent}\n\n${report.content}`;
      }
      
      return report.content;
    } catch (error) {
      console.error('Error generating daily summary report:', error);
      return baseContent || 'Error generating daily summary report. Please check the system logs.';
    }
  }
  
  /**
   * Generate an energy efficiency report
   */
  private async generateEnergyEfficiencyReport(baseContent: string): Promise<string> {
    try {
      // Get the latest power data
      const latestPowerData = await db.select().from(schema.powerData)
        .orderBy(schema.powerData.timestamp.desc())
        .limit(168); // Last week of hourly data
      
      // Use the AI service to generate recommendations
      const recommendations = await this.aiService.generateEnergyRecommendations({
        powerData: latestPowerData
      });
      
      // Combine with base content if provided
      if (baseContent) {
        return `${baseContent}\n\n${recommendations.content}`;
      }
      
      return recommendations.content;
    } catch (error) {
      console.error('Error generating energy efficiency report:', error);
      return baseContent || 'Error generating energy efficiency report. Please check the system logs.';
    }
  }
  
  /**
   * Generate an anomaly detection report
   */
  private async generateAnomalyDetectionReport(baseContent: string): Promise<string> {
    try {
      // Get the latest power data
      const latestPowerData = await db.select().from(schema.powerData)
        .orderBy(schema.powerData.timestamp.desc())
        .limit(168); // Last week of hourly data
      
      // Use the AI service to generate analytics
      const analytics = await this.aiService.generateDataAnalytics({
        powerData: latestPowerData,
        focus: 'anomalies'
      });
      
      // Combine with base content if provided
      if (baseContent) {
        return `${baseContent}\n\n${analytics.content}`;
      }
      
      return analytics.content;
    } catch (error) {
      console.error('Error generating anomaly detection report:', error);
      return baseContent || 'Error generating anomaly detection report. Please check the system logs.';
    }
  }
  
  /**
   * Generate a forecast accuracy report
   */
  private async generateForecastAccuracyReport(baseContent: string): Promise<string> {
    try {
      // Get the forecast data from a week ago
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const forecastData = await db.select().from(schema.environmentalData)
        .where(schema.environmentalData.timestamp.gt(oneWeekAgo))
        .where(schema.environmentalData.forecastHorizon.isNotNull())
        .orderBy(schema.environmentalData.timestamp.asc());
      
      // Get the actual data for the same period
      const actualData = await db.select().from(schema.environmentalData)
        .where(schema.environmentalData.timestamp.gt(oneWeekAgo))
        .where(schema.environmentalData.forecastHorizon.isNull())
        .orderBy(schema.environmentalData.timestamp.asc());
      
      // Use the AI service to analyze the forecast accuracy
      const analytics = await this.aiService.generateDataAnalytics({
        forecastData,
        actualData,
        focus: 'forecast_accuracy'
      });
      
      // Combine with base content if provided
      if (baseContent) {
        return `${baseContent}\n\n${analytics.content}`;
      }
      
      return analytics.content;
    } catch (error) {
      console.error('Error generating forecast accuracy report:', error);
      return baseContent || 'Error generating forecast accuracy report. Please check the system logs.';
    }
  }
  
  /**
   * Create a new scheduled report
   */
  async createScheduledReport(reportData: Omit<ScheduledReport, 'id' | 'lastRun' | 'nextRun'>): Promise<ScheduledReport> {
    try {
      const [report] = await db.insert(schema.scheduledReports).values({
        ...reportData,
        lastRun: null,
        nextRun: this.calculateNextRunTime(reportData.schedule)
      }).returning();
      
      // If the report is active, schedule it
      if (report && report.isActive) {
        this.scheduleNextRun(report);
      }
      
      return report;
    } catch (error) {
      console.error('Error creating scheduled report:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing scheduled report
   */
  async updateScheduledReport(reportId: number, reportData: Partial<Omit<ScheduledReport, 'id'>>): Promise<ScheduledReport> {
    try {
      const [updatedReport] = await db.update(schema.scheduledReports)
        .set(reportData)
        .where(schema.scheduledReports.id.equals(reportId))
        .returning();
      
      // If the schedule or active status changed, reschedule
      if (updatedReport && (reportData.schedule || reportData.isActive !== undefined)) {
        if (updatedReport.isActive) {
          this.scheduleNextRun(updatedReport);
        } else {
          // If report is now inactive, clear any scheduled timer
          if (this.activeTimers.has(reportId)) {
            clearTimeout(this.activeTimers.get(reportId)!);
            this.activeTimers.delete(reportId);
          }
        }
      }
      
      return updatedReport;
    } catch (error) {
      console.error(`Error updating scheduled report ${reportId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a scheduled report
   */
  async deleteScheduledReport(reportId: number): Promise<void> {
    try {
      // Clear any scheduled timer
      if (this.activeTimers.has(reportId)) {
        clearTimeout(this.activeTimers.get(reportId)!);
        this.activeTimers.delete(reportId);
      }
      
      await db.delete(schema.scheduledReports)
        .where(schema.scheduledReports.id.equals(reportId));
    } catch (error) {
      console.error(`Error deleting scheduled report ${reportId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new report template
   */
  async createReportTemplate(templateData: Omit<ReportTemplate, 'id'>): Promise<ReportTemplate> {
    try {
      const [template] = await db.insert(schema.reportTemplates).values(templateData).returning();
      return template;
    } catch (error) {
      console.error('Error creating report template:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing report template
   */
  async updateReportTemplate(templateId: number, templateData: Partial<Omit<ReportTemplate, 'id'>>): Promise<ReportTemplate> {
    try {
      const [updatedTemplate] = await db.update(schema.reportTemplates)
        .set(templateData)
        .where(schema.reportTemplates.id.equals(templateId))
        .returning();
      
      return updatedTemplate;
    } catch (error) {
      console.error(`Error updating report template ${templateId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete a report template
   */
  async deleteReportTemplate(templateId: number): Promise<void> {
    try {
      await db.delete(schema.reportTemplates)
        .where(schema.reportTemplates.id.equals(templateId));
    } catch (error) {
      console.error(`Error deleting report template ${templateId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all scheduled reports
   */
  async getAllScheduledReports(): Promise<ScheduledReport[]> {
    try {
      return await db.select().from(schema.scheduledReports);
    } catch (error) {
      console.error('Error getting scheduled reports:', error);
      throw error;
    }
  }
  
  /**
   * Get a scheduled report by ID
   */
  async getScheduledReportById(reportId: number): Promise<ScheduledReport | null> {
    try {
      const reports = await db.select().from(schema.scheduledReports)
        .where(schema.scheduledReports.id.equals(reportId))
        .limit(1);
      
      return reports.length > 0 ? reports[0] : null;
    } catch (error) {
      console.error(`Error getting scheduled report ${reportId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all report templates
   */
  async getAllReportTemplates(): Promise<ReportTemplate[]> {
    try {
      return await db.select().from(schema.reportTemplates);
    } catch (error) {
      console.error('Error getting report templates:', error);
      throw error;
    }
  }
  
  /**
   * Get a report template by ID
   */
  async getReportTemplateById(templateId: number): Promise<ReportTemplate | null> {
    try {
      const templates = await db.select().from(schema.reportTemplates)
        .where(schema.reportTemplates.id.equals(templateId))
        .limit(1);
      
      return templates.length > 0 ? templates[0] : null;
    } catch (error) {
      console.error(`Error getting report template ${templateId}:`, error);
      throw error;
    }
  }
  
  /**
   * Execute a report manually, bypassing the schedule
   */
  async executeReportManually(reportId: number): Promise<void> {
    try {
      await this.executeReport(reportId);
    } catch (error) {
      console.error(`Error executing report ${reportId} manually:`, error);
      throw error;
    }
  }
}