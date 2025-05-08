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
