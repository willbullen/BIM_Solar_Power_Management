/**
 * Agent Database Utilities
 * 
 * This module provides secure database access utilities for the AI agent
 * with parameterized query support and permission control.
 */

import { db, pool } from '../db';
import { SQL, sql } from 'drizzle-orm';
import { QueryResult } from 'pg';
import * as schema from '../../shared/schema';
import { ApiError } from '../utils';

/**
 * Permission level enum for database operations
 */
export enum PermissionLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

/**
 * Database entity types that can be accessed
 */
export enum EntityType {
  POWER_DATA = 'power_data',
  ENVIRONMENTAL_DATA = 'environmental_data',
  EQUIPMENT = 'equipment',
  SETTINGS = 'settings',
  USER = 'user',
  AGENT_CONVERSATION = 'agent_conversation',
  AGENT_MESSAGE = 'agent_message',
  AGENT_TASK = 'agent_task',
  AGENT_FUNCTION = 'agent_function',
  AGENT_SETTING = 'agent_setting',
  SIGNAL_NOTIFICATION = 'signal_notification',
  ISSUE = 'issue',
  COMMENT = 'comment'
}

/**
 * Table mapping for entity types
 */
const entityTableMap = {
  [EntityType.POWER_DATA]: schema.powerData,
  [EntityType.ENVIRONMENTAL_DATA]: schema.environmentalData,
  [EntityType.EQUIPMENT]: schema.equipment,
  [EntityType.SETTINGS]: schema.settings,
  [EntityType.USER]: schema.user,
  [EntityType.AGENT_CONVERSATION]: schema.agentConversations,
  [EntityType.AGENT_MESSAGE]: schema.agentMessages,
  [EntityType.AGENT_TASK]: schema.agentTasks,
  [EntityType.AGENT_FUNCTION]: schema.agentFunctions,
  [EntityType.AGENT_SETTING]: schema.agentSettings,
  [EntityType.SIGNAL_NOTIFICATION]: schema.signalNotifications,
  [EntityType.ISSUE]: schema.issues,
  [EntityType.COMMENT]: schema.comments
};

/**
 * Permission check for database operations
 * @param userRole - The role of the user
 * @param entityType - The type of entity being accessed
 * @param permissionLevel - The permission level required
 * @returns True if the user has permission, false otherwise
 */
export function hasPermission(
  userRole: string,
  entityType: EntityType,
  permissionLevel: PermissionLevel
): boolean {
  // Admin has all permissions
  if (userRole === 'admin') {
    return true;
  }

  // Default permissions for different roles
  const permissionMatrix: Record<string, Record<EntityType, PermissionLevel[]>> = {
    // User role permissions
    'user': {
      [EntityType.POWER_DATA]: [PermissionLevel.READ],
      [EntityType.ENVIRONMENTAL_DATA]: [PermissionLevel.READ],
      [EntityType.EQUIPMENT]: [PermissionLevel.READ],
      [EntityType.SETTINGS]: [PermissionLevel.READ],
      [EntityType.USER]: [PermissionLevel.READ],
      [EntityType.AGENT_CONVERSATION]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_MESSAGE]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_TASK]: [PermissionLevel.READ],
      [EntityType.AGENT_FUNCTION]: [PermissionLevel.READ],
      [EntityType.AGENT_SETTING]: [PermissionLevel.READ],
      [EntityType.SIGNAL_NOTIFICATION]: [PermissionLevel.READ],
      [EntityType.ISSUE]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.COMMENT]: [PermissionLevel.READ, PermissionLevel.WRITE]
    },
    // Operator role permissions
    'operator': {
      [EntityType.POWER_DATA]: [PermissionLevel.READ],
      [EntityType.ENVIRONMENTAL_DATA]: [PermissionLevel.READ],
      [EntityType.EQUIPMENT]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.SETTINGS]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.USER]: [PermissionLevel.READ],
      [EntityType.AGENT_CONVERSATION]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_MESSAGE]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_TASK]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_FUNCTION]: [PermissionLevel.READ],
      [EntityType.AGENT_SETTING]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.SIGNAL_NOTIFICATION]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.ISSUE]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.COMMENT]: [PermissionLevel.READ, PermissionLevel.WRITE]
    },
    // Manager role permissions
    'manager': {
      [EntityType.POWER_DATA]: [PermissionLevel.READ],
      [EntityType.ENVIRONMENTAL_DATA]: [PermissionLevel.READ],
      [EntityType.EQUIPMENT]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.SETTINGS]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.USER]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_CONVERSATION]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_MESSAGE]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_TASK]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.AGENT_FUNCTION]: [PermissionLevel.READ],
      [EntityType.AGENT_SETTING]: [PermissionLevel.READ, PermissionLevel.WRITE],
      [EntityType.SIGNAL_NOTIFICATION]: [PermissionLevel.READ, PermissionLevel.WRITE, PermissionLevel.ADMIN],
      [EntityType.ISSUE]: [PermissionLevel.READ, PermissionLevel.WRITE, PermissionLevel.ADMIN],
      [EntityType.COMMENT]: [PermissionLevel.READ, PermissionLevel.WRITE, PermissionLevel.ADMIN]
    }
  };

  // Get the permissions for this role and entity
  const rolePermissions = permissionMatrix[userRole]?.[entityType] || [];
  
  // Check if the requested permission level is included
  return rolePermissions.includes(permissionLevel);
}

