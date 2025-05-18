import { relations } from 'drizzle-orm';
import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  integer, 
  boolean,
  json,
  pgEnum
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Define task status enum
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in-progress', 'completed', 'failed']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

// Agent Tasks table
export const agentTasks = pgTable('langchain_agent_tasks', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  userId: integer('user_id').notNull(),
  task: text('task').notNull(),
  status: taskStatusEnum('status').notNull().default('pending'),
  scheduledFor: timestamp('scheduled_for'),
  recurrence: text('recurrence'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  dependsOn: integer('depends_on'),
  notifyOnComplete: boolean('notify_on_complete').notNull().default(true),
  notifyOnFail: boolean('notify_on_fail').notNull().default(true),
  telegramNotify: boolean('telegram_notify').notNull().default(false),
  data: json('data').$type<Record<string, any>>(),
  result: json('result').$type<Record<string, any> | null>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
});

// Task to Tool association table
export const agentTaskTools = pgTable('langchain_agent_task_tools', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull(),
  toolId: integer('tool_id').notNull(),
  priority: integer('priority').notNull().default(0),
  parameters: json('parameters').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Define relations
export const agentTasksRelations = relations(agentTasks, ({ one, many }) => ({
  tools: many(agentTaskTools),
  agent: one('agent_table', {
    fields: [agentTasks.agentId],
    references: ['id'] 
  }),
  user: one('user_table', {
    fields: [agentTasks.userId],
    references: ['id']
  }),
  dependentTask: one('langchain_agent_tasks', {
    fields: [agentTasks.dependsOn],
    references: ['id']
  })
}));

export const agentTaskToolsRelations = relations(agentTaskTools, ({ one }) => ({
  task: one(agentTasks, {
    fields: [agentTaskTools.taskId],
    references: [agentTasks.id]
  }),
  tool: one('langchain_tools_table', {
    fields: [agentTaskTools.toolId],
    references: ['id']
  })
}));

// Create Zod schemas for validation
export const insertAgentTaskSchema = createInsertSchema(agentTasks, {
  task: z.string().min(1, "Task description is required"),
  agentId: z.number().int().positive("Valid agent ID is required"),
  scheduledFor: z.date().optional(),
  recurrence: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dependsOn: z.number().int().positive().optional(),
  notifyOnComplete: z.boolean().default(true),
  notifyOnFail: z.boolean().default(true),
  telegramNotify: z.boolean().default(false),
  data: z.record(z.any()).optional(),
  result: z.record(z.any()).nullable().optional(),
}).omit({ id: true });

export const insertAgentTaskToolSchema = createInsertSchema(agentTaskTools, {
  taskId: z.number().int().positive(),
  toolId: z.number().int().positive(),
  priority: z.number().int().default(0),
  parameters: z.record(z.any()).optional(),
}).omit({ id: true });

// Export types
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;
export type AgentTaskTool = typeof agentTaskTools.$inferSelect;
export type InsertAgentTaskTool = typeof agentTaskTools.$inferInsert;