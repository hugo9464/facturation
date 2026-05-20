CREATE TABLE "prospection_resume" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "photo_data_url" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prospection_resume"
  ADD CONSTRAINT "prospection_resume_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

CREATE INDEX "prospection_resume_user_updated_idx"
  ON "prospection_resume" USING btree ("user_id", "updated_at");

ALTER TABLE "prospection_resume" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospection_resume_select_own" ON "prospection_resume"
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "prospection_resume_insert_own" ON "prospection_resume"
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_resume_update_own" ON "prospection_resume"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_resume_delete_own" ON "prospection_resume"
  FOR DELETE USING (user_id = auth.uid());

CREATE TABLE "prospection_cv_generation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" text NOT NULL,
  "offer_description" text NOT NULL,
  "resume_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "generated_cv" jsonb NOT NULL,
  "photo_data_url" text,
  "model" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prospection_cv_generation"
  ADD CONSTRAINT "prospection_cv_generation_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

CREATE INDEX "prospection_cv_generation_user_created_idx"
  ON "prospection_cv_generation" USING btree ("user_id", "created_at");

ALTER TABLE "prospection_cv_generation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospection_cv_generation_select_own" ON "prospection_cv_generation"
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "prospection_cv_generation_insert_own" ON "prospection_cv_generation"
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_cv_generation_update_own" ON "prospection_cv_generation"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_cv_generation_delete_own" ON "prospection_cv_generation"
  FOR DELETE USING (user_id = auth.uid());