/**
 * Execute a parameterized query with permission checks
 * @param userRole - The role of the user
 * @param entityType - The type of entity being accessed
 * @param permissionLevel - The permission level required
 * @param query - The SQL query to execute
 * @param params - The query parameters
 * @returns The query result
 */
export async function executeSecureQuery<T>(
  userRole: string,
  entityType: EntityType,
  permissionLevel: PermissionLevel,
  query: SQL<T>,
): Promise<T> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, permissionLevel)) {
    throw new ApiError(403, `Permission denied for ${userRole} to ${permissionLevel} ${entityType}`);
  }

  try {
    // Execute the query using Drizzle
    return await db.execute(query);
  } catch (error) {
    console.error('Database query error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Execute a raw parameterized query with permission checks
 * @param userRole - The role of the user
 * @param entityType - The type of entity being accessed
 * @param permissionLevel - The permission level required
 * @param queryText - The raw SQL query text
 * @param params - The query parameters
 * @returns The query result
 */
export async function executeRawSecureQuery<T extends Record<string, unknown>>(
  userRole: string,
  entityType: EntityType,
  permissionLevel: PermissionLevel,
  queryText: string,
  params: unknown[] = []
): Promise<T[]> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, permissionLevel)) {
    throw new ApiError(403, `Permission denied for ${userRole} to ${permissionLevel} ${entityType}`);
  }

  try {
    // Execute the query using pg client
    const result = await pool.query<T>(queryText, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Get entity by ID with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity being accessed
 * @param id - The entity ID
 * @returns The entity if found
 */
export async function getEntityById<T>(
  userRole: string,
  entityType: EntityType,
  id: number
): Promise<T> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.READ)) {
    throw new ApiError(403, `Permission denied for ${userRole} to read ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    const query = sql`SELECT * FROM ${table} WHERE id = ${id}`;
    const result = await db.execute(query);
    
    if (!result || result.length === 0) {
      throw new ApiError(404, `${entityType} with ID ${id} not found`);
    }
    
    return result[0] as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Database query error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Query entities with filters and permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity being accessed
 * @param filters - Object containing column/value pairs for filtering
 * @param limit - Maximum number of results to return
 * @param offset - Offset for pagination
 * @returns Array of entity objects
 */
export async function queryEntities<T>(
  userRole: string,
  entityType: EntityType,
  filters: Record<string, unknown> = {},
  limit: number = 100,
  offset: number = 0
): Promise<T[]> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.READ)) {
    throw new ApiError(403, `Permission denied for ${userRole} to read ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    // Build query conditions from filters
    let conditions = sql`1=1`;
    
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions = sql`${conditions} AND ${sql.identifier(key)} = ${value}`;
      }
    }
    
    // Execute query with conditions, limit and offset
    const query = sql`
      SELECT * FROM ${table}
      WHERE ${conditions}
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await db.execute(query);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Create a new entity with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity being created
 * @param data - The entity data to insert
 * @returns The created entity
 */
export async function createEntity<T extends Record<string, unknown>>(
  userRole: string,
  entityType: EntityType,
  data: Omit<T, 'id'>
): Promise<T> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.WRITE)) {
    throw new ApiError(403, `Permission denied for ${userRole} to write ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    // Construct column names and values
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    // Create placeholders for the values
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // Construct the query
    const queryText = `
      INSERT INTO ${table._.name} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    // Execute the query
    const result = await pool.query<T>(queryText, values);
    
    if (result.rows.length === 0) {
      throw new ApiError(500, `Failed to create ${entityType}`);
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Database insert error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Update an entity with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity being updated
 * @param id - The ID of the entity to update
 * @param data - The entity data to update
 * @returns The updated entity
 */
export async function updateEntity<T extends Record<string, unknown>>(
  userRole: string,
  entityType: EntityType,
  id: number,
  data: Partial<Omit<T, 'id'>>
): Promise<T> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.WRITE)) {
    throw new ApiError(403, `Permission denied for ${userRole} to write ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    // Construct SET part of the query
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    if (columns.length === 0) {
      throw new ApiError(400, 'No update data provided');
    }
    
    // Create the SET clause with placeholders
    const setClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
    
    // Construct the query
    const queryText = `
      UPDATE ${table._.name}
      SET ${setClauses}
      WHERE id = $${values.length + 1}
      RETURNING *
    `;
    
    // Add the ID to the values array
    values.push(id);
    
    // Execute the query
    const result = await pool.query<T>(queryText, values);
    
    if (result.rows.length === 0) {
      throw new ApiError(404, `${entityType} with ID ${id} not found`);
    }
    
    return result.rows[0];
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Database update error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Delete an entity with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity being deleted
 * @param id - The ID of the entity to delete
 * @returns True if the entity was deleted
 */
