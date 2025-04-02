import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertPowerDataSchema, insertEnvironmentalDataSchema, insertSettingsSchema } from "@shared/schema";
import { ZodError } from "zod";
import { generateSyntheticData } from "./data";
import { WebSocketServer } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server with minimal configuration for Replit compatibility
  const wss = new WebSocketServer({ 
    noServer: true
  });
  
  // Handle upgrade manually
  httpServer.on('upgrade', (request, socket, head) => {
    console.log('Upgrade request for WebSocket');
    
    // Only handle WebSocket upgrades to /ws path
    if (request.url === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        console.log('WebSocket upgrade successful');
        wss.emit('connection', ws, request);
      });
    } else {
      // Reject non-matching requests
      socket.destroy();
    }
  });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send current data immediately upon connection
    sendInitialData(ws);
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });
  
  // Periodically broadcast power data updates to all connected clients
  setInterval(async () => {
    if (wss.clients.size > 0) {
      // Get settings to determine if we should use synthetic data
      const settings = await storage.getSettings();
      
      // Generate or fetch data
      let powerData;
      let environmentalData;
      
      if (settings.dataSource === 'synthetic') {
        // Generate synthetic data based on selected scenario
        const syntheticData = generateSyntheticData(settings.scenarioProfile);
        powerData = await storage.createPowerData(syntheticData.powerData);
        environmentalData = await storage.createEnvironmentalData(syntheticData.environmentalData);
      } else {
        // In a real implementation, this would fetch from real sensors
        // For demo purposes, we'll generate slightly random data
        const latestPower = await storage.getLatestPowerData();
        const latestEnv = await storage.getLatestEnvironmentalData();
        
        if (latestPower && latestEnv) {
          // Create slightly varied new data based on latest readings
          powerData = await storage.createPowerData({
            timestamp: new Date(),
            mainGridPower: latestPower.mainGridPower * (0.95 + Math.random() * 0.1),
            solarOutput: latestEnv.sunIntensity > 50 
              ? latestPower.solarOutput * (0.95 + Math.random() * 0.1)
              : latestPower.solarOutput * (0.85 + Math.random() * 0.1),
            refrigerationLoad: latestPower.refrigerationLoad * (0.97 + Math.random() * 0.06),
            bigColdRoom: latestPower.bigColdRoom * (0.97 + Math.random() * 0.06),
            bigFreezer: latestPower.bigFreezer * (0.97 + Math.random() * 0.06),
            smoker: latestPower.smoker * (0.9 + Math.random() * 0.2),
            totalLoad: latestPower.totalLoad * (0.97 + Math.random() * 0.06),
            unaccountedLoad: latestPower.unaccountedLoad * (0.9 + Math.random() * 0.2)
          });
          
          environmentalData = await storage.createEnvironmentalData({
            timestamp: new Date(),
            weather: latestEnv.weather,
            temperature: latestEnv.temperature * (0.99 + Math.random() * 0.02),
            sunIntensity: Math.min(100, Math.max(0, latestEnv.sunIntensity * (0.97 + Math.random() * 0.06)))
          });
        } else {
          // Fallback to synthetic data if no previous data exists
          const syntheticData = generateSyntheticData('sunny');
          powerData = await storage.createPowerData(syntheticData.powerData);
          environmentalData = await storage.createEnvironmentalData(syntheticData.environmentalData);
        }
      }
      
      // Broadcast to all clients
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(JSON.stringify({
            type: 'update',
            powerData,
            environmentalData,
            timestamp: new Date()
          }));
        }
      });
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

// Helper function to send initial data to newly connected WebSocket clients
async function sendInitialData(ws: any) {
  try {
    const [latestPower, latestEnvironmental, settings] = await Promise.all([
      storage.getLatestPowerData(),
      storage.getLatestEnvironmentalData(),
      storage.getSettings()
    ]);
    
    ws.send(JSON.stringify({
      type: 'initial',
      powerData: latestPower,
      environmentalData: latestEnvironmental,
      settings,
      timestamp: new Date()
    }));
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}
