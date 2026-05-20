CREATE TYPE "prospection_type" AS ENUM (
  'OFFER',
  'MISSION',
  'COMPANY',
  'CONTACT'
);

CREATE TYPE "prospection_status" AS ENUM (
  'TO_APPLY',
  'APPLIED',
  'FOLLOW_UP',
  'INTERVIEW',
  'WON',
  'LOST',
  'ARCHIVED'
);

CREATE TABLE "prospection_entry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" "prospection_type" DEFAULT 'OFFER' NOT NULL,
  "status" "prospection_status" DEFAULT 'TO_APPLY' NOT NULL,
  "title" text NOT NULL,
  "organization" text,
  "contact_name" text,
  "email" text,
  "phone" text,
  "source_url" text,
  "location" text,
  "target_date" date,
  "applied_at" date,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prospection_entry"
  ADD CONSTRAINT "prospection_entry_user_id_profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "profile"("user_id") ON DELETE CASCADE;

CREATE INDEX "prospection_entry_user_status_idx"
  ON "prospection_entry" USING btree ("user_id", "status", "updated_at");

CREATE INDEX "prospection_entry_user_type_idx"
  ON "prospection_entry" USING btree ("user_id", "type");

ALTER TABLE "prospection_entry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prospection_entry_select_own" ON "prospection_entry"
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "prospection_entry_insert_own" ON "prospection_entry"
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_entry_update_own" ON "prospection_entry"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "prospection_entry_delete_own" ON "prospection_entry"
  FOR DELETE USING (user_id = auth.uid());
