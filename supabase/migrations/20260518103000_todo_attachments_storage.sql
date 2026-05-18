-- Public storage bucket for Todo task description attachments.
-- Files are referenced as Markdown links/images inside todo_task.description so the
-- same content is visible in the UI and included in Hermes implementation prompts.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('todo-attachments', 'todo-attachments', true, 8388608)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 8388608;

DROP POLICY IF EXISTS "todo_attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "todo_attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "todo_attachments_delete_own" ON storage.objects;

CREATE POLICY "todo_attachments_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'todo-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "todo_attachments_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'todo-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'todo-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "todo_attachments_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'todo-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
