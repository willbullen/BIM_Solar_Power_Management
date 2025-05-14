import { db } from '../db';
import { 
  equipment, 
  equipmentEfficiency, 
  maintenanceLog 
} from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Creating equipment tables...');
  
  // Create equipment table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS equipment (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
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
      status TEXT NOT NULL,
      metadata JSONB
    )
  `);
  
  // Create equipment_efficiency table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS equipment_efficiency (
      id SERIAL PRIMARY KEY,
      equipment_id INTEGER NOT NULL,
      timestamp TIMESTAMP NOT NULL,
      power_usage DOUBLE PRECISION NOT NULL,
      efficiency_rating DOUBLE PRECISION,
      temperature_conditions DOUBLE PRECISION,
      production_volume INTEGER,
      anomaly_detected BOOLEAN,
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
      timestamp TIMESTAMP NOT NULL,
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
  
  console.log('Equipment tables created successfully!');
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });