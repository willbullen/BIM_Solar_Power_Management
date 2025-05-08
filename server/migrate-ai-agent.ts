import { db } from "./db";
import * as schema from "@shared/schema";

/**
 * This script migrates the database to add AI agent capabilities
 */
async function migrate() {
  console.log("Starting AI agent database migration...");
  
  try {
    // Create all the AI agent related tables
    await createAgentTables();
    console.log("Successfully created AI agent tables");
    
    // Create default agent settings
    await createDefaultAgentSettings();
    console.log("Successfully created default agent settings");
    
    // Create default agent functions
    await createDefaultAgentFunctions();
    console.log("Successfully created default agent functions");
    
    console.log("AI agent database migration completed successfully");
  } catch (error) {
    console.error("Error during AI agent database migration:", error);
    throw error;
  }
}

/**
 * Create all the AI agent related tables
 */
async function createAgentTables() {
  // Agent Functions
  await db.schema.createTable(schema.agentFunctions)
    .ifNotExists()
    .execute();
  
  // Agent Conversations
  await db.schema.createTable(schema.agentConversations)
    .ifNotExists()
    .execute();
  
  // Agent Messages
  await db.schema.createTable(schema.agentMessages)
    .ifNotExists()
    .execute();
  
  // Agent Tasks
  await db.schema.createTable(schema.agentTasks)
    .ifNotExists()
    .execute();
  
  // Agent Settings
  await db.schema.createTable(schema.agentSettings)
    .ifNotExists()
    .execute();
  
  // MCP Tasks
  await db.schema.createTable(schema.mcpTasks)
    .ifNotExists()
    .execute();
  
  // Signal Notifications
  await db.schema.createTable(schema.signalNotifications)
    .ifNotExists()
    .execute();
}

/**
 * Create default agent settings
 */
async function createDefaultAgentSettings() {
  const defaultSettings = [
    {
      name: "agent_enabled",
      value: "true",
      description: "Whether the AI agent is enabled for the application",
      type: "boolean",
      category: "general"
    },
    {
      name: "openai_model",
      value: "gpt-4",
      description: "The OpenAI model used for AI agent operations",
      type: "string",
      category: "models"
    },
    {
      name: "agent_temperature",
      value: "0.7",
      description: "Temperature setting for the AI agent's language model",
      type: "number",
      category: "models"
    },
    {
      name: "agent_max_tokens",
      value: "2000",
      description: "Maximum tokens for agent responses",
      type: "number",
      category: "models"
    },
    {
      name: "agent_history_limit",
      value: "20",
      description: "Maximum number of messages to include in conversation history",
      type: "number",
      category: "limits"
    },
    {
      name: "agent_system_prompt",
      value: "You are an advanced AI Energy Advisor for Emporium Power Monitoring. Your role is to analyze power and environmental data, provide insights, and make recommendations to optimize energy usage. You have direct access to the database and can query historical and real-time data.",
      description: "System prompt for the AI agent",
      type: "string",
      category: "prompts"
    }
  ];

  for (const setting of defaultSettings) {
    // Check if setting already exists
    const existingSetting = await db.query.agentSettings.findFirst({
      where: (fields, { eq }) => eq(fields.name, setting.name)
    });

    if (!existingSetting) {
      await db.insert(schema.agentSettings).values(setting);
    }
  }
}

/**
 * Create default agent functions
 */
