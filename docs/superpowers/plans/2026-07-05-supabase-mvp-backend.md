# Supabase MVP Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase backend foundation for Local Way: schema, RLS policies, storage buckets, and a frontend integration boundary that can replace mock data incrementally.

**Architecture:** Supabase owns Auth, Postgres, Storage, and RLS for the MVP. The existing `apps/consumer` and `apps/admin` apps will call a small shared Supabase client module first, then feature-specific data modules. A separate API server is deferred until privileged server workflows are needed.

**Tech Stack:** Supabase Auth, PostgreSQL, Supabase Storage, RLS, React/Vite, `@supabase/supabase-js`.

---

### File Structure

- Create `supabase/migrations/20260705000000_initial_local_way_schema.sql`: schema, enum types, triggers, RLS policies, storage buckets, and storage policies.
- Create `packages/supabase-client/package.json`: shared workspace package metadata.
- Create `packages/supabase-client/src/client.js`: browser Supabase client factory.
- Create `packages/supabase-client/src/localWayApi.js`: typed data access functions for auth, guide applications, tours, and admin review.
- Modify `apps/consumer/package.json`: add `@local-way/supabase-client` and `@supabase/supabase-js`.
- Modify `apps/admin/package.json`: add `@local-way/supabase-client` and `@supabase/supabase-js`.
- Create `apps/consumer/.env.example`: Supabase browser environment variables.
- Create `apps/admin/.env.example`: Supabase browser environment variables.

### Task 1: Supabase Schema And Policies

**Files:**
- Create: `supabase/migrations/20260705000000_initial_local_way_schema.sql`

- [ ] **Step 1: Create schema migration**

Create `supabase/migrations/20260705000000_initial_local_way_schema.sql` with enum types, tables, indexes, triggers, RLS policies, and storage bucket setup from the checked-in migration.

- [ ] **Step 2: Apply migration locally**

Run:

```bash
supabase db reset
```

Expected: the local database resets and applies `20260705000000_initial_local_way_schema.sql` without SQL errors.

- [ ] **Step 3: Verify advisors**

Run:

```bash
supabase db advisors
```

Expected: no critical security warnings for public tables without RLS.

### Task 2: Shared Supabase Client Package

**Files:**
- Create: `packages/supabase-client/package.json`
- Create: `packages/supabase-client/src/client.js`
- Create: `packages/supabase-client/src/localWayApi.js`
- Modify: `apps/consumer/package.json`
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Add package metadata**

Create `packages/supabase-client/package.json`:

```json
{
  "name": "@local-way/supabase-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/client.js",
  "exports": {
    ".": "./src/client.js",
    "./localWayApi": "./src/localWayApi.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4"
  }
}
```

- [ ] **Step 2: Add client factory**

Create `packages/supabase-client/src/client.js`:

```js
import { createClient } from '@supabase/supabase-js';

export function createLocalWaySupabaseClient(env = import.meta.env) {
  const url = env.VITE_SUPABASE_URL;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }

  return createClient(url, publishableKey);
}
```

- [ ] **Step 3: Add data access functions**

Create `packages/supabase-client/src/localWayApi.js` with functions for `getActiveTours`, `submitGuideApplication`, `getPendingGuideApplications`, and `reviewGuideApplication`.

- [ ] **Step 4: Link package dependencies**

Add this dependency to both app package files:

```json
"@local-way/supabase-client": "workspace:*"
```

Also add:

```json
"@supabase/supabase-js": "^2.45.4"
```

- [ ] **Step 5: Install dependencies**

Run from the workspace root:

```bash
pnpm install
```

Expected: lockfiles update and both apps can resolve `@local-way/supabase-client`.

### Task 3: Environment Examples

**Files:**
- Create: `apps/consumer/.env.example`
- Create: `apps/admin/.env.example`

- [ ] **Step 1: Add consumer environment example**

Create `apps/consumer/.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

- [ ] **Step 2: Add admin environment example**

Create `apps/admin/.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

### Task 4: Frontend Integration Check

**Files:**
- Modify after Task 2: `apps/consumer/src/pages/Pages.jsx`
- Modify after Task 2: `apps/admin/src/pages/AdminPages.jsx`

- [ ] **Step 1: Keep mock fallback while adding Supabase reads**

Add Supabase reads behind a small data-loading boundary so the apps still render mock data when environment variables are absent.

- [ ] **Step 2: Verify consumer app**

Run:

```bash
pnpm --dir apps/consumer test
pnpm --dir apps/consumer build
```

Expected: tests pass and Vite build completes.

- [ ] **Step 3: Verify admin app**

Run:

```bash
pnpm --dir apps/admin test
pnpm --dir apps/admin build
```

Expected: tests pass and Vite build completes.

---

### Self-Review

- Spec coverage: schema, auth model, guide approval, storage, RLS, mock migration path, and frontend integration are covered.
- Placeholder scan: no deferred implementation step uses an undefined placeholder; deferred product features are explicitly out of MVP scope.
- Type consistency: role, application status, tour status, and reservation status names match the schema design.
