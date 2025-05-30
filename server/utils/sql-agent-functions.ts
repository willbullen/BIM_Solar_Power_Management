/**
 * SQL execution functions for the AI agent
 * 
 * This file provides functions that allow the AI agent to execute SQL queries
 * with proper security controls and permissions.
 */

import { UnifiedFunctionRegistry } from './unified-function-registry';
import { SqlExecutor } from '../sql-executor';

/**
 * Register SQL execution functions for the AI agent
 */
export async function registerSqlFunctions() {
  // Register the executeSql function for direct SQL query execution
  await UnifiedFunctionRegistry.registerFunction({
    name: 'executeSqlQuery',
    description: 'Execute a SQL query with parameterized values for security',
    toolType: 'database',
    implementation: 'SqlQueryExecutorTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'admin', // Only admins can execute raw SQL - use lowercase for consistency
      implementationCode: `
        const { query, parameters = [], allowModification = false } = params;
        
        // Create SQL executor with user role for permission checking
        const executor = new SqlExecutor({
          userRole: (context.userRole || 'user').toLowerCase(), // Normalize role to lowercase
          allowModification,
          allowSchemaModification: false // Never allow schema modification
        });
        
        try {
          // Execute the query with parameters
          const result = await executor.execute(query, parameters);
          return result;
        } catch (error) {
          throw new Error(\`SQL execution failed: \${error.message}\`);
        }
      `
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL query to execute'
        },
        parameters: {
          type: 'array',
          items: {
            type: ['string', 'number', 'boolean', 'null']
          },
          description: 'Parameters for the query (for security, use ? or $1, $2, etc. placeholders in query)'
        },
        allowModification: {
          type: 'boolean',
          description: 'Whether to allow data modification (INSERT, UPDATE, DELETE)'
        }
      },
      required: ['query']
    }
  });
  
  // Register a function to get database schema information
  await UnifiedFunctionRegistry.registerFunction({
    name: 'getDatabaseInfo',
    description: 'Get information about database tables and columns',
    toolType: 'database',
    implementation: 'DatabaseInfoTool',
    metadata: {
      returnType: 'array',
      accessLevel: 'User',
      implementationCode: `
        const { includeSystemTables = false } = params;
        
        // Create SQL executor with user role for permission checking
        const executor = new SqlExecutor({
          userRole: context.userRole || 'User',
          allowModification: false,
          allowSchemaModification: false
        });
        
        try {
          // Get database information
          const dbInfo = await executor.getDatabaseInfo();
          
          // Filter out system tables if needed
          if (!includeSystemTables) {
            return dbInfo.filter(tableInfo => 
              !tableInfo.tableName.startsWith('pg_') && 
              !tableInfo.tableName.startsWith('sql_')
            );
          }
          
          return dbInfo;
        } catch (error) {
          throw new Error(\`Failed to get database information: \${error.message}\`);
        }
      `
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
    }
  });
  
  // Register a function to analyze table data
  await UnifiedFunctionRegistry.registerFunction({
    name: 'analyzeTableData',
    description: 'Analyze table data with common statistical queries',
    toolType: 'database',
    implementation: 'TableAnalysisTool',
    metadata: {
      returnType: 'object',
      accessLevel: 'User',
      implementationCode: `
        const { tableName, columns, analysisType, limit = 100 } = params;
        
        // Create SQL executor with user role for permission checking
        const executor = new SqlExecutor({
          userRole: context.userRole || 'User',
          allowModification: false,
          allowSchemaModification: false
        });
        
        // Validate table name
        if (!executor.isTableAllowed(tableName)) {
          throw new Error(\`Table '\${tableName}' does not exist or is not accessible\`);
        }
        
        try {
          let query;
          
          switch (analysisType) {
            case 'statistics':
              // For each numeric column, generate statistics
              query = \`
                SELECT 
                  \${columns.map(col => \`
                    MIN(\${col}) as min_\${col},
                    MAX(\${col}) as max_\${col},
                    AVG(\${col}) as avg_\${col},
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY \${col}) as median_\${col},
                    STDDEV(\${col}) as stddev_\${col}
                  \`).join(',')}
                FROM \${tableName}
              \`;
              break;
              
            case 'distinct':
              // For each column, count distinct values
              query = \`
                SELECT 
                  \${columns.map(col => \`
                    COUNT(DISTINCT \${col}) as distinct_\${col}
                  \`).join(',')}
                FROM \${tableName}
              \`;
              break;
              
            case 'distribution':
              // For the first column, show value distribution
              if (!columns || columns.length === 0) {
                throw new Error('At least one column must be specified for distribution analysis');
              }
              
              query = \`
                SELECT 
                  \${columns[0]},
                  COUNT(*) as count
                FROM \${tableName}
                GROUP BY \${columns[0]}
                ORDER BY count DESC
                LIMIT \${limit}
              \`;
              break;
              
            case 'correlation':
              // For pairs of numeric columns, calculate correlation
              if (columns.length < 2) {
                throw new Error('At least two columns must be specified for correlation analysis');
              }
              
              const correlationPairs = [];
              for (let i = 0; i < columns.length; i++) {
                for (let j = i + 1; j < columns.length; j++) {
                  correlationPairs.push(\`
                    CORR(\${columns[i]}, \${columns[j]}) as corr_\${columns[i]}_\${columns[j]}
                  \`);
                }
              }
              
              query = \`
                SELECT 
                  \${correlationPairs.join(',')}
                FROM \${tableName}
              \`;
              break;
              
            default:
              throw new Error(\`Unsupported analysis type: \${analysisType}\`);
          }
          
          // Execute the query
          const result = await executor.executeReadOnly(query);
          return result;
        } catch (error) {
          throw new Error(\`Table analysis failed: \${error.message}\`);
        }
      `
    },
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Name of the table to analyze'
        },
        columns: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Columns to analyze (numeric columns for statistics, any for distinct values)'
        },
        analysisType: {
          type: 'string',
          enum: ['statistics', 'distinct', 'distribution', 'correlation'],
          description: 'Type of analysis to perform'
        },
        limit: {
          type: 'number',
          description: 'Limit for the number of results (for distinct values)'
        }
      },
      required: ['tableName', 'columns', 'analysisType']
    }
  });
  
  console.log('SQL execution functions registered successfully');
}