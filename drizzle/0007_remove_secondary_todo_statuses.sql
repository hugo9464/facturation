UPDATE "todo_task"
SET "status" = 'TODO'
WHERE "status" = 'BACKLOG';

UPDATE "todo_task"
SET "status" = 'DONE'
WHERE "status" = 'CANCELLED';

ALTER TYPE "todo_status" RENAME TO "todo_status_old";

CREATE TYPE "todo_status" AS ENUM (
  'TODO',
  'IN_PROGRESS',
  'TO_TEST',
  'DONE'
);

ALTER TABLE "todo_task"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "todo_status"
    USING "status"::text::"todo_status",
  ALTER COLUMN "status" SET DEFAULT 'TODO';

DROP TYPE "todo_status_old";
