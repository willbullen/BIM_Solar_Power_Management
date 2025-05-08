import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertPowerDataSchema, 
  insertEnvironmentalDataSchema, 
  insertSettingsSchema,
  insertEquipmentSchema, 
  insertEquipmentEfficiencySchema,
  insertMaintenanceLogSchema 
} from "@shared/schema";
import { ZodError } from "zod";
import { generateSyntheticData } from "./data";
import { format } from 'date-fns';
import { SolcastService } from './solcast-service';
import { AIService } from './ai-service';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize the database
  console.log("Initializing database tables and seed data...");
  await storage.initializeDatabase();
  console.log("Database initialization completed successfully");

  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Helper function to generate live data based on previous readings (moved outside of interval)
  async function generateLiveDataFromPrevious(latestPower: any, latestEnv: any): Promise<{powerData: any, environmentalData: any}> {
    let powerData;
    let environmentalData;
    
    if (latestPower && latestEnv) {
      // Function to get random variation within range
      const getVariation = (value: number, minPercent: number, maxPercent: number): number => {
        return value * (minPercent + Math.random() * (maxPercent - minPercent));
      };
      
      // Helper function to get random value within a range
      const getRandomInRange = (min: number, max: number): number => {
        return min + (Math.random() * (max - min));
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
      
      // For temperature and sun intensity, calculate extremely small variations (±0.05 max)
      const getTinyVariation = (value: number, maxChange: number = 0.05): number => {
        // Generate a random number between -maxChange and +maxChange
        const change = (Math.random() * 2 * maxChange) - maxChange;
        return value + change;
      };
      
      environmentalData = await storage.createEnvironmentalData({
        timestamp: new Date(),
        // Keep the same weather for longer periods (only change 5% of the time)
        weather: Math.random() < 0.05 ? baseData.environmentalData.weather : latestEnv.weather,
        // Ultra-small temperature variations (max ±0.05°C between refreshes)
        // Use the LATEST temp value, not the base scenario temp
        temperature: Math.round((getTinyVariation(latestEnv.temperature, 0.05)) * 10) / 10,
        // Use the LATEST humidity value, not the base scenario value
        humidity: Math.min(98, Math.max(60, 
                 getTinyVariation(latestEnv.humidity || 85, 0.1))), 
        // Use the LATEST wind speed, not the base scenario value
        windSpeed: Math.min(60, Math.max(3, 
                 getTinyVariation(latestEnv.windSpeed || 15, 0.2))),
        // Ultra-small sun intensity variations (max ±0.1% between refreshes)
        // Use the LATEST value, not the base scenario value
        sunIntensity: Math.min(100, Math.max(0, 
                     getTinyVariation(latestEnv.sunIntensity, 0.1)))
      });
      console.log('Generated new live data');
    } else {
      // Fallback to synthetic data if no previous data exists
      const syntheticData = generateSyntheticData('sunny');
      powerData = await storage.createPowerData(syntheticData.powerData);
      environmentalData = await storage.createEnvironmentalData(syntheticData.environmentalData);
      console.log('Generated initial synthetic data (fallback)');
    }
    
    return { powerData, environmentalData };
  }
  
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
        // For live data, we can use real API data or generate slightly random values
        const latestPower = await storage.getLatestPowerData();
        const latestEnv = await storage.getLatestEnvironmentalData();
        
        // Check if we should use Solcast data for environmental measurements
        if (settings.useSolcastData && settings.solcastApiKey) {
          // Initialize Solcast service with API key and location
          const solcastService = new SolcastService(
            settings.solcastApiKey, 
            settings.locationLatitude ?? undefined, 
            settings.locationLongitude ?? undefined
          );
          
          try {
            // Fetch the latest forecast data (for next 24 hours)
            // The SolcastService now includes fallback handling for API issues
            const forecastData = await solcastService.getForecastData(24);
            
            // Map Solcast data to our environmental data format
            const mappedEnvData = solcastService.mapToEnvironmentalData(forecastData);
            
            if (mappedEnvData.length > 0) {
              // Take the most current data point (first in the array)
              const currentEnvData = mappedEnvData[0];
              
              // Create environmental data record with Solcast data
              environmentalData = await storage.createEnvironmentalData(currentEnvData);
              console.log('Created environmental data from Solcast API');
              
              // Create power data that correlates with the environmental conditions
              // Function to get random variation within range
              const getVariation = (value: number, minPercent: number, maxPercent: number): number => {
                return value * (minPercent + Math.random() * (maxPercent - minPercent));
              };
              
              // Adjust solar output based on sun intensity from real weather data
              let solarEfficiency = 1.0;
              
              // Weather affects solar efficiency
              if (currentEnvData.weather === 'Sunny') {
                solarEfficiency = 1.0; // Maximum efficiency
              } else if (currentEnvData.weather === 'Partly Cloudy') {
                solarEfficiency = 0.75; // 75% efficiency
              } else if (currentEnvData.weather === 'Mostly Cloudy') {
                solarEfficiency = 0.5; // 50% efficiency
              } else if (currentEnvData.weather === 'Cloudy') {
                solarEfficiency = 0.3; // 30% efficiency
              } else {
                solarEfficiency = 0.2; // 20% efficiency for overcast
              }
              
              // Calculate base solar output based on sun intensity and weather
              const baseSolarOutput = (currentEnvData.sunIntensity / 100) * 2.5 * solarEfficiency;
              
              // Create corresponding power data
              powerData = await storage.createPowerData({
                timestamp: new Date(),
                // Base solar output on real weather data
                solarOutput: Math.max(0, baseSolarOutput),
                // Other values vary slightly from previous readings
                mainGridPower: latestPower ? getVariation(latestPower.mainGridPower, 0.95, 1.05) : 3.5,
                refrigerationLoad: latestPower ? getVariation(latestPower.refrigerationLoad, 0.97, 1.03) : 3.9,
                bigColdRoom: latestPower ? getVariation(latestPower.bigColdRoom, 0.97, 1.03) : 9.7,
                bigFreezer: latestPower ? getVariation(latestPower.bigFreezer, 0.97, 1.03) : 7.1,
                smoker: latestPower ? getVariation(latestPower.smoker, 0.95, 1.05) : 0.1,
                totalLoad: latestPower ? getVariation(latestPower.totalLoad, 0.97, 1.03) : 5.6,
                unaccountedLoad: latestPower ? getVariation(latestPower.unaccountedLoad, 0.95, 1.05) : 0.6
              });
              
            } else {
              throw new Error('No forecast data available from Solcast');
            }
          } catch (error) {
            console.error('Error fetching Solcast data:', error);
            // Fallback to normal data generation if API call fails
            const result = await generateLiveDataFromPrevious(latestPower, latestEnv);
            powerData = result.powerData;
            environmentalData = result.environmentalData;
          }
        } else {
          // Use previous method if not using Solcast
          const result = await generateLiveDataFromPrevious(latestPower, latestEnv);
          powerData = result.powerData;
          environmentalData = result.environmentalData;
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
  
  // GET /api/environmental-data/forecast - Get forecast data from Solcast
  app.get('/api/environmental-data/forecast', async (req, res) => {
    try {
      // Get settings to check if Solcast is enabled
      const settings = await storage.getSettings();
      
      if (!settings.useSolcastData || !settings.solcastApiKey) {
        return res.status(400).json({ 
          message: 'Solcast API is not configured or enabled. Update settings to enable forecast data.' 
        });
      }
      
      // Get hours parameter (default to 48 hours)
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 48;
      
      // Initialize Solcast service with API key and location
      const solcastService = new SolcastService(
        settings.solcastApiKey,
        settings.locationLatitude ?? undefined,
        settings.locationLongitude ?? undefined
      );
      
      // Try to fetch forecast data with improved error handling
      // SolcastService will now handle API errors internally and provide fallback data
      let forecastData;
      try {
        forecastData = await solcastService.getForecastData(hours);
      } catch (err) {
        console.warn('Issue with Solcast API, using fallback data:', err);
        forecastData = solcastService.getFallbackData();
      }
      
      // Convert to our environmental data format
      const mappedData = solcastService.mapToEnvironmentalData(forecastData);
      
      // Add a data source indicator if we're using fallback data
      const usingRealData = !('_fallback' in forecastData);
      
      res.json({
        data: mappedData,
        meta: {
          source: usingRealData ? 'solcast-api' : 'fallback-data',
          timestamp: new Date(),
          forecastHours: hours
        }
      });
    } catch (error) {
      console.error('Error in forecast endpoint:', error);
      res.status(500).json({ 
        message: 'Failed to process forecast data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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

  // Equipment API routes
  
  // GET /api/equipment - Get all equipment
  app.get('/api/equipment', async (req, res) => {
    try {
      const data = await storage.getAllEquipment();
      res.json(data);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      res.status(500).json({ message: 'Failed to fetch equipment' });
    }
  });
  
  // GET /api/equipment/:id - Get equipment by ID
  app.get('/api/equipment/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const equipment = await storage.getEquipmentById(id);
      
      if (!equipment) {
        return res.status(404).json({ message: 'Equipment not found' });
      }
      
      res.json(equipment);
    } catch (error) {
      console.error('Error fetching equipment by ID:', error);
      res.status(500).json({ message: 'Failed to fetch equipment' });
    }
  });
  
  // GET /api/equipment/type/:type - Get equipment by type
  app.get('/api/equipment/type/:type', async (req, res) => {
    try {
      const type = req.params.type;
      const equipment = await storage.getEquipmentByType(type);
      
      res.json(equipment);
    } catch (error) {
      console.error('Error fetching equipment by type:', error);
      res.status(500).json({ message: 'Failed to fetch equipment by type' });
    }
  });
  
  // POST /api/equipment - Create new equipment
  app.post('/api/equipment', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      // Validate input
      const validatedData = insertEquipmentSchema.parse(req.body);
      
      // Create equipment
      const equipment = await storage.createEquipment(validatedData);
      res.status(201).json(equipment);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Invalid equipment data', errors: error.errors });
      }
      console.error('Error creating equipment:', error);
      res.status(500).json({ message: 'Failed to create equipment' });
    }
  });
  
  // PUT /api/equipment/:id - Update equipment
  app.put('/api/equipment/:id', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const id = parseInt(req.params.id);
      
      // Validate input
      const validatedData = insertEquipmentSchema.partial().parse(req.body);
      
      // Update equipment
      const equipment = await storage.updateEquipment(id, validatedData);
      
      if (!equipment) {
        return res.status(404).json({ message: 'Equipment not found' });
      }
      
      res.json(equipment);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Invalid equipment data', errors: error.errors });
      }
      console.error('Error updating equipment:', error);
      res.status(500).json({ message: 'Failed to update equipment' });
    }
  });
  
  // DELETE /api/equipment/:id - Delete equipment
  app.delete('/api/equipment/:id', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const id = parseInt(req.params.id);
      const success = await storage.deleteEquipment(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Equipment not found or could not be deleted' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting equipment:', error);
      res.status(500).json({ message: 'Failed to delete equipment' });
    }
  });
  
  // GET /api/equipment/:id/efficiency - Get efficiency data for equipment
  app.get('/api/equipment/:id/efficiency', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      
      const data = await storage.getEquipmentEfficiencyData(id, limit);
      res.json(data);
    } catch (error) {
      console.error('Error fetching equipment efficiency data:', error);
      res.status(500).json({ message: 'Failed to fetch equipment efficiency data' });
    }
  });
  
  // POST /api/equipment/:id/efficiency - Create efficiency record for equipment
  app.post('/api/equipment/:id/efficiency', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const equipmentId = parseInt(req.params.id);
      
      // Validate input
      const validatedData = insertEquipmentEfficiencySchema.parse({
        ...req.body,
        equipmentId
      });
      
      // Create efficiency record
      const record = await storage.createEquipmentEfficiencyRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Invalid efficiency data', errors: error.errors });
      }
      console.error('Error creating efficiency record:', error);
      res.status(500).json({ message: 'Failed to create efficiency record' });
    }
  });
  
  // GET /api/equipment/:id/maintenance - Get maintenance history for equipment
  app.get('/api/equipment/:id/maintenance', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getMaintenanceHistory(id);
      res.json(data);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      res.status(500).json({ message: 'Failed to fetch maintenance history' });
    }
  });
  
  // POST /api/equipment/:id/maintenance - Create maintenance record for equipment
  app.post('/api/equipment/:id/maintenance', async (req, res) => {
    try {
      // Ensure user is authenticated and is an admin
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      if (req.user?.role !== 'Admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
      }
      
      const equipmentId = parseInt(req.params.id);
      
      // Validate input
      const validatedData = insertMaintenanceLogSchema.parse({
        ...req.body,
        equipmentId,
        timestamp: req.body.timestamp || new Date()
      });
      
      // Create maintenance record
      const record = await storage.createMaintenanceRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: 'Invalid maintenance data', errors: error.errors });
      }
      console.error('Error creating maintenance record:', error);
      res.status(500).json({ message: 'Failed to create maintenance record' });
    }
  });
  
  // GET /api/maintenance/upcoming - Get upcoming maintenance schedule
  app.get('/api/maintenance/upcoming', async (req, res) => {
    try {
      const data = await storage.getUpcomingMaintenanceSchedule();
      res.json(data);
    } catch (error) {
      console.error('Error fetching upcoming maintenance:', error);
      res.status(500).json({ message: 'Failed to fetch upcoming maintenance schedule' });
    }
  });

  // === Feedback System Routes ===
  
  // Issues routes
  app.get('/api/issues', async (req, res) => {
    try {
      const issues = await storage.getAllIssues();
      res.json(issues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      res.status(500).json({ error: "Failed to fetch issues" });
    }
  });
  
  app.get('/api/issues/:id', async (req, res) => {
    try {
      const issue = await storage.getIssueById(parseInt(req.params.id));
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }
      res.json(issue);
    } catch (error) {
      console.error(`Error fetching issue ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch issue" });
    }
  });
  
  app.get('/api/issues/status/:status', async (req, res) => {
    try {
      const issues = await storage.getIssuesByStatus(req.params.status);
      res.json(issues);
    } catch (error) {
      console.error(`Error fetching issues with status ${req.params.status}:`, error);
      res.status(500).json({ error: "Failed to fetch issues by status" });
    }
  });
  
  app.get('/api/issues/type/:type', async (req, res) => {
    try {
      const issues = await storage.getIssuesByType(req.params.type);
      res.json(issues);
    } catch (error) {
      console.error(`Error fetching issues with type ${req.params.type}:`, error);
      res.status(500).json({ error: "Failed to fetch issues by type" });
    }
  });
  
  app.post('/api/issues', async (req, res) => {
    try {
      const issueData = req.body;
      
      // If authenticated, set the submitter ID
      if (req.user) {
        issueData.submitterId = req.user.id;
      }
      
      const issue = await storage.createIssue(issueData);
      res.status(201).json(issue);
    } catch (error) {
      console.error("Error creating issue:", error);
      res.status(500).json({ error: "Failed to create issue" });
    }
  });
  
  app.put('/api/issues/:id', async (req, res) => {
    try {
      // Optional: Check if user has permissions to update the issue
      const issue = await storage.updateIssue(parseInt(req.params.id), req.body);
      res.json(issue);
    } catch (error) {
      console.error(`Error updating issue ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update issue" });
    }
  });
  
  app.post('/api/issues/:id/close', async (req, res) => {
    try {
      // Optional: Check if user has permissions to close the issue
      const issue = await storage.closeIssue(parseInt(req.params.id), req.body.resolution);
      res.json(issue);
    } catch (error) {
      console.error(`Error closing issue ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to close issue" });
    }
  });
  
  // Issue comments routes
  app.get('/api/issues/:id/comments', async (req, res) => {
    try {
      const comments = await storage.getIssueComments(parseInt(req.params.id));
      res.json(comments);
    } catch (error) {
      console.error(`Error fetching comments for issue ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });
  
  app.post('/api/issues/:id/comments', async (req, res) => {
    try {
      const commentData = {
        issueId: parseInt(req.params.id),
        content: req.body.content
      };
      
      // If authenticated, set the user ID
      if (req.user) {
        commentData.userId = req.user.id;
      }
      
      const comment = await storage.createIssueComment(commentData);
      res.status(201).json(comment);
    } catch (error) {
      console.error(`Error creating comment for issue ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });
  
  app.put('/api/comments/:id', async (req, res) => {
    try {
      // Optional: Check if user owns the comment before updating
      const comment = await storage.updateIssueComment(parseInt(req.params.id), req.body.content);
      res.json(comment);
    } catch (error) {
      console.error(`Error updating comment ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });
  
  // Todo items routes
  app.get('/api/todo-items', async (req, res) => {
    try {
      const todoItems = await storage.getAllTodoItems();
      res.json(todoItems);
    } catch (error) {
      console.error("Error fetching todo items:", error);
      res.status(500).json({ error: "Failed to fetch todo items" });
    }
  });
  
  app.get('/api/todo-items/status/:status', async (req, res) => {
    try {
      const todoItems = await storage.getTodoItemsByStatus(req.params.status);
      res.json(todoItems);
    } catch (error) {
      console.error(`Error fetching todo items with status ${req.params.status}:`, error);
      res.status(500).json({ error: "Failed to fetch todo items by status" });
    }
  });
  
  app.get('/api/todo-items/stage/:stage', async (req, res) => {
    try {
      const todoItems = await storage.getTodoItemsByStage(parseInt(req.params.stage));
      res.json(todoItems);
    } catch (error) {
      console.error(`Error fetching todo items for stage ${req.params.stage}:`, error);
      res.status(500).json({ error: "Failed to fetch todo items by stage" });
    }
  });
  
  app.post('/api/todo-items', async (req, res) => {
    try {
      const todoItem = await storage.createTodoItem(req.body);
      res.status(201).json(todoItem);
    } catch (error) {
      console.error("Error creating todo item:", error);
      res.status(500).json({ error: "Failed to create todo item" });
    }
  });
  
  app.put('/api/todo-items/:id', async (req, res) => {
    try {
      const todoItem = await storage.updateTodoItem(parseInt(req.params.id), req.body);
      res.json(todoItem);
    } catch (error) {
      console.error(`Error updating todo item ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to update todo item" });
    }
  });
  
  app.post('/api/todo-items/:id/complete', async (req, res) => {
    try {
      const todoItem = await storage.completeTodoItem(parseInt(req.params.id));
      res.json(todoItem);
    } catch (error) {
      console.error(`Error completing todo item ${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to complete todo item" });
    }
  });

  // === Solcast API Routes ===
  
  // Create a Solcast service instance
  const solcastService = new SolcastService(
    process.env.SOLCAST_API_KEY || 'demo-key',
    settings => settings // Function to get settings when needed
  );
  
  // GET /api/solcast/forecast - Get Solcast forecast data
  app.get('/api/solcast/forecast', async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 336;
      const period = req.query.period as string || 'PT30M';
      
      const data = await solcastService.getForecastData(hours, period);
      res.json(data);
    } catch (error) {
      console.error('Error fetching Solcast forecast data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch Solcast forecast data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // GET /api/solcast/pv-forecast - Get Solcast PV power forecast data
  app.get('/api/solcast/pv-forecast', async (req, res) => {
    try {
      const hours = req.query.hours ? parseInt(req.query.hours as string) : 336;
      const period = req.query.period as string || 'PT30M';
      
      const data = await solcastService.getPvForecastData(hours, period);
      res.json(data);
    } catch (error) {
      console.error('Error fetching Solcast PV forecast data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch Solcast PV forecast data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // GET /api/solcast/live-radiation - Get Solcast live radiation and weather data
  app.get('/api/solcast/live-radiation', async (req, res) => {
    try {
      const data = await solcastService.getLiveRadiationData();
      res.json(data);
    } catch (error) {
      console.error('Error fetching Solcast live radiation data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch Solcast live radiation data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // GET /api/solcast/live-pv - Get Solcast live PV power data
  app.get('/api/solcast/live-pv', async (req, res) => {
    try {
      const data = await solcastService.getLivePvData();
      res.json(data);
    } catch (error) {
      console.error('Error fetching Solcast live PV data:', error);
      res.status(500).json({ 
        message: 'Failed to fetch Solcast live PV data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI energy recommendations route
  app.post('/api/ai/energy-recommendations', async (req, res) => {
    try {
      // Initialize AI service
      const aiService = new AIService();
      
      // Validate that we have the API key available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured', 
          message: 'The AI recommendation service is not available at this time.'
        });
      }
      
      // Generate recommendations based on the data provided
      const data = req.body;
      const recommendations = await aiService.generateEnergyRecommendations(data);
      
      res.json(recommendations);
    } catch (error) {
      console.error('Error generating AI energy recommendations:', error);
      res.status(500).json({ 
        error: 'Failed to generate recommendations',
        message: 'An error occurred while generating energy efficiency recommendations.'
      });
    }
  });
  
  // AI advanced analytics route
  app.post('/api/ai/analytics', async (req, res) => {
    try {
      // Initialize AI service
      const aiService = new AIService();
      
      // Validate that we have the API key available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured', 
          message: 'The AI analytics service is not available at this time.'
        });
      }
      
      // Generate advanced analytics based on the data provided
      const data = req.body;
      const analytics = await aiService.generateDataAnalytics(data);
      
      res.json(analytics);
    } catch (error) {
      console.error('Error generating AI analytics:', error);
      res.status(500).json({ 
        error: 'Failed to generate analytics',
        message: 'An error occurred while generating advanced data analytics.'
      });
    }
  });
  
  // AI executive report generation route
  app.post('/api/ai/report', async (req, res) => {
    try {
      // Initialize AI service
      const aiService = new AIService();
      
      // Validate that we have the API key available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured', 
          message: 'The AI report generation service is not available at this time.'
        });
      }
      
      // Extract data and report type
      const { data, reportType } = req.body;
      
      if (!data || !reportType) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          message: 'Both data and reportType are required'
        });
      }
      
      // Generate executive report based on the data provided
      const report = await aiService.generateExecutiveReport(data, reportType);
      
      res.json(report);
    } catch (error) {
      console.error('Error generating executive report:', error);
      res.status(500).json({ 
        error: 'Failed to generate report',
        message: 'An error occurred while generating the executive report.'
      });
    }
  });
  
  // AI predictions route
  app.post('/api/ai/predictions', async (req, res) => {
    try {
      // Initialize AI service
      const aiService = new AIService();
      
      // Validate that we have the API key available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenAI API key not configured', 
          message: 'The AI prediction service is not available at this time.'
        });
      }
      
      // Extract data and forecast horizon
      const { data, forecastHorizon } = req.body;
      
      if (!data || !forecastHorizon) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          message: 'Both data and forecastHorizon are required'
        });
      }
      
      // Generate predictions based on the data provided
      const predictions = await aiService.generatePredictions(data, forecastHorizon);
      
      res.json(predictions);
    } catch (error) {
      console.error('Error generating predictions:', error);
      res.status(500).json({ 
        error: 'Failed to generate predictions',
        message: 'An error occurred while generating future predictions.'
      });
    }
  });

  return httpServer;
}

// Helper function to format dates for filenames
function formatDateForFilename(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}


