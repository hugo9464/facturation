ALTER TABLE "prospection_offer_review"
  ADD COLUMN IF NOT EXISTS "ai_matches" boolean,
  ADD COLUMN IF NOT EXISTS "accepted" boolean DEFAULT false NOT NULL;
