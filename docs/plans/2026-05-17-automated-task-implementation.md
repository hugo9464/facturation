# Automated Task Implementation Plan

Superseded by:

`docs/plans/2026-05-17-hermes-automated-task-implementation.md`

This earlier plan assumed Facturation would store GitHub repo metadata on each Todo project. That approach was rejected.

Current decision:

- Facturation is only the control UI.
- The Todo app sends the task and project context to Hermes.
- Hermes on the VPS resolves the relevant repository/worktree itself from `/opt/data/projects`, git remotes, and project/task context.
- No repo configuration is required in the Todo UI.
