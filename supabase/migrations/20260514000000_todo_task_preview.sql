-- Liens de déploiement sur les tâches todo (preview Vercel + Pull Request)

ALTER TABLE "todo_task"
  ADD COLUMN IF NOT EXISTS "preview_url" text,
  ADD COLUMN IF NOT EXISTS "pr_url" text;
