import { db } from '../db';
import { 
  users, type User, type InsertUser, 
  settings, type Settings, type InsertSettings, 
  powerData, type PowerData, type InsertPowerData, 
  environmentalData, type EnvironmentalData, type InsertEnvironmentalData,
  equipment, type Equipment, type InsertEquipment,
  equipmentEfficiency, type EquipmentEfficiency, type InsertEquipmentEfficiency,
  maintenanceLog, type MaintenanceLog, type InsertMaintenanceLog
} from '../../shared/schema';
import { sql } from 'drizzle-orm';
import { hash } from 'bcrypt';
import { db } from '../data';
import { sub, add } from 'date-fns';

/**
 * This script creates all the required database tables and loads test data
 */
async function migrateAll() {
  console.log('Starting full database migration and data loading...');
  
  try {
    // 1. Create all tables
    await createAllTables();
    
    // 2. Create default settings
    await createDefaultSettings();
    
    // 3. Create default users
    await createDefaultUsers();
    
    // 4. Create test data - power and environmental
    await createHistoricalData();
    
    // 5. Create equipment and maintenance data
    await createEquipmentData();
    
    console.log('Migration and data loading completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

async function createAllTables() {
  console.log('Creating database tables...');
  
  // Create users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Viewer'
    )
  `);
  
  // Create settings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      data_source TEXT NOT NULL DEFAULT 'live',
      scenario_profile TEXT NOT NULL DEFAULT 'sunny',
      grid_import_threshold DOUBLE PRECISION NOT NULL DEFAULT 5,
      solar_output_minimum DOUBLE PRECISION NOT NULL DEFAULT 1.5,
      unaccounted_power_threshold DOUBLE PRECISION NOT NULL DEFAULT 15,
      enable_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
      data_refresh_rate INTEGER NOT NULL DEFAULT 10,
      historical_data_storage INTEGER NOT NULL DEFAULT 90,
      grid_power_cost DOUBLE PRECISION NOT NULL DEFAULT 0.28,
      feed_in_tariff DOUBLE PRECISION NOT NULL DEFAULT 0.09,
      weather_api_key TEXT,
      power_monitoring_api_key TEXT,
      notifications_api_key TEXT,
      solcast_api_key TEXT,
      location_latitude DOUBLE PRECISION DEFAULT 52.059937,
      location_longitude DOUBLE PRECISION DEFAULT -9.507269,
      use_solcast_data BOOLEAN DEFAULT FALSE
    )
  `);
  
  // Create power_data table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS power_data (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      main_grid_power DOUBLE PRECISION NOT NULL,
      solar_output DOUBLE PRECISION NOT NULL,
      refrigeration_load DOUBLE PRECISION NOT NULL,
      big_cold_room DOUBLE PRECISION NOT NULL,
      big_freezer DOUBLE PRECISION NOT NULL,
      smoker DOUBLE PRECISION NOT NULL,
      total_load DOUBLE PRECISION NOT NULL,
      unaccounted_load DOUBLE PRECISION NOT NULL
    )
  `);
  
  // Create environmental_data table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS environmental_data (
      id SERIAL PRIMARY KEY,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      weather TEXT NOT NULL,
      temperature DOUBLE PRECISION NOT NULL,
      sun_intensity DOUBLE PRECISION NOT NULL,
      humidity DOUBLE PRECISION,
      wind_speed DOUBLE PRECISION
    )
  `);
  
  // Create equipment table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      model TEXT,
      manufacturer TEXT,
      installed_date TIMESTAMP,
      nominal_power DOUBLE PRECISION,
      nominal_efficiency DOUBLE PRECISION,
      current_efficiency DOUBLE PRECISION,
      maintenance_interval INTEGER,
      last_maintenance TIMESTAMP,
      next_maintenance TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'operational',
      metadata JSONB
    )
  `);
  
  // Create equipment_efficiency table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS equipment_efficiency (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      power_usage DOUBLE PRECISION NOT NULL,
      efficiency_rating DOUBLE PRECISION NOT NULL,
      temperature_conditions DOUBLE PRECISION,
      production_volume INTEGER,
      anomaly_detected BOOLEAN NOT NULL DEFAULT FALSE,
      anomaly_score DOUBLE PRECISION,
      notes TEXT,
      FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE CASCADE
    )
  `);
  
  // Create maintenance_log table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS maintenance_log (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      maintenance_type TEXT NOT NULL,
      description TEXT NOT NULL,
      technician TEXT,
      cost DOUBLE PRECISION,
      parts_replaced TEXT,
      efficiency_before DOUBLE PRECISION,
      efficiency_after DOUBLE PRECISION,
      next_scheduled_date TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE CASCADE
    )
  `);
  
  // Create session table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "session" (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMP(6) NOT NULL
    )
  `);
  
  console.log('All tables created successfully');
}

