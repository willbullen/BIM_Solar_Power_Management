# AI Agent Architect Technical Documentation

## Architecture Overview

The AI Agent Architect is built on a modular architecture with several key components:

1. **Agent Service**: The core service that handles conversations, function execution, and task management
2. **REST API Layer**: Endpoints for frontend communication, implementing polling with exponential backoff 
3. **Database Layer**: Schema and storage for conversations, messages, tasks, and settings
4. **Function Registry**: A flexible system for registering and executing agent functions
5. **MCP Framework**: Multi-Capability Planning system for complex task orchestration
6. **Notification Service**: Service for sending and managing notifications
7. **Security Layer**: Authentication, authorization, and data access controls

## Component Specifications

### Agent Service

The `AgentService` class is the central component that manages AI interactions. It provides methods for:

- Creating and managing conversations
- Generating AI responses
- Executing functions
- Managing tasks
- Configuring agent settings

#### Key Methods

```typescript
createConversation(userId: number, title: string): Promise<AgentConversation>
addUserMessage(conversationId: number, content: string): Promise<AgentMessage>
generateResponse(conversationId: number, userId: number, userRole: string, maxTokens?: number): Promise<AgentMessage>
executeFunction(functionName: string, parameters: any): Promise<any>
createTask(taskData: InsertAgentTask): Promise<AgentTask>
updateTaskStatus(taskId: number, status: string, result?: any): Promise<AgentTask>
getSettings(category?: string): Promise<AgentSetting[]>
updateSetting(name: string, value: string, userId?: number): Promise<AgentSetting>
```

### REST API Layer

The API layer exposes the Agent Service functionality to the frontend. Instead of WebSockets, the system uses efficient REST API endpoints with polling.

#### Key Endpoints

**Conversations**
- `GET /api/agent/conversations`: Get all conversations
- `POST /api/agent/conversations`: Create a new conversation
- `GET /api/agent/conversations/:id`: Get a specific conversation
- `GET /api/agent/conversations/:id/messages`: Get messages for a conversation
- `POST /api/agent/conversations/:id/messages`: Add a message to a conversation

**Functions**
- `GET /api/agent/functions`: Get available functions
- `POST /api/agent/functions/execute`: Execute a function

**Tasks**
- `GET /api/agent/tasks`: Get all tasks
- `POST /api/agent/tasks`: Create a new task
- `PATCH /api/agent/tasks/:id/status`: Update task status

**Settings**
- `GET /api/agent/settings`: Get all agent settings
- `PATCH /api/agent/settings/:name`: Update a specific setting

**Notifications**
- `GET /api/agent/notifications`: Get all notifications
- `GET /api/agent/notifications/unread/count`: Get count of unread notifications
- `PATCH /api/agent/notifications/:id/read`: Mark a notification as read
- `POST /api/agent/notifications/mark-all-read`: Mark all notifications as read
- `DELETE /api/agent/notifications/:id`: Delete a notification

### Database Schema

The system uses the following tables:

**agent_conversations**
```typescript
{
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  context: jsonb('context').$type<Record<string, any>>().default({}),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}
```

**agent_messages**
```typescript
{
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull(),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  functionCall: jsonb('function_call').$type<Record<string, any>>(),
  functionResult: jsonb('function_result').$type<Record<string, any>>()
}
```

**agent_functions**
```typescript
{
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  module: varchar('module', { length: 50 }).notNull(),
  parameters: jsonb('parameters').notNull(),
  returnType: varchar('return_type', { length: 100 }).notNull(),
  functionCode: text('function_code').notNull(),
  accessLevel: varchar('access_level', { length: 20 }).notNull().default('public'),
  tags: text('tags').array().notNull().default([])
}
```

**agent_tasks**
```typescript
{
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  parameters: jsonb('parameters').$type<Record<string, any>>().default({}),
  result: jsonb('result').$type<Record<string, any>>(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
}
```

**agent_settings**
```typescript
{
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  dataType: varchar('data_type', { length: 20 }).notNull().default('string'),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}
```

**signal_notifications**
```typescript
{
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 20 }).notNull().default('info'),
  source: varchar('source', { length: 50 }).notNull().default('system'),
  data: jsonb('data').$type<Record<string, any>>(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  readAt: timestamp('read_at')
}
```

**mcp_tasks**
```typescript
{
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description').notNull(),
  capability: varchar('capability', { length: 50 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  parameters: jsonb('parameters').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  priority: varchar('priority', { length: 20 }).notNull().default('medium'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  result: jsonb('result').$type<Record<string, any>>(),
  createdBy: integer('created_by').notNull(),
  parentTaskId: integer('parent_task_id'),
  scheduledFor: timestamp('scheduled_for'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
}
```

### Function Registry

The Function Registry provides a flexible way to register, manage, and execute functions that the AI Agent can use.

#### Function Structure

```typescript
{
  name: string;            // Function name
  description: string;     // Description of what the function does
  module: string;          // Module where the function is implemented
  parameters: Record<string, any>; // JSON Schema describing parameters
  returnType: string;      // Return type description
  functionCode: string;    // Function implementation
  accessLevel: string;     // Required access level (public, user, admin)
  tags: string[];          // Tags for categorization
}
```

#### Function Registration

Functions can be registered programmatically:

```typescript
const functionData = {
  name: "analyzeEnergySavings",
  description: "Analyzes potential energy savings based on usage patterns",
  module: "energy-analysis",
  parameters: {
    type: "object",
    properties: {
      timeframe: { type: "string", enum: ["day", "week", "month"] },
      equipment: { type: "string", optional: true }
    },
    required: ["timeframe"]
  },
  returnType: "EnergyAnalysisResult",
  functionCode: "...", // Actual implementation
  accessLevel: "user",
  tags: ["energy", "analysis", "savings"]
};

await agentService.registerFunction(functionData);
```

#### Function Execution

Functions are executed with proper input validation and error handling:

```typescript
try {
  const result = await agentService.executeFunction("analyzeEnergySavings", {
    timeframe: "week",
    equipment: "refrigeration"
  });
  // Process result
} catch (error) {
  // Handle error
}
```

### MCP Framework

The Multi-Capability Planning (MCP) framework orchestrates complex tasks that may involve multiple capabilities.

#### Core Components

- **Capability Providers**: Modules that provide specific capabilities (analytics, forecasting, etc.)
- **Task Scheduler**: Schedules and manages task execution
- **Task Dependencies**: Manages dependencies between tasks
- **Result Aggregation**: Combines results from multiple subtasks

#### MCP Task Structure

```typescript
{
  name: string;            // Task name
  description: string;     // Task description
  capability: string;      // Required capability (analytics, forecasting, etc.)
  provider: string;        // Provider implementation
  parameters: any;         // Task parameters
  status: string;          // Current status
  priority: string;        // Task priority
  metadata: any;           // Additional metadata
  result: any;             // Task result
  createdBy: number;       // User ID who created the task
  parentTaskId?: number;   // ID of parent task (for dependencies)
  scheduledFor?: Date;     // When to execute the task
}
```

#### Capability Registration

Capabilities are registered with the MCP service:

```typescript
mcpService.registerCapability({
  name: "time-series-forecasting",
  description: "Advanced forecasting for time series data",
  provider: "ai-forecasting-engine",
  parameters: {
    // Parameter schema
  }
});
```

### Notification Service

The Notification Service handles sending, storing, and managing notifications.

#### Notification Types

- **Alert**: Urgent notifications requiring attention
- **Info**: Informational notifications
- **Success**: Notifications of successful operations
- **Warning**: Warning notifications
- **Error**: Error notifications

#### Notification Methods

```typescript
async createNotification(notification: InsertSignalNotification): Promise<SignalNotification>
async getNotifications(userId: number, filter?: any): Promise<SignalNotification[]>
async getUnreadCount(userId: number): Promise<number>
async markAsRead(notificationId: number): Promise<SignalNotification>
async markAllAsRead(userId: number): Promise<void>
async deleteNotification(notificationId: number): Promise<void>
```

### Security Layer

The security layer ensures proper authentication, authorization, and data access controls.

#### Authentication

- Session-based authentication using Passport.js
- User sessions with role information

#### Authorization

- Role-based access control (RBAC) for API endpoints
- Function-level access control based on user roles
- Data access restrictions based on user permissions

#### Middleware

```typescript
// Auth middleware
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Role middleware
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const userRole = (req.session as any).userRole;
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}
```

## Frontend Integration

### Context Providers

The frontend uses React context providers to manage state:

- **NotificationContext**: Manages notification state and updates
- **AgentContext**: Manages agent state and interactions
- **RefreshRateContext**: Manages data refresh rates for polling

### Key Hooks

- **useAgentConversations**: Hook for accessing and managing conversations
- **useAgentMessages**: Hook for accessing and sending messages
- **useAgentTasks**: Hook for accessing and managing tasks
- **useAgentSettings**: Hook for accessing and updating settings
- **useNotifications**: Hook for accessing and managing notifications

### Polling Implementation

Instead of WebSockets, the system uses efficient polling with exponential backoff:

```typescript
const useDataPolling = (endpoint, interval = 5000) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  
  useEffect(() => {
    let timer: any = null;
    let currentInterval = interval;
    let consecutiveErrors = 0;
    
    const fetchData = async () => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        setData(result);
        
        // Reset backoff on success
        currentInterval = interval;
        consecutiveErrors = 0;
      } catch (err) {
        setError(err);
        
        // Implement exponential backoff
        consecutiveErrors++;
        currentInterval = Math.min(30000, interval * Math.pow(1.5, consecutiveErrors));
      } finally {
        if (isPolling) {
          timer = setTimeout(fetchData, currentInterval);
        }
      }
    };
    
    fetchData();
    
    return () => {
      if (timer) clearTimeout(timer);
      setIsPolling(false);
    };
  }, [endpoint, interval, isPolling]);
  
  return { data, error, isPolling, setIsPolling };
};
```

## Error Handling

### Error Types

- **AuthenticationError**: User is not authenticated
- **AuthorizationError**: User lacks required permissions
- **ValidationError**: Input validation failed
- **FunctionExecutionError**: Error during function execution
- **DatabaseError**: Error interacting with the database
- **ApiError**: Error in API layer
- **TaskExecutionError**: Error executing a task

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "The field with the error",
    "message": "Specific error message for this field"
  }
}
```

### Logging

- Error logging with severity levels
- Structured logging for easier parsing
- Context information in log entries
- Log rotation and retention policies

## Performance Considerations

### Optimizations

- **Caching**: API responses are cached where appropriate
- **Pagination**: Large result sets are paginated
- **Query Optimization**: Database queries are optimized for performance
- **Batching**: Operations are batched where possible
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse

### Scalability

- The architecture is designed to scale horizontally
- Stateless API layer allows for easy load balancing
- Database operations are optimized for concurrent access

## Integration Points

### External Systems

- **OpenAI API**: For AI model access
- **Power Monitoring System**: For accessing energy data
- **Environmental Monitoring System**: For accessing environmental data
- **Notification Systems**: For delivering notifications

### Authentication Systems

- **Local Authentication**: Username/password authentication
- **OAuth Integration**: Support for OAuth providers
- **SAML Integration**: Support for SAML authentication

## Deployment Considerations

### Environment Variables

- `OPENAI_API_KEY`: API key for OpenAI
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `LOG_LEVEL`: Logging level
- `NODE_ENV`: Environment (development, testing, production)

### Database Migrations

Database migrations are managed through SQL scripts and Drizzle ORM:

- Initial schema creation
- Adding new tables
- Altering existing tables
- Data migrations

## Testing Strategy

### Unit Tests

- Testing individual components in isolation
- Mocking dependencies
- Testing error handling

### Integration Tests

- Testing component interactions
- Testing API endpoints
- Testing database interactions

### End-to-End Tests

- Testing complete workflows
- Testing user interactions
- Performance testing

## Monitoring and Diagnostics

### Metrics

- Request rates and latencies
- Error rates
- Database operation performance
- AI API call performance
- Task execution performance

### Alerts

- Error rate thresholds
- Latency thresholds
- API quota usage
- Database performance

## Future Enhancements

- **Response Streaming**: Implementing chunked API responses for streaming
- **Typing Indicators**: Adding API endpoints for typing indicators
- **Enhanced Visualization**: Adding capabilities for data visualization
- **Expanded Function Registry**: Adding more functions and capabilities
- **Advanced MCP Features**: Enhancing the MCP framework with more capabilities

## Developer Documentation

For more detailed documentation on specific components, see:

- [Function Registry Documentation](./docs/function-registry.md)
- [MCP Framework Documentation](./docs/mcp-framework.md)
- [API Reference](./docs/api-reference.md)
- [Database Schema Reference](./docs/schema-reference.md)
- [Frontend Integration Guide](./docs/frontend-integration.md)