---
name: deploy
description: Bump an application version cleanly, prepare a release commit, and push the result to the remote branch. Use this skill whenever the user asks to deploy, release, ship, publish, push to main, bump the version, align package.json/package-lock.json, or put current local changes online, especially for Node projects with package.json.
---

# Deploy

This skill is for release-oriented Git work: inspect the current branch, bump the version, update release notes when appropriate, commit, and push without rewriting history.

Default stance: be conservative with Git safety and explicit about what was released.

## Workflow

1. Inspect repository state first.
   - Run `git status --short --branch`, `git remote -v`, and check the current branch.
   - Read the current version source before changing anything. For Node projects, start with `package.json`, then align `package-lock.json` if it exists.
   - If the user asked for `main`, confirm the current branch is `main` or switch only if that is clearly safe and requested.

2. Decide the target version.
   - If the user specifies a version, use it exactly.
   - If the user asks for a bump without precision, default to a patch bump.
   - For Node projects with `package.json`, compute the target version and use `scripts/bump_node_release.py`.

3. Update release metadata cleanly.
   - Keep `package.json` and `package-lock.json` aligned.
   - If `CHANGELOG.md` exists, prepend a short entry for the new version using the current date and a compact summary of the shipped changes.
   - Do not invent release notes unrelated to the actual diff.

4. Validate proportionally.
   - Prefer a lightweight verification pass such as reading the diff and, if cheap, running the most relevant repo check.
   - If global lint/test failures already exist elsewhere, state that clearly instead of blocking the release on unrelated issues.

5. Commit and push safely.
   - Use a release-style commit message such as `chore: release vX.Y.Z`.
   - Push with `git push origin <current-branch>` unless the user explicitly requested a different remote or branch.
   - Never force-push unless the user explicitly asks for it.

## Node Release Script

For Node repositories, use this helper instead of ad hoc text edits. In this repo, run:

```bash
python3 .codex/skills/deploy/scripts/bump_node_release.py \
  --root "$PWD" \
  --version 2.15.2
```

If this skill is installed in another skill directory, resolve `scripts/bump_node_release.py` relative to this `SKILL.md`.

This script updates:
- `package.json`
- `package-lock.json` root `version`
- `package-lock.json.packages[""].version`

The changelog remains a manual edit because its format varies by repository.

## Release Rules

- Do not revert unrelated local changes.
- Do not create tags unless the user asks for tags.
- If there is no clear version source, say so briefly and fall back to a plain commit-and-push workflow.
- If the working tree is already clean and everything is already pushed, report that instead of creating an empty release commit.
- If the repository has uncommitted changes and the user asked to "put everything online", include those changes in the release after a quick sanity check.

## Output

At the end, report:
- the version before and after
- the commit hash created for the release
- the branch and remote pushed
- any validation that was run
- any non-blocking issues noticed during the release
