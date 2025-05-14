/**
 * Database query and analysis functions for the AI agent
 * 
 * This file contains functions that allow the AI agent to query
 * and analyze data from the database.
 */

import { db } from '../db';
import { UnifiedFunctionRegistry } from './unified-function-registry';
import { count, desc, eq, sql, and } from 'drizzle-orm';
import * as schema from '@shared/schema';

/**
 * Register all database-related functions for the AI agent
 */
export async function registerDatabaseFunctions() {
  // Register ReadFromDB function - to handle the Telegram bot using this function name
  await UnifiedFunctionRegistry.registerFunction({
    name: 'ReadFromDB',
    description: 'Execute database queries to retrieve information, including listing tables',
    module: 'database',
    returnType: 'object',
    accessLevel: 'User',
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: "Text command or SQL query. Use 'list tables' to show all tables."
        }
      },
      required: ['input']
    },
    functionCode: `
      try {
        // Check for special commands like list tables
        if (typeof params.input === 'string') {
          const inputLower = params.input.toLowerCase().trim();
          
          if (inputLower === 'list tables' || 
              inputLower === 'show tables' || 
              inputLower.includes('list all tables') ||
              inputLower.includes('all tables')) {
                
            console.log("ReadFromDB: Processing 'list tables' command");
            
            // Use the listAllTables function for this request
            return await UnifiedFunctionRegistry.executeFunction(
              'listAllTables', 
              { includeSystemTables: false },
              context
            );
          }
        }
        
        // For any other SQL queries, you can implement them here
        // This is just a basic implementation to handle the list tables command
        return {
          error: "Only 'list tables' command is supported currently. For complex queries, please use explicit SQL.",
          message: "Please use 'list tables' to see available tables."
        };
      } catch (error) {
        console.error("ReadFromDB function error:", error);
        return { error: String(error) };
      }
    `
  });

  // Register listAllTables function
  await UnifiedFunctionRegistry.registerFunction({
    name: 'listAllTables',
    description: 'List all tables in the database',
    toolType: 'database',
    implementation: 'ListAllTablesTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User'
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        includeSystemTables: {
          type: 'boolean',
          description: 'Whether to include system tables (default: false)'
        }
      }
    },
    functionCode: `
      try {
        // Check if the input is a shortcut command like "list tables"
        if (typeof params === 'string' && (params.toLowerCase() === 'list tables' || params.toLowerCase() === 'show tables')) {
          // Shortcut command detected
          const tableNames = [];
          
          // Get table names from schema
          for (const key in schema) {
            if (typeof schema[key] === 'object' && schema[key]?.name) {
              tableNames.push(schema[key].name);
            }
          }
          
          // Filter system tables
          const userTables = tableNames.filter(name => 
            !name.startsWith('pg_') && 
            !name.startsWith('information_schema') &&
            !name.startsWith('sql_')
          );
          
          return { 
            tables: userTables,
            count: userTables.length,
            message: \`Found \${userTables.length} tables in the database\`
          };
        }
        
        // Regular execution path
        const { includeSystemTables = false } = params || {};
        
        // Get available tables from the schema
        const availableTables = Object.keys(schema)
          .filter(key => typeof schema[key] === 'object' && schema[key]?.name)
          .map(key => schema[key].name);
        
        // If includeSystemTables is false, filter out system tables
        const filteredTables = includeSystemTables 
          ? availableTables 
          : availableTables.filter(name => 
              !name.startsWith('pg_') && 
              !name.startsWith('information_schema') &&
              !name.startsWith('sql_')
            );
        
        return { 
          tables: filteredTables,
          count: filteredTables.length,
          message: \`Found \${filteredTables.length} tables in the database\`
        };
      } catch (error) {
        console.error('Error in listAllTables function:', error);
        return {
          tables: [],
          count: 0,
          error: error.message,
          message: 'Error listing tables. Please check logs for details.'
        };
      }
    `
  });
  
  // Register database query functions
  await UnifiedFunctionRegistry.registerFunction({
    name: 'queryTable',
    description: 'Query data from a database table with optional filters and sorting',
    toolType: 'database',
    implementation: 'QueryTableTool',
    metadata: {
      returnType: 'array',
      accessLevel: 'User'
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to query'
        },
        filters: {
          type: 'object',
          description: 'Optional filter conditions as key-value pairs',
          additionalProperties: true
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        orderBy: {
          type: 'string',
          description: 'Column to sort results by'
        },
        orderDirection: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort direction (asc or desc)'
        }
      },
      required: ['tableName']
    },
    functionCode: async function(params, context) {
      const { tableName, filters = {}, limit = 100, orderBy, orderDirection = 'desc' } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(`Table '${tableName}' does not exist or is not accessible`);
      }
      
      // Get the table object
      const table = schema[tableName];
      
      // Create where conditions
      const whereConditions = [];
      for (const [key, value] of Object.entries(filters)) {
        if (table[key]) {
          whereConditions.push(eq(table[key], value));
        }
      }
      
      // Prepare query
      let query = db.select().from(table);
      
      // Add where conditions if any
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          query = query.where(whereConditions[0]);
        } else {
          query = query.where(and(...whereConditions));
        }
      }
      
      // Add order by if specified
      if (orderBy && table[orderBy]) {
        query = query.orderBy(
          orderDirection === 'desc' ? desc(table[orderBy]) : table[orderBy]
        );
      }
      
      // Add limit
      query = query.limit(limit);
      
      // Execute query
      const results = await query;
      return results;
    }
  });
  
  // Register count function
  await UnifiedFunctionRegistry.registerFunction({
    name: 'countRecords',
    description: 'Count records in a database table with optional filters',
    toolType: 'database',
    implementation: 'CountRecordsTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User'
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to count records from'
        },
        filters: {
          type: 'object',
          description: 'Optional filter conditions as key-value pairs',
          additionalProperties: true
        }
      },
      required: ['tableName']
    },
    functionCode: async function(params, context) {
      const { tableName, filters = {} } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(`Table '${tableName}' does not exist or is not accessible`);
      }
      
      // Get the table object
      const table = schema[tableName];
      
      // Create where conditions
      const whereConditions = [];
      for (const [key, value] of Object.entries(filters)) {
        if (table[key]) {
          whereConditions.push(eq(table[key], value));
        }
      }
      
      // Prepare query
      let query = db.select({ count: count() }).from(table);
      
      // Add where conditions if any
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          query = query.where(whereConditions[0]);
        } else {
          query = query.where(and(...whereConditions));
        }
      }
      
      // Execute query
      const result = await query;
      return { count: result[0]?.count || 0 };
    }
  });
  
  // Register database schema info function
  await UnifiedFunctionRegistry.registerFunction({
    name: 'getDatabaseSchemaInfo',
    description: 'Get information about the database schema including tables and their columns',
    toolType: 'database',
    implementation: 'DatabaseSchemaInfoTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User'
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Optional table name to get specific table schema info'
        }
      }
    },
    functionCode: async function(params, context) {
      const { tableName } = params;
      
      // Get available tables
      const availableTables = Object.keys(schema)
        .filter(key => typeof schema[key] === 'object' && schema[key]?.name)
        .map(key => ({
          name: schema[key].name,
          columns: Object.keys(schema[key])
            .filter(col => col !== 'name' && typeof schema[key][col] === 'object')
            .map(col => ({
              name: col,
              type: schema[key][col].dataType || 'unknown'
            }))
        }));
      
      if (tableName) {
        const tableInfo = availableTables.find(t => t.name === tableName);
        if (!tableInfo) {
          throw new Error(`Table '${tableName}' does not exist or is not accessible`);
        }
        return tableInfo;
      }
      
      return { tables: availableTables };
    }
  });
  
  // Register data aggregation function
  await FunctionRegistry.registerFunction({
    name: 'aggregateData',
    description: 'Perform aggregation operations on table data (sum, avg, min, max, count)',
    module: 'database',
    returnType: 'object',
    accessLevel: 'User',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to aggregate data from'
        },
        aggregateColumn: {
          type: 'string',
          description: 'Column to aggregate'
        },
        operation: {
          type: 'string',
          enum: ['sum', 'avg', 'min', 'max', 'count'],
          description: 'Aggregation operation to perform'
        },
        groupByColumn: {
          type: 'string',
          description: 'Optional column to group results by'
        },
        filters: {
          type: 'object',
          description: 'Optional filter conditions as key-value pairs',
          additionalProperties: true
        }
      },
      required: ['tableName', 'aggregateColumn', 'operation']
    },
    functionCode: async function(params, context) {
      const { tableName, aggregateColumn, operation, groupByColumn, filters = {} } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(`Table '${tableName}' does not exist or is not accessible`);
      }
      
      // Get the table object
      const table = schema[tableName];
      
      // Verify columns exist
      if (!table[aggregateColumn]) {
        throw new Error(`Column '${aggregateColumn}' does not exist in table '${tableName}'`);
      }
      
      if (groupByColumn && !table[groupByColumn]) {
        throw new Error(`Column '${groupByColumn}' does not exist in table '${tableName}'`);
      }
      
      // Create where conditions
      const whereConditions = [];
      for (const [key, value] of Object.entries(filters)) {
        if (table[key]) {
          whereConditions.push(eq(table[key], value));
        }
      }
      
      // Create aggregate function
      let aggregateFunc;
      switch (operation) {
        case 'sum':
          aggregateFunc = sql`SUM(${table[aggregateColumn]})`;
          break;
        case 'avg':
          aggregateFunc = sql`AVG(${table[aggregateColumn]})`;
          break;
        case 'min':
          aggregateFunc = sql`MIN(${table[aggregateColumn]})`;
          break;
        case 'max':
          aggregateFunc = sql`MAX(${table[aggregateColumn]})`;
          break;
        case 'count':
          aggregateFunc = sql`COUNT(${table[aggregateColumn]})`;
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      // Prepare query
      let query;
      
      if (groupByColumn) {
        query = db.select({
          groupValue: table[groupByColumn],
          result: aggregateFunc
        }).from(table);
      } else {
        query = db.select({
          result: aggregateFunc
        }).from(table);
      }
      
      // Add where conditions if any
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          query = query.where(whereConditions[0]);
        } else {
          query = query.where(and(...whereConditions));
        }
      }
      
      // Add group by if specified
      if (groupByColumn) {
        query = query.groupBy(table[groupByColumn]);
      }
      
      // Execute query
      const results = await query;
      
      return results;
    }
  });
  
  console.log('Database query and analysis functions registered successfully');
}