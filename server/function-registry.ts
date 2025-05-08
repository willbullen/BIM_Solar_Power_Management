import { db } from "./db";
import * as schema from "@shared/schema";
import { AgentService } from "./agent-service";
import { AIService } from "./ai-service";

/**
 * The FunctionRegistry class manages the registration, validation, and execution
 * of agent functions with proper type checking and security controls.
 */
export class FunctionRegistry {
  private aiService: AIService;
  
  constructor(aiService: AIService) {
    this.aiService = aiService;
  }
  
  /**
   * Register a new function in the agent function registry
   */
  async registerFunction(
    functionData: Omit<schema.InsertAgentFunction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<schema.AgentFunction> {
    // Check if a function with this name already exists
    const existingFunction = await db.query.agentFunctions.findFirst({
      where: (fields, { eq }) => eq(fields.name, functionData.name)
    });
    
    if (existingFunction) {
      throw new Error(`Function with name '${functionData.name}' already exists`);
    }
    
    // Validate function code for security issues
    this.validateFunctionCode(functionData.functionCode);
    
    // Insert the function into the database
    const [newFunction] = await db.insert(schema.agentFunctions)
      .values(functionData)
      .returning();
      
    return newFunction;
  }
  
  /**
   * Get a function by name
   */
  async getFunction(name: string): Promise<schema.AgentFunction | null> {
    return db.query.agentFunctions.findFirst({
      where: (fields, { eq }) => eq(fields.name, name)
    });
  }
  
  /**
   * Get all available functions filtered by access level
   */
  async getAvailableFunctions(accessLevel: string = 'public'): Promise<schema.AgentFunction[]> {
    const functions = await db.query.agentFunctions.findMany({
      where: (fields, { eq, and, or }) => and(
        eq(fields.enabled, true),
        or(
          eq(fields.accessLevel, 'public'),
          eq(fields.accessLevel, accessLevel)
        )
      )
    });
    
    return functions;
  }
  
  /**
   * Get functions by tag
   */
  async getFunctionsByTag(tag: string, accessLevel: string = 'public'): Promise<schema.AgentFunction[]> {
    const functions = await db.query.agentFunctions.findMany({
      where: (fields, { eq, and, or, arrayContains }) => and(
        eq(fields.enabled, true),
        arrayContains(fields.tags, [tag]),
        or(
          eq(fields.accessLevel, 'public'),
          eq(fields.accessLevel, accessLevel)
        )
      )
    });
    
    return functions;
  }
  
  /**
   * Update an existing function
   */
  async updateFunction(
    name: string, 
    updates: Partial<Omit<schema.InsertAgentFunction, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<schema.AgentFunction> {
    // If function code is being updated, validate it
    if (updates.functionCode) {
      this.validateFunctionCode(updates.functionCode);
    }
    
    const [updatedFunction] = await db.update(schema.agentFunctions)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(({ name: functionName }) => functionName.eq(name))
      .returning();
      
    if (!updatedFunction) {
      throw new Error(`Function with name '${name}' not found`);
    }
    
    return updatedFunction;
  }
  
  /**
   * Disable a function (safer than deleting)
   */
  async disableFunction(name: string): Promise<schema.AgentFunction> {
    const [disabledFunction] = await db.update(schema.agentFunctions)
      .set({
        enabled: false,
        updatedAt: new Date()
      })
      .where(({ name: functionName }) => functionName.eq(name))
      .returning();
      
    if (!disabledFunction) {
      throw new Error(`Function with name '${name}' not found`);
    }
    
    return disabledFunction;
  }
  
  /**
   * Execute a function by name with the given parameters
   */
  async executeFunction(
    name: string, 
    parameters: any, 
    userRole: string = 'public'
  ): Promise<any> {
    // Get the function definition
    const functionDef = await db.query.agentFunctions.findFirst({
      where: (fields, { eq, and }) => and(
        eq(fields.name, name),
        eq(fields.enabled, true)
      )
    });
    
    if (!functionDef) {
      throw new Error(`Function '${name}' not found or not enabled`);
    }
    
    // Check access level permissions
    if (!this.checkAccessPermission(functionDef.accessLevel, userRole)) {
      throw new Error(`Access denied: Function '${name}' requires '${functionDef.accessLevel}' access level`);
    }
    
    // Execute the function in a secure context
    try {
      return await this.executeFunctionSecurely(functionDef, parameters);
    } catch (error) {
      console.error(`Error executing function '${name}':`, error);
      throw error;
    }
  }
  
  /**
   * Check if the user role has permission to access a function based on access level
   */
  private checkAccessPermission(functionAccessLevel: string, userRole: string): boolean {
    // Map roles to access levels
    const accessLevels: { [key: string]: string[] } = {
      'public': ['public', 'restricted', 'admin'],
      'restricted': ['restricted', 'admin'],
      'admin': ['admin']
    };
    
    // Map user roles to access levels
    const roleAccessLevel = userRole === 'Admin' ? 'admin' : 
                           userRole === 'Operator' ? 'restricted' : 'public';
    
    // Check if the role's access level can access the function's access level
    return accessLevels[functionAccessLevel]?.includes(roleAccessLevel) || false;
  }
  
  /**
   * Execute a function securely with proper context isolation
   */
  private async executeFunctionSecurely(
    functionDef: schema.AgentFunction, 
    parameters: any
  ): Promise<any> {
    // Create a safe execution context with limited capabilities
    const functionContext = {
      db: this.createSecureDbWrapper(functionDef.accessLevel),
      schema,
      aiService: this.aiService
    };
    
    // Construct the function from the stored code
    const func = new Function(
      'params', 
      'db', 
      'schema', 
      'aiService', 
      functionDef.functionCode
    );
    
    // Execute the function with the provided parameters and context
    return await func(
      parameters, 
      functionContext.db, 
      functionContext.schema, 
      functionContext.aiService
    );
  }
  
  /**
   * Validate function code for security issues
   * This is a basic implementation - in a production system, more thorough
   * code validation and sandbox execution would be needed
   */
  private validateFunctionCode(code: string): void {
    // Basic security checks
    const dangerousPatterns = [
      /process\.env/,
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /fs\./,
      /process\./,
      /globalThis/,
      /constructor\.constructor/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Function code contains potentially unsafe code pattern: ${pattern}`);
      }
    }
  }
  
  /**
   * Create a secure wrapper around the database to limit access based on function access level
   */
  private createSecureDbWrapper(accessLevel: string): any {
    // Create a proxy to intercept and control database access
    const secureDb = {
      query: { ...db.query },
      insert: db.insert.bind(db),
      update: db.update.bind(db),
      delete: db.delete.bind(db),
      execute: accessLevel === 'admin' ? db.execute.bind(db) : undefined
    };
    
    // For non-admin functions, remove delete capability
    if (accessLevel !== 'admin') {
      secureDb.delete = undefined;
    }
    
    // For public functions, limit write capabilities
    if (accessLevel === 'public') {
      secureDb.insert = undefined;
      secureDb.update = undefined;
    }
    
    return secureDb;
  }
  
  /**
   * Format a function definition in OpenAI function calling format
   */
  static formatForOpenAI(func: schema.AgentFunction): any {
    return {
      name: func.name,
      description: func.description,
      parameters: func.parameters
    };
  }
  
  /**
   * Format all available functions for OpenAI function calling
   */
  static async formatAllForOpenAI(registry: FunctionRegistry, accessLevel: string): Promise<any[]> {
    const functions = await registry.getAvailableFunctions(accessLevel);
    return functions.map(FunctionRegistry.formatForOpenAI);
  }
}