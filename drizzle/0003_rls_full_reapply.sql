-- Idempotent RLS reapply for all tables.
-- Reapply policies after schema changes that drop them.

-- Ensure profile FK to auth.users (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profile_user_id_fk' AND table_name = 'profile'
  ) THEN
    ALTER TABLE "profile"
      ADD CONSTRAINT "profile_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on all app tables
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_line" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "profile_select_own" ON "profile";
DROP POLICY IF EXISTS "profile_insert_own" ON "profile";
DROP POLICY IF EXISTS "profile_update_own" ON "profile";
DROP POLICY IF EXISTS "client_select_own" ON "client";
DROP POLICY IF EXISTS "client_insert_own" ON "client";
DROP POLICY IF EXISTS "client_update_own" ON "client";
DROP POLICY IF EXISTS "client_delete_own" ON "client";
DROP POLICY IF EXISTS "time_entry_select_own" ON "time_entry";
DROP POLICY IF EXISTS "time_entry_insert_own" ON "time_entry";
DROP POLICY IF EXISTS "time_entry_update_own" ON "time_entry";
DROP POLICY IF EXISTS "time_entry_delete_own" ON "time_entry";
DROP POLICY IF EXISTS "invoice_select_own" ON "invoice";
DROP POLICY IF EXISTS "invoice_insert_own" ON "invoice";
DROP POLICY IF EXISTS "invoice_update_own" ON "invoice";
DROP POLICY IF EXISTS "invoice_line_select_own" ON "invoice_line";
DROP POLICY IF EXISTS "invoice_line_insert_own" ON "invoice_line";
DROP POLICY IF EXISTS "invoice_line_update_own" ON "invoice_line";
DROP POLICY IF EXISTS "invoice_line_delete_own" ON "invoice_line";
DROP POLICY IF EXISTS "quote_select_own" ON "quote";
DROP POLICY IF EXISTS "quote_insert_own" ON "quote";
DROP POLICY IF EXISTS "quote_update_own" ON "quote";
DROP POLICY IF EXISTS "quote_delete_own" ON "quote";
DROP POLICY IF EXISTS "quote_line_select_own" ON "quote_line";
DROP POLICY IF EXISTS "quote_line_insert_own" ON "quote_line";
DROP POLICY IF EXISTS "quote_line_update_own" ON "quote_line";
DROP POLICY IF EXISTS "quote_line_delete_own" ON "quote_line";

-- profile: user owns their row
CREATE POLICY "profile_select_own" ON "profile"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profile_insert_own" ON "profile"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profile_update_own" ON "profile"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- client
CREATE POLICY "client_select_own" ON "client"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "client_insert_own" ON "client"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "client_update_own" ON "client"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "client_delete_own" ON "client"
  FOR DELETE USING (user_id = auth.uid());

-- time_entry
CREATE POLICY "time_entry_select_own" ON "time_entry"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "time_entry_insert_own" ON "time_entry"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_entry_update_own" ON "time_entry"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_entry_delete_own" ON "time_entry"
  FOR DELETE USING (user_id = auth.uid());

-- invoice
CREATE POLICY "invoice_select_own" ON "invoice"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "invoice_insert_own" ON "invoice"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "invoice_update_own" ON "invoice"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- invoice_line: inherits ownership through invoice
CREATE POLICY "invoice_line_select_own" ON "invoice_line"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "invoice" WHERE invoice.id = invoice_line.invoice_id AND invoice.user_id = auth.uid())
  );
CREATE POLICY "invoice_line_insert_own" ON "invoice_line"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "invoice" WHERE invoice.id = invoice_line.invoice_id AND invoice.user_id = auth.uid())
  );
CREATE POLICY "invoice_line_update_own" ON "invoice_line"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "invoice" WHERE invoice.id = invoice_line.invoice_id AND invoice.user_id = auth.uid())
  );
CREATE POLICY "invoice_line_delete_own" ON "invoice_line"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM "invoice" WHERE invoice.id = invoice_line.invoice_id AND invoice.user_id = auth.uid())
  );

-- quote
CREATE POLICY "quote_select_own" ON "quote"
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "quote_insert_own" ON "quote"
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "quote_update_own" ON "quote"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "quote_delete_own" ON "quote"
  FOR DELETE USING (user_id = auth.uid());

-- quote_line: inherits ownership through quote
CREATE POLICY "quote_line_select_own" ON "quote_line"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "quote" WHERE quote.id = quote_line.quote_id AND quote.user_id = auth.uid())
  );
CREATE POLICY "quote_line_insert_own" ON "quote_line"
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM "quote" WHERE quote.id = quote_line.quote_id AND quote.user_id = auth.uid())
  );
CREATE POLICY "quote_line_update_own" ON "quote_line"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "quote" WHERE quote.id = quote_line.quote_id AND quote.user_id = auth.uid())
  );
CREATE POLICY "quote_line_delete_own" ON "quote_line"
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM "quote" WHERE quote.id = quote_line.quote_id AND quote.user_id = auth.uid())
  );
