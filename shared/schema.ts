import { pgTable, text, serial, integer, boolean, real, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("Viewer"), // Admin or Viewer
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Power data schema
export const powerData = pgTable("power_data", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  mainGridPower: real("main_grid_power").notNull(), // in kW
  solarOutput: real("solar_output").notNull(), // in kW
  refrigerationLoad: real("refrigeration_load").notNull(), // in kW
  bigColdRoom: real("big_cold_room").notNull(), // in kW
  bigFreezer: real("big_freezer").notNull(), // in kW
  smoker: real("smoker").notNull(), // in kW
  totalLoad: real("total_load").notNull(), // in kW
  unaccountedLoad: real("unaccounted_load").notNull(), // in kW
});

export const insertPowerDataSchema = createInsertSchema(powerData).omit({
  id: true,
});

export type InsertPowerData = z.infer<typeof insertPowerDataSchema>;
export type PowerData = typeof powerData.$inferSelect;

// Settings schema
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  dataSource: text("data_source").notNull().default("live"), // live or synthetic
  scenarioProfile: text("scenario_profile").notNull().default("sunny"), // sunny, cloudy, peak, night
  gridImportThreshold: real("grid_import_threshold").notNull().default(5), // in kW
  solarOutputMinimum: real("solar_output_minimum").notNull().default(1.5), // in kW
  unaccountedPowerThreshold: real("unaccounted_power_threshold").notNull().default(15), // in %
  enableEmailNotifications: boolean("enable_email_notifications").notNull().default(true),
  dataRefreshRate: integer("data_refresh_rate").notNull().default(10), // in seconds
  historicalDataStorage: integer("historical_data_storage").notNull().default(90), // in days
  gridPowerCost: real("grid_power_cost").notNull().default(0.28), // in €/kWh
  feedInTariff: real("feed_in_tariff").notNull().default(0.09), // in €/kWh
  // API Key settings
  weatherApiKey: text("weather_api_key"),
  powerMonitoringApiKey: text("power_monitoring_api_key"),
  notificationsApiKey: text("notifications_api_key"),
  // Solcast API settings
  solcastApiKey: text("solcast_api_key"),
  // Location for solar forecasting (Kerry, Ireland by default)
  locationLatitude: real("location_latitude").default(52.059937), // Kerry, Ireland default
  locationLongitude: real("location_longitude").default(-9.507269), // Kerry, Ireland default
  useSolcastData: boolean("use_solcast_data").default(false),
  // Enhanced Solcast configuration
  solcastForecastHorizon: integer("solcast_forecast_horizon").default(168), // Default to 7 days (168 hours)
  solcastRefreshRate: integer("solcast_refresh_rate").default(30), // Refresh rate in minutes
  solcastPanelCapacity: real("solcast_panel_capacity").default(25), // System capacity in kW
  solcastPanelTilt: real("solcast_panel_tilt").default(30), // Panel tilt in degrees
  solcastPanelAzimuth: real("solcast_panel_azimuth").default(180), // Panel azimuth (180° = south)
  solcastShowProbabilistic: boolean("solcast_show_probabilistic").default(true), // Show P10/P90 ranges
  // Performance monitoring settings
  enablePvPerformanceMonitoring: boolean("enable_pv_performance_monitoring").default(true),
  pvPerformanceThreshold: real("pv_performance_threshold").default(15), // Alert if performance varies by % from expected
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

// Environmental data schema
export const environmentalData = pgTable("environmental_data", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  weather: text("weather").notNull(), // Sunny, Partly Cloudy, Drizzle, Rain, etc.
  air_temp: real("air_temp").notNull(), // in °C, directly from Solcast API
  ghi: real("ghi").notNull(), // Global Horizontal Irradiance, directly from Solcast API
  dni: real("dni").notNull(), // Direct Normal Irradiance, directly from Solcast API
  dhi: real("dhi"), // Diffuse Horizontal Irradiance (if available)
  humidity: real("humidity"), // in %
  windSpeed: real("wind_speed"), // in km/h
  windDirection: real("wind_direction"), // in degrees from North
  cloudOpacity: real("cloud_opacity"), // cloud cover percentage (0-100)
  forecast_p10: real("forecast_p10"), // P10 forecast value (lower confidence bound)
  forecast_p50: real("forecast_p50"), // P50 forecast value (median estimate)
  forecast_p90: real("forecast_p90"), // P90 forecast value (upper confidence bound)
  dataSource: text("data_source"), // 'solcast_live', 'solcast_forecast', 'emporium', 'fallback'
  forecastHorizon: integer("forecast_horizon"), // forecast time horizon in hours (0 for current)
});

export const insertEnvironmentalDataSchema = createInsertSchema(environmentalData).omit({
  id: true,
});

export type InsertEnvironmentalData = z.infer<typeof insertEnvironmentalDataSchema>;
export type EnvironmentalData = typeof environmentalData.$inferSelect;

