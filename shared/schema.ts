import { pgTable, text, serial, integer, boolean, real, timestamp, jsonb, date, varchar } from "drizzle-orm/pg-core";
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
  votes: integer("votes").notNull().default(0), // Number of votes/upvotes for this issue
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
// DEPRECATED: agent_functions table has been removed and replaced by langchain_tools table
// Keeping these definitions commented for reference, but they are no longer used in the application

/*
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
*/

// Agent Conversations schema
export const agentConversations = pgTable("langchain_agent_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Foreign key to users
  title: text("title").notNull(),
  agentId: integer("agent_id"), // Foreign key to langchain_agents (optional)
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
  agent: one(langchainAgents, {
    fields: [agentConversations.agentId],
    references: [langchainAgents.id],
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
export const agentMessages = pgTable("langchain_agent_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(), // Foreign key to agent_conversations
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(), // Using created_at instead of timestamp
  updatedAt: timestamp("updated_at").defaultNow(), // Added updated_at field
  tokens: integer("tokens"), // Token count for the message
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
  createdAt: true,
  updatedAt: true,
  tokens: true,
});

export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;

// Agent Tasks schema
export const agentTasks = pgTable("langchain_agent_tasks", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(), // Agent ID that this task is associated with
  userId: integer("user_id").notNull(), // User ID that this task belongs to
  result: jsonb("result"), // Task result or output
  data: jsonb("data"), // Task data including description, parameters, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  task: text("task").notNull(), // Main task description/title
  status: text("status").notNull().default("pending"), // 'pending', 'in-progress', 'completed', 'failed'
});

export const agentTasksRelations = relations(agentTasks, ({ one }) => ({
  user: one(users, {
    fields: [agentTasks.userId],
    references: [users.id],
  }),
  agent: one(langchainAgents, {
    fields: [agentTasks.agentId],
    references: [langchainAgents.id],
  })
}));

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;

// Agent Settings schema
export const agentSettings = pgTable("langchain_agent_settings", {
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

// Agent Notifications schema
export const agentNotifications = pgTable("langchain_agent_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Foreign key to users
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success', 'task', 'conversation'
  source: text("source").notNull(), // 'system', 'task', 'conversation', 'agent'
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  readAt: timestamp("read_at"),
  data: jsonb("data").notNull().default({}), // Additional notification data
});

export const agentNotificationsRelations = relations(agentNotifications, ({ one }) => ({
  user: one(users, {
    fields: [agentNotifications.userId],
    references: [users.id],
  }),
}));

export const insertAgentNotificationSchema = createInsertSchema(agentNotifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertAgentNotification = z.infer<typeof insertAgentNotificationSchema>;
export type AgentNotification = typeof agentNotifications.$inferSelect;

// Report templates table for customizing report formats
export const reportTemplates = pgTable('report_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  template: text('template').notNull(), // template content with placeholders
  category: text('category').notNull(), // report category
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Scheduled reports table for recurring report generation
export const scheduledReports = pgTable('scheduled_reports', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  userId: integer('user_id').references(() => users.id),
  templateId: integer('template_id').references(() => reportTemplates.id),
  schedule: text('schedule').notNull(), // cron expression
  lastRun: timestamp('last_run'), // last time the report was run
  nextRun: timestamp('next_run'), // next scheduled run time
  parameters: text('parameters'), // JSON string of parameters
  recipients: text('recipients').array(), // array of recipient identifiers
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Report template relations
export const reportTemplatesRelations = relations(reportTemplates, ({ many }) => ({
  scheduledReports: many(scheduledReports)
}));

// Scheduled reports relations
export const scheduledReportsRelations = relations(scheduledReports, ({ one }) => ({
  user: one(users, {
    fields: [scheduledReports.userId],
    references: [users.id],
  }),
  template: one(reportTemplates, {
    fields: [scheduledReports.templateId],
    references: [reportTemplates.id],
  }),
}));

// Create Zod schemas for insert operations
export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  lastRun: true,
  nextRun: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;

// Multi-Capability Planning (MCP) tasks table
export const mcpTasks = pgTable('mcp_tasks', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  capability: text('capability').notNull(), // Which capability should handle the task
  provider: text('provider').notNull(), // Which provider should execute the capability
  parameters: jsonb('parameters').notNull(), // Parameters for the capability
  status: text('status').notNull().default('pending'), // pending, scheduled, in-progress, completed, failed, cancelled
  priority: text('priority').notNull().default('medium'), // low, medium, high, critical
  createdBy: integer('created_by').notNull().references(() => users.id),
  scheduledFor: timestamp('scheduled_for'), // For scheduled tasks
  startedAt: timestamp('started_at'), // When task execution began
  completedAt: timestamp('completed_at'), // When task execution finished
  result: jsonb('result'), // Result of the task execution
  parentTaskId: integer('parent_task_id'), // For subtasks of a larger task
  metadata: jsonb('metadata'), // Additional task data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Set up relations
export const mcpTasksRelations = relations(mcpTasks, ({ one, many }) => ({
  creator: one(users, {
    fields: [mcpTasks.createdBy],
    references: [users.id],
  }),
  parentTask: one(mcpTasks, {
    fields: [mcpTasks.parentTaskId],
    references: [mcpTasks.id],
  }),
  childTasks: many(mcpTasks, {
    relationName: 'parent_child'
  })
}));

// Create Zod schemas for insert operations
export const insertMcpTaskSchema = createInsertSchema(mcpTasks).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  result: true,
  createdAt: true,
  updatedAt: true
});

export type InsertMcpTask = z.infer<typeof insertMcpTaskSchema>;
export type McpTask = typeof mcpTasks.$inferSelect;

// Telegram integration schema uses direct columns rather than metadata

export const telegramUsers = pgTable("langchain_telegram_users", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  telegramId: text("telegram_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  username: text("username"),
  languageCode: text("language_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastAccessed: timestamp("last_accessed"),
  chatId: text("chat_id"),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  telegramLastName: text("telegram_last_name"),
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  isVerified: boolean("is_verified").notNull().default(false),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  receiveAlerts: boolean("receive_alerts").notNull().default(true),
  receiveReports: boolean("receive_reports").notNull().default(true),
});

export const telegramUserRelations = relations(telegramUsers, ({ one }) => ({
  user: one(users, {
    fields: [telegramUsers.userId],
    references: [users.id],
  }),
}));

export const insertTelegramUserSchema = createInsertSchema(telegramUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTelegramUser = z.infer<typeof insertTelegramUserSchema>;
export type TelegramUser = typeof telegramUsers.$inferSelect;

// Telegram message history
export const telegramMessages = pgTable("langchain_telegram_messages", {
  id: serial("id").primaryKey(),
  telegramUserId: integer("telegram_user_id").notNull().references(() => telegramUsers.id),
  direction: text("direction").notNull(), // "inbound" or "outbound"
  messageText: text("message_text").notNull(),
  messageId: text("message_id"), // Telegram's message ID
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  isProcessed: boolean("is_processed").notNull().default(false),
  conversationId: integer("conversation_id").references(() => agentConversations.id),
});

export const telegramMessageRelations = relations(telegramMessages, ({ one }) => ({
  telegramUser: one(telegramUsers, {
    fields: [telegramMessages.telegramUserId],
    references: [telegramUsers.id],
  }),
  conversation: one(agentConversations, {
    fields: [telegramMessages.conversationId],
    references: [agentConversations.id],
  }),
}));

export const insertTelegramMessageSchema = createInsertSchema(telegramMessages).omit({
  id: true,
});

export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;
export type TelegramMessage = typeof telegramMessages.$inferSelect;

// Telegram settings for the system
export const telegramSettings = pgTable("langchain_telegram_settings", {
  id: serial("id").primaryKey(),
  botToken: text("bot_token").notNull(),
  botUsername: text("bot_username").notNull(),
  webhookUrl: text("webhook_url"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTelegramSettingsSchema = createInsertSchema(telegramSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTelegramSettings = z.infer<typeof insertTelegramSettingsSchema>;
export type TelegramSettings = typeof telegramSettings.$inferSelect;

// Model Context Protocol (MCP) tool definitions
export const mcpTools = pgTable("mcp_tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  apiType: text("api_type").notNull(), // REST, GraphQL, gRPC, etc.
  authType: text("auth_type").notNull(), // API Key, OAuth, None, etc.
  parameters: jsonb("parameters").notNull(),
  responseFormat: text("response_format").notNull(), // JSON, XML, etc.
  category: text("category").notNull(), // Data Source, Processing Tool, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertMcpToolSchema = createInsertSchema(mcpTools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMcpTool = z.infer<typeof insertMcpToolSchema>;
export type McpTool = typeof mcpTools.$inferSelect;

// File attachments for agent conversations
export const fileAttachments = pgTable("file_attachments", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => agentConversations.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => agentMessages.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  metadata: jsonb("metadata").default({}),
});

export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  conversation: one(agentConversations, {
    fields: [fileAttachments.conversationId],
    references: [agentConversations.id],
  }),
  message: one(agentMessages, {
    fields: [fileAttachments.messageId],
    references: [agentMessages.id],
  }),
  creator: one(users, {
    fields: [fileAttachments.createdBy],
    references: [users.id],
  }),
}));

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({
  id: true,
  createdAt: true,
});

export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;

// Update relations to include file attachments
export const agentMessagesRelationsWithFiles = relations(agentMessages, ({ one, many }) => ({
  conversation: one(agentConversations, {
    fields: [agentMessages.conversationId],
    references: [agentConversations.id],
  }),
  files: many(fileAttachments),
}));

export const agentConversationsRelationsWithFiles = relations(agentConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [agentConversations.userId],
    references: [users.id],
  }),
  agent: one(langchainAgents, {
    fields: [agentConversations.agentId],
    references: [langchainAgents.id],
  }),
  messages: many(agentMessages),
  files: many(fileAttachments),
}));

// Update user relations to include AI agent related entities

// LangChain Tables

// LangChain Agents table - Configuration for different LangChain agents
export const langchainAgents = pgTable("langchain_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  modelName: text("model_name").notNull().default("gpt-4o"), // Default to most recent model
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").default(4000),
  streaming: boolean("streaming").default(true),
  systemPrompt: text("system_prompt"),
  maxIterations: integer("max_iterations").default(5),
  verbose: boolean("verbose").default(false),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  metadata: jsonb("metadata"),
});

export const insertLangchainAgentSchema = createInsertSchema(langchainAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLangchainAgent = z.infer<typeof insertLangchainAgentSchema>;
export type LangchainAgent = typeof langchainAgents.$inferSelect;

// LangChain Tools table - Custom tools available to LangChain agents
export const langchainTools = pgTable("langchain_tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  toolType: text("tool_type").notNull(), // 'custom', 'readFromDB', 'compileReport', etc.
  parameters: jsonb("parameters"), // JSON schema describing parameters (replaces schema)
  implementation: text("implementation"), // Code or reference to implementation
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  isBuiltIn: boolean("is_built_in").default(false),
  metadata: jsonb("metadata"),
});

export const insertLangchainToolSchema = createInsertSchema(langchainTools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLangchainTool = z.infer<typeof insertLangchainToolSchema>;
export type LangchainTool = typeof langchainTools.$inferSelect;

// LangChain Agent-Tool associations
export const langchainAgentTools = pgTable("langchain_agent_tools", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => langchainAgents.id),
  toolId: integer("tool_id").notNull().references(() => langchainTools.id),
  priority: integer("priority").default(0), // Order of tool preference
});

export const insertLangchainAgentToolSchema = createInsertSchema(langchainAgentTools).omit({
  id: true,
});

export type InsertLangchainAgentTool = z.infer<typeof insertLangchainAgentToolSchema>;
export type LangchainAgentTool = typeof langchainAgentTools.$inferSelect;

// LangChain Prompt Templates
export const langchainPromptTemplates = pgTable("langchain_prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  template: text("template").notNull(),
  templateType: text("template_type").notNull().default("string"), // string, chat, etc.
  variables: jsonb("variables"), // JSON array of variable names
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertLangchainPromptTemplateSchema = createInsertSchema(langchainPromptTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLangchainPromptTemplate = z.infer<typeof insertLangchainPromptTemplateSchema>;
export type LangchainPromptTemplate = typeof langchainPromptTemplates.$inferSelect;

// LangChain Runs - For tracking execution of agents (like LangSmith)
export const langchainRuns = pgTable("langchain_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(), // Unique ID for the run
  agentId: integer("agent_id").references(() => langchainAgents.id),
  userId: integer("user_id").references(() => users.id),
  conversationId: integer("conversation_id").references(() => agentConversations.id),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("running"), // running, completed, error, cancelled
  input: text("input"), // Input to the run (text, not jsonb per DB schema)
  output: text("output"), // Output of the run (text, not jsonb per DB schema)
  error: text("error"), // Error message if any
  toolCalls: jsonb("tool_calls"), // Array of tool calls made
  metadata: jsonb("metadata"), // Additional metadata including cost estimates
  parentRunId: text("parent_run_id"), // For nested runs/chains
  run_type: text("run_type").notNull(), // Required field per DB schema
  created_at: timestamp("created_at").defaultNow(), // Timestamp from DB schema
});

export const insertLangchainRunSchema = createInsertSchema(langchainRuns).omit({
  id: true,
  endTime: true,
});

export type InsertLangchainRun = z.infer<typeof insertLangchainRunSchema>;
export type LangchainRun = typeof langchainRuns.$inferSelect;

// LangChain Tool Executions - Details of each tool call
export const langchainToolExecutions = pgTable("langchain_tool_executions", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().references(() => langchainRuns.runId),
  toolId: integer("tool_id").references(() => langchainTools.id),
  toolName: text("tool_name").notNull(), // Sometimes we use built-in tools not in our DB
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("running"), // running, completed, error
  input: jsonb("input"), // Input parameters to the tool
  output: jsonb("output"), // Output from the tool
  error: text("error"), // Error message if any
  executionOrder: integer("execution_order"), // Order in which tools were called
});

export const insertLangchainToolExecutionSchema = createInsertSchema(langchainToolExecutions).omit({
  id: true,
  endTime: true,
});

export type InsertLangchainToolExecution = z.infer<typeof insertLangchainToolExecutionSchema>;
export type LangchainToolExecution = typeof langchainToolExecutions.$inferSelect;

// Define the relationships

export const langchainAgentsRelations = relations(langchainAgents, ({ one, many }) => ({
  creator: one(users, {
    fields: [langchainAgents.createdBy],
    references: [users.id],
  }),
  tools: many(langchainAgentTools),
  runs: many(langchainRuns),
}));

export const langchainToolsRelations = relations(langchainTools, ({ one, many }) => ({
  creator: one(users, {
    fields: [langchainTools.createdBy],
    references: [users.id],
  }),
  agents: many(langchainAgentTools),
  executions: many(langchainToolExecutions),
}));

export const langchainPromptTemplatesRelations = relations(langchainPromptTemplates, ({ one }) => ({
  creator: one(users, {
    fields: [langchainPromptTemplates.createdBy],
    references: [users.id],
  }),
}));

// Voice transcription schema
export const voiceTranscriptions = pgTable("voice_transcriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text"),
  sourceLanguage: varchar("source_language", { length: 10 }).notNull().default("auto"),
  targetLanguage: varchar("target_language", { length: 10 }),
  audioFilePath: text("audio_file_path").notNull(),
  duration: real("duration").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const voiceTranscriptionsRelations = relations(voiceTranscriptions, ({ one }) => ({
  user: one(users, {
    fields: [voiceTranscriptions.userId],
    references: [users.id],
  }),
}));

export const insertVoiceTranscriptionSchema = createInsertSchema(voiceTranscriptions).omit({
  id: true,
});

export type InsertVoiceTranscription = z.infer<typeof insertVoiceTranscriptionSchema>;
export type VoiceTranscription = typeof voiceTranscriptions.$inferSelect;

export const langchainAgentToolsRelations = relations(langchainAgentTools, ({ one }) => ({
  agent: one(langchainAgents, {
    fields: [langchainAgentTools.agentId],
    references: [langchainAgents.id],
  }),
  tool: one(langchainTools, {
    fields: [langchainAgentTools.toolId],
    references: [langchainTools.id],
  }),
}));

export const langchainRunsRelations = relations(langchainRuns, ({ one, many }) => ({
  agent: one(langchainAgents, {
    fields: [langchainRuns.agentId],
    references: [langchainAgents.id],
  }),
  user: one(users, {
    fields: [langchainRuns.userId],
    references: [users.id],
  }),
  conversation: one(agentConversations, {
    fields: [langchainRuns.conversationId],
    references: [agentConversations.id],
  }),
  toolExecutions: many(langchainToolExecutions),
}));

export const langchainToolExecutionsRelations = relations(langchainToolExecutions, ({ one }) => ({
  run: one(langchainRuns, {
    fields: [langchainToolExecutions.runId],
    references: [langchainRuns.runId],
  }),
  tool: one(langchainTools, {
    fields: [langchainToolExecutions.toolId],
    references: [langchainTools.id],
  }),
}));
