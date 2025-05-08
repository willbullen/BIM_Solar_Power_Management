import { db } from "./db";
import * as schema from "@shared/schema";
import { SQL, sql, eq, and, or, like, count, desc, asc, gte, lte, between } from "drizzle-orm";

/**
 * The DatabaseAccess class provides a secure, parameterized interface for
 * accessing the database from agent functions and other components.
 * 
 * It provides safer alternatives to direct database access to prevent SQL
 * injection and enforce access controls.
 */
export class DatabaseAccess {
  /**
   * Authorized user ID for operations that require user context
   */
  private userId?: number;
  
  /**
   * User role for access control
   */
  private userRole: string;
  
  /**
   * Access level for determining database operation permissions
   */
  private accessLevel: string;
  
  constructor(userId?: number, userRole: string = 'public') {
    this.userId = userId;
    this.userRole = userRole;
    
    // Map role to access level
    this.accessLevel = userRole === 'Admin' ? 'admin' 
                     : userRole === 'Operator' ? 'restricted'
                     : 'public';
  }

  /**
   * Query for power data with optional time range and pagination
   */
  async getPowerData({
    startDate,
    endDate,
    limit = 100,
    offset = 0
  }: {
    startDate?: Date | string;
    endDate?: Date | string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.powerData);
    
    if (startDate) {
      const startDateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
      query = query.where(gte(schema.powerData.timestamp, startDateObj));
    }
    
    if (endDate) {
      const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
      query = query.where(lte(schema.powerData.timestamp, endDateObj));
    }
    
    return query.limit(limit).offset(offset).orderBy(desc(schema.powerData.timestamp));
  }
  
  /**
   * Query for environmental data with optional time range and pagination
   */
  async getEnvironmentalData({
    startDate,
    endDate,
    limit = 100,
    offset = 0
  }: {
    startDate?: Date | string;
    endDate?: Date | string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.environmentalData);
    
    if (startDate) {
      const startDateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
      query = query.where(gte(schema.environmentalData.timestamp, startDateObj));
    }
    
    if (endDate) {
      const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
      query = query.where(lte(schema.environmentalData.timestamp, endDateObj));
    }
    
    return query.limit(limit).offset(offset).orderBy(desc(schema.environmentalData.timestamp));
  }
  
  /**
   * Query for equipment data with pagination
   */
  async getEquipmentData({
    type,
    limit = 100,
    offset = 0
  }: {
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.equipment);
    
    if (type) {
      query = query.where(eq(schema.equipment.type, type));
    }
    
    return query.limit(limit).offset(offset);
  }
  
  /**
   * Query for user information, with access level restrictions
   */
  async getUsers({
    id,
    username,
    limit = 100,
    offset = 0
  }: {
    id?: number;
    username?: string;
    limit?: number;
    offset?: number;
  }) {
    // Only admin and restricted access can query users
    if (this.accessLevel === 'public') {
      throw new Error('Access denied: User query requires higher access privileges');
    }
    
    let query = db.select({
      id: schema.users.id,
      username: schema.users.username,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      // Don't include password hash
    }).from(schema.users);
    
    if (id) {
      query = query.where(eq(schema.users.id, id));
    }
    
    if (username) {
      query = query.where(eq(schema.users.username, username));
    }
    
    return query.limit(limit).offset(offset);
  }
  
  /**
   * Get issues with pagination and filtering
   */
  async getIssues({
    status,
    priority,
    assignedTo,
    createdBy,
    type,
    limit = 100,
    offset = 0
  }: {
    status?: string;
    priority?: string;
    assignedTo?: number;
    createdBy?: number;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.issues);
    
    if (status) {
      query = query.where(eq(schema.issues.status, status));
    }
    
    if (priority) {
      query = query.where(eq(schema.issues.priority, priority));
    }
    
    if (assignedTo) {
      query = query.where(eq(schema.issues.assigneeId, assignedTo));
    }
    
    if (createdBy) {
      query = query.where(eq(schema.issues.submitterId, createdBy));
    }
    
    if (type) {
      query = query.where(eq(schema.issues.type, type));
    }
    
    return query.limit(limit).offset(offset).orderBy(desc(schema.issues.createdAt));
  }
  
  /**
   * Get agent conversations with pagination and filtering
   */
  async getAgentConversations({
    userId,
    limit = 100,
    offset = 0
  }: {
    userId?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.agentConversations);
    
    if (userId) {
      query = query.where(eq(schema.agentConversations.userId, userId));
    } else if (this.userId && this.accessLevel !== 'admin') {
      // If not admin, only show user's own conversations
      query = query.where(eq(schema.agentConversations.userId, this.userId));
    }
    
    return query.limit(limit).offset(offset).orderBy(desc(schema.agentConversations.updatedAt));
  }
  
