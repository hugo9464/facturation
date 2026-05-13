-- Project-centric workflow

ALTER TABLE "todo_project"
  ADD COLUMN "client_id" uuid;

ALTER TABLE "todo_project"
  ADD CONSTRAINT "todo_project_client_id_client_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT;

CREATE INDEX "todo_project_client_idx"
  ON "todo_project" USING btree ("client_id");

-- Create one billable project per client when none exists yet.
WITH clients_without_project AS (
  SELECT
    c.*,
    count(*) OVER (PARTITION BY c."user_id", c."name") AS same_name_count,
    row_number() OVER (PARTITION BY c."user_id" ORDER BY c."created_at", c."id") AS migration_order
  FROM "client" c
  WHERE NOT EXISTS (
    SELECT 1
    FROM "todo_project" p
    WHERE p."client_id" = c."id"
  )
)
INSERT INTO "todo_project" ("user_id", "client_id", "name", "order")
SELECT
  c."user_id",
  c."id",
  CASE
    WHEN c.same_name_count > 1
      OR EXISTS (
        SELECT 1
        FROM "todo_project" p
        WHERE p."user_id" = c."user_id"
          AND p."name" = c."name"
      )
    THEN c."name" || ' (' || left(c."id"::text, 8) || ')'
    ELSE c."name"
  END,
  COALESCE((
    SELECT max(p2."order") + 1
    FROM "todo_project" p2
    WHERE p2."user_id" = c."user_id"
  ), 0) + c.migration_order - 1
FROM clients_without_project c;

ALTER TABLE "time_entry"
  ADD COLUMN "project_id" uuid;

ALTER TABLE "time_entry"
  ADD CONSTRAINT "time_entry_project_id_todo_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "todo_project"("id") ON DELETE RESTRICT;

UPDATE "time_entry" te
SET "project_id" = p."id"
FROM "todo_project" p
WHERE p."client_id" = te."client_id"
  AND p."user_id" = te."user_id"
  AND te."project_id" IS NULL;

CREATE INDEX "time_entry_project_idx"
  ON "time_entry" USING btree ("project_id");

ALTER TABLE "invoice"
  ADD COLUMN "project_id" uuid;

ALTER TABLE "invoice"
  ADD CONSTRAINT "invoice_project_id_todo_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "todo_project"("id") ON DELETE RESTRICT;

UPDATE "invoice" i
SET "project_id" = p."id"
FROM "todo_project" p
WHERE p."client_id" = i."client_id"
  AND p."user_id" = i."user_id"
  AND i."project_id" IS NULL;

CREATE INDEX "invoice_project_idx"
  ON "invoice" USING btree ("project_id");

ALTER TABLE "quote"
  ADD COLUMN "project_id" uuid;

ALTER TABLE "quote"
  ADD CONSTRAINT "quote_project_id_todo_project_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "todo_project"("id") ON DELETE RESTRICT;

UPDATE "quote" q
SET "project_id" = p."id"
FROM "todo_project" p
WHERE p."client_id" = q."client_id"
  AND p."user_id" = q."user_id"
  AND q."project_id" IS NULL;

CREATE INDEX "quote_project_idx"
  ON "quote" USING btree ("project_id");

-- Reapply strict project-aware policies where project access matters.
DROP POLICY IF EXISTS "time_entry_insert_own" ON "time_entry";
DROP POLICY IF EXISTS "time_entry_update_own" ON "time_entry";
DROP POLICY IF EXISTS "invoice_insert_own" ON "invoice";
DROP POLICY IF EXISTS "invoice_update_own" ON "invoice";
DROP POLICY IF EXISTS "quote_insert_own" ON "quote";
DROP POLICY IF EXISTS "quote_update_own" ON "quote";

CREATE POLICY "time_entry_insert_own" ON "time_entry"
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "todo_project"
      WHERE "todo_project"."id" = "time_entry"."project_id"
        AND "todo_project"."user_id" = auth.uid()
        AND "todo_project"."client_id" = "time_entry"."client_id"
    )
  );

CREATE POLICY "time_entry_update_own" ON "time_entry"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND (
      "time_entry"."project_id" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "todo_project"
        WHERE "todo_project"."id" = "time_entry"."project_id"
          AND "todo_project"."user_id" = auth.uid()
          AND "todo_project"."client_id" = "time_entry"."client_id"
      )
    )
  );

CREATE POLICY "invoice_insert_own" ON "invoice"
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "todo_project"
      WHERE "todo_project"."id" = "invoice"."project_id"
        AND "todo_project"."user_id" = auth.uid()
        AND "todo_project"."client_id" = "invoice"."client_id"
    )
  );

CREATE POLICY "invoice_update_own" ON "invoice"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND (
      "invoice"."project_id" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "todo_project"
        WHERE "todo_project"."id" = "invoice"."project_id"
          AND "todo_project"."user_id" = auth.uid()
          AND "todo_project"."client_id" = "invoice"."client_id"
      )
    )
  );

CREATE POLICY "quote_insert_own" ON "quote"
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM "todo_project"
      WHERE "todo_project"."id" = "quote"."project_id"
        AND "todo_project"."user_id" = auth.uid()
        AND "todo_project"."client_id" = "quote"."client_id"
    )
  );

CREATE POLICY "quote_update_own" ON "quote"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid()
    AND (
      "quote"."project_id" IS NULL
      OR EXISTS (
        SELECT 1
        FROM "todo_project"
        WHERE "todo_project"."id" = "quote"."project_id"
          AND "todo_project"."user_id" = auth.uid()
          AND "todo_project"."client_id" = "quote"."client_id"
      )
    )
  );