async function createDefaultSettings() {
  console.log('Creating default settings...');
  
  // Check if settings already exist
  const existingSettings = await db.select().from(settings).limit(1);
  
  if (existingSettings.length === 0) {
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
      feedInTariff: 0.09,
      solcastApiKey: "XMKoLyczxaT3Qzt33MTkZS1gvg8ZJkO0",
      locationLatitude: 52.059937,
      locationLongitude: -9.507269,
      useSolcastData: true
    };
    
    await db.insert(settings).values(defaultSettings);
    console.log('Default settings created');
  } else {
    console.log('Settings already exist, skipping creation');
  }
}

async function createDefaultUsers() {
  console.log('Creating default users...');
  
  // Check if admin user exists
  const adminUser = await db.select().from(users).where(sql`username = 'admin'`).limit(1);
  
  if (adminUser.length === 0) {
    // Create admin user
    const hashedPassword = await hash("password", 10);
    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      role: "Admin"
    });
    console.log('Admin user created');
  }
  
  // Check if viewer user exists
  const viewerUser = await db.select().from(users).where(sql`username = 'viewer'`).limit(1);
  
  if (viewerUser.length === 0) {
    // Create viewer user
    const hashedPassword = await hash("password", 10);
    await db.insert(users).values({
      username: "viewer",
      password: hashedPassword,
      role: "Viewer"
    });
    console.log('Viewer user created');
  }
}

