import { pgTable, serial, integer, text, boolean, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, langchainAgents, langchainTools } from './schema';

// Define status and priority enums for tasks
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in-progress', 'completed', 'failed']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high']);

// Define the agent tasks table
export const agentTasks = pgTable('langchain_agent_tasks', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => langchainAgents.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  task: text('task').notNull(),
  status: taskStatusEnum('status').notNull().default('pending'),
  scheduledFor: timestamp('scheduled_for'),
  recurrence: text('recurrence'),
  priority: taskPriorityEnum('priority').notNull().default('medium'),
  dependsOn: integer('depends_on').references(() => agentTasks.id, { onDelete: 'set null' }),
  notifyOnComplete: boolean('notify_on_complete').notNull().default(true),
  notifyOnFail: boolean('notify_on_fail').notNull().default(true),
  telegramNotify: boolean('telegram_notify').notNull().default(false),
  data: jsonb('data').default({}),
  result: jsonb('result'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
});

// Define the task tools junction table
export const agentTaskTools = pgTable('langchain_agent_task_tools', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id')
    .notNull()
    .references(() => agentTasks.id, { onDelete: 'cascade' }),
  toolId: integer('tool_id')
    .notNull()
    .references(() => langchainTools.id, { onDelete: 'cascade' }),
  priority: integer('priority').notNull().default(0),
  parameters: jsonb('parameters').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Define relationships
export const agentTasksRelations = relations(agentTasks, ({ one, many }) => ({
  agent: one(langchainAgents, {
    fields: [agentTasks.agentId],
    references: [langchainAgents.id]
  }),
  user: one(users, {
    fields: [agentTasks.userId],
    references: [users.id]
  }),
  dependentTask: one(agentTasks, {
    fields: [agentTasks.dependsOn],
    references: [agentTasks.id]
  }),
  tools: many(agentTaskTools)
}));

export const agentTaskToolsRelations = relations(agentTaskTools, ({ one }) => ({
  task: one(agentTasks, {
    fields: [agentTaskTools.taskId],
    references: [agentTasks.id]
  }),
  tool: one(langchainTools, {
    fields: [agentTaskTools.toolId],
    references: [langchainTools.id]
  })
}));

// Create Zod schemas for validation
export const insertAgentTaskSchema = createInsertSchema(agentTasks).extend({
  task: z.string().min(1, "Task description is required"),
  agentId: z.number().int().positive("Valid agent ID is required")
}).omit({ id: true });

export const insertAgentTaskToolSchema = createInsertSchema(agentTaskTools).omit({ id: true });

// Export types for type safety
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = typeof agentTasks.$inferInsert;
export type AgentTaskTool = typeof agentTaskTools.$inferSelect;
export type InsertAgentTaskTool = typeof agentTaskTools.$inferInsert;