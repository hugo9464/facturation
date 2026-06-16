-- Job offers scraped hourly for the job-offer agent

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_offer_status') THEN
    CREATE TYPE "job_offer_status" AS ENUM (
      'NEW',
      'SAVED',
      'IGNORED',
      'APPLIED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "job_offer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "source" text NOT NULL,
  "source_id" text,
  "source_url" text NOT NULL,
  "title" text NOT NULL,
  "company" text,
  "location" text,
  "remote" boolean DEFAULT true NOT NULL,
  "contract_type" text,
  "salary" text,
  "description" text,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "matched_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
  "match_score" integer DEFAULT 0 NOT NULL,
  "status" "job_offer_status" DEFAULT 'NEW' NOT NULL,
  "published_at" timestamp with time zone,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_offer_user_source_url_idx"
  ON "job_offer" USING btree ("user_id", "source_url");

CREATE INDEX IF NOT EXISTS "job_offer_user_status_score_idx"
  ON "job_offer" USING btree ("user_id", "status", "match_score" DESC, "published_at" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "job_offer_user_seen_idx"
  ON "job_offer" USING btree ("user_id", "last_seen_at" DESC);

ALTER TABLE "job_offer"
  ADD CONSTRAINT "job_offer_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

ALTER TABLE "job_offer" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_offer_select_own" ON "job_offer"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "job_offer_insert_own" ON "job_offer"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "job_offer_update_own" ON "job_offer"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "job_offer_delete_own" ON "job_offer"
  FOR DELETE USING (user_id = auth.uid());