async function createHistoricalData() {
  console.log('Creating historical power and environmental data...');
  
  // Check if power data already exists
  const existingPowerData = await db.select().from(powerData).limit(1);
  
  if (existingPowerData.length === 0) {
    // Generate historical data for the past week with 30-minute intervals
    const now = new Date();
    const startDate = sub(now, { days: 7 });
    const powerDataBatch = [];
    const environmentalDataBatch = [];
    
    // Weather options with weights for more realistic data generation
    const weatherOptions = [
      { value: 'Sunny', weight: 0.4 },
      { value: 'Partly Cloudy', weight: 0.3 },
      { value: 'Cloudy', weight: 0.2 },
      { value: 'Overcast', weight: 0.05 },
      { value: 'Drizzle', weight: 0.03 },
      { value: 'Rain', weight: 0.02 }
    ];
    
    // Generate data for the past week with 30-minute intervals
    const timePoints = [];
    let currentTime = new Date(startDate);
    
    while (currentTime <= now) {
      timePoints.push(new Date(currentTime));
      currentTime = add(currentTime, { minutes: 30 });
    }
    
    // Ensure realistic patterns
    let prevWeather = 'Sunny';
    let prevTemp = 22;
    let prevSunIntensity = 80;
    let prevHumidity = 50;
    
    // Generate data for all time points
    for (const timestamp of timePoints) {
      // Basic time-of-day effects
      const hour = timestamp.getHours();
      const isDayTime = hour >= 6 && hour <= 20;
      const isMidDay = hour >= 10 && hour <= 16;
      
      // Generate synthetic data with time-of-day effects
      const { powerData: powerRecord, environmentalData: envRecord } = generateSyntheticData({
        timeOfDay: isDayTime ? 'day' : 'night',
        weather: prevWeather === 'Sunny' ? 'sunny' : 
                 prevWeather === 'Partly Cloudy' ? 'partly_cloudy' : 
                 prevWeather === 'Cloudy' || prevWeather === 'Overcast' ? 'cloudy' : 'rainy'
      });

      // Pick new weather with persistence (weather tends to stay similar for periods)
      const weatherChange = Math.random();
      if (weatherChange > 0.8) { // 20% chance to change weather
        // Weighted selection of new weather
        const rand = Math.random();
        let cumulativeWeight = 0;
        for (const option of weatherOptions) {
          cumulativeWeight += option.weight;
          if (rand <= cumulativeWeight) {
            prevWeather = option.value;
            break;
          }
        }
      }
      
      // Adjust temperature, sun intensity, and humidity with small variations for realism
      const tempVariation = (Math.random() * 2 - 1);
      prevTemp = Math.min(35, Math.max(10, prevTemp + tempVariation));
      
      // Sun intensity follows time of day and weather
      const timeBasedIntensity = isMidDay ? 90 : isDayTime ? 70 : 0;
      const weatherEffect = 
        prevWeather === 'Sunny' ? 1.0 : 
        prevWeather === 'Partly Cloudy' ? 0.7 : 
        prevWeather === 'Cloudy' ? 0.4 : 
        prevWeather === 'Overcast' ? 0.2 : 0.1;
      
      prevSunIntensity = timeBasedIntensity * weatherEffect;
      
      // Humidity is inversely related to temperature and affected by weather
      const humidityVariation = (Math.random() * 5 - 2.5);
      const weatherHumidityEffect = 
        prevWeather === 'Sunny' ? -5 : 
        prevWeather === 'Partly Cloudy' ? 0 : 
        prevWeather === 'Cloudy' ? 5 : 
        prevWeather === 'Overcast' ? 10 : 15;
      
      prevHumidity = Math.min(95, Math.max(30, prevHumidity + humidityVariation + weatherHumidityEffect - tempVariation));
      
      // Create power data record
      powerDataBatch.push({
        timestamp,
        mainGridPower: powerRecord.mainGridPower,
        solarOutput: isDayTime ? powerRecord.solarOutput : 0, // No solar at night
        refrigerationLoad: powerRecord.refrigerationLoad,
        bigColdRoom: powerRecord.bigColdRoom,
        bigFreezer: powerRecord.bigFreezer,
        smoker: powerRecord.smoker,
        totalLoad: powerRecord.totalLoad,
        unaccountedLoad: powerRecord.unaccountedLoad
      });
      
      // Create environmental data record
      // Convert sun intensity to GHI and DNI values
      let ghi = 0;
      let dni = 0;
      
      if (prevSunIntensity > 0) {
        // Convert previous sunIntensity percentage to GHI and DNI values
        ghi = prevSunIntensity * 10; // Approximate conversion
        dni = prevSunIntensity * 12; // DNI is typically higher than GHI
      }
      
      environmentalDataBatch.push({
        timestamp,
        weather: prevWeather,
        air_temp: prevTemp,
        ghi: ghi,
        dni: dni,
        humidity: prevHumidity,
        windSpeed: Math.random() * 15
      });
    }
    
    // Insert data in chunks to avoid overwhelming the database
    const chunkSize = 100;
    for (let i = 0; i < powerDataBatch.length; i += chunkSize) {
      const powerChunk = powerDataBatch.slice(i, i + chunkSize);
      await db.insert(powerData).values(powerChunk);
    }
    
    for (let i = 0; i < environmentalDataBatch.length; i += chunkSize) {
      const envChunk = environmentalDataBatch.slice(i, i + chunkSize);
      await db.insert(environmentalData).values(envChunk);
    }
    
    console.log(`Created ${powerDataBatch.length} historical data points`);
  } else {
    console.log('Power data already exists, skipping creation');
  }
}