// Equipment schema
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // Refrigeration, Processing, HVAC, etc.
  model: text("model"),
  manufacturer: text("manufacturer"),
  installedDate: timestamp("installed_date"),
  nominalPower: real("nominal_power"), // in kW
  nominalEfficiency: real("nominal_efficiency"), // baseline efficiency metric
  currentEfficiency: real("current_efficiency"), // current calculated efficiency
  maintenanceInterval: integer("maintenance_interval"), // in days
  lastMaintenance: timestamp("last_maintenance"),
  nextMaintenance: timestamp("next_maintenance"),
  status: text("status").notNull().default("operational"), // operational, maintenance, warning, critical
  metadata: jsonb("metadata"), // Additional equipment-specific data
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  currentEfficiency: true, // Will be calculated 
  nextMaintenance: true,   // Will be calculated
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// Equipment efficiency data schema
export const equipmentEfficiency = pgTable("equipment_efficiency", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull(), // Foreign key to equipment
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  powerUsage: real("power_usage").notNull(), // in kW
  efficiencyRating: real("efficiency_rating").notNull(), // calculated efficiency metric
  temperatureConditions: real("temperature_conditions"), // in °C
  productionVolume: real("production_volume"), // units produced during measurement
  anomalyDetected: boolean("anomaly_detected").notNull().default(false),
  anomalyScore: real("anomaly_score"), // if anomaly detected, how severe (0-100)
  notes: text("notes"),
});

export const insertEquipmentEfficiencySchema = createInsertSchema(equipmentEfficiency).omit({
  id: true,
  efficiencyRating: true, // Will be calculated
  anomalyDetected: true,  // Will be calculated
  anomalyScore: true,     // Will be calculated
});

export type InsertEquipmentEfficiency = z.infer<typeof insertEquipmentEfficiencySchema>;
export type EquipmentEfficiency = typeof equipmentEfficiency.$inferSelect;

// Equipment maintenance schema
export const maintenanceLog = pgTable("maintenance_log", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull(), // Foreign key to equipment
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  maintenanceType: text("maintenance_type").notNull(), // routine, repair, upgrade
  description: text("description").notNull(),
  technician: text("technician"),
  cost: real("cost"), // maintenance cost
  partsReplaced: text("parts_replaced"),
  efficiencyBefore: real("efficiency_before"),
  efficiencyAfter: real("efficiency_after"),
  nextScheduledDate: timestamp("next_scheduled_date"),
});

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLog).omit({
  id: true,
});

export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLog.$inferSelect;

// Issue schema for feedback and feature requests
export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // 'bug', 'enhancement', 'feature', 'question', 'feedback'
  status: text("status").notNull().default("open"), // 'open', 'in-progress', 'completed', 'wont-fix', 'duplicate'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  submitterId: integer("submitter_id").notNull(), // Foreign key to users
  assigneeId: integer("assignee_id"), // Foreign key to users (optional)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  milestone: text("milestone"), // Which version/milestone it's targeted for
  labels: text("labels").array(), // Array of labels like 'ui', 'backend', 'solcast', etc.
  linkedTaskId: integer("linked_task_id"), // For linking to another issue
});

export const insertIssueSchema = createInsertSchema(issues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
});

export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issues.$inferSelect;

// Issue comments schema
export const issueComments = pgTable("issue_comments", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").notNull(), // Foreign key to issues
  userId: integer("user_id").notNull(), // Foreign key to users
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isEdited: boolean("is_edited").default(false),
});

export const issueCommentsRelations = relations(issueComments, ({ one }) => ({
  issue: one(issues, {
    fields: [issueComments.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [issueComments.userId],
    references: [users.id],
  }),
}));

export const insertIssueCommentSchema = createInsertSchema(issueComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
});

export type InsertIssueComment = z.infer<typeof insertIssueCommentSchema>;
export type IssueComment = typeof issueComments.$inferSelect;

// Todo items schema for tracking completed tasks
export const todoItems = pgTable("todo_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // 'pending', 'in-progress', 'completed'
  category: text("category").notNull().default("general"), // 'schema', 'api', 'frontend', 'backend', 'feature', etc.
  stage: integer("stage").notNull().default(1), // Which implementation stage (1-6)
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  assigneeId: integer("assignee_id"), // Foreign key to users (optional)
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high'
  linkedIssueId: integer("linked_issue_id"), // Foreign key to issues (optional)
});

export const todoItemsRelations = relations(todoItems, ({ one }) => ({
  assignee: one(users, {
    fields: [todoItems.assigneeId],
    references: [users.id],
  }),
  linkedIssue: one(issues, {
    fields: [todoItems.linkedIssueId],
    references: [issues.id],
  }),
}));

export const insertTodoItemSchema = createInsertSchema(todoItems).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTodoItem = z.infer<typeof insertTodoItemSchema>;
export type TodoItem = typeof todoItems.$inferSelect;

// Now that all tables are defined, we can establish the relations
export const usersRelations = relations(users, ({ many }) => ({
  submittedIssues: many(issues),
  assignedIssues: many(issues, { relationName: "assignee" }),
  comments: many(issueComments),
  conversations: many(agentConversations),
  createdTasks: many(agentTasks, { relationName: "creator" }),
  assignedTasks: many(agentTasks, { relationName: "task_assignee" }),
  updatedSettings: many(agentSettings),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  submitter: one(users, {
    fields: [issues.submitterId],
    references: [users.id],
  }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
    relationName: "assignee",
  }),
  linkedTask: one(issues, {
    fields: [issues.linkedTaskId],
    references: [issues.id],
    relationName: "linked_task",
  }),
  comments: many(issueComments),
}));

