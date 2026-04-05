---
name: review-pr
description: >-
  Review code changes for quality, security, and CentrAI-Chat architecture
  compliance. Use when reviewing a pull request, examining a diff, or when the
  user asks for "code review", "review PR", "check my changes", or "review this".
---

# CentrAI-Chat Code Review

Review code changes against project standards. Focus on what's unique to this codebase — assume the agent already knows general TypeScript/NestJS/Next.js best practices.

## Review Checklist

### 1. RBAC & Persona Enforcement

- [ ] Admin endpoints use `@Roles('ADMIN')` or `@Roles('ADMIN', 'DEVELOPER')`
- [ ] End-user endpoints don't expose admin data (system prompts, provider API keys, user lists)
- [ ] `GET /agents/published` returns only `status=PUBLISHED` agents with limited fields
- [ ] New admin pages are under `(admin)/` route group, not `(dashboard)/`
- [ ] New end-user features are under `(dashboard)/`, not `(admin)/`

### 2. Data Security

- [ ] API keys / secrets encrypted before DB storage (never plaintext)
- [ ] `passwordHash` excluded from all query selects
- [ ] `systemPrompt` excluded from end-user-facing API responses
- [ ] No secrets in frontend code or client bundles
- [ ] `.env` files not committed

### 3. Validation & Types

- [ ] Zod schemas defined in `@centrai/types`, not duplicated in `apps/api`
- [ ] `ZodValidationPipe` applied on all endpoints accepting body input
- [ ] TypeScript types derived from Zod with `z.infer<>`, not hand-written
- [ ] No `any` types

### 4. Database

- [ ] New models have `workspaceId` FK, `createdAt`, `updatedAt`, `deletedAt`
- [ ] Soft delete used (set `deletedAt`), not hard delete
- [ ] Migration name is descriptive (not `migration-1`)
- [ ] Queries filter out `deletedAt IS NOT NULL` where appropriate

### 5. API Conventions

- [ ] Responses use `{ data, error: null }` envelope
- [ ] Controller is thin — business logic in service
- [ ] Swagger decorators on every controller method (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- [ ] Endpoint paths are plural, kebab-case (`/agents`, `/provider-configs`)

### 6. Frontend

- [ ] Server Components by default; `"use client"` only when needed
- [ ] UI primitives from `@centrai/ui`, not custom duplicates
- [ ] Agent/model picker only shows published/enabled items
- [ ] Loading states with `loading.tsx` or Suspense
- [ ] Forms use React Hook Form + Zod resolver

### 7. Agent Publish Workflow

If the change touches agents:
- [ ] New agents default to `DRAFT` status
- [ ] Only `PUBLISHED` agents visible to end users
- [ ] Editing creates a new version (immutable versions)
- [ ] `POST /agents/:id/publish` is admin/developer only

## Feedback Format

- **Critical** — must fix: bugs, security issues, RBAC violations, data leaks
- **Suggestion** — should improve: patterns, readability, missing validation
- **Nit** — optional: naming, style, minor refactors

Keep feedback actionable: state what's wrong and how to fix it.
