import { pgTable, text, serial, integer, boolean, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  weather: text("weather").notNull(), // Sunny, Partly Cloudy, etc.
  temperature: real("temperature").notNull(), // in °C
  sunIntensity: real("sun_intensity").notNull(), // in %
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
