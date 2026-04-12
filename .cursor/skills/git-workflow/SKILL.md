---
name: git-workflow
description: Execute git operations following CentrAI-Chat conventions: stage changes, write Conventional Commit messages, create branches, and open PRs with gh. Use when the user asks to commit, stage, create a branch, open a PR, write a commit message, or says "git", "commit", "push", "PR", "pull request", or "branch".
---

# Git Workflow for CentrAI-Chat

## Commit Message Format

`<type>(<scope>): <subject>`

Types: `feat` `fix` `refactor` `chore` `docs` `test` `perf` `ci`

Scopes: `api` `web` `worker` `ui` `sdk` `config` `types` `prisma` `auth` `agents` `providers` `chat` `infra`

Rules: imperative mood · no trailing period · subject ≤ 72 chars · body explains **why**

```
feat(agents): add draft → published status transition
fix(api): prevent system prompt leakage in user chat endpoint
chore(prisma): add workspaceId index on Message table
```

## Workflow: Stage & Commit

1. Run `git status` and `git diff` to understand what changed
2. Stage intentionally — group related files, never `git add .` blindly
3. Derive type + scope from the diff; write the subject in imperative mood
4. If changes span multiple concerns, split into separate commits

```bash
git add apps/api/src/agents/          # stage only the relevant files
git commit -m "$(cat <<'EOF'
feat(agents): add tool-calling support to agent execution

OpenAI function-calling requires a tool registry; wired up existing
ToolRegistry into the AgentExecutor so agents can invoke tools at runtime.
EOF
)"
```

## Workflow: Create a Branch

Branch off `main` unless told otherwise:

```bash
git checkout main && git pull
git checkout -b feat/short-description   # lowercase, hyphens only
```

Branch naming: `feat/` `fix/` `chore/` `docs/` `refactor/` `test/`

## Workflow: Open a PR

```bash
git push -u origin HEAD
gh pr create --title "feat(scope): subject" --body "$(cat <<'EOF'
## Summary
- What changed and why

## Test plan
- [ ] Step to verify the change works
- [ ] Edge cases covered
EOF
)"
```

PR title must follow Conventional Commits (same as the squash-merge commit).

## Safety Checks

- Never commit `.env`, secrets, or `node_modules/`
- Always commit `pnpm-lock.yaml` alongside `package.json` changes
- Never force-push `main`
- Don't amend commits that have already been pushed
- Don't commit or push unless the user explicitly asks

## Quick Reference

```bash
git log --oneline -10           # recent commits
git diff --staged               # what's staged
git stash                       # save WIP without committing
git stash pop                   # restore WIP
gh pr list                      # open PRs
gh pr view --web                # open current PR in browser
```
