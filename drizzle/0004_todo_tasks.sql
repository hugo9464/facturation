-- Todo tasks

CREATE TYPE "todo_status" AS ENUM (
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'TO_TEST',
  'DONE',
  'CANCELLED'
);

ALTER TABLE "profile"
  ADD COLUMN "next_task_number" integer NOT NULL DEFAULT 1;

CREATE TABLE "todo_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "number" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" "todo_status" DEFAULT 'TODO' NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "todo_task_user_number_idx"
  ON "todo_task" USING btree ("user_id", "number");

CREATE INDEX "todo_task_user_status_order_idx"
  ON "todo_task" USING btree ("user_id", "status", "order");

ALTER TABLE "todo_task"
  ADD CONSTRAINT "todo_task_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "todo_task" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todo_task_select_own" ON "todo_task"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "todo_task_insert_own" ON "todo_task"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_task_update_own" ON "todo_task"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_task_delete_own" ON "todo_task"
  FOR DELETE USING (user_id = auth.uid());
