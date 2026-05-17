# Hermes-first Automated Task Implementation Plan

Goal: In Facturation, click “Implémenter” on a Todo task and have Hermes on the VPS implement the task, push a branch/PR, then write the PR and Vercel preview URL back into Facturation.

Important architecture decision: Facturation is only the control UI. It must not manage GitHub repositories, local worktrees, SSH aliases, Codex, or Claude Code directly. Hermes on the VPS is the worker/orchestrator and resolves the project repository itself from the project/task context and its local environment.

---

## Target architecture

```text
Facturation UI on Vercel
  -> Server Action creates implementation job
  -> signed POST to Hermes webhook on VPS
  -> Hermes receives task + project context
  -> Hermes resolves the local repo/worktree under /opt/data/projects
  -> Hermes uses terminal/git/codex/claude tools as needed
  -> Hermes pushes branch and opens PR
  -> Vercel creates preview from PR/branch
  -> Hermes calls Facturation callback API
  -> Facturation shows job status, PR URL, preview URL, logs/errors
```

This avoids Vercel running shell commands. The VPS remains the only place with GitHub SSH keys, Codex login, Claude Code login, and local repos.

---

## Facturation app responsibilities

Facturation should only:

1. Store Todo projects/tasks.
2. Store implementation jobs in `todo_implementation_job`.
3. Send a signed webhook payload to Hermes.
4. Expose a callback endpoint for Hermes job updates.
5. Display status, logs, PR URL, and preview URL.

Facturation should not require per-project repo configuration in the Todo UI.

---

## Database changes

Table: `todo_implementation_job`

Fields:

- `id`
- `user_id`
- `task_id`
- `project_id`
- `status`: `QUEUED`, `RUNNING`, `WAITING_PREVIEW`, `SUCCEEDED`, `FAILED`, `CANCELLED`
- `agent`: usually `hermes`
- `branch_name`
- `pr_url`
- `preview_url`
- `error_message`
- `logs`
- timestamps

No repo fields are required on `todo_project` for this MVP. Hermes resolves the repo on the VPS.

---

## Payload sent to Hermes

```json
{
  "event_type": "implement_task",
  "jobId": "uuid",
  "task": {
    "id": "uuid",
    "number": 12,
    "title": "Task title",
    "description": "Task details",
    "status": "TODO"
  },
  "project": {
    "id": "uuid",
    "name": "Client project"
  },
  "automation": {
    "mode": "hermes",
    "preferredCodingTool": "codex",
    "repositoryResolution": "vps_hermes",
    "instructions": "Résous le dépôt/projet côté VPS à partir du nom du projet et du contexte de la tâche."
  },
  "callback": {
    "url": "https://facturation-app/api/todo/implementation-jobs/<jobId>/callback",
    "token": "per-job-token"
  }
}
```

Required Vercel env vars:

- `HERMES_WEBHOOK_URL`
- `HERMES_WEBHOOK_SECRET`
- `FACTURATION_CALLBACK_SECRET` or fallback secret used for per-job callback tokens

---

## Callback endpoint

Endpoint:

```text
POST /api/todo/implementation-jobs/[id]/callback
```

Hermes calls it with:

```json
{
  "taskId": "uuid",
  "status": "RUNNING",
  "branchName": "agent/uc-12-task-title",
  "prUrl": "https://github.com/owner/repo/pull/123",
  "previewUrl": "https://preview.vercel.app",
  "logs": "short summary/logs",
  "errorMessage": null
}
```

The endpoint updates:

- `todo_implementation_job`
- `todo_task.pr_url`
- `todo_task.preview_url`

---

## Hermes webhook behavior

For each job Hermes should:

1. Callback `RUNNING` immediately.
2. Resolve the local repo/worktree under `/opt/data/projects`.
   - Prefer an exact/near match with `project.name`.
   - Inspect git remotes when needed.
   - If multiple candidates match, fail safely with a clear callback log instead of guessing destructively.
3. Infer default branch from git remote/local repo.
4. Create branch `agent/uc-<task.number>-<slug>`.
5. Inspect repo.
6. Implement task directly or use Codex/Claude Code as internal tools.
7. Run available checks.
8. Commit changes.
9. Push branch and open PR when a GitHub remote/account is resolvable.
10. Find Vercel preview URL if available.
11. Callback `SUCCEEDED`, `WAITING_PREVIEW`, or `FAILED`.

---

## Current VPS configuration status

Completed on 2026-05-17:

- Hermes webhook platform enabled in `/opt/data/config.yaml`.
- Webhook server listening on port `8644`.
- Hermes gateway started manually in the current VPS/container session.
- Health check passes at `http://127.0.0.1:8644/health`.
- Dynamic webhook subscription exists:
  - name: `facturation-implement-task`
  - local URL: `http://localhost:8644/webhooks/facturation-implement-task`
  - event: `implement_task`
- Subscription prompt updated so repo hints are optional and Hermes resolves the repo on the VPS.

Note: if the gateway is already running, restart/reload it before relying on prompt changes. In this session, automatic restart was blocked by safety approval because it would kill running agents.