// AI Agent Schemas

// Agent Functions Registry schema
export const agentFunctions = pgTable("agent_functions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  module: text("module").notNull(), // Service module this function belongs to
  parameters: jsonb("parameters").notNull(), // Parameters definition in JSON Schema format
  returnType: text("return_type").notNull(), // Return type description
  functionCode: text("function_code").notNull(), // Actual callable function or reference
  accessLevel: text("access_level").notNull().default("restricted"), // 'public', 'admin', 'restricted'
  tags: text("tags").array(), // For categorization and search
});

export const insertAgentFunctionSchema = createInsertSchema(agentFunctions).omit({
  id: true
});

export type InsertAgentFunction = z.infer<typeof insertAgentFunctionSchema>;
export type AgentFunction = typeof agentFunctions.$inferSelect;

// Agent Conversations schema
export const agentConversations = pgTable("agent_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Foreign key to users
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  context: jsonb("context"), // Conversation context/state
  status: text("status").notNull().default("active"), // 'active', 'archived', 'deleted'
});

export const agentConversationsRelations = relations(agentConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [agentConversations.userId],
    references: [users.id],
  }),
  messages: many(agentMessages),
}));

export const insertAgentConversationSchema = createInsertSchema(agentConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type AgentConversation = typeof agentConversations.$inferSelect;

// Agent Messages schema
export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(), // Foreign key to agent_conversations
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  functionCall: jsonb("function_call"), // Optional function call details
  functionResponse: jsonb("function_response"), // Optional function response
  metadata: jsonb("metadata"), // Additional message metadata
});

export const agentMessagesRelations = relations(agentMessages, ({ one }) => ({
  conversation: one(agentConversations, {
    fields: [agentMessages.conversationId],
    references: [agentConversations.id],
  }),
}));

export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({
  id: true,
  timestamp: true,
});

export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;

// Agent Tasks schema
export const agentTasks = pgTable("agent_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'in-progress', 'completed', 'failed'
  type: text("type").notNull(), // 'scheduled', 'user-requested', 'system', 'recurring'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  scheduledFor: timestamp("scheduled_for"), // For scheduled tasks
  completedAt: timestamp("completed_at"), 
  createdBy: integer("created_by"), // User ID or null for system
  assignedTo: integer("assigned_to"), // User ID or null
  parameters: jsonb("parameters"), // Task parameters
  result: jsonb("result"), // Task result or output
});

export const agentTasksRelations = relations(agentTasks, ({ one }) => ({
  creator: one(users, {
    fields: [agentTasks.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  assignee: one(users, {
    fields: [agentTasks.assignedTo],
    references: [users.id],
    relationName: "task_assignee",
  }),
}));

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;

// Agent Settings schema
export const agentSettings = pgTable("agent_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  value: text("value"),
  description: text("description").notNull(),
  type: text("type").notNull().default("string"), // 'string', 'number', 'boolean', 'json'
  category: text("category").notNull().default("general"), // For grouping settings
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by"), // User ID who updated it last
});

export const agentSettingsRelations = relations(agentSettings, ({ one }) => ({
  updater: one(users, {
    fields: [agentSettings.updatedBy],
    references: [users.id],
  }),
}));

export const insertAgentSettingSchema = createInsertSchema(agentSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAgentSetting = z.infer<typeof insertAgentSettingSchema>;
export type AgentSetting = typeof agentSettings.$inferSelect;

// MCP (Multi-Capability Planning) Tasks schema
export const mcpTasks = pgTable("mcp_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // Service provider (e.g., 'openai', 'local', 'custom')
  endpoint: text("endpoint").notNull(), // API endpoint or local function reference
  parameters: jsonb("parameters").notNull(), // Task parameters in JSON format
  capabilities: text("capabilities").array(), // Array of capabilities this task provides
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  enabled: boolean("enabled").notNull().default(true),
  authType: text("auth_type").notNull().default("none"), // 'none', 'api_key', 'oauth', 'custom'
  responseFormat: text("response_format"), // Expected response format
});

export const insertMcpTaskSchema = createInsertSchema(mcpTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMcpTask = z.infer<typeof insertMcpTaskSchema>;
export type McpTask = typeof mcpTasks.$inferSelect;

// Signal Notifications schema
export const signalNotifications = pgTable("signal_notifications", {
  id: serial("id").primaryKey(),
  recipientNumber: text("recipient_number").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("alert"), // 'alert', 'report', 'reminder', 'status'
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed', 'delivered'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  scheduledFor: timestamp("scheduled_for"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  triggeredBy: integer("triggered_by"), // Task or user ID that triggered this
});

export const insertSignalNotificationSchema = createInsertSchema(signalNotifications).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type InsertSignalNotification = z.infer<typeof insertSignalNotificationSchema>;
export type SignalNotification = typeof signalNotifications.$inferSelect;

// Update user relations to include AI agent related entities
