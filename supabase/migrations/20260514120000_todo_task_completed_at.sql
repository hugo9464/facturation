-- Date de fin posée quand une tâche passe en "à valider" (TO_TEST) ou "terminé" (DONE)

ALTER TABLE "todo_task"
  ADD COLUMN "completed_at" timestamp with time zone;

-- Backfill : les tâches déjà en TO_TEST/DONE prennent leur updated_at comme date de fin
UPDATE "todo_task"
SET "completed_at" = "updated_at"
WHERE "status" IN ('TO_TEST', 'DONE');
