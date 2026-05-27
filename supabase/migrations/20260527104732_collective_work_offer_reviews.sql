CREATE TYPE "prospection_offer_review_status" AS ENUM (
  'PENDING',
  'IMPORTED',
  'ARCHIVED'
);

CREATE TABLE "prospection_offer_review" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "status" "prospection_offer_review_status" DEFAULT 'PENDING' NOT NULL,
  "source_url" text NOT NULL,
  "source_id" text,
  "title" text NOT NULL,
  "organization" text,
  "location" text,
  "daily_rate" text,
  "notes" text,
  "score" numeric,
  "heuristic_score" integer DEFAULT 0 NOT NULL,
  "matched_terms" text[] DEFAULT '{}'::text[] NOT NULL,
  "fit_signals" text[] DEFAULT '{}'::text[] NOT NULL,
  "reason" text,
  "entry_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone
);

ALTER TABLE "prospection_offer_review"
  ADD CONSTRAINT "prospection_offer_review_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "prospection_offer_review"
  ADD CONSTRAINT "prospection_offer_review_entry_id_prospection_entry_id_fk"
  FOREIGN KEY ("entry_id") REFERENCES "prospection_entry"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "prospection_offer_review_user_source_url_idx"
  ON "prospection_offer_review" USING btree ("user_id", "source_url");

CREATE INDEX "prospection_offer_review_user_status_updated_idx"
  ON "prospection_offer_review" USING btree ("user_id", "status", "updated_at");

ALTER TABLE "prospection_offer_review" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "prospection_offer_review" TO authenticated;

CREATE POLICY "prospection_offer_review_select_own" ON "prospection_offer_review"
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "prospection_offer_review_insert_own" ON "prospection_offer_review"
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_offer_review_update_own" ON "prospection_offer_review"
  FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "prospection_offer_review_delete_own" ON "prospection_offer_review"
  FOR DELETE USING (user_id = (select auth.uid()));
