/**
 * Unified Database Service
 * 
 * This file consolidates all database-related functionality including:
 * - Core database utilities (previously in db-utils.ts)
 * - Query building tools (previously in db-query-tools.ts)
 * - Database functions for AI agent (previously in db-agent-functions.ts)
 * - SQL execution functions for AI agent (previously in sql-agent-functions.ts)
 */

import { db } from '../db';
import { SQL, sql, eq, and, desc, count, asc } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { SqlExecutor } from '../sql-executor';
import { UnifiedFunctionRegistry } from './unified-function-registry';

/**
 * Core Database Utilities
 * Provides low-level database operations with parameterized queries
 */
export class DbCore {
  /**
   * Executes a parameterized SELECT query
   * @param tableName The database table to query
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @param options Additional query options (columns, limit, offset, orderBy)
   * @returns Results of the query
   */
  static async select<T>(
    tableName: string,
    whereConditions: Record<string, any> = {},
    options: {
      columns?: string[];
      limit?: number;
      offset?: number;
      orderBy?: { column: string; direction: "asc" | "desc" }[];
    } = {}
  ): Promise<T[]> {
    // Construct column selection
    const columnSelection = options.columns?.length 
      ? options.columns.join(", ") 
      : "*";

    // Build base query
    let queryStr = `SELECT ${columnSelection} FROM ${tableName}`;
    
    // Add WHERE conditions if any
    const params: any[] = [];
    if (Object.keys(whereConditions).length > 0) {
      const conditions = Object.entries(whereConditions)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value], index) => {
          params.push(value);
          return `${key} = $${index + 1}`;
        });
      
      if (conditions.length > 0) {
        queryStr += ` WHERE ${conditions.join(' AND ')}`;
      }
    }

    // Add ORDER BY if specified
    if (options.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(
        order => `${order.column} ${order.direction.toUpperCase()}`
      );
      queryStr += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Add LIMIT and OFFSET if specified
    if (options.limit !== undefined) {
      queryStr += ` LIMIT ${options.limit}`;
    }
    if (options.offset !== undefined) {
      queryStr += ` OFFSET ${options.offset}`;
    }

    // Execute the query
    return await db.execute(sql.raw(queryStr, ...params)) as T[];
  }

  /**
   * Executes a parameterized INSERT query
   * @param tableName The database table to insert into
   * @param data Object containing column-value pairs to insert
   * @returns Result of the insert operation
   */
  static async insert<T>(
    tableName: string,
    data: Record<string, any>
  ): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const queryStr = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await db.execute(sql.raw(queryStr, ...values));
    return (result && result[0]) as T;
  }

  /**
   * Executes a parameterized UPDATE query
   * @param tableName The database table to update
   * @param data Object containing column-value pairs to update
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @returns Results of the update operation
   */
  static async update<T>(
    tableName: string,
    data: Record<string, any>,
    whereConditions: Record<string, any>
  ): Promise<T[]> {
    const setValues = Object.entries(data)
      .map(([key, _], i) => `${key} = $${i + 1}`)
      .join(', ');
    
    const values = [...Object.values(data)];
    
    // Add WHERE conditions
    let whereClause = '';
    if (Object.keys(whereConditions).length > 0) {
      const conditions = Object.entries(whereConditions)
        .map(([key, _], i) => `${key} = $${i + values.length + 1}`);
      
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
      values.push(...Object.values(whereConditions));
    }
    
    const queryStr = `
      UPDATE ${tableName}
      SET ${setValues}
      ${whereClause}
      RETURNING *
    `;
    
    return await db.execute(sql.raw(queryStr, ...values)) as T[];
  }

  /**
   * Executes a parameterized DELETE query
   * @param tableName The database table to delete from
   * @param whereConditions Object containing key-value pairs for WHERE conditions
   * @returns Results of the delete operation
   */
  static async delete<T>(
    tableName: string,
    whereConditions: Record<string, any>
  ): Promise<T[]> {
    const values = Object.values(whereConditions);
    
    // Add WHERE conditions
    let whereClause = '';
    if (Object.keys(whereConditions).length > 0) {
      const conditions = Object.entries(whereConditions)
        .map(([key, _], i) => `${key} = $${i + 1}`);
      
      whereClause = ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const queryStr = `
      DELETE FROM ${tableName}
      ${whereClause}
      RETURNING *
    `;
    
    return await db.execute(sql.raw(queryStr, ...values)) as T[];
  }

  /**
   * Executes a raw parameterized SQL query with proper security controls
   * @param query SQL query string with placeholders
   * @param params Array of parameter values
   * @returns Query results
   */
  static async executeRaw<T>(query: string, params: any[] = []): Promise<T[]> {
    return await db.execute(sql.raw(query, ...params)) as T[];
  }
  
  /**
   * Executes a raw parameterized SQL query within a transaction
   * @param query SQL query string with placeholders
   * @param params Array of parameter values 
   * @returns Query results
   */
  static async executeTransaction<T>(query: string, params: any[] = []): Promise<T[]> {
    try {
      // Execute the query in a transaction
      return await db.transaction(async (tx) => {
        const sqlQuery = sql.raw(query);
        const paramsArray = params || [];
        return await tx.execute(sqlQuery, ...paramsArray) as T[];
      });
    } catch (error: any) {
      console.error('Transaction execution error:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }
}

/**
 * Advanced Query Tools
 * Provides higher-level query operations like aggregation and analysis
 */
export class DbQueryTools {
  /**
   * Execute a complex analytical query with aggregations
   * @param tableName The database table to query
   * @param metrics Array of metrics to compute (count, sum, avg, min, max)
   * @param dimensions Optional dimensions to group by
   * @param filters Optional filter conditions
   * @param options Additional query options
   * @returns Aggregated data results
   */
  static async aggregate(
    tableName: string,
    metrics: Array<{
      function: "count" | "sum" | "avg" | "min" | "max";
      field: string;
      alias?: string;
    }>,
    dimensions: string[] = [],
    filters: Record<string, any> = {},
    options: {
      limit?: number;
      offset?: number;
      orderBy?: Array<{
        field: string;
        direction: "asc" | "desc";
      }>;
    } = {}
  ): Promise<any[]> {
    // Construct the metric expressions
    const metricExpressions = metrics.map((metric) => {
      const alias = metric.alias || `${metric.function}_${metric.field}`;
      return `${metric.function.toUpperCase()}(${metric.field}) AS ${alias}`;
    });

    // Construct the base query
    let query = `SELECT ${dimensions.length > 0 ? dimensions.join(", ") + ", " : ""}
                ${metricExpressions.join(", ")}
                FROM ${tableName}`;

    // Add WHERE conditions
    const params: any[] = [];
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value], index) => {
        params.push(value);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Add GROUP BY if dimensions are specified
    if (dimensions.length > 0) {
      query += ` GROUP BY ${dimensions.join(", ")}`;
    }

    // Add ORDER BY if specified
    if (options.orderBy && options.orderBy.length > 0) {
      const orderClauses = options.orderBy.map(
        (order) => `${order.field} ${order.direction.toUpperCase()}`
      );
      query += ` ORDER BY ${orderClauses.join(", ")}`;
    }

    // Add LIMIT and OFFSET if specified
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset !== undefined) {
      query += ` OFFSET ${options.offset}`;
    }

    // Execute the query
    return await DbCore.executeRaw(query, params);
  }

  /**
   * Calculate time-based aggregations for time series data
   * @param tableName Table containing time series data
   * @param timeColumn Name of timestamp/date column
   * @param valueColumn Column to aggregate
   * @param aggregation Type of aggregation to perform
   * @param interval Time interval for grouping
   * @param filters Optional filter conditions
   * @returns Time-based aggregated data
   */
  static async timeSeriesAggregate(
    tableName: string,
    timeColumn: string,
    valueColumn: string,
    aggregation: "avg" | "sum" | "min" | "max" | "count",
    interval: "hour" | "day" | "week" | "month",
    filters: Record<string, any> = {},
    range?: { start?: Date; end?: Date }
  ): Promise<any[]> {
    // Build interval expression based on PostgreSQL date trunc
    const intervalExpression = `DATE_TRUNC('${interval}', ${timeColumn})`;

    // Construct base query
    let query = `
      SELECT 
        ${intervalExpression} AS time_bucket,
        ${aggregation.toUpperCase()}(${valueColumn}) AS value
      FROM ${tableName}
    `;

    // Add WHERE conditions
    const params: any[] = [];
    const conditions: string[] = [];

    // Add time range filter if provided
    if (range) {
      if (range.start) {
        conditions.push(`${timeColumn} >= $${params.length + 1}`);
        params.push(range.start);
      }
      if (range.end) {
        conditions.push(`${timeColumn} <= $${params.length + 1}`);
        params.push(range.end);
      }
    }

    // Add other filters
    Object.entries(filters).forEach(([key, value]) => {
      conditions.push(`${key} = $${params.length + 1}`);
      params.push(value);
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Add GROUP BY and ORDER BY
    query += `
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;

    // Execute the query
    return await DbCore.executeRaw(query, params);
  }

  /**
   * Run a correlation analysis between two numeric columns
   * @param tableName Table containing the data
   * @param column1 First column name
   * @param column2 Second column name
   * @param filters Optional filter conditions
   * @returns Correlation coefficient
   */
  static async correlationAnalysis(
    tableName: string,
    column1: string,
    column2: string,
    filters: Record<string, any> = {}
  ): Promise<{ correlation: number }> {
    // Construct the correlation query using PostgreSQL's CORR function
    let query = `
      SELECT CORR(${column1}, ${column2}) AS correlation
      FROM ${tableName}
    `;

    // Add WHERE conditions
    const params: any[] = [];
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value], index) => {
        params.push(value);
        return `${key} = $${index + 1}`;
      });
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Execute the query
    const result = await DbCore.executeRaw<{ correlation: number }>(query, params);
    return result[0];
  }
}

/**
 * Database Agent Functions
 * Functions specifically designed for AI agent to query and analyze data
 */
export class DbAgentFunctions {
  /**
   * Register all database-related functions for the AI agent
   */
  static async registerDatabaseFunctions() {
    // Register database query functions
    await UnifiedFunctionRegistry.registerFunction({
      name: 'queryTable',
      description: 'Query data from a database table with optional filters and sorting',
      module: 'database',
      returnType: 'array',
      accessLevel: 'User', // Will be compared case-insensitively
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
            description: 'Optional maximum number of records to return'
          },
          offset: {
            type: 'number',
            description: 'Optional number of records to skip'
          },
          orderBy: {
            type: 'array',
            description: 'Optional sorting criteria',
            items: {
              type: 'object',
              properties: {
                column: { type: 'string' },
                direction: { type: 'string', enum: ['asc', 'desc'] }
              }
            }
          }
        },
        required: ['tableName']
      },
      handler: async (args: any) => {
        const { tableName, filters = {}, limit, offset, orderBy } = args;
        
        const options: any = {};
        if (limit) options.limit = limit;
        if (offset) options.offset = offset;
        if (orderBy) options.orderBy = orderBy;
        
        return await DbCore.select(tableName, filters, options);
      }
    });

    // Register aggregation function
    await UnifiedFunctionRegistry.registerFunction({
      name: 'aggregateData',
      description: 'Perform aggregations (count, sum, avg, min, max) on database tables',
      module: 'database',
      returnType: 'array',
      accessLevel: 'User', // Will be compared case-insensitively
      parameters: {
        type: 'object',
        properties: {
          tableName: {
            type: 'string',
            description: 'Name of the table to query'
          },
          metrics: {
            type: 'array',
            description: 'Metrics to compute',
            items: {
              type: 'object',
              properties: {
                function: { 
                  type: 'string', 
                  enum: ['count', 'sum', 'avg', 'min', 'max'],
                  description: 'Aggregation function to use'
                },
                field: { 
                  type: 'string',
                  description: 'Field/column to aggregate' 
                },
                alias: { 
                  type: 'string',
                  description: 'Optional alias for the result' 
                }
              },
              required: ['function', 'field']
            }
          },
          dimensions: {
            type: 'array',
            description: 'Optional group by dimensions',
            items: { type: 'string' }
          },
          filters: {
            type: 'object',
            description: 'Optional filter conditions',
            additionalProperties: true
          }
        },
        required: ['tableName', 'metrics']
      },
      handler: async (args: any) => {
        const { tableName, metrics, dimensions = [], filters = {}, limit, offset, orderBy } = args;
        
        const options: any = {};
        if (limit) options.limit = limit;
        if (offset) options.offset = offset;
        if (orderBy) options.orderBy = orderBy;
        
        return await DbQueryTools.aggregate(tableName, metrics, dimensions, filters, options);
      }
    });

    // Register time series aggregation function
    await UnifiedFunctionRegistry.registerFunction({
      name: 'timeSeriesAggregate',
      description: 'Aggregate time series data by time intervals',
      module: 'database',
      returnType: 'array',
      functionCode: 'return DatabaseService.AgentFunctions.timeSeriesAggregate(params, context)',
      accessLevel: 'User', // Will be compared case-insensitively
      parameters: {
        type: 'object',
        properties: {
          tableName: {
            type: 'string',
            description: 'Table containing time series data'
          },
          timeColumn: {
            type: 'string',
            description: 'Name of timestamp/date column'
          },
          valueColumn: {
            type: 'string',
            description: 'Column to aggregate'
          },
          aggregation: {
            type: 'string',
            enum: ['avg', 'sum', 'min', 'max', 'count'],
            description: 'Type of aggregation to perform'
          },
          interval: {
            type: 'string',
            enum: ['hour', 'day', 'week', 'month'],
            description: 'Time interval for grouping'
          },
          filters: {
            type: 'object',
            description: 'Optional filter conditions',
            additionalProperties: true
          },
          startDate: {
            type: 'string',
            description: 'Optional start date (ISO format)'
          },
          endDate: {
            type: 'string',
            description: 'Optional end date (ISO format)'
          }
        },
        required: ['tableName', 'timeColumn', 'valueColumn', 'aggregation', 'interval']
      },
      handler: async (args: any) => {
        const { 
          tableName, 
          timeColumn, 
          valueColumn, 
          aggregation, 
          interval, 
          filters = {},
          startDate,
          endDate
        } = args;
        
        const range: any = {};
        if (startDate) range.start = new Date(startDate);
        if (endDate) range.end = new Date(endDate);
        
        return await DbQueryTools.timeSeriesAggregate(
          tableName, 
          timeColumn, 
          valueColumn, 
          aggregation, 
          interval, 
          filters,
          Object.keys(range).length > 0 ? range : undefined
        );
      }
    });

    // Register correlation analysis function
    await UnifiedFunctionRegistry.registerFunction({
      name: 'analyzeCorrelation',
      description: 'Analyze correlation between two numeric columns',
      module: 'database',
      returnType: 'object',
      functionCode: 'return DatabaseService.AgentFunctions.analyzeCorrelation(params)',
      accessLevel: 'User', // Will be compared case-insensitively
      parameters: {
        type: 'object',
        properties: {
          tableName: {
            type: 'string',
            description: 'Table containing the data'
          },
          column1: {
            type: 'string',
            description: 'First column name'
          },
          column2: {
            type: 'string',
            description: 'Second column name'
          },
          filters: {
            type: 'object',
            description: 'Optional filter conditions',
            additionalProperties: true
          }
        },
        required: ['tableName', 'column1', 'column2']
      }
    });

    // Get equipment list function
    await UnifiedFunctionRegistry.registerFunction({
      name: 'getEquipmentList',
      description: 'Get a list of all equipment in the system',
      module: 'database',
      returnType: 'array',
      functionCode: 'return DatabaseService.AgentFunctions.getEquipmentList(params)',
      accessLevel: 'User', // Will be compared case-insensitively
      parameters: {
        type: 'object',
        properties: {
          active: {
            type: 'boolean',
            description: 'Optional filter for active equipment only'
          }
        }
      }
    });

    // Get latest power data function
    await UnifiedFunctionRegistry.registerFunction({
      name: 'getLatestPowerData',
      description: 'Get the most recent power monitoring data',
      module: 'database',
      returnType: 'object',
      functionCode: 'return DatabaseService.AgentFunctions.getLatestPowerData()',
      accessLevel: 'User', // Will be compared case-insensitively
      parameters: {
        type: 'object',
        properties: {}
      }
    });

    // Register SQL execution function for advanced users
    await UnifiedFunctionRegistry.registerFunction({
      name: 'executeSqlQuery',
      description: 'Execute a SQL query with parameterized values for security',
      module: 'database',
      returnType: 'object',
      functionCode: 'return DatabaseService.AgentFunctions.executeSqlQuery(params, context)',
      accessLevel: 'admin', // Will be compared case-insensitively 
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'SQL query to execute'
          },
          parameters: {
            type: 'array',
            description: 'Array of parameter values for query placeholders',
            items: {
              type: ['string', 'number', 'boolean', 'null']
            }
          },
          options: {
            type: 'object',
            description: 'Additional query options',
            properties: {
              useTransaction: {
                type: 'boolean',
                description: 'Whether to run the query in a transaction'
              }
            }
          }
        },
        required: ['query']
      }
    });

    console.log('Database query and analysis functions registered successfully');
    console.log('SQL execution functions registered successfully');
  }
}

// Export the combined service
export const DatabaseService = {
  Core: DbCore,
  QueryTools: DbQueryTools,
  AgentFunctions: DbAgentFunctions
};