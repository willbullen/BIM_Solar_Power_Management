import { db } from './db';
import { settings } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * This script migrates the database to add Solcast API settings
 */
async function migrate() {
  try {
    console.log('Starting migration to add Solcast API settings...');

    // Check if the solcast_api_key column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'settings' AND column_name = 'solcast_api_key'
    `);

    // If the column doesn't exist, add all the new columns
    if (checkColumn.rows.length === 0) {
      console.log('Adding Solcast API columns to settings table...');
      
      // Add solcast_api_key column
      await db.execute(sql`
        ALTER TABLE settings 
        ADD COLUMN solcast_api_key TEXT
      `);
      
      // Add location_latitude column with default value
      await db.execute(sql`
        ALTER TABLE settings 
        ADD COLUMN location_latitude REAL DEFAULT 52.059937
      `);
      
      // Add location_longitude column with default value
      await db.execute(sql`
        ALTER TABLE settings 
        ADD COLUMN location_longitude REAL DEFAULT -9.507269
      `);
      
      // Add use_solcast_data column with default value
      await db.execute(sql`
        ALTER TABLE settings 
        ADD COLUMN use_solcast_data BOOLEAN DEFAULT FALSE
      `);
      
      console.log('Migration completed successfully!');
    } else {
      console.log('Migration already applied. Skipping...');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Execute the migration
migrate().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed with error:', error);
  process.exit(1);
});