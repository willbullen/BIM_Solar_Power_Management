/**
 * Database query and analysis functions for the AI agent
 * 
 * This file contains functions that allow the AI agent to query
 * and analyze data from the database.
 */

import { UnifiedFunctionRegistry } from './unified-function-registry';
import { schema, db } from '../../shared/schema';
import { eq, sql, asc, desc } from 'drizzle-orm';

/**
 * Register all database-related functions for the AI agent
 */
export async function registerDatabaseFunctions() {
  // Basic database query function to read data
  await UnifiedFunctionRegistry.registerFunction({
    name: 'ReadFromDB',
    description: 'Execute database queries to retrieve information, including listing tables',
    toolType: 'database',
    implementation: 'DatabaseReaderTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User',
      implementationCode: `
      try {
        // Check for special commands like list tables
        if (typeof params.input === 'string') {
          const inputLower = params.input.toLowerCase().trim();
          
          if (inputLower === 'list tables') {
            // Get all available tables from schema
            const tables = Object.keys(schema).filter(key => 
              typeof schema[key] === 'object' && schema[key]?.name);
            
            return {
              tables,
              count: tables.length
            };
          }
          
          if (inputLower.startsWith('describe table ')) {
            const tableName = inputLower.replace('describe table ', '').trim();
            
            // Check if table exists
            const availableTables = Object.keys(schema).filter(key => 
              typeof schema[key] === 'object' && schema[key]?.name);
            
            if (!availableTables.includes(tableName)) {
              return {
                error: \`Table '\${tableName}' does not exist or is not accessible\`
              };
            }
            
            // Get column information for the table
            const table = schema[tableName];
            const columns = Object.keys(table)
              .filter(key => typeof key === 'string' && key !== 'name' && !key.startsWith('_'))
              .map(key => {
                const column = table[key];
                return {
                  name: key,
                  type: column?.dataType || 'unknown',
                  nullable: column?.notNull === false
                };
              });
            
            return {
              table: tableName,
              columns,
              columnCount: columns.length
            };
          }
          
          if (inputLower.startsWith('count ')) {
            const tableName = inputLower.replace('count ', '').trim();
            
            // Check if table exists
            const availableTables = Object.keys(schema).filter(key => 
              typeof schema[key] === 'object' && schema[key]?.name);
            
            if (!availableTables.includes(tableName)) {
              return {
                error: \`Table '\${tableName}' does not exist or is not accessible\`
              };
            }
            
            // Get the count
            const table = schema[tableName];
            const result = await db.select({ count: sql\`count(*)\` }).from(table);
            
            return {
              table: tableName,
              count: Number(result[0]?.count || 0)
            };
          }
        }
        
        // Return an error if no valid command was given
        return {
          error: "Please provide a valid command. Try 'list tables', 'describe table [tableName]', or 'count [tableName]'."
        };
      } catch (error) {
        return {
          error: \`Database error: \${error.message}\`
        };
      }
      `
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: "Text command or SQL query. Use 'list tables' to show all tables."
        }
      },
      required: ['input']
    }
  });

  // Function to query a specific table with filters
  await UnifiedFunctionRegistry.registerFunction({
    name: 'queryTable',
    description: 'Query a specific table with optional filters, sorting and limits',
    toolType: 'database',
    implementation: 'TableQueryTool',
    metadata: {
      returnType: 'array',
      accessLevel: 'User',
      implementationCode: `
      const { tableName, filters = {}, limit = 100, orderBy, orderDirection = 'desc' } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(\`Table '\${tableName}' does not exist or is not accessible\`);
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
          query = query.where(sql\`\${whereConditions.join(' AND ')}\`);
        }
      }
      
      // Add order by if specified
      if (orderBy && table[orderBy]) {
        if (orderDirection.toLowerCase() === 'asc') {
          query = query.orderBy(asc(table[orderBy]));
        } else {
          query = query.orderBy(desc(table[orderBy]));
        }
      }
      
      // Add limit
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      
      // Execute query
      const results = await query;
      return results;
      `
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
          description: 'Filters to apply to the query (column-value pairs)'
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
    }
  });

  // Count records in a table with filters
  await UnifiedFunctionRegistry.registerFunction({
    name: 'countRecords',
    description: 'Count records in a table with optional filters',
    toolType: 'database',
    implementation: 'TableCountTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User',
      implementationCode: `
      const { tableName, filters = {} } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(\`Table '\${tableName}' does not exist or is not accessible\`);
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
      let query = db.select({ count: sql\`count(*)\` }).from(table);
      
      // Add where conditions if any
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          query = query.where(whereConditions[0]);
        } else {
          query = query.where(sql\`\${whereConditions.join(' AND ')}\`);
        }
      }
      
      // Execute query
      const result = await query;
      
      return {
        table: tableName,
        count: Number(result[0]?.count || 0),
        filters: Object.keys(filters).length > 0 ? filters : 'none'
      };
      `
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
          description: 'Filters to apply to the count (column-value pairs)'
        }
      },
      required: ['tableName']
    }
  });

  // Function to get latest records from a table
  await UnifiedFunctionRegistry.registerFunction({
    name: 'getLatestRecords',
    description: 'Get the latest records from a table based on a timestamp column',
    toolType: 'database',
    implementation: 'LatestRecordsTool',
    metadata: {
      returnType: 'array',
      accessLevel: 'User',
      implementationCode: `
      const { tableName, timestampColumn = 'createdAt', limit = 10 } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(\`Table '\${tableName}' does not exist or is not accessible\`);
      }
      
      // Get the table object
      const table = schema[tableName];
      
      // Check if timestamp column exists
      if (!table[timestampColumn]) {
        throw new Error(\`Column '\${timestampColumn}' does not exist in table '\${tableName}'\`);
      }
      
      // Query the latest records
      const results = await db
        .select()
        .from(table)
        .orderBy(desc(table[timestampColumn]))
        .limit(limit);
      
      return results;
      `
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to query'
        },
        timestampColumn: {
          type: 'string',
          description: 'Name of the timestamp column to sort by (default: createdAt)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return (default: 10)'
        }
      },
      required: ['tableName']
    }
  });

  // Function to perform aggregate operations on a table
  await UnifiedFunctionRegistry.registerFunction({
    name: 'aggregateData',
    description: 'Perform aggregate operations (sum, avg, min, max, count) on a table column',
    toolType: 'database',
    implementation: 'DataAggregationTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User',
      implementationCode: `
      const { tableName, column, operation, filters = {} } = params;
      
      // Check if table exists in schema
      const availableTables = Object.keys(schema).filter(key => 
        typeof schema[key] === 'object' && schema[key]?.name);
      
      if (!availableTables.includes(tableName)) {
        throw new Error(\`Table '\${tableName}' does not exist or is not accessible\`);
      }
      
      // Get the table object
      const table = schema[tableName];
      
      // Check if column exists
      if (!table[column]) {
        throw new Error(\`Column '\${column}' does not exist in table '\${tableName}'\`);
      }
      
      // Create where conditions for filters
      const whereConditions = [];
      for (const [key, value] of Object.entries(filters)) {
        if (table[key]) {
          whereConditions.push(eq(table[key], value));
        }
      }
      
      // Prepare aggregate operation
      let aggregateQuery;
      const aggregateColumn = table[column];
      
      switch (operation.toLowerCase()) {
        case 'sum':
          aggregateQuery = sql\`SUM(\${aggregateColumn})\`;
          break;
        case 'avg':
          aggregateQuery = sql\`AVG(\${aggregateColumn})\`;
          break;
        case 'min':
          aggregateQuery = sql\`MIN(\${aggregateColumn})\`;
          break;
        case 'max':
          aggregateQuery = sql\`MAX(\${aggregateColumn})\`;
          break;
        case 'count':
          aggregateQuery = sql\`COUNT(\${aggregateColumn})\`;
          break;
        default:
          throw new Error(\`Unsupported operation: \${operation}\`);
      }
      
      // Build and execute query
      let query = db.select({ result: aggregateQuery }).from(table);
      
      // Add where conditions if any
      if (whereConditions.length > 0) {
        if (whereConditions.length === 1) {
          query = query.where(whereConditions[0]);
        } else {
          query = query.where(sql\`\${whereConditions.join(' AND ')}\`);
        }
      }
      
      const result = await query;
      
      return {
        table: tableName,
        column,
        operation: operation.toLowerCase(),
        result: result[0]?.result,
        filters: Object.keys(filters).length > 0 ? filters : 'none'
      };
      `
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to query'
        },
        column: {
          type: 'string',
          description: 'Column to perform the aggregate operation on'
        },
        operation: {
          type: 'string',
          enum: ['sum', 'avg', 'min', 'max', 'count'],
          description: 'Aggregate operation to perform'
        },
        filters: {
          type: 'object',
          description: 'Filters to apply to the query (column-value pairs)'
        }
      },
      required: ['tableName', 'column', 'operation']
    }
  });

  console.log('Database query functions registered successfully');
}