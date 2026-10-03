# Build plan and task list

Every phase ends with these steps: run the app, run lint, typecheck, unit, database, and E2E tests, check phone, tablet, and desktop sizes, fix what fails, commit, update CLAUDE.md and DECISIONS.md, summarise, and **stop for review**.

## Phase 1 — Foundation ✅ (awaiting review; commit blocked until Git is installed)

- [x] Next 16 + TS strict + Tailwind 4 + ESLint + Prettier + Husky/lint-staged + Vitest + Playwright (phone/tablet/desktop)
- [x] shadcn/ui, theme tokens (teal, pastel tints, 12px radius, Nunito, tabular numbers), light/dark + toggle, `brand.ts`
- [x] Supabase local: schema for every table in the brief, indexes, `app.*` helpers, RLS on every table, revoked DML, audit/idempotency/counter helpers, stock primitive, `create_tenant_with_owner()`
- [x] Seed: two tenants, each with a Store Room and Stores A and B, demo logins per role, products with opening stock
- [x] `db:reset`, `db:types` (types committed), `db:test`, `db:lint`
- [x] Auth: login, reset request, update password, `/auth/confirm`, sign out; `proxy.ts` tenant resolution; role-gated portals
- [x] Shell: desktop sidebar / tablet icon rail / phone bottom nav with central Scan and safe-area insets
- [x] Shared components: PageHeader, StickyActionBar, DataTable (cards on phone), Pagination, StatusChip, StatCard, EmptyState, ConfirmDialog, QtyStepper, form fields, ScannerSheet (manual or USB entry)
- [x] pgTAP: structure (RLS everywhere, grants), tenant isolation, store isolation, ledger protections and invariant
- [x] CLAUDE.md, DECISIONS.md, README, .env.example, CI workflow
- [ ] Commit (waiting for Git)

## Phase 2 — Products

- [ ] Suppliers CRUD (managers)
- [ ] Products list: server pagination, debounced search (name/SKU/barcode, trigram), category/supplier/low-stock filters
- [ ] Add/edit product; barcode and SKU auto-generation in the DB (unique per tenant); cost price (managers only)
- [ ] Product images: Storage bucket `product-images/{tenant_id}/…` with storage policies; client-side resize to webp
- [ ] CSV/XLSX import with a validation preview, then a single `import_products()` RPC
- [ ] ScanSearchField (USB Enter), camera ScannerSheet (@zxing/browser), permission-denied fallback
- [ ] Store "My Stock" list (read-only)
- [ ] Users & Locations: invite user (name, email, role, location), add second store, deactivate user
- [ ] Tests: pgTAP (barcode/SKU uniqueness, cost visibility, storage policies), Vitest (import validation), E2E

## Phase 3 — Receive stock

- [ ] `receive_stock()` RPC (supplier, invoice, lines, optional cost; idempotent; audit)
- [ ] Receive Stock screen (scan to add lines, numeric keypad, sticky action bar)
- [ ] pgTAP for every stock rule

## Phase 4 — Dispatch

- [ ] `create_dispatch`, `send_dispatch`, `receive_dispatch`, `resolve_discrepancy`
- [ ] Dispatch list/editor, printable dispatch note (PDF + print CSS), store Incoming Dispatches, discrepancy list

## Phase 5 — Restock requests

- [ ] Manual requests; `generate_restock_suggestions()` (pg_cron nightly + button); staff Approve/Edit/Skip → Forward; approve → draft dispatch

## Phase 6 — Returns, damage, sales API

- [ ] Return/damage entries + approval; `record_sale()`; `sales` Edge Function (API key, idempotent, error codes); API key create/rotate; README API docs

## Phase 7 — Barcode labels

- [ ] Picker (products / recent receipt), 24/40/65 presets, start position grid, live preview, Print + PDF, print log

## Phase 8 — Dashboards, reports, notifications

- [ ] Dashboards (Store Room, Store, Owner with one bar chart); 5 reports with CSV/XLSX/PDF export; notification bell; Stock History

## Phase 9 — Device, accessibility, performance pass

- [ ] PWA (manifest, icons, service worker); camera on Android/iOS installed app; axe checks; Lighthouse ≥ 90

## Phase 10 — SaaS layer

- [ ] Signup + onboarding checklist; plans/limits; trial → Razorpay subscription + webhook; tenant states; full CSV export

## Phase 11 — Production readiness

- [ ] Hosted Supabase setup, migration deploy, backups note, error-monitoring hook, final README
