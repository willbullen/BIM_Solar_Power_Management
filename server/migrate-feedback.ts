/**
 * This script migrates the database to add feedback and issue tracking functionality
 */
import { db, pool } from "./db";
import { issues, issueComments, todoItems } from "@shared/schema";
import { sql } from "drizzle-orm";
import { log } from "./vite";
import { parseMarkdownTasks } from "./utils";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main migration function
 */
async function migrate() {
  try {
    log("Starting feedback and issue tracking migration", "migrate");
    
    // Create new tables
    await createFeedbackTables();
    
    // Import tasks from todo.md
    await importTodoItems();
    
    log("Feedback and issue tracking migration completed successfully", "migrate");
  } catch (error) {
    log(`Migration failed: ${error}`, "migrate");
    console.error(error);
  } finally {
    await pool.end();
  }
}

/**
 * Create all the feedback and issue related tables
 */
async function createFeedbackTables() {
  log("Creating feedback and issue tables", "migrate");
  
  // Create issues table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      submitter_id INTEGER NOT NULL REFERENCES users(id),
      assignee_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMP,
      milestone TEXT,
      labels TEXT[],
      linked_task_id INTEGER REFERENCES issues(id)
    );
  `);
  
  // Create issue comments table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS issue_comments (
      id SERIAL PRIMARY KEY,
      issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      is_edited BOOLEAN DEFAULT FALSE
    );
  `);
  
  // Create todo items table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS todo_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      category TEXT NOT NULL DEFAULT 'general',
      stage INTEGER NOT NULL DEFAULT 1,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      assignee_id INTEGER REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'medium',
      linked_issue_id INTEGER REFERENCES issues(id)
    );
  `);
  
  log("Feedback and issue tables created successfully", "migrate");
}

/**
 * Import items from todo.md into the todoItems table
 */
async function importTodoItems() {
  log("Importing todo items from todo.md", "migrate");
  
  try {
    // Read todo.md file
    const todoPath = path.join(process.cwd(), 'todo.md');
    const todoContent = fs.readFileSync(todoPath, 'utf8');
    
    // Get admin user for assigning tasks
    const [adminUser] = await db.execute(sql`SELECT id FROM users WHERE role = 'Admin' LIMIT 1`);
    const adminId = adminUser ? adminUser.id : 1; // Default to ID 1 if no admin found
    
    // Parse todo.md content and extract tasks
    const tasks = parseMarkdownTasks(todoContent);
    
    // Insert tasks into todoItems table
    if (tasks.length > 0) {
      log(`Found ${tasks.length} tasks to import`, "migrate");
      
      for (const task of tasks) {
        await db.insert(todoItems).values({
          title: task.title,
          description: task.description || null,
          status: task.completed ? 'completed' : 'pending',
          category: task.category,
          stage: task.stage,
          completedAt: task.completed ? new Date() : null,
          assigneeId: adminId,
          priority: task.priority || 'medium',
        });
      }
      
      log(`Successfully imported ${tasks.length} todo items`, "migrate");
    } else {
      log("No tasks found to import", "migrate");
    }
  } catch (error) {
    log(`Error importing todo items: ${error}`, "migrate");
    console.error(error);
  }
}

// Run the migration
migrate();