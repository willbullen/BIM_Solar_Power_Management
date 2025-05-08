/**
 * This script migrates the environmental_data table to add the forecast_p50 column
 */
import { db } from "./db";
import { sql } from "drizzle-orm";

async function migrateForecastP50() {
  console.log('Starting migration to add forecast_p50 column...');
  
  try {
    // Check if column already exists
    const columnsResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'environmental_data' AND column_name = 'forecast_p50'
    `);
    
    if (columnsResult.rows.length > 0) {
      console.log('Column forecast_p50 already exists, skipping migration');
      return;
    }
    
    // Add the forecast_p50 column
    await db.execute(sql`
      ALTER TABLE environmental_data 
      ADD COLUMN forecast_p50 real
    `);
    
    console.log('Successfully added forecast_p50 column to environmental_data table');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}

// Run the migration
migrateForecastP50()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });