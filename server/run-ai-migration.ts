/**
 * This script runs the AI agent migration to set up all required database tables
 * and initial data for the AI agent architect functionality.
 */

import { migrate as migrateAIAgent } from "./migrations/migrate-ai-agent";

async function runMigration() {
  try {
    console.log("Starting AI Agent migration...");
    await migrateAIAgent();
    console.log("AI Agent migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();