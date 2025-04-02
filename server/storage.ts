import { 
  users, type User, type InsertUser, 
  settings, type Settings, type InsertSettings, 
  powerData, type PowerData, type InsertPowerData, 
  environmentalData, type EnvironmentalData, type InsertEnvironmentalData 
} from "@shared/schema";
import session from "express-session";
import * as expressSession from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import { hash } from "bcrypt";

// Connect PG Simple setup for session store
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Settings operations
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // Power data operations
  getPowerData(limit?: number): Promise<PowerData[]>;
  getLatestPowerData(): Promise<PowerData | undefined>;
  getPowerDataByDateRange(startDate: Date, endDate: Date): Promise<PowerData[]>;
  createPowerData(data: InsertPowerData): Promise<PowerData>;
  
  // Environmental data operations
  getEnvironmentalData(limit?: number): Promise<EnvironmentalData[]>;
  getLatestEnvironmentalData(): Promise<EnvironmentalData | undefined>;
  getEnvironmentalDataByDateRange(startDate: Date, endDate: Date): Promise<EnvironmentalData[]>;
  createEnvironmentalData(data: InsertEnvironmentalData): Promise<EnvironmentalData>;
  
  // Session store
  sessionStore: expressSession.Store;
  
  // Initialize database
  initializeDatabase(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: expressSession.Store;

  constructor() {
    // Initialize session store with PostgreSQL
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Settings methods
  async getSettings(): Promise<Settings> {
    const [setting] = await db.select().from(settings);
    
    if (!setting) {
      // If no settings exist, create default settings
      return this.createDefaultSettings();
    }
    
    return setting;
  }
  
  async updateSettings(updatedSettings: Partial<InsertSettings>): Promise<Settings> {
    // First ensure settings exist
    const existingSettings = await this.getSettings();
    
    // Update the settings
    const [updated] = await db
      .update(settings)
      .set(updatedSettings)
      .where(eq(settings.id, existingSettings.id))
      .returning();
      
    return updated;
  }
  
  // Power data methods
  async getPowerData(limit: number = 100): Promise<PowerData[]> {
    return db
      .select()
      .from(powerData)
      .orderBy(desc(powerData.timestamp))
      .limit(limit);
  }
  
  async getLatestPowerData(): Promise<PowerData | undefined> {
    const [latest] = await db
      .select()
      .from(powerData)
      .orderBy(desc(powerData.timestamp))
      .limit(1);
      
    return latest;
  }
  
  async getPowerDataByDateRange(startDate: Date, endDate: Date): Promise<PowerData[]> {
    return db
      .select()
      .from(powerData)
      .where(
        sql`${powerData.timestamp} >= ${startDate} AND ${powerData.timestamp} <= ${endDate}`
      )
      .orderBy(desc(powerData.timestamp));
  }
  
  async createPowerData(data: InsertPowerData): Promise<PowerData> {
    const [entry] = await db
      .insert(powerData)
      .values(data)
      .returning();
      
    return entry;
  }
  
  // Environmental data methods
  async getEnvironmentalData(limit: number = 100): Promise<EnvironmentalData[]> {
    return db
      .select()
      .from(environmentalData)
      .orderBy(desc(environmentalData.timestamp))
      .limit(limit);
  }
  
  async getLatestEnvironmentalData(): Promise<EnvironmentalData | undefined> {
    const [latest] = await db
      .select()
      .from(environmentalData)
      .orderBy(desc(environmentalData.timestamp))
      .limit(1);
      
    return latest;
  }
  
  async getEnvironmentalDataByDateRange(startDate: Date, endDate: Date): Promise<EnvironmentalData[]> {
    return db
      .select()
      .from(environmentalData)
      .where(
        sql`${environmentalData.timestamp} >= ${startDate} AND ${environmentalData.timestamp} <= ${endDate}`
      )
      .orderBy(desc(environmentalData.timestamp));
  }
  
  async createEnvironmentalData(data: InsertEnvironmentalData): Promise<EnvironmentalData> {
    const [entry] = await db
      .insert(environmentalData)
      .values(data)
      .returning();
      
    return entry;
  }
  
  // Database initialization
  async initializeDatabase(): Promise<void> {
    console.log("Initializing database...");
    
    // Create default settings if they don't exist
    await this.ensureSettingsExist();
    
    // Create default users if they don't exist
    await this.ensureDefaultUsersExist();
    
    // Generate initial data if none exists
    await this.ensureInitialDataExists();
    
    console.log("Database initialization complete");
  }
  
  // Helper methods
  private async createDefaultSettings(): Promise<Settings> {
    const defaultSettings: InsertSettings = {
      dataSource: "live",
      scenarioProfile: "sunny",
      gridImportThreshold: 5,
      solarOutputMinimum: 1.5,
      unaccountedPowerThreshold: 15,
      enableEmailNotifications: true,
      dataRefreshRate: 10,
      historicalDataStorage: 90,
      gridPowerCost: 0.28,
      feedInTariff: 0.09
    };
    
    const [setting] = await db
      .insert(settings)
      .values(defaultSettings)
      .returning();
      
    return setting;
  }
  
  private async ensureSettingsExist(): Promise<void> {
    const [existingSettings] = await db.select().from(settings);
    
    if (!existingSettings) {
      await this.createDefaultSettings();
      console.log("Created default settings");
    }
  }
  
  private async ensureDefaultUsersExist(): Promise<void> {
    // Check if admin user exists
    const adminUser = await this.getUserByUsername("admin");
    
    if (!adminUser) {
      // Create admin user
      const hashedPassword = await hash("password", 10);
      await this.createUser({
        username: "admin",
        password: hashedPassword,
        role: "Admin"
      });
      console.log("Created admin user");
    }
    
    // Check if viewer user exists
    const viewerUser = await this.getUserByUsername("viewer");
    
    if (!viewerUser) {
      // Create viewer user
      const hashedPassword = await hash("password", 10);
      await this.createUser({
        username: "viewer",
        password: hashedPassword,
        role: "Viewer"
      });
      console.log("Created viewer user");
    }
  }
  
  private async ensureInitialDataExists(): Promise<void> {
    // Check if power data exists
    const [existingPowerData] = await db.select().from(powerData).limit(1);
    
    if (!existingPowerData) {
      await this.generateInitialPowerData();
      console.log("Generated initial power data");
    }
    
    // Check if environmental data exists
    const [existingEnvironmentalData] = await db.select().from(environmentalData).limit(1);
    
    if (!existingEnvironmentalData) {
      await this.generateInitialEnvironmentalData();
      console.log("Generated initial environmental data");
    }
  }
  
  private async generateInitialPowerData(): Promise<void> {
    const now = new Date();
    const powerDataBatch = [];
    
    // Create historical data for the past hour
    for (let i = 60; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      
      // Generate slightly varied power data
      const mainGridPower = 3.5 + (Math.random() * 0.5) - 0.25;
      const solarOutput = 2.1 + (Math.random() * 0.3) - 0.15;
      const bigColdRoom = 9.74 + (Math.random() * 0.4) - 0.2;
      const bigFreezer = 7.12 + (Math.random() * 0.3) - 0.15;
      const smoker = 0.11 + (Math.random() * 0.05);
      const refrigerationLoad = 3.9 + (Math.random() * 0.4) - 0.2;
      const totalLoad = 5.6 + (Math.random() * 0.6) - 0.3;
      const unaccountedLoad = 0.6 + (Math.random() * 0.1) - 0.05;
      
      powerDataBatch.push({
        timestamp,
        mainGridPower,
        solarOutput,
        refrigerationLoad,
        bigColdRoom,
        bigFreezer,
        smoker,
        totalLoad,
        unaccountedLoad
      });
    }
    
    // Insert all power data entries in a batch
    await db.insert(powerData).values(powerDataBatch);
  }
  
  private async generateInitialEnvironmentalData(): Promise<void> {
    const now = new Date();
    const weatherOptions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Overcast'];
    const environmentalDataBatch = [];
    
    // Create historical environmental data for the past hour
    for (let i = 60; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000);
      
      // Generate realistic environmental data
      const weatherIndex = Math.floor(Math.random() * weatherOptions.length);
      const weather = weatherOptions[weatherIndex];
      const temperature = 22 + (Math.random() * 3) - 1.5;
      const sunIntensity = weather === 'Sunny' 
        ? 80 + (Math.random() * 20) 
        : weather === 'Partly Cloudy' 
        ? 50 + (Math.random() * 30) 
        : weather === 'Cloudy' 
        ? 30 + (Math.random() * 20) 
        : 10 + (Math.random() * 20);
      
      environmentalDataBatch.push({
        timestamp,
        weather,
        temperature,
        sunIntensity
      });
    }
    
    // Insert all environmental data entries in a batch
    await db.insert(environmentalData).values(environmentalDataBatch);
  }
}

// Export a singleton instance of the database storage
export const storage = new DatabaseStorage();
