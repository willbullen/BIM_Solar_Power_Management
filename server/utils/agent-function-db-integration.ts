/**
 * Agent Function Database Integration
 * 
 * This module provides integration between agent functions and database utilities,
 * enabling secure database operations with permission checks.
 */

import { 
  EntityType, 
  PermissionLevel, 
  executeSecureQuery, 
  executeRawSecureQuery,
  getEntityById,
  queryEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getAggregateStats,
  executeTimeSeriesQuery
} from './agent-db-utils';
import { SQL, eq, and, sql } from 'drizzle-orm';
import * as schema from '../../shared/schema';
import { db } from '../db';
import { ApiError } from '../utils';

/**
 * Function parameter schema definition
 */
export interface FunctionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Function registration schema
 */
export interface FunctionRegistration {
  name: string;
  description: string;
  parameters: FunctionParameter[];
  requiredPermissionLevel: PermissionLevel;
  requiredEntityType: EntityType;
  execute: (params: any, userRole: string) => Promise<any>;
}

/**
 * Create a query builder function for a specific entity
 * @param entityType The entity type to query
 * @returns A function that builds a query for the entity
 */
function createQueryBuilder(entityType: EntityType) {
  return async (
    userRole: string, 
    filters: Record<string, unknown> = {}, 
    limit: number = 100, 
    offset: number = 0
  ) => {
    return await queryEntities(userRole, entityType, filters, limit, offset);
  };
}

/**
 * Create a get by ID function for a specific entity
 * @param entityType The entity type to get
 * @returns A function that gets an entity by ID
 */
function createGetByIdFunction(entityType: EntityType) {
  return async (userRole: string, id: number) => {
    return await getEntityById(userRole, entityType, id);
  };
}

/**
 * Create a create function for a specific entity
 * @param entityType The entity type to create
 * @returns A function that creates an entity
 */
function createCreateFunction(entityType: EntityType) {
  return async (userRole: string, data: Record<string, unknown>) => {
    return await createEntity(userRole, entityType, data);
  };
}

/**
 * Create an update function for a specific entity
 * @param entityType The entity type to update
 * @returns A function that updates an entity
 */
function createUpdateFunction(entityType: EntityType) {
  return async (userRole: string, id: number, data: Record<string, unknown>) => {
    return await updateEntity(userRole, entityType, id, data);
  };
}

/**
 * Create a delete function for a specific entity
 * @param entityType The entity type to delete
 * @returns A function that deletes an entity
 */
function createDeleteFunction(entityType: EntityType) {
  return async (userRole: string, id: number) => {
    return await deleteEntity(userRole, entityType, id);
  };
}

/**
 * Create a stats function for a specific entity
 * @param entityType The entity type to get stats for
 * @returns A function that gets stats for an entity
 */
function createStatsFunction(entityType: EntityType) {
  return async (
    userRole: string, 
    aggregationColumn: string, 
    aggregationType: 'count' | 'sum' | 'avg' | 'min' | 'max', 
    filters: Record<string, unknown> = {}
  ) => {
    return await getAggregateStats(userRole, entityType, aggregationColumn, aggregationType, filters);
  };
}

/**
 * Create a time series function for a specific entity
 * @param entityType The entity type to get time series data for
 * @returns A function that gets time series data for an entity
 */
function createTimeSeriesFunction(entityType: EntityType) {
  return async (
    userRole: string, 
    timeColumn: string, 
    valueColumn: string, 
    interval: 'hour' | 'day' | 'week' | 'month', 
    startTime: Date, 
    endTime: Date, 
    filters: Record<string, unknown> = {}
  ) => {
    return await executeTimeSeriesQuery(
      userRole, 
      entityType, 
      timeColumn, 
      valueColumn, 
      interval, 
      startTime, 
      endTime, 
      filters
    );
  };
}

// Define common database function types
export const dbFunctionTypes = {
  QUERY: 'query',
  GET_BY_ID: 'getById',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  STATS: 'stats',
  TIME_SERIES: 'timeSeries'
};

