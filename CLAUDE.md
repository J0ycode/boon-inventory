@AGENTS.md

# BoonBaby Store Manager

Multi-tenant SaaS for baby shops: one Store Room (central stock) and its Stores per tenant. Stock flows
Supplier → Store Room → Store; stores never transfer to each other but can return to the Store Room.
Pieces only — no sizes, variants, batches, or cartons. Selling happens in a separate billing module that calls our sales API.

Full brief: `docs/BRIEF.md`. Decisions and their reasons: `docs/DECISIONS.md`. Task list: `docs/PLAN.md`.

## Stack

- Next.js 16 (App Router, **`src/proxy.ts` — not middleware.ts**), React 19, TypeScript strict
- Tailwind CSS 4, shadcn/ui (radix-nova preset), TanStack Table **v9** (`useTable({ features, columns, data })`), React Hook Form + Zod 4
- Supabase: Postgres 17, Auth, RLS, Storage, Edge Functions, pg_cron — **no separate API server**
- @supabase/ssr for auth cookies; generated types in `src/types/database.ts` (committed)
- Tests: Vitest (logic), pgTAP via `supabase test db` (RLS + stock rules), Playwright (phone/tablet/desktop)
- pnpm, ESLint, Prettier, Husky (pre-commit: lint-staged + typecheck), GitHub Actions CI

## Commands

| What                                                 | Command                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| Start local Supabase (Docker must be running)        | `pnpm db:start`                                  |
| Dev server                                           | `pnpm dev` → open http://boonbaby.localhost:3000 |
| Reset DB (migrations + seed) and regenerate types    | `pnpm db:reset`                                  |
| Regenerate types only                                | `pnpm db:types`                                  |
| Database tests (pgTAP)                               | `pnpm db:test`                                   |
| Database lint                                        | `pnpm db:lint`                                   |
| Unit tests                                           | `pnpm test`                                      |
| End-to-end tests (starts `pnpm dev` if not running)  | `pnpm e2e`                                       |
| Lint / typecheck / format                            | `pnpm lint` / `pnpm typecheck` / `pnpm format`   |
| Regenerate auth email templates after a brand change | `pnpm brand:emails`                              |

Demo logins (password `Password123!`): `owner@`, `storeroom@`, `storea@`, `storeb@` + `boonbaby.test` (shop `boonbaby`)
or `tinytots.test` (shop `tinytots`).

## Stock rules (non-negotiable)

1. `stock_levels` changes ONLY via `app.apply_stock_movement()`, which locks the row, refuses to go negative
   (`BB_INSUFFICIENT_STOCK`), and writes a `stock_movements` ledger row in the same transaction.
   Clients have no INSERT/UPDATE/DELETE grant on stock, ledger, audit, or document tables.
2. Stock can never go negative: friendly error first, `CHECK (quantity >= 0)` as the backstop.
3. Every stock action is a Postgres function called through RPC (single transaction) — never multi-step client updates.
4. Every state-changing function writes `audit_log` (`app.audit`) and takes `p_idempotency_key uuid`
   (`app.idempotency_begin` / `app.idempotency_finish`).
5. Ledger invariant (tested): `sum(quantity_delta)` = `stock_levels.quantity` for every product × location.
6. Flows: receive (Store Room +) → dispatch Draft→Dispatched (Store Room −, in transit) → store receipt
   (good qty +; missing/damaged → "Received with issues" → `resolve_discrepancy`: return to stock or write off).
   Store returns and write-offs change stock only on manager/owner approval. Sales API reduces a store's stock,
   idempotent on `external_ref`.

## Security model

- Every business table has `tenant_id` and RLS enabled — no exceptions (tested in `01_security_structure`).
- Policy helpers live in the private `app` schema: `app.current_tenant_id()`, `app.current_app_role()`,
  `app.is_manager()`, `app.is_owner()`, `app.visible_location_ids()`. Call them in policies as `(select app.fn())`
  (cast arrays: `any ((select app.visible_location_ids())::uuid[])`).
- RPC guards: `app.require_user(array['OWNER', ...]::app_role[])` then `app.assert_location_access(profile, location)`.
- Store staff see only their assigned store(s) (+ the Store Room's location row, not its stock). `product_costs` is
  manager-only. Restock suggestions are invisible to managers until forwarded.
- Service-role key: server-only (`src/lib/supabase/admin.ts`) and Edge Functions. Never import admin.ts from client code.
- New functions: Postgres grants EXECUTE to PUBLIC by default — always `revoke execute ... from public, anon` and grant
  explicitly. Test 01 fails if anon can call anything except `tenant_public_info`.

## Code conventions

- Feature code in `src/features/<domain>/`: `queries.ts` (server reads), `actions.ts` (`"use server"`, Zod-validate →
  RPC), `schemas.ts` (Zod), components next to them. Shared UI in `src/components/shared/`, shell in `src/components/shell/`.
- Reuse the shared set: `PageHeader`, `StickyActionBar`, `DataTable` (cards on phone via `meta.mobile`), `Pagination`,
  `StatusChip`, `StatCard`, `EmptyState`, `ConfirmDialog`, `QtyStepper`, `TextField`/`SubmitButton`/`FormError`, `ScannerSheet`.
- Errors: DB functions raise via `app.raise('BB_CODE', 'Human message')`; UI shows `toUserMessage(error)` (`src/lib/errors.ts`).
- Tenant: never build tenant URLs by hand — use `tenantPath` / `tenantUrl` (server) or `useTenantHref` (client).
  `src/lib/tenant/resolve.ts` is the only module that knows subdomain vs path mode.
- Server data: Server Components + URL search params for list state (page, q, filters); server-side pagination, never
  load the whole catalogue. Debounce search 300 ms.
- Mutations: disable the submit while pending (`SubmitButton`), send an idempotency key generated when the form mounts,
  toast on success, confirm destructive actions.
- Responsive: mobile-first. Phone < md (768) bottom nav; tablet md–xl icon rail; desktop ≥ xl (1280) sidebar.
  Touch targets ≥ 44px below xl (buttons/inputs already sized). No hover-only UI. Numeric inputs use `inputMode="numeric"`.
- Design tokens in `src/app/globals.css` (teal primary, pastel tints `mint/blue/peach/lavender/danger` for chips and
  charts only, 12px radius). Quantities use `tabular-nums`. Brand name/logo only from `src/config/brand.ts`.
- Migrations: new file per change in `supabase/migrations/` (timestamped); after schema changes run `pnpm db:reset`,
  commit regenerated `src/types/database.ts`, add pgTAP tests for any new rule.
- Windows note: when scripting file writes in PowerShell 5.1, write UTF-8 **without BOM** (a BOM breaks SQL migrations).
