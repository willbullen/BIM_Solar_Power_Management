/**
 * This script migrates the database to add scheduled reports and report templates tables
 */
import { db } from './db';
import { schema } from '../shared/schema';

export async function migrate() {
  console.log('Starting scheduled reports tables migration...');
  
  try {
    await createScheduledReportsTables();
    console.log('Scheduled reports tables created successfully');
    
    await createDefaultReportTemplates();
    console.log('Default report templates created successfully');
    
    console.log('Scheduled reports migration completed successfully');
  } catch (error) {
    console.error('Error during scheduled reports migration:', error);
  }
}

/**
 * Create the scheduled reports tables
 */
async function createScheduledReportsTables() {
  // Create report templates table
  await db.schema
    .createTable(schema.reportTemplates)
    .ifNotExists()
    .execute();
  
  console.log('Report templates table created');
  
  // Create scheduled reports table
  await db.schema
    .createTable(schema.scheduledReports)
    .ifNotExists()
    .execute();
  
  console.log('Scheduled reports table created');
}

/**
 * Create default report templates
 */
async function createDefaultReportTemplates() {
  // Check if any templates already exist
  const existingTemplates = await db.select().from(schema.reportTemplates);
  
  if (existingTemplates.length > 0) {
    console.log(`Found ${existingTemplates.length} existing templates, skipping default creation`);
    return;
  }
  
  // Create default report templates
  
  // Daily summary template
  await db.insert(schema.reportTemplates).values({
    name: 'Daily Power Summary',
    description: 'Template for daily power usage summary reports',
    content: `# Daily Power Usage Summary

## Overview
{summary}

## Key Metrics
- **Total Power Consumption**: {totalConsumption} kWh
- **Solar Generation**: {solarGeneration} kWh
- **Grid Import**: {gridImport} kWh
- **Peak Load**: {peakLoad} kW at {peakTime}
- **Energy Cost**: €{energyCost}

## Recommendations
{recommendations}

---
Report generated automatically by Emporium Power Monitoring Dashboard.
`,
    parameters: {
      includeCharts: true,
      includeCosts: true,
      showRecommendations: true
    },
    createdBy: 1 // Default admin user
  });
  
  // Energy efficiency template
  await db.insert(schema.reportTemplates).values({
    name: 'Energy Efficiency Analysis',
    description: 'Template for weekly energy efficiency analysis reports',
    content: `# Energy Efficiency Analysis

## Efficiency Overview
{efficiencyOverview}

## Equipment Performance
{equipmentPerformance}

## Potential Savings
{potentialSavings}

## Recommendations
{recommendations}

---
Report generated automatically by Emporium Power Monitoring Dashboard.
`,
    parameters: {
      includeEquipmentDetails: true,
      includeComparisons: true,
      showCostSavings: true
    },
    createdBy: 1 // Default admin user
  });
  
  // Anomaly detection template
  await db.insert(schema.reportTemplates).values({
    name: 'Power Anomaly Report',
    description: 'Template for power consumption anomaly reports',
    content: `# Power Consumption Anomaly Report

## Alert Summary
{alertSummary}

## Detected Anomalies
{anomalyDetails}

## Impact Assessment
{impactAssessment}

## Recommended Actions
{recommendedActions}

---
Report generated automatically by Emporium Power Monitoring Dashboard.
`,
    parameters: {
      includeSeverity: true,
      includeHistoricalContext: true,
      includeActionableItems: true
    },
    createdBy: 1 // Default admin user
  });
  
  // Forecast accuracy template
  await db.insert(schema.reportTemplates).values({
    name: 'Forecast Accuracy Report',
    description: 'Template for solar forecast accuracy reports',
    content: `# Solar Forecast Accuracy Report

## Accuracy Summary
{accuracySummary}

## Forecast vs Actual
{forecastVsActual}

## Weather Impact Analysis
{weatherImpact}

## Recommendations
{recommendations}

---
Report generated automatically by Emporium Power Monitoring Dashboard.
`,
    parameters: {
      includeCharts: true,
      includeSolarPerformanceRatio: true,
      includeWeatherCorrelation: true
    },
    createdBy: 1 // Default admin user
  });
  
  console.log('Created 4 default report templates');
}

// Run the migration if this script is executed directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}