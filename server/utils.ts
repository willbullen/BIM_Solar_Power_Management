/**
 * Utility functions for the server
 */

/**
 * Helper function to parse tasks from a markdown string
 */
export function parseMarkdownTasks(markdown: string): Array<{
  title: string;
  description?: string;
  completed: boolean;
  category: string;
  stage: number;
  priority?: string;
}> {
  const tasks: Array<{
    title: string;
    description?: string;
    completed: boolean;
    category: string;
    stage: number;
    priority?: string;
  }> = [];
  
  const lines = markdown.split('\n');
  let currentStage = 1;
  let currentCategory = 'general';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for stage headers (e.g., "Stage a: Something")
    if (line.startsWith('### Stage')) {
      const stageMatch = line.match(/### Stage (\d+)/);
      if (stageMatch && stageMatch[1]) {
        currentStage = parseInt(stageMatch[1], 10);
        // Get category from the rest of the line
        const categoryParts = line.split(':');
        if (categoryParts.length > 1) {
          currentCategory = categoryParts[1].trim().toLowerCase();
        } else {
          currentCategory = 'general';
        }
      }
      continue;
    }
    
    // Check for tasks with checkbox format (GitHub style)
    const checkboxMatch = line.match(/- \[(x| )\] (.*)/);
    if (checkboxMatch) {
      const completed = checkboxMatch[1] === 'x';
      const title = checkboxMatch[2].trim();
      
      // Check if the next line might be a description (indented)
      let description = '';
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('  ')) {
        description = lines[i + 1].trim();
        i++; // Skip the description line in the next iteration
      }
      
      // Determine priority based on keywords
      let priority = 'medium';
      if (title.toLowerCase().includes('critical') || title.toLowerCase().includes('urgent')) {
        priority = 'high';
      } else if (title.toLowerCase().includes('minor') || title.toLowerCase().includes('low')) {
        priority = 'low';
      }
      
      tasks.push({
        title,
        description: description || undefined,
        completed,
        category: currentCategory,
        stage: currentStage,
        priority,
      });
      continue;
    }
    
    // Also check for regular tasks with [x] or [ ] format
    const taskMatch = line.match(/- \[([xX ])\] (.*)/);
    if (taskMatch) {
      const completed = taskMatch[1].toLowerCase() === 'x';
      const title = taskMatch[2].trim();
      
      // Check if the next line might be a description (indented)
      let description = '';
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('  ')) {
        description = lines[i + 1].trim();
        i++; // Skip the description line in the next iteration
      }
      
      // Determine priority based on keywords
      let priority = 'medium';
      if (title.toLowerCase().includes('critical') || title.toLowerCase().includes('urgent')) {
        priority = 'high';
      } else if (title.toLowerCase().includes('minor') || title.toLowerCase().includes('low')) {
        priority = 'low';
      }
      
      tasks.push({
        title,
        description: description || undefined,
        completed,
        category: currentCategory,
        stage: currentStage,
        priority,
      });
    }
  }
  
  return tasks;
}