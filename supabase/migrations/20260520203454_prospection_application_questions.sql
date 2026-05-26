CREATE TABLE "prospection_application_question" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "entry_id" uuid NOT NULL,
  "question" text NOT NULL,
  "answer" text DEFAULT '' NOT NULL,
  "model" text,
  "generated_at" timestamp with time zone,
  "order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prospection_application_question"
  ADD CONSTRAINT "prospection_application_question_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "prospection_application_question"
  ADD CONSTRAINT "prospection_application_question_entry_id_prospection_entry_id_fk"
  FOREIGN KEY ("entry_id") REFERENCES "prospection_entry"("id") ON DELETE CASCADE;

CREATE INDEX "prospection_application_question_user_entry_order_idx"
  ON "prospection_application_question" USING btree ("user_id", "entry_id", "order", "created_at");

CREATE INDEX "prospection_application_question_user_updated_idx"
  ON "prospection_application_question" USING btree ("user_id", "updated_at");

ALTER TABLE "prospection_application_question" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "prospection_application_question" TO authenticated;

CREATE POLICY "prospection_application_question_select_own" ON "prospection_application_question"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_application_question_insert_own" ON "prospection_application_question"
  FOR INSERT WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM "prospection_entry"
      WHERE "prospection_entry"."id" = "prospection_application_question"."entry_id"
        AND "prospection_entry"."user_id" = (select auth.uid())
    )
  );

CREATE POLICY "prospection_application_question_update_own" ON "prospection_application_question"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1
      FROM "prospection_entry"
      WHERE "prospection_entry"."id" = "prospection_application_question"."entry_id"
        AND "prospection_entry"."user_id" = (select auth.uid())
    )
  );

CREATE POLICY "prospection_application_question_delete_own" ON "prospection_application_question"
  FOR DELETE USING (user_id = (select auth.uid()));