async function createEquipmentData() {
  console.log('Creating equipment and maintenance data...');
  
  // Check if equipment data already exists
  const existingEquipment = await db.select().from(equipment).limit(1);
  
  if (existingEquipment.length === 0) {
    // Create core equipment items
    const equipmentItems: InsertEquipment[] = [
      {
        name: "Main Cold Room",
        type: "Refrigeration",
        model: "CR-5000",
        manufacturer: "CoolTech Industries",
        installedDate: new Date("2022-03-15"),
        nominalPower: 11.5,
        nominalEfficiency: 0.85,
        maintenanceInterval: 90, // days
        lastMaintenance: sub(new Date(), { days: 45 }),
        status: "operational",
        metadata: JSON.stringify({
          area: 120, // square meters
          targetTemperature: 4, // Celsius
          coolantType: "R-134a"
        })
      },
      {
        name: "Main Freezer",
        type: "Refrigeration",
        model: "FZ-8000",
        manufacturer: "FrostyTech",
        installedDate: new Date("2021-11-05"),
        nominalPower: 8.2,
        nominalEfficiency: 0.78,
        maintenanceInterval: 120, // days
        lastMaintenance: sub(new Date(), { days: 30 }),
        status: "operational",
        metadata: JSON.stringify({
          area: 80, // square meters
          targetTemperature: -18, // Celsius
          coolantType: "R-404A"
        })
      },
      {
        name: "Electric Smoker",
        type: "Processing",
        model: "SM-2000",
        manufacturer: "SmokeWorks",
        installedDate: new Date("2023-01-10"),
        nominalPower: 4.8,
        nominalEfficiency: 0.92,
        maintenanceInterval: 60, // days
        lastMaintenance: sub(new Date(), { days: 15 }),
        status: "operational",
        metadata: JSON.stringify({
          capacity: 200, // kg
          maxTemperature: 250, // Celsius
          powerPhase: "three-phase"
        })
      },
      {
        name: "Solar Panel Array",
        type: "Power Generation",
        model: "SP-350W-60",
        manufacturer: "SolarEdge",
        installedDate: new Date("2022-05-20"),
        nominalPower: 35, // 35kW array
        nominalEfficiency: 0.215, // 21.5% panel efficiency
        maintenanceInterval: 180, // days
        lastMaintenance: sub(new Date(), { days: 60 }),
        status: "operational",
        metadata: JSON.stringify({
          panels: 100,
          orientation: "south",
          angle: 30, // degrees
          inverterType: "SolarEdge SE30K"
        })
      },
      {
        name: "HVAC System",
        type: "HVAC",
        model: "HVAC-Pro-5000",
        manufacturer: "AirComfort Solutions",
        installedDate: new Date("2022-02-10"),
        nominalPower: 8.5,
        nominalEfficiency: 0.88,
        maintenanceInterval: 90, // days
        lastMaintenance: sub(new Date(), { days: 85 }),
        status: "maintenance",
        metadata: JSON.stringify({
          zones: 4,
          coolantType: "R-410A",
          heatingCapacity: "25kW"
        })
      }
    ];
    
    // Insert equipment
    for (const item of equipmentItems) {
      const [insertedEquipment] = await db.insert(equipment).values({
        ...item,
        // Calculate nextMaintenance date based on lastMaintenance and maintenanceInterval
        nextMaintenance: item.lastMaintenance && item.maintenanceInterval 
          ? add(item.lastMaintenance, { days: item.maintenanceInterval }) 
          : undefined,
        // Calculate a realistic current efficiency that's slightly below nominal
        currentEfficiency: item.nominalEfficiency ? 
          item.nominalEfficiency * (0.9 + Math.random() * 0.05) : undefined
      }).returning();
      
      if (insertedEquipment) {
        // Generate efficiency records for each equipment
        const now = new Date();
        const startDate = sub(now, { days: 14 });
        const efficiencyRecords = [];
        
        // Generate data for the past two weeks with 6-hour intervals
        let recordTime = new Date(startDate);
        while (recordTime <= now) {
          // Base efficiency is the current efficiency of the equipment
          const baseEfficiency = insertedEquipment.currentEfficiency || 0.8;
          
          // Slight variations in efficiency throughout the day
          const hourEffect = (recordTime.getHours() % 12) / 50; // Slight boost in midday
          
          // Random daily variations plus gradual decline
          const daysPassed = Math.floor((recordTime.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
          const randomVariation = (Math.random() * 0.04) - 0.02;
          const gradualDecline = 0.001 * daysPassed; // Slight efficiency decline over time
          
          // Calculate efficiency for this time point
          const efficiencyRating = baseEfficiency + hourEffect - gradualDecline + randomVariation;
          
          // Power usage varies based on time of day and type
          const hourOfDay = recordTime.getHours();
          const isDaytime = hourOfDay >= 8 && hourOfDay <= 20;
          
          // Base power usage on equipment type
          let basePower = 0;
          if (insertedEquipment.type === "Refrigeration") {
            // Refrigeration uses more power during daytime/warm periods
            basePower = isDaytime ? 
              insertedEquipment.nominalPower || 10 : 
              (insertedEquipment.nominalPower || 10) * 0.85;
          } else if (insertedEquipment.type === "Processing") {
            // Processing equipment primarily used during working hours
            basePower = isDaytime ? 
              insertedEquipment.nominalPower || 5 : 
              (insertedEquipment.nominalPower || 5) * 0.1;
          } else if (insertedEquipment.type === "Power Generation") {
            // Solar generation peaks midday
            const hour = recordTime.getHours();
            const solarPeak = hour >= 10 && hour <= 16;
            const nighttime = hour < 6 || hour > 20;
            
            basePower = nighttime ? 0 : 
              solarPeak ? (insertedEquipment.nominalPower || 35) * 0.9 : 
              (insertedEquipment.nominalPower || 35) * 0.5;
          } else {
            // Default for other equipment types
            basePower = insertedEquipment.nominalPower || 5;
          }
          
          // Add some random variation to power usage
          const powerVariation = (Math.random() * 0.2) - 0.1; // ±10% variation
          const powerUsage = basePower * (1 + powerVariation);
          
          // Detect anomalies - occasionally add an anomaly for demonstration
          const hasAnomaly = Math.random() > 0.95; // 5% chance of anomaly
          const anomalyScore = hasAnomaly ? 60 + Math.random() * 40 : 0; // Score from 60-100 if anomaly
          
          efficiencyRecords.push({
            equipmentId: insertedEquipment.id,
            timestamp: new Date(recordTime),
            powerUsage,
            efficiencyRating,
            temperatureConditions: 20 + (Math.random() * 5),
            productionVolume: insertedEquipment.type === "Processing" ? Math.floor(Math.random() * 1000) : null,
            anomalyDetected: hasAnomaly,
            anomalyScore: hasAnomaly ? anomalyScore : null,
            notes: hasAnomaly ? "Potential efficiency issue detected" : null
          });
          
          // Move to next 6-hour interval
          recordTime = add(recordTime, { hours: 6 });
        }
        
        // Insert all efficiency records for this equipment
        if (efficiencyRecords.length > 0) {
          await db.insert(equipmentEfficiency).values(efficiencyRecords);
        }
        
        // Add maintenance logs for this equipment
        const maintenanceLogs = [];
        
        // Add a past maintenance record
        if (insertedEquipment.lastMaintenance) {
          const efficiencyBefore = (insertedEquipment.currentEfficiency || 0.8) * 0.92;
          const efficiencyAfter = insertedEquipment.currentEfficiency;
          
          maintenanceLogs.push({
            equipmentId: insertedEquipment.id,
            timestamp: insertedEquipment.lastMaintenance,
            maintenanceType: "routine",
            description: `Regular maintenance of ${insertedEquipment.name}`,
            technician: "Alex Technician",
            cost: 250 + (Math.random() * 200),
            partsReplaced: "Filters, lubricant",
            efficiencyBefore,
            efficiencyAfter,
            nextScheduledDate: insertedEquipment.nextMaintenance
          });
        }
        
        // Add an older maintenance record
        const olderMaintenanceDate = sub(insertedEquipment.lastMaintenance || new Date(), { days: 120 });
        maintenanceLogs.push({
          equipmentId: insertedEquipment.id,
          timestamp: olderMaintenanceDate,
          maintenanceType: "repair",
          description: `Emergency repair on ${insertedEquipment.name}`,
          technician: "Jamie Repair",
          cost: 450 + (Math.random() * 300),
          partsReplaced: "Controller board, sensors",
          efficiencyBefore: 0.65,
          efficiencyAfter: 0.82,
          nextScheduledDate: insertedEquipment.lastMaintenance
        });
        
        // Insert maintenance logs
        if (maintenanceLogs.length > 0) {
          await db.insert(maintenanceLog).values(maintenanceLogs);
        }
      }
    }
    
    console.log('Equipment data and related records created successfully');
  } else {
    console.log('Equipment data already exists, skipping creation');
  }
}

// Run migration
migrateAll()
  .then(() => {
    console.log('Database setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });