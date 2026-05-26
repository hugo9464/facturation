DROP POLICY IF EXISTS "prospection_entry_select_own" ON "prospection_entry";
DROP POLICY IF EXISTS "prospection_entry_insert_own" ON "prospection_entry";
DROP POLICY IF EXISTS "prospection_entry_update_own" ON "prospection_entry";
DROP POLICY IF EXISTS "prospection_entry_delete_own" ON "prospection_entry";

CREATE POLICY "prospection_entry_select_own" ON "prospection_entry"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_entry_insert_own" ON "prospection_entry"
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_entry_update_own" ON "prospection_entry"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_entry_delete_own" ON "prospection_entry"
  FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "prospection_resume_select_own" ON "prospection_resume";
DROP POLICY IF EXISTS "prospection_resume_insert_own" ON "prospection_resume";
DROP POLICY IF EXISTS "prospection_resume_update_own" ON "prospection_resume";
DROP POLICY IF EXISTS "prospection_resume_delete_own" ON "prospection_resume";

CREATE POLICY "prospection_resume_select_own" ON "prospection_resume"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_resume_insert_own" ON "prospection_resume"
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_resume_update_own" ON "prospection_resume"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_resume_delete_own" ON "prospection_resume"
  FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "prospection_cv_generation_select_own" ON "prospection_cv_generation";
DROP POLICY IF EXISTS "prospection_cv_generation_insert_own" ON "prospection_cv_generation";
DROP POLICY IF EXISTS "prospection_cv_generation_update_own" ON "prospection_cv_generation";
DROP POLICY IF EXISTS "prospection_cv_generation_delete_own" ON "prospection_cv_generation";

CREATE POLICY "prospection_cv_generation_select_own" ON "prospection_cv_generation"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_generation_insert_own" ON "prospection_cv_generation"
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_generation_update_own" ON "prospection_cv_generation"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_cv_generation_delete_own" ON "prospection_cv_generation"
  FOR DELETE USING (user_id = (select auth.uid()));
