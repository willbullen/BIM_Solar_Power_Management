import { db } from "../db";
import { sql, SQL } from "drizzle-orm";
import * as schema from "@shared/schema";
import { DbUtils } from "./db-utils";

/**
 * Enhanced database query tools for the AI Agent
 * Provides advanced querying capabilities, data aggregation, and analysis
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
      orderBy?: { column: string; direction: "asc" | "desc" }[];
    } = {}
  ): Promise<any[]> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Build the metric expressions
    const metricExpressions = metrics.map(metric => {
      const alias = metric.alias || `${metric.function}_${metric.field}`;
      switch (metric.function) {
        case "count":
          return `COUNT("${metric.field}") AS "${alias}"`;
        case "sum":
          return `SUM("${metric.field}") AS "${alias}"`;
        case "avg":
          return `AVG("${metric.field}") AS "${alias}"`;
        case "min":
          return `MIN("${metric.field}") AS "${alias}"`;
        case "max":
          return `MAX("${metric.field}") AS "${alias}"`;
        default:
          return `COUNT("${metric.field}") AS "${alias}"`;
      }
    });
    
    // Build dimension expressions for GROUP BY
    const dimensionExpressions = dimensions.map(dim => `"${dim}"`);
    
    // Start building the query
    let query = `SELECT ${[...dimensionExpressions, ...metricExpressions].join(", ")} FROM "${validTableName}"`;
    const params: any[] = [];
    
    // Add WHERE conditions if any
    const conditions = Object.entries(filters).filter(([_, value]) => value !== undefined);
    
    if (conditions.length > 0) {
      query += " WHERE ";
      const whereClause = conditions.map(([key, _], index) => {
        params.push(conditions[index][1]);
        return `"${key}" = $${params.length}`;
      }).join(" AND ");
      query += whereClause;
    }
    
    // Add GROUP BY if dimensions provided
    if (dimensions.length > 0) {
      query += ` GROUP BY ${dimensionExpressions.join(", ")}`;
    }
    
    // Add ORDER BY if specified
    if (options.orderBy?.length) {
      query += " ORDER BY " + options.orderBy.map(order => 
        `"${order.column}" ${order.direction.toUpperCase()}`
      ).join(", ");
    }
    
    // Add LIMIT if specified
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    
    // Add OFFSET if specified
    if (options.offset !== undefined) {
      query += ` OFFSET ${options.offset}`;
    }
    
    // Execute the query
    return await DbUtils.executeRaw(query, params);
  }
  
  /**
   * Execute a time series query with date/time grouping
   * @param tableName The database table to query
   * @param timeField The timestamp field to use
   * @param timeInterval The time interval to group by (hour, day, week, month, year)
   * @param metrics The metrics to compute
   * @param filters Optional filter conditions
   * @param options Additional query options
   * @returns Time series data
   */
  static async timeSeriesAnalysis(
    tableName: string,
    timeField: string,
    timeInterval: "hour" | "day" | "week" | "month" | "year",
    metrics: Array<{
      function: "count" | "sum" | "avg" | "min" | "max";
      field: string;
      alias?: string;
    }>,
    filters: Record<string, any> = {},
    options: {
      startDate?: Date | string;
      endDate?: Date | string;
      limit?: number;
      orderBy?: "asc" | "desc";
    } = {}
  ): Promise<any[]> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Build the time interval expression
    let timeGroupExpression: string;
    switch (timeInterval) {
      case "hour":
        timeGroupExpression = `DATE_TRUNC('hour', "${timeField}")`;
        break;
      case "day":
        timeGroupExpression = `DATE_TRUNC('day', "${timeField}")`;
        break;
      case "week":
        timeGroupExpression = `DATE_TRUNC('week', "${timeField}")`;
        break;
      case "month":
        timeGroupExpression = `DATE_TRUNC('month', "${timeField}")`;
        break;
      case "year":
        timeGroupExpression = `DATE_TRUNC('year', "${timeField}")`;
        break;
      default:
        timeGroupExpression = `DATE_TRUNC('day', "${timeField}")`;
    }
    
    // Build metric expressions
    const metricExpressions = metrics.map(metric => {
      const alias = metric.alias || `${metric.function}_${metric.field}`;
      switch (metric.function) {
        case "count":
          return `COUNT("${metric.field}") AS "${alias}"`;
        case "sum":
          return `SUM("${metric.field}") AS "${alias}"`;
        case "avg":
          return `AVG("${metric.field}") AS "${alias}"`;
        case "min":
          return `MIN("${metric.field}") AS "${alias}"`;
        case "max":
          return `MAX("${metric.field}") AS "${alias}"`;
        default:
          return `COUNT("${metric.field}") AS "${alias}"`;
      }
    });
    
    // Start building the query
    let query = `
      SELECT 
        ${timeGroupExpression} AS time_period,
        ${metricExpressions.join(", ")}
      FROM "${validTableName}"
    `;
    
    // Build WHERE clause for filters and date range
    const params: any[] = [];
    const whereConditions: string[] = [];
    
    // Add custom filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.push(value);
        whereConditions.push(`"${key}" = $${params.length}`);
      }
    });
    
    // Add date range filters if provided
    if (options.startDate) {
      params.push(options.startDate instanceof Date ? options.startDate : new Date(options.startDate));
      whereConditions.push(`"${timeField}" >= $${params.length}`);
    }
    
    if (options.endDate) {
      params.push(options.endDate instanceof Date ? options.endDate : new Date(options.endDate));
      whereConditions.push(`"${timeField}" <= $${params.length}`);
    }
    
    // Add WHERE clause if conditions exist
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    
    // Add GROUP BY
    query += ` GROUP BY time_period`;
    
    // Add ORDER BY
    const orderDirection = options.orderBy || "asc";
    query += ` ORDER BY time_period ${orderDirection.toUpperCase()}`;
    
    // Add LIMIT if specified
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    
    // Execute the query
    return await DbUtils.executeRaw(query, params);
  }
  
  /**
   * Calculate correlations between two or more fields in a table
   * @param tableName The database table to query
   * @param fields Array of fields to calculate correlations for
   * @param filters Optional filter conditions
   * @returns Correlation matrix
   */
  static async calculateCorrelations(
    tableName: string,
    fields: string[],
    filters: Record<string, any> = {}
  ): Promise<{ field1: string; field2: string; correlation: number }[]> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Need at least 2 fields
    if (fields.length < 2) {
      throw new Error("At least 2 fields are required to calculate correlations");
    }
    
    // Create result array to store correlations
    const results: { field1: string; field2: string; correlation: number }[] = [];
    
    // For each pair of fields, calculate correlation
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const field1 = fields[i];
        const field2 = fields[j];
        
        // Build the query using PostgreSQL's CORR function
        let query = `
          SELECT CORR("${field1}", "${field2}") AS correlation
          FROM "${validTableName}"
        `;
        
        // Add filters if any
        const params: any[] = [];
        const conditions = Object.entries(filters).filter(([_, value]) => value !== undefined);
        
        if (conditions.length > 0) {
          query += " WHERE ";
          const whereClause = conditions.map(([key, _], index) => {
            params.push(conditions[index][1]);
            return `"${key}" = $${params.length}`;
          }).join(" AND ");
          query += whereClause;
        }
        
        // Execute the query
        const result = await DbUtils.executeRaw<{ correlation: number }>(query, params);
        
        // Add to results if correlation is not null
        if (result[0] && result[0].correlation !== null) {
          results.push({
            field1,
            field2,
            correlation: result[0].correlation
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Detect anomalies in a time series using z-scores
   * @param tableName The database table to query
   * @param timeField The timestamp field
   * @param valueField The numeric field to analyze
   * @param threshold Z-score threshold for anomaly detection (default 2.0)
   * @param filters Optional filter conditions
   * @param options Additional query options
   * @returns Records with anomaly scores
   */
  static async detectAnomalies(
    tableName: string,
    timeField: string,
    valueField: string,
    threshold: number = 2.0,
    filters: Record<string, any> = {},
    options: {
      startDate?: Date | string;
      endDate?: Date | string;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Build the query using window functions
    let query = `
      WITH stats AS (
        SELECT 
          AVG("${valueField}") AS mean, 
          STDDEV("${valueField}") AS stddev
        FROM "${validTableName}"
    `;
    
    // Add filtering for the stats calculation
    const params: any[] = [];
    const whereConditions: string[] = [];
    
    // Add custom filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.push(value);
        whereConditions.push(`"${key}" = $${params.length}`);
      }
    });
    
    // Add date range filters if provided
    if (options.startDate) {
      params.push(options.startDate instanceof Date ? options.startDate : new Date(options.startDate));
      whereConditions.push(`"${timeField}" >= $${params.length}`);
    }
    
    if (options.endDate) {
      params.push(options.endDate instanceof Date ? options.endDate : new Date(options.endDate));
      whereConditions.push(`"${timeField}" <= $${params.length}`);
    }
    
    // Add WHERE clause to stats CTE if conditions exist
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    
    // Complete the query with z-score calculation
    query += `
      )
      SELECT 
        *,
        ("${valueField}" - stats.mean) / NULLIF(stats.stddev, 0) AS z_score,
        ABS(("${valueField}" - stats.mean) / NULLIF(stats.stddev, 0)) > ${threshold} AS is_anomaly
      FROM "${validTableName}", stats
    `;
    
    // Add the same WHERE conditions to the main query
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    
    // Add ORDER BY for the results
    query += ` ORDER BY ABS(("${valueField}" - stats.mean) / NULLIF(stats.stddev, 0)) DESC`;
    
    // Add LIMIT if specified
    if (options.limit !== undefined) {
      query += ` LIMIT ${options.limit}`;
    }
    
    // Execute the query
    return await DbUtils.executeRaw(query, params);
  }
  
  /**
   * Calculate statistical summary for table fields
   * @param tableName The database table to analyze
   * @param fields Fields to include in the summary
   * @param filters Optional filter conditions
   * @returns Statistical summary for each field
   */
  static async calculateStatistics(
    tableName: string,
    fields: string[],
    filters: Record<string, any> = {}
  ): Promise<Record<string, any>> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Initialize the result object
    const statistics: Record<string, any> = {};
    
    // Process each field
    for (const field of fields) {
      // Build the query for statistics
      let query = `
        SELECT
          COUNT("${field}") AS count,
          AVG("${field}") AS mean,
          STDDEV("${field}") AS stddev,
          MIN("${field}") AS min,
          MAX("${field}") AS max,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "${field}") AS q1,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "${field}") AS median,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "${field}") AS q3
        FROM "${validTableName}"
      `;
      
      // Add filtering
      const params: any[] = [];
      const conditions = Object.entries(filters).filter(([_, value]) => value !== undefined);
      
      if (conditions.length > 0) {
        query += " WHERE ";
        const whereClause = conditions.map(([key, _], index) => {
          params.push(conditions[index][1]);
          return `"${key}" = $${params.length}`;
        }).join(" AND ");
        query += whereClause;
      }
      
      // Execute the query
      const result = await DbUtils.executeRaw<Record<string, any>>(query, params);
      
      // Store the statistics
      if (result.length > 0) {
        statistics[field] = result[0];
      }
    }
    
    return statistics;
  }
  
  /**
   * Get schema information for a table
   * @param tableName The database table to get schema for
   * @returns Table schema information including columns and constraints
   */
  static async getTableSchema(tableName: string): Promise<any> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Query to get column information
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM 
        information_schema.columns
      WHERE 
        table_name = $1
        AND table_schema = 'public'
      ORDER BY 
        ordinal_position
    `;
    
    // Query to get constraint information
    const constraintsQuery = `
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
      WHERE
        tc.table_name = $1
        AND tc.table_schema = 'public'
      ORDER BY
        kcu.ordinal_position
    `;
    
    // Execute the queries
    const columns = await DbUtils.executeRaw(columnsQuery, [validTableName]);
    const constraints = await DbUtils.executeRaw(constraintsQuery, [validTableName]);
    
    // Return combined schema information
    return {
      tableName: validTableName,
      columns,
      constraints
    };
  }
  
  /**
   * Get table relationship information
   * @param tableName The database table to get relationships for
   * @returns Table relationship information
   */
  static async getTableRelationships(tableName: string): Promise<any> {
    // Validate table name
    const validTableName = DbUtils.validateTableName(tableName);
    
    // Query to get foreign key relationships
    const relationshipsQuery = `
      SELECT
        tc.table_name AS table_name,
        kcu.column_name AS column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
      WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name = $1 OR ccu.table_name = $1)
        AND tc.table_schema = 'public'
    `;
    
    // Execute the query
    const relationships = await DbUtils.executeRaw(relationshipsQuery, [validTableName]);
    
    // Process the results to categorize as outgoing and incoming relationships
    const outgoingRelationships = relationships.filter(
      (rel: any) => rel.table_name === validTableName
    );
    
    const incomingRelationships = relationships.filter(
      (rel: any) => rel.referenced_table === validTableName
    );
    
    return {
      tableName: validTableName,
      outgoingRelationships,
      incomingRelationships
    };
  }
  
  /**
   * Get a list of available tables in the database
   * @returns List of table names
   */
  static async listTables(): Promise<string[]> {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    const result = await DbUtils.executeRaw<{ table_name: string }>(query, []);
    return result.map(row => row.table_name);
  }
}