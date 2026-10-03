# Decisions

Each entry: **Decision** — why — _alternative considered_. Newest phase last.

## Phase 1 — Foundation

### Environment and tooling

1. **Repo lives in `boonbaby-store-manager/` inside the workspace.** The brief names the repo/folder; the workspace root holds the original brief. _Alt: init in the workspace root._
2. **pnpm and the Supabase CLI are installed globally** (your choice). CI uses `supabase/setup-cli`. _Alt: Supabase CLI as a devDependency._
3. **Supabase Analytics (Logflare) is disabled locally.** It is heavy, unused by the app, and unreliable on Windows Docker. _Alt: keep it on._
4. **Next.js 16 uses `src/proxy.ts`.** `middleware.ts` is deprecated and was renamed to `proxy` in v16. _Alt: none._
5. **shadcn/ui uses the radix-nova preset.** Its components import `cn` from the `cn` package, which shadcn maintains. Sizes were raised to 44px touch targets below the xl breakpoint and drop to compact sizes on desktop. _Alt: the Base UI preset._
6. **TanStack Table v9** (current major): `useTable({ features, columns, data })`. The DataTable only renders server-paginated data, so no client row models are used. _Alt: pin v8._
7. **The Next.js dev indicator is off** because it covered the phone bottom navigation. _Alt: move it._

### Security and data

8. **RLS helpers are in a private `app` schema with non-reserved names**: `app.current_tenant_id()`, `app.current_app_role()`, `app.visible_location_ids()`, `app.is_manager()`, `app.is_owner()`. `current_role` is a reserved SQL keyword, and the `app` schema isn't exposed by the Data API. _Alt: `public.current_role_()`._
9. **Role and tenant are read from `profiles` on every query, not from JWT claims**, so role changes and deactivations apply immediately. Helpers are STABLE and called as `(select …)`, so each runs once per statement. _Alt: a custom access-token hook._
10. **One user belongs to exactly one tenant** (`profiles.user_id` is the primary key). Shops are small and staff aren't shared between them. _Alt: a membership table._
11. **Nothing is granted implicitly.**
    - Default privileges are revoked, including Postgres's built-in EXECUTE-to-PUBLIC on functions, which needs a _global_ default-privilege revoke.
    - Every grant is explicit, and test `01_security_structure` fails if anon can execute anything except `tenant_public_info`.
    - _Alt: rely on Supabase defaults plus RLS._
12. **Clients get SELECT only on stock, ledger, audit, and document tables.** All writes go through SECURITY DEFINER RPCs. Catalogue tables (products, suppliers, product_costs) allow direct manager writes under RLS. _Alt: RPCs for everything._
13. **Composite foreign keys `(tenant_id, id)`** pin child rows to their parent's tenant, so even a buggy function can't link across tenants. _Alt: tenant checks only in code._
14. **Store staff visibility**: they see their store's data, plus the Store Room's _location row_ (needed for dispatch notes) but never Store Room stock. Profiles: managers see the team, staff see only themselves. _Alt: let staff see all locations._
15. **Restock requests in Draft or "Waiting for Staff Approval" are hidden from the Owner too**, not only from the Store Room Manager. Managers act on forwarded requests only. _Alt: let the owner see drafts._
16. **Business errors use SQLSTATE `P0001`, a stable `BB_*` code in HINT, and a human-written message.** `src/lib/errors.ts` shows the message and maps raw constraint errors to plain language. _Alt: parse message text._
17. **Idempotency**: an `idempotency_keys` table plus a transaction-scoped advisory lock per key. A repeated call returns the first result, and reusing a key for a different function is rejected. _Alt: unique constraints per document._
18. **Every stock change goes through `app.apply_stock_movement()`.** It locks the row, checks the quantity, updates the level, and writes the ledger row with `quantity_after`. _Alt: triggers on stock_levels._
19. **Discrepancy write-off is recorded as `RETURN_IN +q` then `DAMAGE −q` at the Store Room.** In-transit stock isn't a location, and this keeps the ledger traceable with net zero. "Return to stock" records only `RETURN_IN +q`. _Alt: a virtual "in transit" location._
20. **Return and damage entries made by managers at the Store Room apply immediately**, because the creator is the approver. Entries from store staff wait for approval. _Alt: approval for everyone._
21. **`sales` and `sale_lines` tables will be added** (Phase 6), so the sales API can be idempotent on `(tenant_id, external_ref)`. _Alt: idempotency keys only._
22. **Barcode default**: `BB` plus a 10-digit per-tenant counter, which is Code 128-safe and short enough to scan. **SKU default**: `CLO-00001` / `ACC-00001`. Both are unique per tenant. _Alt: EAN-13, which needs a GS1 prefix._
23. **Document numbers** (`RCV-00001`, `DSP-00001`, and so on) come from a per-tenant counter table. _Alt: UUIDs only._
24. **Seed opening stock is recorded as `ADJUSTMENT` movements** through the real stock primitive, so the ledger invariant holds from the first row. _Alt: insert stock_levels directly._

### Tenancy and auth

