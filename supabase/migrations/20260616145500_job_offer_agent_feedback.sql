-- Feedback sent by users from the job-offer page to tune future agent runs

CREATE TABLE IF NOT EXISTS "job_offer_agent_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "job_offer_agent_feedback_user_created_idx"
  ON "job_offer_agent_feedback" USING btree ("user_id", "created_at" DESC);

ALTER TABLE "job_offer_agent_feedback"
  ADD CONSTRAINT "job_offer_agent_feedback_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "job_offer_agent_feedback" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_offer_agent_feedback_select_own" ON "job_offer_agent_feedback"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "job_offer_agent_feedback_insert_own" ON "job_offer_agent_feedback"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "job_offer_agent_feedback_delete_own" ON "job_offer_agent_feedback"
  FOR DELETE USING (user_id = auth.uid());