  /**
   * Get agent messages for a conversation
   */
  async getAgentMessages({
    conversationId,
    limit = 100,
    offset = 0
  }: {
    conversationId: number;
    limit?: number;
    offset?: number;
  }) {
    // First check if the user has access to this conversation
    if (this.userId && this.accessLevel !== 'admin') {
      const conversation = await db.query.agentConversations.findFirst({
        where: (fields, { eq, and }) => and(
          eq(fields.id, conversationId),
          eq(fields.userId, this.userId!)
        )
      });
      
      if (!conversation) {
        throw new Error('Access denied: This conversation does not belong to you');
      }
    }
    
    return db.select()
      .from(schema.agentMessages)
      .where(eq(schema.agentMessages.conversationId, conversationId))
      .limit(limit)
      .offset(offset)
      .orderBy(asc(schema.agentMessages.timestamp));
  }
  
  /**
   * Get agent tasks with pagination and filtering
   */
  async getAgentTasks({
    status,
    type,
    priority,
    assignedTo,
    createdBy,
    limit = 100,
    offset = 0
  }: {
    status?: string;
    type?: string;
    priority?: string;
    assignedTo?: number;
    createdBy?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = db.select().from(schema.agentTasks);
    
    // Apply filters
    if (status) {
      query = query.where(eq(schema.agentTasks.status, status));
    }
    
    if (type) {
      query = query.where(eq(schema.agentTasks.type, type));
    }
    
    if (priority) {
      query = query.where(eq(schema.agentTasks.priority, priority));
    }
    
    if (assignedTo) {
      query = query.where(eq(schema.agentTasks.assignedTo, assignedTo));
    }
    
    if (createdBy) {
      query = query.where(eq(schema.agentTasks.createdBy, createdBy));
    }
    
    // If not admin, limit to tasks related to the user
    if (this.userId && this.accessLevel !== 'admin') {
      query = query.where(
        or(
          eq(schema.agentTasks.createdBy, this.userId),
          eq(schema.agentTasks.assignedTo, this.userId)
        )
      );
    }
    
    return query.limit(limit).offset(offset).orderBy(desc(schema.agentTasks.createdAt));
  }
  
  /**
   * Get agent settings with optional category filter
   */
  async getAgentSettings(category?: string) {
    // Only admin can see all settings
    if (this.accessLevel !== 'admin') {
      throw new Error('Access denied: Viewing settings requires admin privileges');
    }
    
    let query = db.select().from(schema.agentSettings);
    
    if (category) {
      query = query.where(eq(schema.agentSettings.category, category));
    }
    
    return query;
  }
  
  /**
   * Get a count of records matching a query
   */
  async getCount<T extends { id: number }>({
    table,
    whereCondition
  }: {
    table: T;
    whereCondition?: SQL<unknown>;
  }) {
    let query = db.select({ count: count() }).from(table);
    
    if (whereCondition) {
      query = query.where(whereCondition);
    }
    
    const result = await query;
    return result[0]?.count || 0;
  }
  
  /**
   * Get statistical aggregation of power data
   */
  async getPowerDataStats({
    startDate,
    endDate,
    interval = 'day'
  }: {
    startDate: Date | string;
    endDate: Date | string;
    interval?: 'hour' | 'day' | 'week' | 'month';
  }) {
    const startDateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    // This query uses raw SQL for time-based aggregation
    // The interval parameter is validated to prevent injection
    if (!['hour', 'day', 'week', 'month'].includes(interval)) {
      throw new Error('Invalid interval. Must be one of: hour, day, week, month');
    }
    
    const intervalSql = sql.raw(interval);
    
    const result = await db.execute(sql`
      SELECT
        date_trunc(${intervalSql}, timestamp) as time_period,
        AVG(voltage) as avg_voltage,
        AVG(current) as avg_current,
        AVG(power) as avg_power,
        MAX(power) as max_power,
        MIN(power) as min_power,
        SUM(energy_delta) as total_energy
      FROM power_data
      WHERE timestamp BETWEEN ${startDateObj} AND ${endDateObj}
      GROUP BY time_period
      ORDER BY time_period
    `);
    
    return result;
  }
  
  /**
   * Execute a parameterized query for advanced data analysis
   * Only available to admin access level
   */
  async executeQuery(query: string, params: any[] = []) {
    // Only admin can execute custom queries
    if (this.accessLevel !== 'admin') {
      throw new Error('Access denied: Custom queries require admin privileges');
    }
    
    // Basic SQL injection protection - don't allow multiple statements
    if (query.includes(';') && !query.trim().endsWith(';')) {
      throw new Error('Multi-statement queries are not allowed');
    }
    
    // Disallow destructive operations
    const lowerQuery = query.toLowerCase();
    if (
      lowerQuery.includes('drop ') ||
      lowerQuery.includes('delete ') ||
      lowerQuery.includes('truncate ') ||
      lowerQuery.includes('alter ') ||
      lowerQuery.includes('create ')
    ) {
      throw new Error('Destructive database operations are not allowed through this interface');
    }
    
    // Convert params to SQL parameters
    const sqlParams = params.map(param => {
      if (param instanceof Date) {
        return param;
      }
      if (typeof param === 'number') {
        return param;
      }
      if (typeof param === 'boolean') {
        return param;
      }
      // Everything else as string
      return String(param);
    });
    
    // Execute the query with parameters
    const result = await db.execute(sql.raw(query, sqlParams));
    return result;
  }
}