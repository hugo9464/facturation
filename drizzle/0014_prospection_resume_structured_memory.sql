ALTER TABLE "prospection_resume"
  ADD COLUMN IF NOT EXISTS "structured_content" jsonb DEFAULT '{}'::jsonb NOT NULL;
