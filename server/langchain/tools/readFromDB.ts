import { Tool } from "@langchain/core/tools";
import { z } from "zod";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";

/**
 * Tool for reading from the database using parameterized queries
 * to prevent SQL injection.
 */
export class ReadFromDBTool extends Tool {
  name = "ReadFromDB";
  description = "Execute database queries to retrieve information. For listing all tables, use 'list tables' as the input. For specific queries, use the format 'QUERY: SELECT * FROM table_name'.";
  
  // Store the available tables
  private availableTables: string[] = [];
  
  constructor() {
    super();
    
    // Set tool properties in constructor to ensure they're properly used by LangChain
    this.name = "ReadFromDB";
    this.description = "Execute database queries to retrieve information. For listing all tables, use 'list tables' as the input. For specific queries, use the format 'QUERY: SELECT * FROM table_name'.";
    
    // Initialize the list of available tables
    this.initAvailableTables();
    
    console.log(`ReadFromDBTool initialized with ${this.availableTables.length} available tables`);
  }
  
  /**
   * Initialize the list of available tables for querying
   */
  private async initAvailableTables() {
    try {
      // Get tables directly from the database
      const result = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      this.availableTables = result.rows.map((row: any) => row.table_name);
      
      // Fallback in case the query fails
      if (!this.availableTables || this.availableTables.length === 0) {
        // List of table names that are allowed to be queried
        this.availableTables = [
          'users',
          'power_data',
          'environmental_data',
          'settings',
          'equipment',
          'equipment_efficiency',
          'maintenance_log',
          'issues',
          'issue_comments',
          'langchain_agent_conversations',
          'langchain_agent_messages',
          'langchain_agent_tasks',
          'langchain_agents', // renamed from agent_settings
          'langchain_tools', // replaced agent_functions
          'langchain_agent_notifications',
          'signal_notifications',
          'report_templates',
          'scheduled_reports',
          'mcp_tasks',
          'mcp_tools',
          'telegram_messages',
          'telegram_users',
          'telegram_settings',
          'langchain_agents',
          'langchain_agent_tools',
          'langchain_prompt_templates',
          'langchain_tools',
          'langchain_tool_executions',
          'langchain_runs'
        ];
      }
    } catch (error) {
      console.error("Error initializing available tables:", error);
      // Fallback if query fails
      this.availableTables = [
        'users',
        'power_data',
        'environmental_data',
        'settings',
        'equipment',
        'equipment_efficiency',
        'maintenance_log',
        'issues',
        'issue_comments',
        'langchain_agent_conversations',
        'langchain_agent_messages',
        'langchain_agent_tasks',
        // 'agent_settings' is now 'langchain_agents', already included below
        // 'agent_functions' is now 'langchain_tools', already included below
        'langchain_agent_notifications',
        'signal_notifications',
        'langchain_agents',
        'langchain_agent_tools',
        'langchain_prompt_templates',
        'langchain_tools'
      ];
    }
  }
  
  /**
   * Get the list of available tables
   */
  getAvailableTables(): string[] {
    return this.availableTables;
  }
  
