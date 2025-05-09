import { db } from "./db";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * This script migrates the database to add the agent notifications table
 */
export async function migrate() {
  console.log("Starting agent notifications database migration...");
  
  try {
    // Create the agent notifications table
    await createNotificationsTable();
    console.log("Successfully created agent notifications table");
    
    console.log("Agent notifications database migration completed successfully");
  } catch (error) {
    console.error("Error during agent notifications database migration:", error);
    throw error;
  }
}

/**
 * Create the agent notifications table
 */
async function createNotificationsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "agent_notifications" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER NOT NULL,
      "title" VARCHAR(200) NOT NULL,
      "message" TEXT NOT NULL,
      "type" VARCHAR(50) NOT NULL,
      "source" VARCHAR(50) NOT NULL,
      "read" BOOLEAN NOT NULL DEFAULT FALSE,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "read_at" TIMESTAMP,
      "data" JSONB NOT NULL DEFAULT '{}'
    );
  `);
  
  // Create index for faster notification queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "agent_notifications_user_id_idx" ON "agent_notifications" ("user_id");
  `);
  
  // Create index for unread notifications
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "agent_notifications_unread_idx" ON "agent_notifications" ("user_id", "read") 
    WHERE "read" = FALSE;
  `);
}

// Run the migration if this script is executed directly
// Using ES Module syntax instead of CommonJS
migrate()
  .then(() => {
    console.log("Migration completed successfully");
    // No need to call process.exit in ESM
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });