import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * This script migrates the database to add the file attachments table
 */
export async function migrate() {
  console.log("Creating file_attachments table...");
  
  try {
    // Check if table already exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'file_attachments'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log("file_attachments table already exists, skipping creation");
      return;
    }
    
    // Create file_attachments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "file_attachments" (
        "id" SERIAL PRIMARY KEY,
        "conversation_id" INTEGER REFERENCES "agent_conversations"("id") ON DELETE CASCADE,
        "message_id" INTEGER REFERENCES "agent_messages"("id") ON DELETE CASCADE,
        "filename" TEXT NOT NULL,
        "original_filename" TEXT NOT NULL,
        "file_type" TEXT NOT NULL,
        "file_path" TEXT NOT NULL,
        "file_size" INTEGER NOT NULL,
        "is_public" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "created_by" INTEGER REFERENCES "users"("id"),
        "metadata" JSONB DEFAULT '{}'
      );
    `);
    
    console.log("file_attachments table created successfully");
    
  } catch (error) {
    console.error("Error creating file_attachments table:", error);
    throw error;
  }
}

// Run the migration directly
migrate()
  .then(() => {
    console.log("File attachments migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("File attachments migration failed:", error);
    process.exit(1);
  });