import { FunctionRegistry } from './function-registry';
import { handleAgentSqlQuery } from '../sql-executor';

/**
 * Register SQL execution functions for the AI agent
 */
export async function registerSqlFunctions() {
  console.log('Registering AI Agent SQL execution functions...');
  
  // SQL Query Execution Function
  await FunctionRegistry.registerFunction({
    name: 'executeSqlQuery',
    description: 'Execute a SQL query against the database with security and permission checks',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        sqlQuery: {
          type: 'string',
          description: 'SQL query to execute (SELECT statements only for regular users)'
        },
        explain: {
          type: 'boolean',
          description: 'Execute as EXPLAIN ANALYZE for query performance analysis'
        },
        maxRows: {
          type: 'number',
          description: 'Maximum number of rows to return'
        }
      },
      required: ['sqlQuery']
    },
    returnType: 'SqlQueryResult',
    functionCode: `
      async function executeSqlQuery(params, dbUtils, context) {
        const { sqlQuery, explain = false, maxRows = 1000 } = params;
        
        // Get user role from context
        const userRole = context.userRole || 'user';
        
        return await handleAgentSqlQuery(sqlQuery, userRole, { explain, maxRows });
      }
    `,
    accessLevel: 'restricted',
    tags: ['database', 'sql', 'query']
  });
  
  // SQL Schema Query Function - Safer option for exploring the database structure
  await FunctionRegistry.registerFunction({
    name: 'getSqlTableInfo',
    description: 'Get information about database tables, their columns, and relationships',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        tableName: {
          type: 'string',
          description: 'Optional table name to get information for. If not provided, returns list of all tables.'
        },
        includeColumns: {
          type: 'boolean',
          description: 'Include column details'
        },
        includeIndexes: {
          type: 'boolean',
          description: 'Include index information'
        },
        includeRelationships: {
          type: 'boolean',
          description: 'Include foreign key relationships'
        }
      }
    },
    returnType: 'SqlTableInfo',
    functionCode: `
      async function getSqlTableInfo(params, dbUtils, context) {
        const { 
          tableName, 
          includeColumns = true, 
          includeIndexes = true, 
          includeRelationships = true 
        } = params;
        
        const result = {
          tables: [],
          columns: [],
          indexes: [],
          relationships: []
        };
        
        // Get tables
        if (!tableName) {
          const tablesQuery = \`
            SELECT 
              table_name, 
              pg_catalog.obj_description(pg_class.oid, 'pg_class') as description, 
              pg_relation_size(quote_ident(table_name)) as size_bytes
            FROM 
              information_schema.tables 
              JOIN pg_catalog.pg_class ON pg_class.relname = table_name
            WHERE 
              table_schema = 'public'
              AND table_type = 'BASE TABLE'
            ORDER BY 
              table_name
          \`;
          
          result.tables = await dbUtils.executeRaw(tablesQuery);
        } else {
          // Get single table info
          const tableQuery = \`
            SELECT 
              table_name, 
              pg_catalog.obj_description(pg_class.oid, 'pg_class') as description, 
              pg_relation_size(quote_ident(table_name)) as size_bytes
            FROM 
              information_schema.tables 
              JOIN pg_catalog.pg_class ON pg_class.relname = table_name
            WHERE 
              table_schema = 'public'
              AND table_type = 'BASE TABLE'
              AND table_name = $1
          \`;
          
          result.tables = await dbUtils.executeRaw(tableQuery, [tableName]);
          
          // Get column info if requested
          if (includeColumns) {
            const columnsQuery = \`
              SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default,
                character_maximum_length,
                pg_catalog.col_description(pg_class.oid, columns.ordinal_position) as description
              FROM 
                information_schema.columns
                JOIN pg_catalog.pg_class ON pg_class.relname = table_name
              WHERE 
                table_schema = 'public' 
                AND table_name = $1
              ORDER BY 
                ordinal_position
            \`;
            
            result.columns = await dbUtils.executeRaw(columnsQuery, [tableName]);
          }
          
          // Get index info if requested
          if (includeIndexes) {
            const indexesQuery = \`
              SELECT
                i.relname as index_name,
                a.attname as column_name,
                ix.indisunique as is_unique,
                ix.indisprimary as is_primary
              FROM
                pg_class t, pg_class i, pg_index ix, pg_attribute a
              WHERE
                t.oid = ix.indrelid
                AND i.oid = ix.indexrelid
                AND a.attrelid = t.oid
                AND a.attnum = ANY(ix.indkey)
                AND t.relkind = 'r'
                AND t.relname = $1
              ORDER BY
                i.relname, a.attnum
            \`;
            
            result.indexes = await dbUtils.executeRaw(indexesQuery, [tableName]);
          }
          
          // Get relationship info if requested
          if (includeRelationships) {
            const relationshipsQuery = \`
              SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name as foreign_table_name,
                ccu.column_name as foreign_column_name
              FROM
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name
              WHERE
                tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = $1
                AND tc.table_schema = 'public'
            \`;
            
            result.relationships = await dbUtils.executeRaw(relationshipsQuery, [tableName]);
          }
        }
        
        return result;
      }
    `,
    accessLevel: 'public',
    tags: ['database', 'schema', 'metadata']
  });
  
  // SQL Query Builder Function - Safer alternative to raw SQL execution
  await FunctionRegistry.registerFunction({
    name: 'buildAndExecuteSqlQuery',
    description: 'Build and execute a SQL query using safe parameters and options',
    module: 'database',
    parameters: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table name to query'
        },
        action: {
          type: 'string',
          enum: ['select', 'count', 'aggregate'],
          description: 'Query action to perform'
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to include in the query (for SELECT)'
        },
        aggregations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              function: { 
                type: 'string', 
                enum: ['count', 'sum', 'avg', 'min', 'max']
              },
              column: { type: 'string' },
              alias: { type: 'string' }
            }
          },
          description: 'Aggregation functions to apply (for aggregate action)'
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              column: { type: 'string' },
              operator: { 
                type: 'string', 
                enum: ['=', '!=', '>', '<', '>=', '<=', 'like', 'in', 'is null', 'is not null'] 
              },
              value: { type: 'any' }
            }
          },
          description: 'Filter conditions for WHERE clause'
        },
        groupBy: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to group by (for aggregate action)'
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
          description: 'Columns and directions to order by'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of rows to return'
        },
        offset: {
          type: 'number',
          description: 'Number of rows to skip'
        }
      },
      required: ['table', 'action']
    },
    returnType: 'SqlQueryResult',
    functionCode: `
      async function buildAndExecuteSqlQuery(params, dbUtils, context) {
        const { 
          table, 
          action, 
          columns = ['*'], 
          aggregations = [], 
          filters = [], 
          groupBy = [], 
          orderBy = [], 
          limit, 
          offset 
        } = params;
        
        // Build the SQL query safely
        let sqlQuery = '';
        const queryParams = [];
        
        // Generate the SELECT part based on action
        if (action === 'select') {
          sqlQuery = \`SELECT \${columns.join(', ')} FROM "\${table}"\`;
        } else if (action === 'count') {
          sqlQuery = \`SELECT COUNT(*) as count FROM "\${table}"\`;
        } else if (action === 'aggregate') {
          // Build aggregation expressions
          const aggExpressions = aggregations.map(agg => {
            const alias = agg.alias || \`\${agg.function}_\${agg.column}\`;
            return \`\${agg.function.toUpperCase()}(\${agg.column}) AS "\${alias}"\`;
          });
          
          // Combine with group by columns
          const selectExpressions = [...groupBy, ...aggExpressions];
          sqlQuery = \`SELECT \${selectExpressions.join(', ')} FROM "\${table}"\`;
        }
        
        // Add WHERE clause if filters exist
        if (filters.length > 0) {
          const whereConditions = filters.map(filter => {
            // Handle special operators
            if (filter.operator === 'is null') {
              return \`"\${filter.column}" IS NULL\`;
            } else if (filter.operator === 'is not null') {
              return \`"\${filter.column}" IS NOT NULL\`;
            } else if (filter.operator === 'in' && Array.isArray(filter.value)) {
              // Generate placeholders for IN clause
              const placeholders = filter.value.map((_, i) => \`$\${queryParams.length + i + 1}\`).join(', ');
              filter.value.forEach(val => queryParams.push(val));
              return \`"\${filter.column}" IN (\${placeholders})\`;
            } else if (filter.operator === 'like') {
              // For LIKE, add wildcards if they're not already there
              queryParams.push(filter.value.includes('%') ? filter.value : \`%\${filter.value}%\`);
              return \`"\${filter.column}" LIKE $\${queryParams.length}\`;
            } else {
              // Standard operators
              queryParams.push(filter.value);
              return \`"\${filter.column}" \${filter.operator} $\${queryParams.length}\`;
            }
          });
          
          sqlQuery += \` WHERE \${whereConditions.join(' AND ')}\`;
        }
        
        // Add GROUP BY if needed
        if (groupBy.length > 0 && action === 'aggregate') {
          sqlQuery += \` GROUP BY \${groupBy.map(col => \`"\${col}"\`).join(', ')}\`;
        }
        
        // Add ORDER BY if specified
        if (orderBy.length > 0) {
          const orderClauses = orderBy.map(order => 
            \`"\${order.column}" \${order.direction.toUpperCase()}\`
          );
          sqlQuery += \` ORDER BY \${orderClauses.join(', ')}\`;
        }
        
        // Add LIMIT if specified
        if (limit !== undefined) {
          sqlQuery += \` LIMIT \${limit}\`;
        }
        
        // Add OFFSET if specified
        if (offset !== undefined) {
          sqlQuery += \` OFFSET \${offset}\`;
        }
        
        // Execute the query
        const results = await dbUtils.executeRaw(sqlQuery, queryParams);
        
        return {
          query: sqlQuery,
          parameters: queryParams,
          results,
          rowCount: results.length
        };
      }
    `,
    accessLevel: 'public',
    tags: ['database', 'sql', 'query-builder']
  });
  
  console.log('AI Agent SQL execution functions registered successfully');
}