// Telegram integration schemas and types
import { z } from 'zod';

// Schema for admin Telegram bot settings
export const telegramBotSchema = z.object({
  botToken: z.string().optional(), // Optional because we might not want to update token every time
  botUsername: z.string().min(3, "Bot username must be at least 3 characters"),
  isEnabled: z.boolean(),
  tokenUpdated: z.boolean().optional(), // Track if token was updated, not for database
  webhookUrl: z.string().optional().nullable(),
});

export type TelegramBotSettings = z.infer<typeof telegramBotSchema>;

// Schema for user Telegram preferences
export const telegramPreferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  receiveAlerts: z.boolean(),
  receiveReports: z.boolean(),
});

export type TelegramPreferences = z.infer<typeof telegramPreferencesSchema>;

// Schema for test message
export const telegramTestMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(4096, "Message too long (max 4096 characters)"),
});

export type TelegramTestMessage = z.infer<typeof telegramTestMessageSchema>;