ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "capabilities" jsonb DEFAULT '[]'::jsonb;
