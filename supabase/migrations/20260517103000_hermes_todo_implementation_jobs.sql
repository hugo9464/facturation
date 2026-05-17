-- Hermes automated implementation jobs for todo tasks

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'todo_implementation_job_status') THEN
    CREATE TYPE "todo_implementation_job_status" AS ENUM (
      'QUEUED',
      'RUNNING',
      'WAITING_PREVIEW',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "todo_implementation_job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "task_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "status" "todo_implementation_job_status" DEFAULT 'QUEUED' NOT NULL,
  "agent" text DEFAULT 'hermes' NOT NULL,
  "branch_name" text,
  "pr_url" text,
  "preview_url" text,
  "logs" text,
  "error_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "todo_implementation_job_task_created_idx"
  ON "todo_implementation_job" USING btree ("task_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "todo_implementation_job_user_status_idx"
  ON "todo_implementation_job" USING btree ("user_id", "status", "created_at" DESC);

ALTER TABLE "todo_implementation_job"
  ADD CONSTRAINT "todo_implementation_job_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "todo_implementation_job"
  ADD CONSTRAINT "todo_implementation_job_task_id_todo_task_id_fk"
  FOREIGN KEY ("task_id") REFERENCES "todo_task"("id") ON DELETE CASCADE;

ALTER TABLE "todo_implementation_job"
  ADD CONSTRAINT "todo_implementation_job_project_id_todo_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "todo_project"("id") ON DELETE CASCADE;

ALTER TABLE "todo_implementation_job" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todo_implementation_job_select_own" ON "todo_implementation_job"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "todo_implementation_job_insert_own" ON "todo_implementation_job"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_implementation_job_update_own" ON "todo_implementation_job"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_implementation_job_delete_own" ON "todo_implementation_job"
  FOR DELETE USING (user_id = auth.uid());
