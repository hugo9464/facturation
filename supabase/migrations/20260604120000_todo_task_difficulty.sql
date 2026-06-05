-- Niveau de difficulté des tâches Todo

CREATE TYPE "todo_difficulty" AS ENUM ('QUICK', 'COMPLEX');

ALTER TABLE "todo_task"
  ADD COLUMN "difficulty" "todo_difficulty" DEFAULT 'QUICK' NOT NULL;