  /**
   * Get schema information for the specified table
   * @param tableName The name of the table to get schema for
   */
  async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.availableTables.includes(tableName)) {
      throw new Error(`Table '${tableName}' is not available for querying`);
    }
    
    try {
      // Query the PostgreSQL information schema to get column information
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `);
      
      return columns.rows;
    } catch (error) {
      console.error(`Error fetching schema for table '${tableName}':`, error);
      throw new Error(`Failed to retrieve schema for table '${tableName}'`);
    }
  }
  
  /**
   * Define the schema for the tool's input
   * Using the format expected by LangChain.js for OpenAI functions tools
   */
  schema = z.object({
    input: z.string().optional().describe("SQL query to execute. Format: 'QUERY: select * from table WHERE column = ?; PARAMS: [\"value\"]'")
  }).transform(input => {
    if (typeof input === 'object' && input !== null && 'input' in input) {
      return input.input || '';
    }
    return input as string || '';
  });
  
  // Property overrides defined in constructor
  
  /**
   * Safe validation for allowed table operations
   * @param query The SQL query to validate
   */
  private validateQuery(query: string): boolean {
    // Convert to lowercase for case-insensitive checks
    const queryLower = query.toLowerCase();
    
    // Check if query contains any disallowed operations
    if (
      queryLower.includes("drop ") ||
      queryLower.includes("truncate ") ||
      queryLower.includes("alter ") ||
      queryLower.includes("create ") ||
      queryLower.includes("insert ") ||
      queryLower.includes("update ") ||
      queryLower.includes("delete ")
    ) {
      return false;
    }
    
    // Ensure the query only references allowed tables
    // This is a simple check - a more thorough parser would be better
    for (const table of this.availableTables) {
      if (queryLower.includes(` ${table}`) || 
          queryLower.includes(`from ${table}`) || 
          queryLower.includes(`join ${table}`)) {
        return true;
      }
    }
    
    // If no allowed table is found, reject the query
    return false;
  }
  
  /**
   * Execute the tool with the specified input
   * @param input String in format 'QUERY: <sql>; PARAMS: <json-params-array>' or special commands
   */
  async _call(input: string): Promise<string> {
    try {
      console.log(`ReadFromDB tool called with input: "${input}"`);
      
      // Normalize the input by trimming and converting to lowercase for comparison
      const normalizedInput = typeof input === 'string' ? input.trim().toLowerCase() : '';
      
      // Check for direct commands first - be very permissive with variations
      if (normalizedInput === "list tables" || 
          normalizedInput === "show tables" || 
          normalizedInput === "get tables" ||
          normalizedInput.includes("list all tables") ||
          normalizedInput.includes("show all tables") ||
          normalizedInput.includes("get all tables") ||
          normalizedInput.includes("list database tables") ||
          normalizedInput.includes("show database tables") ||
          normalizedInput.includes("all tables") ||
          normalizedInput.includes("tables in database") ||
          normalizedInput.includes("database tables")) {
        
        console.log("Tool received 'list tables' command: " + input);
        
        // Direct command to list tables
        const result = await db.execute(sql`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          ORDER BY table_name;
        `);
        
        // Format the response for better readability
        const tables = result.rows.map((row: any) => row.table_name);
        const tableList = tables.join('\n- ');
        
        return JSON.stringify({
          message: "Here are all the tables in the database:",
          rowCount: result.rowCount,
          tables: tables,
          formattedResult: `Database Tables (${tables.length}):\n- ${tableList}`
        });
      }
      
      // Parse the input string to extract query and params
      let query = '';
      let params: any[] = [];

      // Support both object input (from direct API calls) and string input (from LangChain)
      if (typeof input === 'object' && input !== null && 'query' in input) {
        // Direct API call with object format
        query = (input as any).query;
        params = (input as any).params || [];
      } else if (typeof input === 'string') {
        // Parse from LangChain format "QUERY: select...; PARAMS: [...]"
        const queryMatch = input.match(/QUERY:\s*(.*?)(?:;|\s*PARAMS:|$)/);
        const paramsMatch = input.match(/PARAMS:\s*(\[.*\])/);
        
        
        if (queryMatch && queryMatch[1]) {
          query = queryMatch[1].trim();
        } else {
          // If no QUERY tag found, assume the entire input is the query
          query = input;
        }
        
        if (paramsMatch && paramsMatch[1]) {
          try {
            params = JSON.parse(paramsMatch[1]);
          } catch (e) {
            console.error("Error parsing params JSON:", e);
            // If parsing fails, use empty params
            params = [];
          }
        }
      }
      
      // Validate the query for safety
      if (!this.validateQuery(query)) {
        return JSON.stringify({
          error: "Query validation failed. Only SELECT queries on allowed tables are permitted.",
          availableTables: this.availableTables
        });
      }
      
      console.log(`Executing database query: ${query} with params:`, params);
      
      // Execute the query - use simple execution to avoid LSP issues
      let result;
      if (params.length > 0) {
        // For parameterized queries
        result = await db.execute(sql.raw(query));
      } else {
        // For simple queries
        result = await db.execute(sql.raw(query));
      }
      
      // Return the result as JSON
      return JSON.stringify({
        rowCount: result.rowCount,
        rows: result.rows
      });
    } catch (error) {
      console.error("Error executing database query:", error);
      return JSON.stringify({
        error: `Database query error: ${error instanceof Error ? error.message : String(error)}`,
        query: typeof input === 'string' ? input : JSON.stringify(input)
      });
    }
  }
}