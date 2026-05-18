import * as assert from "node:assert/strict";
import {
  buildTodoTaskPreviewPath,
  buildTodoTaskPreviewUrl,
} from "../lib/todo-preview-link";

const projectId = "5b697732-6ea8-4845-b49a-9d39f41d304d";
const projectPath = `/projects/${projectId}`;

assert.equal(buildTodoTaskPreviewPath(projectId), projectPath);

assert.equal(
  buildTodoTaskPreviewUrl("https://facturation-git-uc-58.vercel.app", projectId),
  `https://facturation-git-uc-58.vercel.app${projectPath}`,
  "root deployment previews should open on the task project page",
);

assert.equal(
  buildTodoTaskPreviewUrl(
    "https://facturation-git-uc-58.vercel.app/auth/preview?next=%2F",
    projectId,
  ),
  `https://facturation-git-uc-58.vercel.app/auth/preview?next=%2Fprojects%2F${projectId}`,
  "generic auto-login links should redirect to the task project page",
);

assert.equal(
  buildTodoTaskPreviewUrl(
    "https://facturation-git-uc-58.vercel.app/api/dev/preview-login?token=***&next=%2F&x-vercel-protection-bypass=bypass&x-vercel-set-bypass-cookie=true",
    projectId,
  ),
  `https://facturation-git-uc-58.vercel.app/api/dev/preview-login?token=***&next=%2Fprojects%2F${projectId}&x-vercel-protection-bypass=bypass&x-vercel-set-bypass-cookie=true`,
  "legacy preview-login links should keep auth/bypass params while targeting the task project page",
);

assert.equal(
  buildTodoTaskPreviewUrl(
    "https://facturation-git-uc-58.vercel.app/projects/existing?tab=todo",
    projectId,
  ),
  "https://facturation-git-uc-58.vercel.app/projects/existing?tab=todo",
  "already specific preview URLs should be preserved",
);
