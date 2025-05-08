import fs from 'fs';
import path from 'path';
import { db } from './db';
import { issues } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * This script migrates items from todo.md to the issues table
 */
async function migrateTodoToIssues() {
  console.log('Migrating todo.md tasks to issues...');
  
  try {
    // Read the todo.md file
    const todoPath = path.join(process.cwd(), 'todo.md');
    const todoContent = fs.readFileSync(todoPath, 'utf8');
    
    // Clear existing issues first
    console.log('Clearing existing issues...');
    await db.delete(issues);
    
    // Parse the todo.md file
    const todoItems = parseTodoMd(todoContent);
    
    // Insert the new issues
    console.log(`Inserting ${todoItems.length} issues from todo.md...`);
    
    let insertCount = 0;
    for (const item of todoItems) {
      await db.insert(issues).values({
        title: item.title,
        description: item.description,
        type: determineType(item),
        status: determineStatus(item),
        priority: determinePriority(item),
        submitterId: 1, // Default submitter
        createdAt: new Date(),
        updatedAt: new Date()
      });
      insertCount++;
    }
    
    console.log(`Successfully migrated ${insertCount} issues from todo.md`);
  } catch (error) {
    console.error('Error migrating todo items to issues:', error);
  }
}

/**
 * Parse the todo.md file and extract tasks
 */
function parseTodoMd(content: string): Array<{ title: string, description: string, completed: boolean, stage: number }> {
  const todoItems: Array<{ title: string, description: string, completed: boolean, stage: number }> = [];
  
  // Regular expression to match checkbox items
  const checkboxRegex = /^(\s*)- \[([ x])\] (.+)$/;
  
  // Split the content into lines
  const lines = content.split('\n');
  
  let currentStage = 0;
  
  // Process the lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a stage heading
    if (line.trim().startsWith('### Stage')) {
      const stageMatch = line.trim().match(/### Stage (\d+):/);
      currentStage = stageMatch ? parseInt(stageMatch[1]) : 0;
      continue;
    }
    
    // Check if this is a task item using regex to handle any level of indentation
    const checkboxMatch = line.match(checkboxRegex);
    if (checkboxMatch) {
      const indentation = checkboxMatch[1].length; // Amount of whitespace before the checkbox
      const completed = checkboxMatch[2] === 'x';
      let title = checkboxMatch[3].trim();
      
      // Get description from related content
      let description = '';
      
      // If the title has a colon, split it to create a better title/description
      if (title.includes(':')) {
        const parts = title.split(':');
        title = parts[0].trim();
        description = parts.slice(1).join(':').trim();
      }
      
      // Look for additional description in subsequent lines with greater indentation
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        
        // Empty line - skip it
        if (!nextLine.trim()) {
          j++;
          continue;
        }
        
        // Check if this is a description line (more indented than the task)
        const nextIndentation = nextLine.search(/\S|$/);
        
        // If this is an indented line with content (not a checkbox)
        if (nextIndentation > indentation && !nextLine.trim().startsWith('- [')) {
          // Add this line to the description
          description += (description ? '\n' : '') + nextLine.trim();
          j++;
        } else {
          // If we hit a line with same or less indentation, or another checkbox
          // with the same indentation, we've reached the end of this item's description
          break;
        }
      }
      
      // Add the item
      todoItems.push({
        title,
        description,
        completed,
        stage: currentStage
      });
      
      // Don't skip any lines as we want to process each line independently
    }
  }
  
  return todoItems;
}

/**
 * Determine the type of the issue based on the task
 */
function determineType(item: { title: string, description: string }): string {
  const title = item.title.toLowerCase();
  
  if (title.includes('implement') || title.includes('add')) {
    return 'feature';
  } else if (title.includes('enhance') || title.includes('improve') || title.includes('update')) {
    return 'enhancement';
  } else if (title.includes('fix') || title.includes('bug') || title.includes('error')) {
    return 'bug';
  } else {
    return 'feature'; // Default to feature
  }
}

/**
 * Determine the status of the issue based on the task completion
 */
function determineStatus(item: { completed: boolean }): string {
  return item.completed ? 'completed' : 'open';
}

/**
 * Determine the priority of the issue based on the stage and other factors
 */
function determinePriority(item: { title: string, stage: number }): string {
  const title = item.title.toLowerCase();
  
  // Higher priority for earlier stages
  if (item.stage <= 2) {
    return 'high';
  } else if (item.stage <= 4) {
    return 'medium';
  } else {
    return 'low';
  }
}

// Execute the migration
migrateTodoToIssues()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });