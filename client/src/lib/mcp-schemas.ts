// MCP (Model Context Protocol) schemas and types
import { z } from 'zod';

// Schema for MCP capabilities
export const mcpCapabilitySchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  parameters: z.record(z.any()).optional(),
});

export type McpCapability = z.infer<typeof mcpCapabilitySchema>;

// Schema for creating new MCP tasks
export const mcpTaskCreateSchema = z.object({
  name: z.string().min(3, "Task name must be at least 3 characters"),
  description: z.string().min(10, "Task description must be at least 10 characters"),
  capability: z.string(),
  provider: z.string().default("openai"), // Default to OpenAI as provider
  parameters: z.record(z.any()), // Dynamic parameters based on capability
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  scheduledFor: z.date().optional().nullable(),
  parentTaskId: z.number().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type McpTaskCreate = z.infer<typeof mcpTaskCreateSchema>;

// Schema for updating MCP task status
export const mcpTaskStatusUpdateSchema = z.object({
  status: z.enum(["pending", "scheduled", "in-progress", "completed", "failed", "canceled"]),
  result: z.any().optional(),
});

export type McpTaskStatusUpdate = z.infer<typeof mcpTaskStatusUpdateSchema>;

// Filter schema for MCP tasks
export const mcpTaskFilterSchema = z.object({
  status: z.string().optional(),
  capability: z.string().optional(),
  userId: z.number().optional(),
});

export type McpTaskFilter = z.infer<typeof mcpTaskFilterSchema>;