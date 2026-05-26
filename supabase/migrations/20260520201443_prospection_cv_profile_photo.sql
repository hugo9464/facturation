CREATE TABLE IF NOT EXISTS "prospection_cv_profile" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "photo_data_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prospection_cv_profile"
  ADD CONSTRAINT "prospection_cv_profile_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "prospection_cv_profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospection_cv_profile_select_own" ON "prospection_cv_profile"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_profile_insert_own" ON "prospection_cv_profile"
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_profile_update_own" ON "prospection_cv_profile"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_profile_delete_own" ON "prospection_cv_profile"
  FOR DELETE USING (user_id = (select auth.uid()));
