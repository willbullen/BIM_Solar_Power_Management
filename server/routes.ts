import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertPowerDataSchema, insertEnvironmentalDataSchema, insertSettingsSchema } from "@shared/schema";
import { ZodError } from "zod";
import { generateSyntheticData } from "./data";
import { format } from 'date-fns';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the database
  console.log("Initializing database tables and seed data...");
  await storage.initializeDatabase();
  console.log("Database initialization completed successfully");

  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Instead of using WebSockets, we'll generate new data periodically
  // to be fetched via the REST API endpoints
  
  // Generate new data every 10 seconds
  setInterval(async () => {
    try {
      // Get settings to determine if we should use synthetic data
      const settings = await storage.getSettings();
      
      // Generate or fetch data based on settings
      let powerData;
      let environmentalData;
      
      if (settings.dataSource === 'synthetic') {
        // Generate synthetic data based on selected scenario
        const syntheticData = generateSyntheticData(settings.scenarioProfile);
        powerData = await storage.createPowerData(syntheticData.powerData);
        environmentalData = await storage.createEnvironmentalData(syntheticData.environmentalData);
        console.log('Generated new synthetic data');
      } else {
        // In a real implementation, this would fetch from real sensors
        // For demo purposes, we'll generate slightly random data
        const latestPower = await storage.getLatestPowerData();
        const latestEnv = await storage.getLatestEnvironmentalData();
        
        if (latestPower && latestEnv) {
          // Function to get random variation within range
          const getVariation = (value: number, minPercent: number, maxPercent: number): number => {
            return value * (minPercent + Math.random() * (maxPercent - minPercent));
          };
          
          // Get current hour to determine appropriate scenario
          const currentHour = new Date().getHours();
          let scenario = 'cloudy'; // Default
          
          // Determine scenario based on time of day
          if (currentHour >= 9 && currentHour < 16) {
            scenario = Math.random() > 0.3 ? 'sunny' : 'cloudy'; // More likely sunny during day
          } else if (currentHour >= 16 && currentHour < 20) {
            scenario = Math.random() > 0.6 ? 'peak' : 'cloudy'; // Afternoon peak
          } else {
            scenario = 'night'; // Night time
          }
          
          // Generate base values using our scenario-based generator
          const baseData = generateSyntheticData(scenario);
          
          // Create new data that slightly varies from baseline but stays in realistic range
          powerData = await storage.createPowerData({
            timestamp: new Date(),
            mainGridPower: getVariation(baseData.powerData.mainGridPower, 0.95, 1.05),
            solarOutput: latestEnv.sunIntensity > 20 
              ? getVariation(baseData.powerData.solarOutput, 0.95, 1.05)
              : getVariation(baseData.powerData.solarOutput, 0.90, 1.0),
            refrigerationLoad: getVariation(baseData.powerData.refrigerationLoad, 0.97, 1.03),
            bigColdRoom: getVariation(baseData.powerData.bigColdRoom, 0.97, 1.03),
            bigFreezer: getVariation(baseData.powerData.bigFreezer, 0.97, 1.03),
            smoker: getVariation(baseData.powerData.smoker, 0.95, 1.05),
            totalLoad: getVariation(baseData.powerData.totalLoad, 0.97, 1.03),
            unaccountedLoad: getVariation(baseData.powerData.unaccountedLoad, 0.95, 1.05)
          });
          
          environmentalData = await storage.createEnvironmentalData({
            timestamp: new Date(),
            weather: baseData.environmentalData.weather,
            temperature: getVariation(baseData.environmentalData.temperature, 0.99, 1.01),
            sunIntensity: Math.min(100, Math.max(0, getVariation(baseData.environmentalData.sunIntensity, 0.97, 1.03)))
          });
          console.log('Generated new live data');
        } else {
          // Fallback to synthetic data if no previous data exists
          const syntheticData = generateSyntheticData('sunny');
          powerData = await storage.createPowerData(syntheticData.powerData);
          environmentalData = await storage.createEnvironmentalData(syntheticData.environmentalData);
          console.log('Generated initial synthetic data (fallback)');
        }
      }
    } catch (error) {
      console.error('Error generating periodic data:', error);
    }
  }, 10000); // Update every 10 seconds
  
  // GET /api/power-data - Get historical power data
  app.get('/api/power-data', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const data = await storage.getPowerData(limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch power data' });
    }
  });
  
  // GET /api/power-data/latest - Get the latest power data reading
  app.get('/api/power-data/latest', async (req, res) => {
    try {
      const data = await storage.getLatestPowerData();
      if (!data) {
        return res.status(404).json({ message: 'No power data available' });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch latest power data' });
    }
  });
  
  // GET /api/power-data/range - Get power data within date range
  app.get('/api/power-data/range', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Start date and end date are required' });
      }
      
      const data = await storage.getPowerDataByDateRange(
        new Date(startDate as string), 
        new Date(endDate as string)
      );
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch power data by date range' });
    }
  });
  
  // GET /api/environmental-data - Get historical environmental data
  app.get('/api/environmental-data', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const data = await storage.getEnvironmentalData(limit);
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch environmental data' });
    }
  });
  
  // GET /api/environmental-data/latest - Get the latest environmental data
  app.get('/api/environmental-data/latest', async (req, res) => {
    try {
      const data = await storage.getLatestEnvironmentalData();
      if (!data) {
        return res.status(404).json({ message: 'No environmental data available' });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch latest environmental data' });
    }
  });
  
  // GET /api/environmental-data/range - Get environmental data within date range
  app.get('/api/environmental-data/range', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Start date and end date are required' });
      }
      
      const data = await storage.getEnvironmentalDataByDateRange(
        new Date(startDate as string), 
        new Date(endDate as string)
      );
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch environmental data by date range' });
    }
  });
  
  // GET /api/export - Export data as CSV or JSON
  app.get('/api/export', async (req, res) => {
    try {
      const { startDate, endDate, dataType, format } = req.query;
      
      if (!startDate || !endDate || !dataType) {
        return res.status(400).json({ 
          message: 'Start date, end date, and data type are required' 
        });
      }
      
      let data;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      // Get data based on type
      if (dataType === 'power') {
        data = await storage.getPowerDataByDateRange(start, end);
      } else if (dataType === 'environmental') {
        data = await storage.getEnvironmentalDataByDateRange(start, end);
      } else if (dataType === 'combined') {
        const powerData = await storage.getPowerDataByDateRange(start, end);
        const envData = await storage.getEnvironmentalDataByDateRange(start, end);
        
        // Combine the data sets by matching timestamps (or nearest)
        data = powerData.map(power => {
          const timestamp = new Date(power.timestamp);
          // Find closest environmental reading
          const env = envData.length ? envData.reduce<typeof envData[0]>((closest, current) => {
            const currentTime = new Date(current.timestamp);
            const closestTime = new Date(closest.timestamp);
            
            const currentDiff = Math.abs(currentTime.getTime() - timestamp.getTime());
            const closestDiff = Math.abs(closestTime.getTime() - timestamp.getTime());
            
            return currentDiff < closestDiff ? current : closest;
          }, envData[0]) : null;
          
          return {
            timestamp: power.timestamp,
            // Power metrics
            mainGridPower: power.mainGridPower,
            solarOutput: power.solarOutput,
            refrigerationLoad: power.refrigerationLoad,
            bigColdRoom: power.bigColdRoom,
            bigFreezer: power.bigFreezer, 
            smoker: power.smoker,
            totalLoad: power.totalLoad,
            unaccountedLoad: power.unaccountedLoad,
            // Environmental metrics
            weather: env?.weather || null,
            temperature: env?.temperature || null,
            sunIntensity: env?.sunIntensity || null
          };
        });
      } else {
        return res.status(400).json({ message: 'Invalid data type. Use "power", "environmental", or "combined"' });
      }
      
      if (!data || data.length === 0) {
        return res.status(404).json({ message: 'No data found for the specified date range' });
      }
      
      const exportFormat = (format as string) || 'json';
      
      if (exportFormat === 'csv') {
        // Generate CSV
        const csvHeader = Object.keys(data[0]).join(',');
        const csvRows = data.map(item => 
          Object.values(item).map(value => 
            value instanceof Date 
              ? value.toISOString() 
              : value === null 
                ? '' 
                : typeof value === 'string' 
                  ? `"${value.replace(/"/g, '""')}"` 
                  : String(value)
          ).join(',')
        );
        
        const csv = [csvHeader, ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=dalys-${dataType}-data-${formatDateForFilename(start)}-to-${formatDateForFilename(end)}.csv`);
        return res.send(csv);
      } else {
        // Return JSON format with a download header
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=dalys-${dataType}-data-${formatDateForFilename(start)}-to-${formatDateForFilename(end)}.json`);
        return res.json(data);
      }
      
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });
  
  // GET /api/settings - Get current system settings
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });
  
  // PUT /api/settings - Update system settings
  app.put('/api/settings', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      // Validate input
      const validatedData = insertSettingsSchema.parse(req.body);
      
      // Update settings
      const updatedSettings = await storage.updateSettings(validatedData);
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Invalid settings data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  return httpServer;
}

// Helper function to format dates for filenames
function formatDateForFilename(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}


