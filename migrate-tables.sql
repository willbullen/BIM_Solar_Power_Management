-- Create langchain_telegram_settings table
CREATE TABLE IF NOT EXISTS langchain_telegram_settings (
  id SERIAL PRIMARY KEY,
  bot_token TEXT NOT NULL,
  bot_username TEXT NOT NULL,
  webhook_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings if the table is empty
INSERT INTO langchain_telegram_settings (bot_token, bot_username, is_enabled)
SELECT 'PLACEHOLDER_TOKEN', 'emporiumbotdev', TRUE
WHERE NOT EXISTS (SELECT 1 FROM langchain_telegram_settings);

-- Create langchain_telegram_users table 
CREATE TABLE IF NOT EXISTS langchain_telegram_users (
  id SERIAL PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  language_code TEXT,
  user_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Create langchain_telegram_messages table
CREATE TABLE IF NOT EXISTS langchain_telegram_messages (
  id SERIAL PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL,
  conversation_id INTEGER,
  message_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  text TEXT NOT NULL,
  direction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Create langchain_agent_conversations table
CREATE TABLE IF NOT EXISTS langchain_agent_conversations (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER NOT NULL,
  agent_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  context JSONB,
  metadata JSONB
);

-- Create langchain_agent_messages table 
CREATE TABLE IF NOT EXISTS langchain_agent_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tokens INTEGER,
  metadata JSONB
);

-- Create langchain_agent_notifications table
CREATE TABLE IF NOT EXISTS langchain_agent_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  data JSONB
);

-- Create langchain_agent_settings table
CREATE TABLE IF NOT EXISTS langchain_agent_settings (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create langchain_agent_tasks table
CREATE TABLE IF NOT EXISTS langchain_agent_tasks (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  result JSONB,
  data JSONB
);