async function createDefaultAgentFunctions() {
  const defaultFunctions = [
    {
      name: "queryPowerData",
      description: "Query power data from the database within a specific time range",
      module: "data",
      parameters: {
        type: "object",
        properties: {
          startDate: { 
            type: "string", 
            description: "Start date in ISO format (e.g. 2025-05-01T00:00:00Z)" 
          },
          endDate: { 
            type: "string", 
            description: "End date in ISO format (e.g. 2025-05-08T00:00:00Z)" 
          },
          limit: { 
            type: "number", 
            description: "Maximum number of records to return"
          }
        },
        required: ["startDate", "endDate"]
      },
      returnType: "PowerData[]",
      functionCode: "async function queryPowerData(params) { const { startDate, endDate, limit = 100 } = params; return db.query.powerData.findMany({ where: (fields, { gte, lte }) => ({ and: [ gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }), limit }); }",
      accessLevel: "restricted",
      tags: ["data", "power", "query"]
    },
    {
      name: "queryEnvironmentalData",
      description: "Query environmental data from the database within a specific time range",
      module: "data",
      parameters: {
        type: "object",
        properties: {
          startDate: { 
            type: "string", 
            description: "Start date in ISO format (e.g. 2025-05-01T00:00:00Z)" 
          },
          endDate: { 
            type: "string", 
            description: "End date in ISO format (e.g. 2025-05-08T00:00:00Z)" 
          },
          limit: { 
            type: "number", 
            description: "Maximum number of records to return"
          }
        },
        required: ["startDate", "endDate"]
      },
      returnType: "EnvironmentalData[]",
      functionCode: "async function queryEnvironmentalData(params) { const { startDate, endDate, limit = 100 } = params; return db.query.environmentalData.findMany({ where: (fields, { gte, lte }) => ({ and: [ gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }), limit }); }",
      accessLevel: "restricted",
      tags: ["data", "environmental", "query"]
    },
    {
      name: "getEquipmentList",
      description: "Get a list of all equipment in the system",
      module: "equipment",
      parameters: {
        type: "object",
        properties: {
          active: { 
            type: "boolean", 
            description: "Filter by active status"
          }
        }
      },
      returnType: "Equipment[]",
      functionCode: "async function getEquipmentList(params) { const { active } = params; if (active !== undefined) { return db.query.equipment.findMany({ where: (fields, { eq }) => eq(fields.active, active) }); } return db.query.equipment.findMany(); }",
      accessLevel: "public",
      tags: ["equipment", "query"]
    },
    {
      name: "getEquipmentEfficiency",
      description: "Get efficiency data for a specific piece of equipment",
      module: "equipment",
      parameters: {
        type: "object",
        properties: {
          equipmentId: { 
            type: "number", 
            description: "ID of the equipment to get efficiency data for"
          },
          startDate: { 
            type: "string", 
            description: "Start date in ISO format (optional)"
          },
          endDate: { 
            type: "string", 
            description: "End date in ISO format (optional)"
          }
        },
        required: ["equipmentId"]
      },
      returnType: "EquipmentEfficiency[]",
      functionCode: "async function getEquipmentEfficiency(params) { const { equipmentId, startDate, endDate } = params; let query = { where: (fields, { eq }) => eq(fields.equipmentId, equipmentId) }; if (startDate && endDate) { query.where = (fields, { eq, gte, lte }) => ({ and: [ eq(fields.equipmentId, equipmentId), gte(fields.timestamp, new Date(startDate)), lte(fields.timestamp, new Date(endDate)) ] }); } return db.query.equipmentEfficiency.findMany(query); }",
      accessLevel: "restricted",
      tags: ["equipment", "efficiency", "query"]
    },
    {
      name: "createEnergyInsight",
      description: "Create a new energy insight record in the database",
      module: "insights",
      parameters: {
        type: "object",
        properties: {
          title: { 
            type: "string", 
            description: "Title of the insight"
          },
          description: { 
            type: "string", 
            description: "Detailed description of the insight"
          },
          type: { 
            type: "string", 
            description: "Type of insight (efficiency, anomaly, recommendation, prediction)"
          },
          priority: { 
            type: "string", 
            description: "Priority level (low, medium, high, critical)"
          },
          metadata: { 
            type: "object", 
            description: "Additional metadata for the insight"
          }
        },
        required: ["title", "description", "type"]
      },
      returnType: "Issue",
      functionCode: "async function createEnergyInsight(params) { const { title, description, type, priority = 'medium', metadata = {} } = params; return db.insert(schema.issues).values({ title, description, status: 'open', type: type || 'feature', priority: priority, assigneeId: null, submitterId: 1, createdAt: new Date(), updatedAt: new Date(), metadata: metadata }).returning(); }",
      accessLevel: "admin",
      tags: ["insights", "create"]
    }
  ];

  for (const func of defaultFunctions) {
    // Check if function already exists
    const existingFunction = await db.query.agentFunctions.findFirst({
      where: (fields, { eq }) => eq(fields.name, func.name)
    });

    if (!existingFunction) {
      await db.insert(schema.agentFunctions).values(func);
    }
  }
}

// Run the migration
migrate().then(() => {
  console.log("Migration completed successfully");
  process.exit(0);
}).catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});