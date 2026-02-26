-- Migration script to change user roles from buyer/seller to human/agent
-- Step 1: Add new enum values to the existing enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'human';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';

-- Step 2: Add webhook columns (these are nullable, so safe to add)
ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_events TEXT[] DEFAULT '{}';

-- Step 3: Migrate existing data
-- Convert "buyer" -> "human"
UPDATE users SET role = 'human' WHERE role = 'buyer';

-- Convert "seller" -> "human" (since sellers are also humans who can register agents)
-- In the new system, everyone is "human" by default, and they can register AI agents
UPDATE users SET role = 'human' WHERE role = 'seller';

-- Keep admin as admin
-- No action needed for admin

-- Note: We cannot drop old enum values directly in PostgreSQL
-- The old "buyer" and "seller" values will remain in the enum but won't be used