export async function deleteEntity(
  userRole: string,
  entityType: EntityType,
  id: number
): Promise<boolean> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.ADMIN)) {
    throw new ApiError(403, `Permission denied for ${userRole} to delete ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    // Construct the query
    const queryText = `
      DELETE FROM ${table._.name}
      WHERE id = $1
      RETURNING id
    `;
    
    // Execute the query
    const result = await pool.query(queryText, [id]);
    
    if (result.rowCount === 0) {
      throw new ApiError(404, `${entityType} with ID ${id} not found`);
    }
    
    return true;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Database delete error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Get aggregate statistics with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity to query
 * @param aggregationColumn - The column to aggregate
 * @param aggregationType - The type of aggregation (count, sum, avg, min, max)
 * @param filters - Object containing column/value pairs for filtering
 * @returns The aggregation result
 */
export async function getAggregateStats(
  userRole: string,
  entityType: EntityType,
  aggregationColumn: string,
  aggregationType: 'count' | 'sum' | 'avg' | 'min' | 'max',
  filters: Record<string, unknown> = {}
): Promise<number> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.READ)) {
    throw new ApiError(403, `Permission denied for ${userRole} to read ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  try {
    // Build query conditions from filters
    let conditions = sql`1=1`;
    
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions = sql`${conditions} AND ${sql.identifier(key)} = ${value}`;
      }
    }
    
    // Select the appropriate aggregation function
    let aggregationFunction;
    switch (aggregationType) {
      case 'count':
        aggregationFunction = sql`COUNT(${sql.identifier(aggregationColumn)})`;
        break;
      case 'sum':
        aggregationFunction = sql`SUM(${sql.identifier(aggregationColumn)})`;
        break;
      case 'avg':
        aggregationFunction = sql`AVG(${sql.identifier(aggregationColumn)})`;
        break;
      case 'min':
        aggregationFunction = sql`MIN(${sql.identifier(aggregationColumn)})`;
        break;
      case 'max':
        aggregationFunction = sql`MAX(${sql.identifier(aggregationColumn)})`;
        break;
      default:
        throw new ApiError(400, `Invalid aggregation type: ${aggregationType}`);
    }
    
    // Execute query with conditions and aggregation
    const query = sql`
      SELECT ${aggregationFunction} as result
      FROM ${table}
      WHERE ${conditions}
    `;
    
    const result = await db.execute(query);
    return Number(result[0]?.result) || 0;
  } catch (error) {
    console.error('Database aggregation error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}

/**
 * Execute a time series query with permission check
 * @param userRole - The role of the user
 * @param entityType - The type of entity to query
 * @param timeColumn - The column containing the timestamp
 * @param valueColumn - The column containing the value to aggregate
 * @param interval - The time interval for grouping (hour, day, week, month)
 * @param startTime - The start time for the query
 * @param endTime - The end time for the query
 * @param filters - Object containing column/value pairs for filtering
 * @returns The time series data
 */
export async function executeTimeSeriesQuery(
  userRole: string,
  entityType: EntityType,
  timeColumn: string,
  valueColumn: string,
  interval: 'hour' | 'day' | 'week' | 'month',
  startTime: Date,
  endTime: Date,
  filters: Record<string, unknown> = {}
): Promise<Array<{ time: Date, value: number }>> {
  // Check if the user has permission
  if (!hasPermission(userRole, entityType, PermissionLevel.READ)) {
    throw new ApiError(403, `Permission denied for ${userRole} to read ${entityType}`);
  }

  const table = entityTableMap[entityType];
  if (!table) {
    throw new ApiError(400, `Invalid entity type: ${entityType}`);
  }

  // Map interval to PostgreSQL interval
  let intervalSql;
  switch (interval) {
    case 'hour':
      intervalSql = sql`1 hour`;
      break;
    case 'day':
      intervalSql = sql`1 day`;
      break;
    case 'week':
      intervalSql = sql`1 week`;
      break;
    case 'month':
      intervalSql = sql`1 month`;
      break;
    default:
      throw new ApiError(400, `Invalid interval: ${interval}`);
  }

  try {
    // Build query conditions from filters
    let conditions = sql`1=1`;
    
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions = sql`${conditions} AND ${sql.identifier(key)} = ${value}`;
      }
    }
    
    // Add time range condition
    conditions = sql`${conditions} AND ${sql.identifier(timeColumn)} >= ${startTime} AND ${sql.identifier(timeColumn)} <= ${endTime}`;
    
    // Execute query with conditions, grouping by time interval
    const query = sql`
      SELECT 
        date_trunc(${interval}, ${sql.identifier(timeColumn)}) as time, 
        AVG(${sql.identifier(valueColumn)}) as value
      FROM ${table}
      WHERE ${conditions}
      GROUP BY time
      ORDER BY time ASC
    `;
    
    const result = await db.execute(query);
    return result as Array<{ time: Date, value: number }>;
  } catch (error) {
    console.error('Database time series query error:', error);
    throw new ApiError(500, `Database error: ${error.message}`);
  }
}