// Build the database function registry
export const databaseFunctionRegistry: Record<string, FunctionRegistration> = {
  // Power Data Functions
  'queryPowerData': {
    name: 'queryPowerData',
    description: 'Query power data with optional filters',
    parameters: [
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for power data',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of records to return',
        required: false,
        default: 100
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of records to skip',
        required: false,
        default: 0
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.POWER_DATA,
    execute: async (params, userRole) => {
      const { filters = {}, limit = 100, offset = 0 } = params;
      return await createQueryBuilder(EntityType.POWER_DATA)(userRole, filters, limit, offset);
    }
  },
  'getPowerDataById': {
    name: 'getPowerDataById',
    description: 'Get power data by ID',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the power data record',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.POWER_DATA,
    execute: async (params, userRole) => {
      return await createGetByIdFunction(EntityType.POWER_DATA)(userRole, params.id);
    }
  },
  'getPowerDataStats': {
    name: 'getPowerDataStats',
    description: 'Get power data statistics',
    parameters: [
      {
        name: 'aggregationColumn',
        type: 'string',
        description: 'Column to aggregate',
        required: true
      },
      {
        name: 'aggregationType',
        type: 'string',
        description: 'Type of aggregation (count, sum, avg, min, max)',
        required: true
      },
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for power data',
        required: false,
        default: {}
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.POWER_DATA,
    execute: async (params, userRole) => {
      const { aggregationColumn, aggregationType, filters = {} } = params;
      return await createStatsFunction(EntityType.POWER_DATA)(
        userRole, 
        aggregationColumn, 
        aggregationType as 'count' | 'sum' | 'avg' | 'min' | 'max', 
        filters
      );
    }
  },
  'getPowerDataTimeSeries': {
    name: 'getPowerDataTimeSeries',
    description: 'Get power data time series',
    parameters: [
      {
        name: 'valueColumn',
        type: 'string',
        description: 'Column containing the value to analyze',
        required: true
      },
      {
        name: 'interval',
        type: 'string',
        description: 'Time interval (hour, day, week, month)',
        required: true
      },
      {
        name: 'startTime',
        type: 'string',
        description: 'Start time for the query (ISO format)',
        required: true
      },
      {
        name: 'endTime',
        type: 'string',
        description: 'End time for the query (ISO format)',
        required: true
      },
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for power data',
        required: false,
        default: {}
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.POWER_DATA,
    execute: async (params, userRole) => {
      const { valueColumn, interval, startTime, endTime, filters = {} } = params;
      return await createTimeSeriesFunction(EntityType.POWER_DATA)(
        userRole,
        'timestamp',
        valueColumn,
        interval as 'hour' | 'day' | 'week' | 'month',
        new Date(startTime),
        new Date(endTime),
        filters
      );
    }
  },

  // Environmental Data Functions
  'queryEnvironmentalData': {
    name: 'queryEnvironmentalData',
    description: 'Query environmental data with optional filters',
    parameters: [
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for environmental data',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of records to return',
        required: false,
        default: 100
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of records to skip',
        required: false,
        default: 0
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.ENVIRONMENTAL_DATA,
    execute: async (params, userRole) => {
      const { filters = {}, limit = 100, offset = 0 } = params;
      return await createQueryBuilder(EntityType.ENVIRONMENTAL_DATA)(userRole, filters, limit, offset);
    }
  },
  'getEnvironmentalDataById': {
    name: 'getEnvironmentalDataById',
    description: 'Get environmental data by ID',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the environmental data record',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.ENVIRONMENTAL_DATA,
    execute: async (params, userRole) => {
      return await createGetByIdFunction(EntityType.ENVIRONMENTAL_DATA)(userRole, params.id);
    }
  },
  'getEnvironmentalDataStats': {
    name: 'getEnvironmentalDataStats',
    description: 'Get environmental data statistics',
    parameters: [
      {
        name: 'aggregationColumn',
        type: 'string',
        description: 'Column to aggregate',
        required: true
      },
      {
        name: 'aggregationType',
        type: 'string',
        description: 'Type of aggregation (count, sum, avg, min, max)',
        required: true
      },
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for environmental data',
        required: false,
        default: {}
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.ENVIRONMENTAL_DATA,
    execute: async (params, userRole) => {
      const { aggregationColumn, aggregationType, filters = {} } = params;
      return await createStatsFunction(EntityType.ENVIRONMENTAL_DATA)(
        userRole, 
        aggregationColumn, 
        aggregationType as 'count' | 'sum' | 'avg' | 'min' | 'max', 
        filters
      );
    }
  },
  'getEnvironmentalDataTimeSeries': {
    name: 'getEnvironmentalDataTimeSeries',
    description: 'Get environmental data time series',
    parameters: [
      {
        name: 'valueColumn',
        type: 'string',
        description: 'Column containing the value to analyze',
        required: true
      },
      {
        name: 'interval',
        type: 'string',
        description: 'Time interval (hour, day, week, month)',
        required: true
      },
      {
        name: 'startTime',
        type: 'string',
        description: 'Start time for the query (ISO format)',
        required: true
      },
      {
        name: 'endTime',
        type: 'string',
        description: 'End time for the query (ISO format)',
        required: true
      },
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for environmental data',
        required: false,
        default: {}
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.ENVIRONMENTAL_DATA,
    execute: async (params, userRole) => {
      const { valueColumn, interval, startTime, endTime, filters = {} } = params;
      return await createTimeSeriesFunction(EntityType.ENVIRONMENTAL_DATA)(
        userRole,
        'timestamp',
        valueColumn,
        interval as 'hour' | 'day' | 'week' | 'month',
        new Date(startTime),
        new Date(endTime),
        filters
      );
    }
  },

  // Equipment Functions
  'queryEquipment': {
    name: 'queryEquipment',
    description: 'Query equipment data with optional filters',
    parameters: [
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for equipment data',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of records to return',
        required: false,
        default: 100
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of records to skip',
        required: false,
        default: 0
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.EQUIPMENT,
    execute: async (params, userRole) => {
      const { filters = {}, limit = 100, offset = 0 } = params;
      return await createQueryBuilder(EntityType.EQUIPMENT)(userRole, filters, limit, offset);
    }
  },
  'getEquipmentById': {
    name: 'getEquipmentById',
    description: 'Get equipment by ID',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the equipment record',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.EQUIPMENT,
    execute: async (params, userRole) => {
      return await createGetByIdFunction(EntityType.EQUIPMENT)(userRole, params.id);
    }
  },
  'updateEquipment': {
    name: 'updateEquipment',
    description: 'Update equipment data',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the equipment to update',
        required: true
      },
      {
        name: 'data',
        type: 'object',
        description: 'Equipment data to update',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.EQUIPMENT,
    execute: async (params, userRole) => {
      const { id, data } = params;
      return await createUpdateFunction(EntityType.EQUIPMENT)(userRole, id, data);
    }
  },
  'createEquipment': {
    name: 'createEquipment',
    description: 'Create new equipment',
    parameters: [
      {
        name: 'data',
        type: 'object',
        description: 'Equipment data to create',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.EQUIPMENT,
    execute: async (params, userRole) => {
      const { data } = params;
      return await createCreateFunction(EntityType.EQUIPMENT)(userRole, data);
    }
  },

  // Settings Functions
  'getSettings': {
    name: 'getSettings',
    description: 'Get system settings',
    parameters: [],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.SETTINGS,
    execute: async (params, userRole) => {
      // Get the first settings record (there should be only one)
      const settings = await createQueryBuilder(EntityType.SETTINGS)(userRole, {}, 1, 0);
      return settings[0] || null;
    }
  },
  'updateSettings': {
    name: 'updateSettings',
    description: 'Update system settings',
    parameters: [
      {
        name: 'data',
        type: 'object',
        description: 'Settings data to update',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.SETTINGS,
    execute: async (params, userRole) => {
      const { data } = params;
      // Get the settings ID first (there should be only one record)
      const settings = await createQueryBuilder(EntityType.SETTINGS)(userRole, {}, 1, 0);
      
      if (!settings || settings.length === 0) {
        throw new ApiError(404, 'Settings not found');
      }
      
      return await createUpdateFunction(EntityType.SETTINGS)(userRole, settings[0].id, data);
    }
  },
  
  // Agent Task Functions
  'getTasks': {
    name: 'getTasks',
    description: 'Get agent tasks with optional filters',
    parameters: [
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for tasks',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of records to return',
        required: false,
        default: 100
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of records to skip',
        required: false,
        default: 0
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.AGENT_TASK,
    execute: async (params, userRole) => {
      const { filters = {}, limit = 100, offset = 0 } = params;
      return await createQueryBuilder(EntityType.AGENT_TASK)(userRole, filters, limit, offset);
    }
  },
  'getTaskById': {
    name: 'getTaskById',
    description: 'Get task by ID',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the task',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.AGENT_TASK,
    execute: async (params, userRole) => {
      return await createGetByIdFunction(EntityType.AGENT_TASK)(userRole, params.id);
    }
  },
  'createTask': {
    name: 'createTask',
    description: 'Create a new agent task',
    parameters: [
      {
        name: 'data',
        type: 'object',
        description: 'Task data to create',
        required: true
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.AGENT_TASK,
    execute: async (params, userRole) => {
      const { data } = params;
      // Add created and updated timestamps
      const taskData = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return await createCreateFunction(EntityType.AGENT_TASK)(userRole, taskData);
    }
  },
  'updateTaskStatus': {
    name: 'updateTaskStatus',
    description: 'Update the status of an agent task',
    parameters: [
      {
        name: 'id',
        type: 'number',
        description: 'ID of the task to update',
        required: true
      },
      {
        name: 'status',
        type: 'string',
        description: 'New status for the task',
        required: true
      },
      {
        name: 'result',
        type: 'object',
        description: 'Result data for the task',
        required: false
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.AGENT_TASK,
    execute: async (params, userRole) => {
      const { id, status, result } = params;
      
      // Prepare update data
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date()
      };
      
      // Add result if provided
      if (result) {
        updateData.result = result;
      }
      
      return await createUpdateFunction(EntityType.AGENT_TASK)(userRole, id, updateData);
    }
  },
  
  // Signal Notification Functions
  'createNotification': {
    name: 'createNotification',
    description: 'Create a new signal notification',
    parameters: [
      {
        name: 'recipient',
        type: 'string',
        description: 'Recipient of the notification',
        required: true
      },
      {
        name: 'message',
        type: 'string',
        description: 'Notification message',
        required: true
      },
      {
        name: 'type',
        type: 'string',
        description: 'Notification type (alert, info, warning)',
        required: false,
        default: 'info'
      }
    ],
    requiredPermissionLevel: PermissionLevel.WRITE,
    requiredEntityType: EntityType.SIGNAL_NOTIFICATION,
    execute: async (params, userRole) => {
      const { recipient, message, type = 'info' } = params;
      
      // Create notification data
      const notificationData = {
        recipient,
        message,
        type,
        sentAt: new Date(),
        status: 'pending'
      };
      
      return await createCreateFunction(EntityType.SIGNAL_NOTIFICATION)(userRole, notificationData);
    }
  },
  'getNotifications': {
    name: 'getNotifications',
    description: 'Get signal notifications with optional filters',
    parameters: [
      {
        name: 'filters',
        type: 'object',
        description: 'Filter criteria for notifications',
        required: false
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Maximum number of records to return',
        required: false,
        default: 100
      },
      {
        name: 'offset',
        type: 'number',
        description: 'Number of records to skip',
        required: false,
        default: 0
      }
    ],
    requiredPermissionLevel: PermissionLevel.READ,
    requiredEntityType: EntityType.SIGNAL_NOTIFICATION,
    execute: async (params, userRole) => {
      const { filters = {}, limit = 100, offset = 0 } = params;
      return await createQueryBuilder(EntityType.SIGNAL_NOTIFICATION)(userRole, filters, limit, offset);
    }
  }
};

/**
 * Get a database function by name
 * @param functionName The name of the function to get
 * @returns The function registration if found, null otherwise
 */
export function getDatabaseFunction(functionName: string): FunctionRegistration | null {
  return databaseFunctionRegistry[functionName] || null;
}

/**
 * Execute a database function by name
 * @param functionName The name of the function to execute
 * @param params The parameters to pass to the function
 * @param userRole The role of the user executing the function
 * @returns The result of the function execution
 */
export async function executeDatabaseFunction(
  functionName: string, 
  params: any, 
  userRole: string = 'user'
): Promise<any> {
  const functionReg = getDatabaseFunction(functionName);
  
  if (!functionReg) {
    throw new ApiError(404, `Function '${functionName}' not found`);
  }
  
  // Check if the user has permission to execute this function
  if (!hasPermission(userRole, functionReg.requiredEntityType, functionReg.requiredPermissionLevel)) {
    throw new ApiError(403, `Permission denied for ${userRole} to execute function '${functionName}'`);
  }
  
  try {
    // Execute the function with the provided parameters
    return await functionReg.execute(params, userRole);
  } catch (error) {
    console.error(`Error executing function '${functionName}':`, error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Error executing function '${functionName}': ${error.message}`);
  }
}