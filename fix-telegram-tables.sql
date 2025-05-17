-- Fix Telegram tables migration script
-- Moving data from telegram_* tables to langchain_telegram_* tables

-- Begin transaction
BEGIN;

-- Check if old tables exist and migrate data if needed
DO $$
DECLARE
    users_exists BOOLEAN;
    messages_exists BOOLEAN;
    settings_exists BOOLEAN;
    users_count INTEGER;
    messages_count INTEGER;
    settings_count INTEGER;
BEGIN
    -- Check if old tables exist
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'telegram_users'
    ) INTO users_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'telegram_messages'
    ) INTO messages_exists;
    
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'telegram_settings'
    ) INTO settings_exists;
    
    -- Process telegram_users
    IF users_exists THEN
        SELECT COUNT(*) FROM telegram_users INTO users_count;
        RAISE NOTICE 'Found telegram_users table with % records', users_count;
        
        -- Migrate data if there are records
        IF users_count > 0 THEN
            -- Check if destination table exists
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'langchain_telegram_users'
            ) THEN
                -- Insert data with conflict handling
                INSERT INTO langchain_telegram_users 
                SELECT * FROM telegram_users
                ON CONFLICT (id) DO NOTHING;
                
                RAISE NOTICE 'Migrated % users to langchain_telegram_users', users_count;
            ELSE
                RAISE NOTICE 'Destination table langchain_telegram_users does not exist, skipping migration';
            END IF;
        END IF;
        
        -- Drop the old table
        DROP TABLE telegram_users CASCADE;
        RAISE NOTICE 'Dropped telegram_users table';
    ELSE
        RAISE NOTICE 'telegram_users table does not exist, nothing to migrate';
    END IF;
    
    -- Process telegram_messages
    IF messages_exists THEN
        SELECT COUNT(*) FROM telegram_messages INTO messages_count;
        RAISE NOTICE 'Found telegram_messages table with % records', messages_count;
        
        -- Migrate data if there are records
        IF messages_count > 0 THEN
            -- Check if destination table exists
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'langchain_telegram_messages'
            ) THEN
                -- Insert data with conflict handling
                INSERT INTO langchain_telegram_messages 
                SELECT * FROM telegram_messages
                ON CONFLICT (id) DO NOTHING;
                
                RAISE NOTICE 'Migrated % messages to langchain_telegram_messages', messages_count;
            ELSE
                RAISE NOTICE 'Destination table langchain_telegram_messages does not exist, skipping migration';
            END IF;
        END IF;
        
        -- Drop the old table
        DROP TABLE telegram_messages CASCADE;
        RAISE NOTICE 'Dropped telegram_messages table';
    ELSE
        RAISE NOTICE 'telegram_messages table does not exist, nothing to migrate';
    END IF;
    
    -- Process telegram_settings
    IF settings_exists THEN
        SELECT COUNT(*) FROM telegram_settings INTO settings_count;
        RAISE NOTICE 'Found telegram_settings table with % records', settings_count;
        
        -- Migrate data if there are records
        IF settings_count > 0 THEN
            -- Check if destination table exists
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'langchain_telegram_settings'
            ) THEN
                -- Insert data with conflict handling
                INSERT INTO langchain_telegram_settings 
                SELECT * FROM telegram_settings
                ON CONFLICT (id) DO NOTHING;
                
                RAISE NOTICE 'Migrated % settings to langchain_telegram_settings', settings_count;
            ELSE
                RAISE NOTICE 'Destination table langchain_telegram_settings does not exist, skipping migration';
            END IF;
        END IF;
        
        -- Drop the old table
        DROP TABLE telegram_settings CASCADE;
        RAISE NOTICE 'Dropped telegram_settings table';
    ELSE
        RAISE NOTICE 'telegram_settings table does not exist, nothing to migrate';
    END IF;
    
END $$;

-- Commit the transaction
COMMIT;