25. **Subdomain tenancy, `{slug}.localhost:3000` in dev.** Chromium and Firefox resolve `*.localhost` with no hosts-file edits. The auth cookie is host-only in dev (`NEXT_PUBLIC_AUTH_COOKIE_DOMAIN` empty) and `.yourdomain` in production. Path mode (`/t/{slug}`) is implemented in `src/lib/tenant/resolve.ts` and switched with `NEXT_PUBLIC_TENANT_MODE=path`. Subdomain mode works in dev and Playwright, so it is the default. _Alt: path mode by default._
26. **Server components resolve the tenant from the proxy header, falling back to the Host header.** Renders that follow a Server Action redirect didn't receive proxy-added request headers. _Alt: rely on the header only._
27. **Login returns a destination and the browser does a full navigation**, so the portal renders with fresh auth state and no stale RSC cache. _Alt: `redirect()` inside the action._
28. **The root domain shows "Find your shop"** (and signup in Phase 10). A sign-in for a user from another shop fails with the same message as a wrong password, so the form doesn't reveal which shops exist. _Alt: a global login that redirects to the tenant._
29. **Auth email templates are generated from `brand.ts`** (`pnpm brand:emails`). Links use `{{ .RedirectTo }}` to land on the tenant's own `/auth/confirm`, so the session cookie is set on the right subdomain. _Alt: hand-written templates._

### UI

30. **Navigation is per portal, with at most 7 items.** Store Room: Dashboard, Products, Receive, Dispatch, Requests, Returns, Reports. **Barcode Labels** is reached from Products and Receive and from the phone "More" sheet, to keep the sidebar at 7. The Owner has 5 items plus a "Store Room view" switch in the account menu. _Alt: an 8-item sidebar._
31. **Breakpoints**: phone below 768 (bottom nav), tablet 768–1279 (80px icon rail, so 1024×768 counts as tablet), desktop 1280 and up (256px sidebar). _Alt: sidebar from 1024._
32. **Theme**: soft teal primary (`oklch(0.52 0.088 186)`, AA with white text), pastel chip and chart tints, Nunito, 12px radius, system theme with a toggle in the account menu (next-themes). _Alt: Poppins._
33. **Users & Locations (invites) moves to Phase 2.** Phase 1 has no product data to manage yet, and invites need the owner screens. _Alt: Phase 8 with the other owner screens._
34. **Screens for later phases are placeholders** (`PlannedScreen`), so the navigation and responsive checks cover every route from Phase 1. _Alt: hide nav items until built._

### Planned (recorded now, implemented later)

- **Notifications are computed, not stored**: one `notification_summary()` RPC, polled every 60 seconds and on navigation, with no read/unread state.
- **Libraries**:
  - PDFs: pdf-lib, with barcodes from bwip-js, generated client-side.
  - CSV: papaparse.
  - XLSX: SheetJS from cdn.sheetjs.com, because the npm copy is outdated.
  - Charts: Recharts through shadcn charts.
- **PWA**: a hand-written service worker that caches static assets and an offline page only, never data or mutations.
- **Defaults**: INR and Asia/Kolkata, stored per tenant. Label presets: A4 at 3×8 (24), 4×10 (40), and 5×13 (65).
- **Billing**: Razorpay behind a `PaymentProvider` interface, with limits in a `plans` table enforced by `app.assert_within_limit()`. `app.assert_tenant_writable()` already blocks writes when a tenant is past_due, canceled, or at the end of its trial.

## Purchase bill payments (added 2026-10-03)
- **Decision:** Each receipt (purchase bill) records a payment status, PAID or UNPAID. UNPAID requires a deadline. The bill amount is optional, and the bill file (PDF or photo, up to 10 MB) is optional.
  - Bill files live in the private `purchase-bills` bucket under `{tenant}/{receipt}/…`.
  - The fields are set in `receive_stock` and can be changed later through `set_receipt_payment` and `set_receipt_bill`.
  - Every change writes an audit row.
- **Where it shows:** the Purchase Bills page (Unpaid / Overdue / Paid / All tabs, with totals). The notification bell flags overdue bills and bills due within 3 days.
- **Why:** The owner needs to track what is owed to suppliers. This is record-keeping only: no payment gateway and no online payments (the user's call).
- **Alternative considered:** a separate bills table. Rejected because one receipt is one supplier invoice, so the receipt is the bill.
- **Existing data:** receipts that existed before this change were marked PAID.

## No billing; shops stay active (added 2026-10-03)
- **Decision:** There are no subscription plans, no trial lock and no payment gateway. A new shop starts out `active`, and only a `canceled` shop becomes read-only (an operator sets that by hand in the database).
- **Why:** This was the user's call. A 14-day trial lock with no way to pay would have frozen every shop.
- **Alternative:** a Razorpay subscription behind a provider interface. It was dropped from scope; the `tenant_status` enum still has room for it later.

## Signup, export and monitoring (added 2026-10-03)
- **Signup:** the server creates the owner's login with the service role (email pre-confirmed), then calls `signup_create_tenant`, which only `service_role` can run. If creating the shop fails, the login is deleted so the owner can retry. A hidden honeypot field stops basic bots. Before launch, add Supabase Auth CAPTCHA if abuse becomes a problem.
- **Export:** `/owner/settings/export` streams a zip with one CSV per table. RLS limits every read to the owner's shop. API key hashes and internal bookkeeping tables are left out.
- **Errors:** `reportError()` in `src/lib/report-error.ts` is the single hook. Server errors reach it through `instrumentation.ts`. Set `ERROR_WEBHOOK_URL` to forward them. There's no vendor SDK, so it stays lightweight. Swap in the Sentry SDK there if you want full tracing.
- **PWA:** a hand-written `public/sw.js`. It caches only build assets and the offline page, never data, and registers only in production builds.
