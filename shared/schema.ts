import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
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
