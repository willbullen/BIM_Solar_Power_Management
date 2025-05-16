import { 
  users, type User, type InsertUser, 
  settings, type Settings, type InsertSettings, 
  powerData, type PowerData, type InsertPowerData, 
  environmentalData, type EnvironmentalData, type InsertEnvironmentalData,
  equipment, type Equipment, type InsertEquipment,
  equipmentEfficiency, type EquipmentEfficiency, type InsertEquipmentEfficiency,
  maintenanceLog, type MaintenanceLog, type InsertMaintenanceLog,
  issues, type Issue, type InsertIssue,
  issueComments, type IssueComment, type InsertIssueComment,
  todoItems, type TodoItem, type InsertTodoItem,
  voiceTranscriptions, type VoiceTranscription, type InsertVoiceTranscription
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
  
  // Voice transcription operations
  createVoiceTranscription(transcription: InsertVoiceTranscription): Promise<VoiceTranscription>;
  getVoiceTranscriptions(userId: number): Promise<VoiceTranscription[]>;
  getVoiceTranscription(id: number): Promise<VoiceTranscription | undefined>;
  deleteVoiceTranscription(id: number, userId: number): Promise<boolean>;
  
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
  
  // Equipment operations
  getAllEquipment(): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  getEquipmentByType(type: string): Promise<Equipment[]>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment>;
  deleteEquipment(id: number): Promise<boolean>;
  
  // Equipment efficiency operations
  getEquipmentEfficiencyData(equipmentId: number, limit?: number): Promise<EquipmentEfficiency[]>;
  getEquipmentEfficiencyByDateRange(equipmentId: number, startDate: Date, endDate: Date): Promise<EquipmentEfficiency[]>;
  createEquipmentEfficiencyRecord(data: InsertEquipmentEfficiency): Promise<EquipmentEfficiency>;
  
  // Maintenance operations
  getMaintenanceHistory(equipmentId: number): Promise<MaintenanceLog[]>;
  createMaintenanceRecord(data: InsertMaintenanceLog): Promise<MaintenanceLog>;
  getUpcomingMaintenanceSchedule(): Promise<{ equipment: Equipment, nextMaintenance: Date }[]>;
  
  // Feedback and Issue operations
  getAllIssues(limit?: number): Promise<Issue[]>; 
  getIssueById(id: number): Promise<Issue | undefined>;
  getIssuesByStatus(status: string): Promise<Issue[]>;
  getIssuesByType(type: string): Promise<Issue[]>;
  createIssue(data: InsertIssue): Promise<Issue>;
  updateIssue(id: number, data: Partial<InsertIssue>): Promise<Issue>;
  closeIssue(id: number, resolution?: string): Promise<Issue>;
  
  // Issue comment operations
  getIssueComments(issueId: number): Promise<IssueComment[]>;
  createIssueComment(data: InsertIssueComment): Promise<IssueComment>;
  updateIssueComment(id: number, content: string): Promise<IssueComment>;
  
  // Todo item operations
  getAllTodoItems(): Promise<TodoItem[]>;
  getTodoItemsByStatus(status: string): Promise<TodoItem[]>;
  getTodoItemsByStage(stage: number): Promise<TodoItem[]>;
  createTodoItem(data: InsertTodoItem): Promise<TodoItem>;
  updateTodoItem(id: number, data: Partial<InsertTodoItem>): Promise<TodoItem>;
  completeTodoItem(id: number): Promise<TodoItem>;
  
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
  
  // Equipment methods
  async getAllEquipment(): Promise<Equipment[]> {
    return db
      .select()
      .from(equipment)
      .orderBy(equipment.name);
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const [equipmentItem] = await db
      .select()
      .from(equipment)
      .where(eq(equipment.id, id));
    return equipmentItem;
  }

  async getEquipmentByType(type: string): Promise<Equipment[]> {
    return db
      .select()
      .from(equipment)
      .where(eq(equipment.type, type))
      .orderBy(equipment.name);
  }

  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    // If nextMaintenance is not provided, calculate it based on maintenanceInterval
    let dataToInsert = { ...data };
    
    if (data.maintenanceInterval && data.lastMaintenance) {
      const lastMaintenance = new Date(data.lastMaintenance);
      const nextMaintenance = new Date(lastMaintenance);
      nextMaintenance.setDate(nextMaintenance.getDate() + data.maintenanceInterval);
      
      // Since nextMaintenance is calculated and not in InsertEquipment,
      // we need to call it separately after creating the equipment
      
    }
    
    const [equipmentItem] = await db
      .insert(equipment)
      .values(dataToInsert)
      .returning();
    return equipmentItem;
  }

  async updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment> {
    // If lastMaintenance is updated and we have a maintenanceInterval, update nextMaintenance
    let dataToUpdate = { ...data };
    
    if (data.lastMaintenance && data.maintenanceInterval) {
      const lastMaintenance = new Date(data.lastMaintenance);
      const nextMaintenance = new Date(lastMaintenance);
      nextMaintenance.setDate(nextMaintenance.getDate() + data.maintenanceInterval);
      
      // Since nextMaintenance is calculated and not in InsertEquipment schema,
      // we need to use an alternative approach to update it
      // For now, we'll just update the fields in dataToUpdate
    } else if (data.lastMaintenance) {
      // If only lastMaintenance is provided, get the current equipment to find its interval
      const currentEquipment = await this.getEquipmentById(id);
      if (currentEquipment && currentEquipment.maintenanceInterval) {
        const lastMaintenance = new Date(data.lastMaintenance);
        const nextMaintenance = new Date(lastMaintenance);
        nextMaintenance.setDate(nextMaintenance.getDate() + currentEquipment.maintenanceInterval);
        
        // Since nextMaintenance is calculated and not in InsertEquipment schema,
        // we need to use an alternative approach to update it
        // For now, we'll just update the lastMaintenance field
      }
    }
    
    const [updated] = await db
      .update(equipment)
      .set(dataToUpdate)
      .where(eq(equipment.id, id))
      .returning();
    return updated;
  }

  async deleteEquipment(id: number): Promise<boolean> {
    try {
      await db
        .delete(equipment)
        .where(eq(equipment.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting equipment:", error);
      return false;
    }
  }

  // Equipment efficiency methods
  async getEquipmentEfficiencyData(equipmentId: number, limit: number = 100): Promise<EquipmentEfficiency[]> {
    return db
      .select()
      .from(equipmentEfficiency)
      .where(eq(equipmentEfficiency.equipmentId, equipmentId))
      .orderBy(desc(equipmentEfficiency.timestamp))
      .limit(limit);
  }

  async getEquipmentEfficiencyByDateRange(
    equipmentId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<EquipmentEfficiency[]> {
    return db
      .select()
      .from(equipmentEfficiency)
      .where(
        sql`${equipmentEfficiency.equipmentId} = ${equipmentId} AND 
            ${equipmentEfficiency.timestamp} >= ${startDate} AND 
            ${equipmentEfficiency.timestamp} <= ${endDate}`
      )
      .orderBy(desc(equipmentEfficiency.timestamp));
  }

  async createEquipmentEfficiencyRecord(data: InsertEquipmentEfficiency): Promise<EquipmentEfficiency> {
    // Get equipment details to calculate efficiency
    const equipmentItem = await this.getEquipmentById(data.equipmentId);
    if (!equipmentItem || !equipmentItem.nominalPower || !equipmentItem.nominalEfficiency) {
      throw new Error("Cannot calculate efficiency: missing equipment baseline data");
    }

    // Calculate efficiency rating based on nominal values
    // This is a simplified calculation - in real systems this would be more complex
    const efficiencyRating = (equipmentItem.nominalPower / data.powerUsage) * equipmentItem.nominalEfficiency;
    
    // Detect anomalies - if efficiency is less than 80% of nominal
    const anomalyDetected = efficiencyRating < (0.8 * equipmentItem.nominalEfficiency);
    
    // Calculate anomaly score if anomaly detected (0-100 scale)
    const anomalyScore = anomalyDetected 
      ? 100 - (efficiencyRating / equipmentItem.nominalEfficiency) * 100
      : 0;

    // Create record with calculated fields
    const recordWithCalculations = {
      ...data,
      efficiencyRating,
      anomalyDetected,
      anomalyScore
    };

    const [record] = await db
      .insert(equipmentEfficiency)
      .values(recordWithCalculations)
      .returning();
      
    // If efficiency is worse than current, update equipment status
    if (anomalyDetected && (!equipmentItem.currentEfficiency || efficiencyRating < equipmentItem.currentEfficiency)) {
      // Update equipment with new efficiency and possibly status
      let status = equipmentItem.status;
      if (anomalyScore > 30) {
        status = 'warning';
      } 
      if (anomalyScore > 60) {
        status = 'critical';
      }
      
      await this.updateEquipment(equipmentItem.id, {
        currentEfficiency: efficiencyRating,
        status
      });
    }
    
    return record;
  }

  // Maintenance methods
  async getMaintenanceHistory(equipmentId: number): Promise<MaintenanceLog[]> {
    return db
      .select()
      .from(maintenanceLog)
      .where(eq(maintenanceLog.equipmentId, equipmentId))
      .orderBy(desc(maintenanceLog.timestamp));
  }

  async createMaintenanceRecord(data: InsertMaintenanceLog): Promise<MaintenanceLog> {
    // Create the maintenance record
    const [record] = await db
      .insert(maintenanceLog)
      .values(data)
      .returning();
      
    // Update the equipment's lastMaintenance date
    await this.updateEquipment(data.equipmentId, {
      lastMaintenance: data.timestamp,
      // If it was in warning/critical, set back to operational
      status: 'operational'
    });
    
    return record;
  }

  async getUpcomingMaintenanceSchedule(): Promise<{ equipment: Equipment, nextMaintenance: Date }[]> {
    // Get all equipment that has a nextMaintenance date
    const equipmentList = await db
      .select()
      .from(equipment)
      .where(
        sql`${equipment.nextMaintenance} IS NOT NULL`
      )
      .orderBy(equipment.nextMaintenance);
      
    return equipmentList.map(item => ({
      equipment: item,
      nextMaintenance: item.nextMaintenance!
    }));
  }
  
  // Issue methods
  async getAllIssues(limit: number = 100): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .orderBy(desc(issues.createdAt))
      .limit(limit);
  }
  
  async getIssueById(id: number): Promise<Issue | undefined> {
    const [issue] = await db
      .select()
      .from(issues)
      .where(eq(issues.id, id));
    return issue;
  }
  
  async getIssuesByStatus(status: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(eq(issues.status, status))
      .orderBy(desc(issues.createdAt));
  }
  
  async getIssuesByType(type: string): Promise<Issue[]> {
    return db
      .select()
      .from(issues)
      .where(eq(issues.type, type))
      .orderBy(desc(issues.createdAt));
  }
  
  async createIssue(data: InsertIssue): Promise<Issue> {
    const [issue] = await db
      .insert(issues)
      .values(data)
      .returning();
    return issue;
  }
  
  async updateIssue(id: number, data: Partial<InsertIssue>): Promise<Issue> {
    const [updated] = await db
      .update(issues)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(issues.id, id))
      .returning();
    return updated;
  }
  
  async closeIssue(id: number, resolution?: string): Promise<Issue> {
    const [closed] = await db
      .update(issues)
      .set({
        status: 'completed',
        closedAt: new Date(),
        updatedAt: new Date(),
        description: resolution 
          ? sql`${issues.description} || E'\n\n**Resolution:** ' || ${resolution}`
          : issues.description
      })
      .where(eq(issues.id, id))
      .returning();
    return closed;
  }
  
  // Issue comment methods
  async getIssueComments(issueId: number): Promise<IssueComment[]> {
    return db
      .select()
      .from(issueComments)
      .where(eq(issueComments.issueId, issueId))
      .orderBy(issueComments.createdAt);
  }
  
  async createIssueComment(data: InsertIssueComment): Promise<IssueComment> {
    const [comment] = await db
      .insert(issueComments)
      .values(data)
      .returning();
    return comment;
  }
  
  async updateIssueComment(id: number, content: string): Promise<IssueComment> {
    const [updated] = await db
      .update(issueComments)
      .set({
        content,
        updatedAt: new Date(),
        isEdited: true
      })
      .where(eq(issueComments.id, id))
      .returning();
    return updated;
  }
  
  // Todo item methods
  async getAllTodoItems(): Promise<TodoItem[]> {
    return db
      .select()
      .from(todoItems)
      .orderBy([
        { column: todoItems.status, order: 'asc' }, // Show pending first
        { column: todoItems.stage, order: 'asc' },  // Lower stages first
        { column: todoItems.createdAt, order: 'desc' } // Newest first
      ]);
  }
  
  async getTodoItemsByStatus(status: string): Promise<TodoItem[]> {
    return db
      .select()
      .from(todoItems)
      .where(eq(todoItems.status, status))
      .orderBy([
        { column: todoItems.stage, order: 'asc' },
        { column: todoItems.createdAt, order: 'desc' }
      ]);
  }
  
  async getTodoItemsByStage(stage: number): Promise<TodoItem[]> {
    return db
      .select()
      .from(todoItems)
      .where(eq(todoItems.stage, stage))
      .orderBy([
        { column: todoItems.status, order: 'asc' },
        { column: todoItems.createdAt, order: 'desc' }
      ]);
  }
  
  async createTodoItem(data: InsertTodoItem): Promise<TodoItem> {
    const [item] = await db
      .insert(todoItems)
      .values(data)
      .returning();
    return item;
  }
  
  async updateTodoItem(id: number, data: Partial<InsertTodoItem>): Promise<TodoItem> {
    const [updated] = await db
      .update(todoItems)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(todoItems.id, id))
      .returning();
    return updated;
  }
  
  async completeTodoItem(id: number): Promise<TodoItem> {
    const [completed] = await db
      .update(todoItems)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(todoItems.id, id))
      .returning();
    return completed;
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
    
    // Generate equipment data if none exists
    await this.ensureEquipmentDataExists();
    
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
      const air_temp = 22 + (Math.random() * 3) - 1.5;
      
      // Calculate GHI and DNI based on weather conditions
      let ghi = 0;
      let dni = 0;
      
      switch(weather) {
        case 'Sunny':
          ghi = 650 + (Math.random() * 200);
          dni = 750 + (Math.random() * 200);
          break;
        case 'Partly Cloudy':
          ghi = 350 + (Math.random() * 300);
          dni = 400 + (Math.random() * 350);
          break;
        case 'Cloudy':
          ghi = 150 + (Math.random() * 200);
          dni = 100 + (Math.random() * 150);
          break;
        case 'Overcast':
          ghi = 50 + (Math.random() * 100);
          dni = 20 + (Math.random() * 80);
          break;
        default:
          ghi = 350;
          dni = 400;
      }
      
      environmentalDataBatch.push({
        timestamp,
        weather,
        air_temp,
        ghi,
        dni,
        humidity: 65 + (Math.random() * 20),
        windSpeed: 10 + (Math.random() * 15)
      });
    }
    
    // Insert all environmental data entries in a batch
    await db.insert(environmentalData).values(environmentalDataBatch);
  }
  
  // Initialize equipment data
  private async ensureEquipmentDataExists(): Promise<void> {
    // Check if equipment data exists
    const [existingEquipment] = await db.select().from(equipment).limit(1);
    
    if (!existingEquipment) {
      await this.generateInitialEquipmentData();
      console.log("Generated initial equipment data");
    }
  }
  
  private async generateInitialEquipmentData(): Promise<void> {
    // Create initial equipment data based on the facility's systems
    const equipmentItems: InsertEquipment[] = [
      {
        name: "Big Cold Room",
        type: "Refrigeration",
        model: "CR-9000",
        manufacturer: "ColdTech Systems",
        installedDate: new Date("2023-05-15"),
        nominalPower: 9.5, // kW
        nominalEfficiency: 0.95,
        maintenanceInterval: 90, // days
        lastMaintenance: new Date(new Date().setDate(new Date().getDate() - 45)),
        status: "operational",
        metadata: { temperature: 4, targetTemperature: 3, area: 120 }
      },
      {
        name: "Big Freezer",
        type: "Refrigeration",
        model: "FZ-7000",
        manufacturer: "ColdTech Systems",
        installedDate: new Date("2023-05-15"),
        nominalPower: 7.0, // kW
        nominalEfficiency: 0.92,
        maintenanceInterval: 90, // days
        lastMaintenance: new Date(new Date().setDate(new Date().getDate() - 75)),
        status: "operational",
        metadata: { temperature: -18, targetTemperature: -20, area: 80 }
      },
      {
        name: "Refrigeration Circuit",
        type: "Refrigeration",
        model: "RC-4000",
        manufacturer: "ColdTech Systems",
        installedDate: new Date("2023-05-15"),
        nominalPower: 3.8, // kW
        nominalEfficiency: 0.9,
        maintenanceInterval: 60, // days
        lastMaintenance: new Date(new Date().setDate(new Date().getDate() - 40)),
        status: "operational",
        metadata: { temperature: 2, targetTemperature: 2, area: 35 }
      },
      {
        name: "Smoker",
        type: "Processing",
        model: "SM-100",
        manufacturer: "FoodTech Equipment",
        installedDate: new Date("2023-06-20"),
        nominalPower: 0.1, // kW
        nominalEfficiency: 0.85,
        maintenanceInterval: 30, // days
        lastMaintenance: new Date(new Date().setDate(new Date().getDate() - 20)),
        status: "operational",
        metadata: { temperature: 80, capacity: 50 }
      },
      {
        name: "Solar PV System",
        type: "Energy Generation",
        model: "SolarMax 500",
        manufacturer: "SunTech",
        installedDate: new Date("2023-03-10"),
        nominalPower: 2.5, // kW peak output
        nominalEfficiency: 0.98,
        maintenanceInterval: 180, // days
        lastMaintenance: new Date(new Date().setDate(new Date().getDate() - 90)),
        status: "operational",
        metadata: { panels: 10, orientation: "South", tilt: 35 }
      }
    ];
    
    // Insert all equipment
    for (const item of equipmentItems) {
      // Calculate next maintenance date
      const lastMaintenance = new Date(item.lastMaintenance!);
      const nextMaintenance = new Date(lastMaintenance);
      nextMaintenance.setDate(nextMaintenance.getDate() + item.maintenanceInterval!);
      
      // Insert with calculated nextMaintenance
      await db.insert(equipment).values({
        ...item,
        nextMaintenance
      });
    }
    
    // Generate some historical efficiency data
    const now = new Date();
    for (const item of equipmentItems) {
      // First get the inserted equipment to get its ID
      const [insertedEquipment] = await db
        .select()
        .from(equipment)
        .where(eq(equipment.name, item.name));
        
      if (insertedEquipment) {
        // Generate efficiency records for the past 30 days
        for (let i = 30; i >= 0; i--) {
          const timestamp = new Date(now.getTime() - i * 86400000); // one day in ms
          
          // Gradually decrease efficiency to simulate wear and tear
          // More significant decrease as we get closer to maintenance date
          const daysSinceLastMaintenance = Math.floor((timestamp.getTime() - insertedEquipment.lastMaintenance!.getTime()) / 86400000);
          const efficiencyDecay = 0.001 * daysSinceLastMaintenance;
          
          // Power usage increases as efficiency decreases
          const powerUsageIncrease = 1 + (efficiencyDecay * 2);
          const powerUsage = insertedEquipment.nominalPower! * powerUsageIncrease;
          
          // Add some random daily fluctuation
          const dailyFluctuation = (Math.random() * 0.1) - 0.05; // ±5%
          
          // Create the efficiency record
          const efficiencyRecord: InsertEquipmentEfficiency = {
            equipmentId: insertedEquipment.id,
            timestamp,
            powerUsage: powerUsage * (1 + dailyFluctuation),
            temperatureConditions: 22 + (Math.random() * 5) - 2.5, // 19.5 to 24.5 °C
            productionVolume: Math.floor(80 + (Math.random() * 40)) // 80 to 120 units
          };
          
          await this.createEquipmentEfficiencyRecord(efficiencyRecord);
        }
      }
    }
  }
  
  // Voice transcription operations
  async createVoiceTranscription(transcription: InsertVoiceTranscription): Promise<VoiceTranscription> {
    try {
      const [result] = await db
        .insert(voiceTranscriptions)
        .values(transcription)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error creating voice transcription:', error);
      throw new Error('Failed to create voice transcription');
    }
  }

  async getVoiceTranscriptions(userId: number): Promise<VoiceTranscription[]> {
    try {
      const transcriptions = await db
        .select()
        .from(voiceTranscriptions)
        .where(eq(voiceTranscriptions.userId, userId))
        .orderBy(desc(voiceTranscriptions.createdAt));
      
      return transcriptions;
    } catch (error) {
      console.error('Error getting voice transcriptions:', error);
      throw new Error('Failed to get voice transcriptions');
    }
  }

  async getVoiceTranscription(id: number): Promise<VoiceTranscription | undefined> {
    try {
      const [transcription] = await db
        .select()
        .from(voiceTranscriptions)
        .where(eq(voiceTranscriptions.id, id));
      
      return transcription;
    } catch (error) {
      console.error('Error getting voice transcription:', error);
      throw new Error('Failed to get voice transcription');
    }
  }

  async deleteVoiceTranscription(id: number, userId: number): Promise<boolean> {
    try {
      // First, check if the transcription exists and belongs to the user
      const [transcription] = await db
        .select()
        .from(voiceTranscriptions)
        .where(eq(voiceTranscriptions.id, id))
        .where(eq(voiceTranscriptions.userId, userId));
      
      if (!transcription) {
        return false;
      }
      
      // If found, delete it
      await db
        .delete(voiceTranscriptions)
        .where(eq(voiceTranscriptions.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting voice transcription:', error);
      throw new Error('Failed to delete voice transcription');
    }
  }
}

// Export a singleton instance of the database storage
export const storage = new DatabaseStorage();