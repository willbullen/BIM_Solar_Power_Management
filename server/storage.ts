import { users, type User, type InsertUser, type Settings, type InsertSettings, type PowerData, type InsertPowerData, type EnvironmentalData, type InsertEnvironmentalData } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
  createPowerData(data: InsertPowerData): Promise<PowerData>;
  
  // Environmental data operations
  getEnvironmentalData(limit?: number): Promise<EnvironmentalData[]>;
  getLatestEnvironmentalData(): Promise<EnvironmentalData | undefined>;
  createEnvironmentalData(data: InsertEnvironmentalData): Promise<EnvironmentalData>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private settings: Settings;
  private powerData: PowerData[];
  private environmentalData: EnvironmentalData[];
  sessionStore: session.SessionStore;
  
  currentUserId: number;
  currentPowerDataId: number;
  currentEnvironmentalDataId: number;

  constructor() {
    this.users = new Map();
    this.powerData = [];
    this.environmentalData = [];
    this.currentUserId = 1;
    this.currentPowerDataId = 1;
    this.currentEnvironmentalDataId = 1;
    
    // Initialize session store
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Default settings
    this.settings = {
      id: 1,
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
    
    // Seed default admin and viewer users
    this.createUser({
      username: "admin",
      password: "$2a$10$Q7gYhQljOXNNMeSBJSOCU.gMZa1FSjZWHfGHnlrMN5kX/JwZXTX1G", // "password"
      role: "Admin"
    });
    
    this.createUser({
      username: "viewer",
      password: "$2a$10$Q7gYhQljOXNNMeSBJSOCU.gMZa1FSjZWHfGHnlrMN5kX/JwZXTX1G", // "password"
      role: "Viewer"
    });
    
    // Seed initial power data
    this.createInitialPowerData();
    this.createInitialEnvironmentalData();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Settings methods
  async getSettings(): Promise<Settings> {
    return this.settings;
  }
  
  async updateSettings(updatedSettings: Partial<InsertSettings>): Promise<Settings> {
    this.settings = { ...this.settings, ...updatedSettings };
    return this.settings;
  }
  
  // Power data methods
  async getPowerData(limit: number = 100): Promise<PowerData[]> {
    return this.powerData
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  async getLatestPowerData(): Promise<PowerData | undefined> {
    if (this.powerData.length === 0) return undefined;
    
    return this.powerData
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
  
  async createPowerData(data: InsertPowerData): Promise<PowerData> {
    const id = this.currentPowerDataId++;
    const powerDataEntry: PowerData = { ...data, id };
    this.powerData.push(powerDataEntry);
    
    // Limit the size of in-memory data
    if (this.powerData.length > 1000) {
      this.powerData.shift();
    }
    
    return powerDataEntry;
  }
  
  // Environmental data methods
  async getEnvironmentalData(limit: number = 100): Promise<EnvironmentalData[]> {
    return this.environmentalData
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
  
  async getLatestEnvironmentalData(): Promise<EnvironmentalData | undefined> {
    if (this.environmentalData.length === 0) return undefined;
    
    return this.environmentalData
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
  
  async createEnvironmentalData(data: InsertEnvironmentalData): Promise<EnvironmentalData> {
    const id = this.currentEnvironmentalDataId++;
    const environmentalDataEntry: EnvironmentalData = { ...data, id };
    this.environmentalData.push(environmentalDataEntry);
    
    // Limit the size of in-memory data
    if (this.environmentalData.length > 1000) {
      this.environmentalData.shift();
    }
    
    return environmentalDataEntry;
  }
  
  // Seed initial data
  private createInitialPowerData() {
    const now = new Date();
    
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
      
      this.createPowerData({
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
  }
  
  private createInitialEnvironmentalData() {
    const now = new Date();
    const weatherOptions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Overcast'];
    
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
      
      this.createEnvironmentalData({
        timestamp,
        weather,
        temperature,
        sunIntensity
      });
    }
  }
}

export const storage = new MemStorage();
