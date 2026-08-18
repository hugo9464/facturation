ALTER TABLE "invoice"
  ADD COLUMN IF NOT EXISTS "po_number" text;
