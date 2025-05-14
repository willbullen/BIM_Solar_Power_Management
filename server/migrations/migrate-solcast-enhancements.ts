import { db } from '../db';
import { environmentalData, settings } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * This script migrates the database to add enhanced Solcast integration fields
 */
async function migrate() {
  console.log('Starting migration: Enhanced Solcast Integration...');
  
  try {
    // Add new columns to settings table
    console.log('Adding new columns to settings table...');
    await db.execute(sql`
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS solcast_forecast_horizon INTEGER DEFAULT 168,
      ADD COLUMN IF NOT EXISTS solcast_refresh_rate INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS solcast_panel_capacity REAL DEFAULT 25,
      ADD COLUMN IF NOT EXISTS solcast_panel_tilt REAL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS solcast_panel_azimuth REAL DEFAULT 180,
      ADD COLUMN IF NOT EXISTS solcast_show_probabilistic BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS enable_pv_performance_monitoring BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS pv_performance_threshold REAL DEFAULT 15;
    `);
    
    // Add new columns to environmental_data table
    console.log('Adding new columns to environmental_data table...');
    await db.execute(sql`
      ALTER TABLE environmental_data
      ADD COLUMN IF NOT EXISTS dhi REAL,
      ADD COLUMN IF NOT EXISTS wind_direction REAL,
      ADD COLUMN IF NOT EXISTS cloud_opacity REAL,
      ADD COLUMN IF NOT EXISTS forecast_p10 REAL,
      ADD COLUMN IF NOT EXISTS forecast_p90 REAL,
      ADD COLUMN IF NOT EXISTS data_source TEXT,
      ADD COLUMN IF NOT EXISTS forecast_horizon INTEGER;
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration
migrate()
  .then(() => {
    console.log('Solcast enhancements migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Solcast enhancements migration failed:', error);
    process.exit(1);
  });