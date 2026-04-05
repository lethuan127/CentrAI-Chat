---
name: scaffold-page
description: >-
  Scaffold a new Next.js page in apps/web with layout, loading state, and
  data fetching. Supports both end-user (dashboard) and admin pages. Use when
  creating a new page, adding a UI section, or when the user says "create page",
  "add page", "new screen", "scaffold UI".
---

# Scaffold Next.js Page

Create a new page in `apps/web/` following the project's App Router conventions.

## Determine Route Group

Ask or infer which route group:

| Group | Path | Who sees it | Auth |
|-------|------|------------|------|
| `(auth)` | `src/app/(auth)/` | Everyone | No |
| `(dashboard)` | `src/app/(dashboard)/` | Authenticated users | JWT |
| `(admin)` | `src/app/(admin)/admin/` | Admin / developer | JWT + RBAC |

## Files to Create

For a page at route `/admin/resource-name`:

```
src/app/(admin)/admin/resource-name/
├── page.tsx          # Page component (Server Component by default)
├── loading.tsx       # Suspense fallback
└── error.tsx         # Error boundary (optional)
```

## Page Template

### Admin Page (Server Component)

```tsx
// src/app/(admin)/admin/resource-name/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resource Name | CentrAI Admin',
};

export default async function ResourceNamePage() {
  // Fetch data server-side (or delegate to client component)
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resource Name</h1>
        {/* Action buttons */}
      </div>
      {/* Content */}
    </div>
  );
}
```

### End-User Page (Client Component — for interactive features)

```tsx
// src/app/(dashboard)/feature/page.tsx
'use client';

import { useState } from 'react';

export default function FeaturePage() {
  // Client state, hooks, WebSocket connections
  return (
    <div className="h-full flex flex-col">
      {/* Interactive UI */}
    </div>
  );
}
```

### Loading State

```tsx
// loading.tsx
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 bg-muted animate-pulse rounded" />
    </div>
  );
}
```

## Component Conventions

- Use `@centrai/ui` primitives (Button, Input, Dialog, etc.) — don't create parallel components.
- Styling with Tailwind only. Use `cn()` for conditional classes.
- Data tables: use a shared `DataTable` component from `components/admin/`.
- Forms: React Hook Form + Zod resolver with schemas from `@centrai/types`.

## Data Fetching

- **Admin pages**: fetch from `GET /api/v1/admin/...` or `GET /api/v1/resource-names` via the `apiClient` in `src/lib/api-client.ts`.
- **End-user pages**: fetch from end-user endpoints only (`GET /agents/published`, `GET /conversations`, etc.).
- **Never expose** admin data (system prompts, all-user lists, provider API keys) in end-user pages.

## RBAC in Frontend

The `(admin)/layout.tsx` already checks `user.role`. If a page needs finer-grained access (e.g., developers can see agents but not users):

```tsx
const user = await getServerUser();
if (user.role === 'USER') redirect('/chat');
if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') redirect('/admin');
```
