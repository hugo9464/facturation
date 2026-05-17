-- Store the user instructions that launched each Hermes todo implementation job.

ALTER TABLE "todo_implementation_job"
  ADD COLUMN IF NOT EXISTS "instructions" text;
