-- Foreign key from profile to auth.users
ALTER TABLE "profile"
  ADD CONSTRAINT "profile_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on all app tables
ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_entry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line" ENABLE ROW LEVEL SECURITY;

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

-- Storage bucket for invoices (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: each user can only access their own folder ({user_id}/...)
CREATE POLICY "invoices_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "invoices_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "invoices_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = auth.uid()::text);
