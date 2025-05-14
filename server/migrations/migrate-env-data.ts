import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * This script migrates the environmental_data table to:
 * 1. Add air_temp, ghi, and dni columns
 * 2. Populate them from existing temperature and sun_intensity data
 */
async function migrateEnvironmentalData() {
  console.log('Starting migration of environmental_data table...');
  
  try {
    // First, let's create a new table with the updated schema
    console.log('Creating new table with updated schema...');
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS environmental_data_new (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        weather TEXT NOT NULL,
        air_temp DOUBLE PRECISION NOT NULL,
        ghi DOUBLE PRECISION,
        dni DOUBLE PRECISION,
        humidity DOUBLE PRECISION,
        wind_speed DOUBLE PRECISION
      )
    `);
    
    // Copy data from old table to new table, transforming as needed
    console.log('Copying data from old table to new table...');
    await db.execute(sql`
      INSERT INTO environmental_data_new (
        id, timestamp, weather, air_temp, ghi, dni, humidity, wind_speed
      )
      SELECT 
        id, 
        timestamp, 
        weather, 
        temperature AS air_temp,
        sun_intensity * 10 AS ghi,  -- rough estimation: ghi in W/m² is approximately sun_intensity * 10
        sun_intensity * 12 AS dni,  -- rough estimation: dni is typically higher than ghi
        humidity,
        wind_speed
      FROM 
        environmental_data
    `);
    
    // Get sequence info to preserve proper ID sequencing
    const seqResult = await db.execute(sql`
      SELECT last_value FROM environmental_data_id_seq
    `);
    const lastValue = seqResult.rows[0]?.last_value || 1;
    
    // Drop old table
    console.log('Dropping old table...');
    await db.execute(sql`DROP TABLE environmental_data`);
    
    // Rename new table to original name
    console.log('Renaming new table to original name...');
    await db.execute(sql`ALTER TABLE environmental_data_new RENAME TO environmental_data`);
    
    // Reset sequence
    console.log('Resetting ID sequence...');
    const nextId = lastValue + 1;
    await db.execute(sql`
      ALTER SEQUENCE environmental_data_id_seq RESTART WITH ${nextId}
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

migrateEnvironmentalData()
  .then(() => {
    console.log('Environmental data migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });