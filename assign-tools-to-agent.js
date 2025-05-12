/**
 * Utility script to assign tools to agents
 * 
 * This script will help you assign tools to agents in the system
 * since the UI form for the Main Assistant Agent appears blank.
 */
import pg from 'pg';
const { Client } = pg;

async function main() {
  // Create a database client using the environment variables
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to database');
    
    // List all agents
    console.log('\nAvailable agents:');
    const agentsResult = await client.query('SELECT id, name FROM langchain_agents ORDER BY id');
    const agents = agentsResult.rows;
    agents.forEach(agent => {
      console.log(`[${agent.id}] ${agent.name}`);
    });
    
    // List all tools
    console.log('\nAvailable tools:');
    const toolsResult = await client.query('SELECT id, name, description FROM langchain_tools ORDER BY id');
    const tools = toolsResult.rows;
    tools.forEach(tool => {
      console.log(`[${tool.id}] ${tool.name} - ${tool.description || 'No description'}`);
    });
    
    // Show current tool assignments
    console.log('\nCurrent tool assignments:');
    const assignmentsResult = await client.query(`
      SELECT at.id, a.name as agent_name, t.name as tool_name, at.priority 
      FROM langchain_agent_tools at
      JOIN langchain_agents a ON at.agent_id = a.id
      JOIN langchain_tools t ON at.tool_id = t.id
      ORDER BY a.name, at.priority
    `);
    
    if (assignmentsResult.rows.length === 0) {
      console.log('No tool assignments found');
    } else {
      assignmentsResult.rows.forEach(assignment => {
        console.log(`[${assignment.id}] Agent: ${assignment.agent_name}, Tool: ${assignment.tool_name}, Priority: ${assignment.priority}`);
      });
    }
    
    // Check if we were provided command line arguments
    const [,, action, agentId, toolId, priority] = process.argv;
    
    if (action === 'assign' && agentId && toolId) {
      // Assign a tool to an agent
      const priorityValue = priority || 0;
      
      // Check if assignment already exists
      const checkResult = await client.query(
        'SELECT id FROM langchain_agent_tools WHERE agent_id = $1 AND tool_id = $2',
        [agentId, toolId]
      );
      
      if (checkResult.rows.length > 0) {
        // Update existing assignment
        const updateResult = await client.query(
          'UPDATE langchain_agent_tools SET priority = $3 WHERE agent_id = $1 AND tool_id = $2 RETURNING id',
          [agentId, toolId, priorityValue]
        );
        console.log(`\nUpdated tool assignment with ID ${updateResult.rows[0].id}`);
      } else {
        // Create new assignment
        const insertResult = await client.query(
          'INSERT INTO langchain_agent_tools (agent_id, tool_id, priority) VALUES ($1, $2, $3) RETURNING id',
          [agentId, toolId, priorityValue]
        );
        console.log(`\nCreated new tool assignment with ID ${insertResult.rows[0].id}`);
      }
    } else if (action === 'remove' && agentId && toolId) {
      // Remove a tool from an agent
      const removeResult = await client.query(
        'DELETE FROM langchain_agent_tools WHERE agent_id = $1 AND tool_id = $2',
        [agentId, toolId]
      );
      
      if (removeResult.rowCount > 0) {
        console.log(`\nRemoved tool ${toolId} from agent ${agentId}`);
      } else {
        console.log('\nNo matching assignment found to remove');
      }
    } else if (action) {
      console.log(`\nUnknown action: ${action}`);
      showUsage();
    } else {
      // Just show usage information
      showUsage();
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await client.end();
  }
}

function showUsage() {
  console.log(`
Usage:
  node assign-tools-to-agent.js                        - Show current assignments
  node assign-tools-to-agent.js assign AGENT_ID TOOL_ID [PRIORITY]  - Assign tool to agent
  node assign-tools-to-agent.js remove AGENT_ID TOOL_ID             - Remove tool from agent
  
Examples:
  node assign-tools-to-agent.js assign 1 1 0           - Assign tool 1 to agent 1 with priority 0
  node assign-tools-to-agent.js remove 1 2             - Remove tool 2 from agent 1
  `);
}

// Run the main function
main().catch(console.error);