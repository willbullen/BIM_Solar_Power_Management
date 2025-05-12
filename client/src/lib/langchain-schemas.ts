import { z } from "zod";

// Schema for creating/editing LangChain agents
export const agentSchema = z.object({
  name: z.string().min(3, { message: "Agent name must be at least 3 characters" }).max(100),
  description: z.string().optional(),
  modelName: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().min(100).max(8000).default(4000),
  streaming: z.boolean().default(true),
  systemPrompt: z.string().optional(),
  maxIterations: z.number().min(1).max(10).default(5),
  verbose: z.boolean().default(false),
  enabled: z.boolean().default(true),
  metadata: z.any().optional(),
});

export type AgentFormValues = z.infer<typeof agentSchema>;

// Schema for creating/editing LangChain tools
export const toolSchema = z.object({
  name: z.string().min(3, { message: "Tool name must be at least 3 characters" }).max(100),
  description: z.string().optional(),
  toolType: z.string().default("custom"),
  parameters: z.any().optional(),
  implementation: z.string().optional(),
  enabled: z.boolean().default(true),
  isBuiltIn: z.boolean().default(false),
  metadata: z.any().optional(),
});

export type ToolFormValues = z.infer<typeof toolSchema>;

// Schema for creating/editing LangChain prompt templates
export const promptTemplateSchema = z.object({
  name: z.string().min(3, { message: "Template name must be at least 3 characters" }).max(100),
  description: z.string().optional(),
  template: z.string().min(10, { message: "Template must be at least 10 characters" }),
  templateType: z.string().default("string"),
  variables: z.array(z.string()).optional(),
});

export type PromptTemplateFormValues = z.infer<typeof promptTemplateSchema>;

// Schema for agent-tool association
export const agentToolSchema = z.object({
  agentId: z.number(),
  toolId: z.number(),
  priority: z.number().default(0),
});

export type AgentToolFormValues = z.infer<typeof agentToolSchema>;