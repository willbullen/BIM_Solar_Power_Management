import { z } from "zod";

// Form validation schema for Agent creation/editing
export const agentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  modelName: z.string().min(1, "Model name is required"),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().int().positive().default(4000),
  streaming: z.boolean().default(true),
  systemPrompt: z.string().optional(),
  maxIterations: z.number().int().positive().default(5),
  verbose: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

// Parameter schema for tool parameters validation
export const parameterSchema = z.record(
  z.string(),
  z.object({
    type: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional().default(false),
    default: z.any().optional(),
  })
);

// Form validation schema for Tool creation/editing
export const toolSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be less than 50 characters"),
  description: z.string().min(1, "Description is required").max(500, "Description must be less than 500 characters"),
  toolType: z.string().min(1, "Tool type is required"),
  parameters: parameterSchema.optional(),
  implementation: z.string().optional(),
  example: z.string().optional(),
  category: z.string().optional(),
  enabled: z.boolean().default(true),
  isBuiltIn: z.boolean().default(false),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ToolFormValues = z.infer<typeof toolSchema>;

// Form validation schema for Prompt Template creation/editing
export const promptTemplateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  template: z.string().min(1, "Template is required"),
  templateType: z.string().default("string"),
  variables: z.array(z.string()).optional(),
});

export type PromptTemplateFormValues = z.infer<typeof promptTemplateSchema>;

// Schema for LangChain query execution
export const querySchema = z.object({
  table: z.string().min(1, "Table name is required"),
  columns: z.array(z.string()).min(1, "At least one column is required"),
  where: z.record(z.string(), z.any()).optional(),
  orderBy: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

export type QueryFormValues = z.infer<typeof querySchema>;