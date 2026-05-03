-- Todo projects

CREATE TABLE "todo_project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "todo_project_user_order_idx"
  ON "todo_project" USING btree ("user_id", "order");

CREATE UNIQUE INDEX "todo_project_user_name_idx"
  ON "todo_project" USING btree ("user_id", "name");

ALTER TABLE "todo_project"
  ADD CONSTRAINT "todo_project_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "todo_project" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todo_project_select_own" ON "todo_project"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "todo_project_insert_own" ON "todo_project"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_project_update_own" ON "todo_project"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "todo_project_delete_own" ON "todo_project"
  FOR DELETE USING (user_id = auth.uid());

ALTER TABLE "todo_task"
  ADD COLUMN "project_id" uuid;

INSERT INTO "todo_project" ("user_id", "name", "order")
SELECT DISTINCT "user_id", 'Général', 0
FROM "todo_task";

UPDATE "todo_task"
SET "project_id" = "todo_project"."id"
FROM "todo_project"
WHERE "todo_task"."user_id" = "todo_project"."user_id"
  AND "todo_project"."name" = 'Général'
  AND "todo_task"."project_id" IS NULL;

ALTER TABLE "todo_task"
  ALTER COLUMN "project_id" SET NOT NULL;

ALTER TABLE "todo_task"
  ADD CONSTRAINT "todo_task_project_id_todo_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "todo_project"("id") ON DELETE RESTRICT;

CREATE INDEX "todo_task_project_status_order_idx"
  ON "todo_task" USING btree ("project_id", "status", "order");

DROP POLICY IF EXISTS "todo_task_insert_own" ON "todo_task";
DROP POLICY IF EXISTS "todo_task_update_own" ON "todo_task";

CREATE POLICY "todo_task_insert_own" ON "todo_task"
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "todo_project"
      WHERE "todo_project"."id" = "todo_task"."project_id"
        AND "todo_project"."user_id" = auth.uid()
    )
  );

CREATE POLICY "todo_task_update_own" ON "todo_task"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "todo_project"
      WHERE "todo_project"."id" = "todo_task"."project_id"
        AND "todo_project"."user_id" = auth.uid()
    )
  );
