/**
 * This script migrates the database to add MCP tasks table
 */
import { db } from './db';
import { mcpTasks } from '../shared/schema';
import { MCPService, TaskStatus, TaskPriority } from './services/mcp-service';

export async function migrate() {
  console.log('Starting MCP tasks migration...');
  
  try {
    await createMcpTasksTable();
    console.log('MCP tasks table created successfully');
    
    await createInitialTasks();
    console.log('Initial MCP tasks created successfully');
    
    // Initialize the MCP service as a singleton
    MCPService.getInstance();
    console.log('MCP Service initialized');
    
    console.log('MCP migration completed successfully');
  } catch (error) {
    console.error('Error during MCP migration:', error);
  }
}

/**
 * Create the MCP tasks table
 */
async function createMcpTasksTable() {
  await db.schema
    .createTable(mcpTasks)
    .ifNotExists()
    .execute();
  
  console.log('MCP tasks table created');
}

/**
 * Create initial MCP tasks
 */
async function createInitialTasks() {
  // Check if any tasks already exist
  const existingTasks = await db.select().from(mcpTasks);
  
  if (existingTasks.length > 0) {
    console.log(`Found ${existingTasks.length} existing MCP tasks, skipping initial creation`);
    return;
  }
  
  // Create initial sample tasks
  
  // Task 1: Daily power data analysis
  await db.insert(mcpTasks).values({
    name: 'Daily Power Data Analysis',
    description: 'Analyze power consumption data and generate insights',
    capability: 'data_summarization',
    provider: 'analysis',
    parameters: {
      focusAreas: 'power consumption patterns, anomalies, efficiency',
      format: 'json',
      maxLength: 500
    },
    status: TaskStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    createdBy: 1, // Default admin user
    scheduledFor: new Date(Date.now() + 3600000), // 1 hour from now
    metadata: {
      recurring: true,
      recurringPeriod: 'daily'
    }
  });
  
  // Task 2: Anomaly detection for environmental data
  await db.insert(mcpTasks).values({
    name: 'Environmental Data Anomaly Detection',
    description: 'Detect anomalies in environmental data readings',
    capability: 'anomaly_detection',
    provider: 'analysis',
    parameters: {
      method: 'std_dev',
      threshold: 2.5,
      timeField: 'timestamp',
      valueField: 'air_temp'
    },
    status: TaskStatus.PENDING,
    priority: TaskPriority.HIGH,
    createdBy: 1, // Default admin user
    scheduledFor: new Date(Date.now() + 7200000), // 2 hours from now
    metadata: {
      recurring: true,
      recurringPeriod: 'daily'
    }
  });
  
  // Task 3: Proactive planning for energy efficiency
  await db.insert(mcpTasks).values({
    name: 'Energy Efficiency Planning',
    description: 'Generate proactive plans for improving energy efficiency',
    capability: 'proactive_planning',
    provider: 'planning',
    parameters: {
      focusAreas: ['energy efficiency', 'cost reduction', 'solar optimization'],
      timeHorizon: '7d' // 7 days
    },
    status: TaskStatus.SCHEDULED,
    priority: TaskPriority.MEDIUM,
    createdBy: 1, // Default admin user
    scheduledFor: new Date(Date.now() + 86400000), // 1 day from now
    metadata: {
      recurring: true,
      recurringPeriod: 'weekly'
    }
  });
  
  console.log('Created 3 initial MCP tasks');
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