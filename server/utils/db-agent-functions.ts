import { FunctionRegistry } from './function-registry';
import { DbQueryTools } from './db-query-tools';

/**
 * Register database query and analysis functions for the AI agent
 */
export async function registerDatabaseFunctions() {
  console.log('Registering AI Agent database query functions...');
  
  // 1. Table Information Function
  await FunctionRegistry.registerFunction({
    name: 'getDatabaseSchema',
    description: 'Get database schema information including table structure, columns and relationships',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Optional table name to get schema for. If not provided, returns a list of all tables.'
        }
      }
    },
    returnType: 'DatabaseSchema',
    functionCode: `
      async function getDatabaseSchema(params, dbUtils) {
        const { tableName } = params;
        
        // If no table name provided, return a list of all tables
        if (!tableName) {
          const tables = await DbQueryTools.listTables();
          return { tables };
        }
        
        // Get schema information for the specified table
        const schema = await DbQueryTools.getTableSchema(tableName);
        
        // Get relationships for the table
        const relationships = await DbQueryTools.getTableRelationships(tableName);
        
        return {
          schema,
          relationships
        };
      }
    `,
    accessLevel: 'public',
    tags: ['database', 'schema', 'metadata']
  });
  
  // 2. Data Query Function
  await FunctionRegistry.registerFunction({
    name: 'queryTableData',
    description: 'Query data from a database table with flexible filtering options',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to query'
        },
        columns: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Specific columns to include in the results. If empty, all columns are returned.'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return'
        },
        offset: {
          type: 'number',
          description: 'Number of records to skip'
        },
        orderBy: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              direction: { type: 'string', enum: ['asc', 'desc'] }
            }
          },
          description: 'Ordering options'
        }
      },
      required: ['tableName']
    },
    returnType: 'TableData',
    functionCode: `
      async function queryTableData(params, dbUtils) {
        const { tableName, columns = [], filters = {}, limit, offset, orderBy } = params;
        
        const options = {
          columns: columns.length > 0 ? columns : undefined,
          limit,
          offset,
          orderBy
        };
        
        const data = await dbUtils.select(tableName, filters, options);
        return {
          tableName,
          columns: columns.length > 0 ? columns : Object.keys(data[0] || {}),
          rowCount: data.length,
          data
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'query', 'select']
  });
  
  // 3. Aggregation Function
  await FunctionRegistry.registerFunction({
    name: 'aggregateData',
    description: 'Perform data aggregation with various metrics and dimensions',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to aggregate data from'
        },
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              function: { 
                type: 'string', 
                enum: ['count', 'sum', 'avg', 'min', 'max']
              },
              field: { type: 'string' },
              alias: { type: 'string' }
            },
            required: ['function', 'field']
          },
          description: 'Metrics to compute in the aggregation'
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dimensions to group by'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of records to return'
        }
      },
      required: ['tableName', 'metrics']
    },
    returnType: 'AggregationResult',
    functionCode: `
      async function aggregateData(params, dbUtils, context) {
        const { tableName, metrics, dimensions = [], filters = {}, limit } = params;
        
        // This is a sensitive operation, make sure we can use DbQueryTools directly
        const results = await DbQueryTools.aggregate(
          tableName,
          metrics,
          dimensions,
          filters,
          { limit }
        );
        
        return {
          tableName,
          metrics,
          dimensions,
          rowCount: results.length,
          data: results
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'analytics', 'aggregation']
  });
  
  // 4. Time Series Analysis
  await FunctionRegistry.registerFunction({
    name: 'timeSeriesAnalysis',
    description: 'Analyze time series data with various time intervals and metrics',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table containing time series data'
        },
        timeField: {
          type: 'string',
          description: 'Name of the timestamp field'
        },
        timeInterval: {
          type: 'string',
          enum: ['hour', 'day', 'week', 'month', 'year'],
          description: 'Time interval to group by'
        },
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              function: { 
                type: 'string', 
                enum: ['count', 'sum', 'avg', 'min', 'max']
              },
              field: { type: 'string' },
              alias: { type: 'string' }
            },
            required: ['function', 'field']
          },
          description: 'Metrics to compute for each time interval'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        },
        startDate: {
          type: 'string',
          description: 'Start date in ISO format (e.g., 2023-01-01)'
        },
        endDate: {
          type: 'string',
          description: 'End date in ISO format (e.g., 2023-01-31)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of time intervals to return'
        }
      },
      required: ['tableName', 'timeField', 'timeInterval', 'metrics']
    },
    returnType: 'TimeSeriesResult',
    functionCode: `
      async function timeSeriesAnalysis(params, dbUtils, context) {
        const { 
          tableName, 
          timeField, 
          timeInterval, 
          metrics, 
          filters = {}, 
          startDate, 
          endDate, 
          limit,
          orderBy = 'asc'
        } = params;
        
        const options = {
          startDate,
          endDate,
          limit,
          orderBy
        };
        
        const results = await DbQueryTools.timeSeriesAnalysis(
          tableName,
          timeField,
          timeInterval,
          metrics,
          filters,
          options
        );
        
        return {
          tableName,
          timeInterval,
          metrics,
          rowCount: results.length,
          data: results
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'analytics', 'time-series']
  });
  
  // 5. Statistical Analysis
  await FunctionRegistry.registerFunction({
    name: 'calculateStatistics',
    description: 'Calculate statistical measures for one or more fields',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to analyze'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to compute statistics for'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        }
      },
      required: ['tableName', 'fields']
    },
    returnType: 'StatisticalSummary',
    functionCode: `
      async function calculateStatistics(params, dbUtils, context) {
        const { tableName, fields, filters = {} } = params;
        
        const statistics = await DbQueryTools.calculateStatistics(
          tableName,
          fields,
          filters
        );
        
        return {
          tableName,
          fields,
          statistics
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'analytics', 'statistics']
  });
  
  // 6. Correlation Analysis
  await FunctionRegistry.registerFunction({
    name: 'calculateCorrelations',
    description: 'Calculate correlations between multiple fields',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to analyze'
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to compute correlations between'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        }
      },
      required: ['tableName', 'fields']
    },
    returnType: 'CorrelationMatrix',
    functionCode: `
      async function calculateCorrelations(params, dbUtils, context) {
        const { tableName, fields, filters = {} } = params;
        
        // Need at least 2 fields
        if (fields.length < 2) {
          throw new Error("At least 2 fields are required to calculate correlations");
        }
        
        const correlations = await DbQueryTools.calculateCorrelations(
          tableName,
          fields,
          filters
        );
        
        return {
          tableName,
          fields,
          correlations
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'analytics', 'correlation']
  });
  
  // 7. Anomaly Detection
  await FunctionRegistry.registerFunction({
    name: 'detectAnomalies',
    description: 'Detect anomalies in a time series using z-scores',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to analyze'
        },
        timeField: {
          type: 'string',
          description: 'Name of the timestamp field'
        },
        valueField: {
          type: 'string',
          description: 'Numeric field to analyze for anomalies'
        },
        threshold: {
          type: 'number',
          description: 'Z-score threshold for anomaly detection (default 2.0)'
        },
        filters: {
          type: 'object',
          description: 'Filter conditions as key-value pairs'
        },
        startDate: {
          type: 'string',
          description: 'Start date in ISO format (e.g., 2023-01-01)'
        },
        endDate: {
          type: 'string',
          description: 'End date in ISO format (e.g., 2023-01-31)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of anomalies to return'
        }
      },
      required: ['tableName', 'timeField', 'valueField']
    },
    returnType: 'AnomalyDetectionResult',
    functionCode: `
      async function detectAnomalies(params, dbUtils, context) {
        const { 
          tableName, 
          timeField, 
          valueField, 
          threshold = 2.0, 
          filters = {},
          startDate,
          endDate,
          limit = 10
        } = params;
        
        const options = {
          startDate,
          endDate,
          limit
        };
        
        const anomalies = await DbQueryTools.detectAnomalies(
          tableName,
          timeField,
          valueField,
          threshold,
          filters,
          options
        );
        
        return {
          tableName,
          timeField,
          valueField,
          threshold,
          anomalyCount: anomalies.filter(a => a.is_anomaly).length,
          anomalies
        };
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'analytics', 'anomaly-detection']
  });

  console.log('AI Agent database query functions registered successfully');
}

// Import required for direct execution
import { DbUtils } from './db-utils';
import { executeSQL } from '../sql-executor';

// Export function to execute raw SQL for complex queries
export async function executeRawSQL(sql: string, params: any[] = []): Promise<any[]> {
  try {
    return await DbUtils.executeRaw(sql, params);
  } catch (error) {
    console.error('Error executing raw SQL:', error);
    throw new Error(`Failed to execute SQL: ${error instanceof Error ? error.message : String(error)}`);
  }
}