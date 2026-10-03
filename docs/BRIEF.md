You are building "BoonBaby Store Manager", a multi-tenant SaaS stock management product for retail baby shops (clothing and accessories). Start in plan mode. Before planning, read this whole brief, then:

1. If anything is genuinely blocking, ask me all your questions in ONE batch (maximum 5, each with a recommended default). Do not ask about anything you can reasonably decide yourself.
2. For everything else, pick the sensible default, record it in /docs/DECISIONS.md (decision, reason, alternative), and proceed.
3. Write the plan and task list, then build phase by phase. After each phase: run the app, run tests and lint, check the result at phone, tablet, and desktop sizes, fix problems, commit, and give me a short summary before continuing.

Also create a CLAUDE.md at the repo root containing the stack, commands (dev, test, lint, db reset, type generation), the stock rules below, and the code conventions, and keep it up to date as the project evolves.

APP NAME

- Product name shown in the UI, login page, emails, PDFs, and page titles: "BoonBaby Store Manager"
- Repo, package, and folder name: boonbaby-store-manager
- PWA manifest name: "BoonBaby Store Manager", short_name: "BoonBaby"
- Use the name consistently in the README, CLAUDE.md, email templates, dispatch note and barcode sheet headers, and the browser tab title.
- Keep the brand name and logo in one shared config (for example /src/config/brand.ts) so it can be changed in one place later. Use a simple text-based logo placeholder until I provide a real logo.

PRODUCT PRINCIPLES

- Professional and essential: only the features listed here. No gimmicks, no decorative extras, no options "just in case". Every screen should have one clear purpose and few controls.
- Works properly on every device: desktop, tablet, and phone are all first-class (see Responsive and Device Requirements).
- Correctness first: stock numbers must always be right and auditable.

BUSINESS RULES

- A tenant is one shop with one Store Room (central inventory) and typically 2 Stores. Stock flows Supplier -> Store Room -> Store. Stores never transfer to each other; they can return stock to the Store Room.
- Units are pieces only. No sizes, colors, variants, expiry dates, batches, or cartons. One barcode and one quantity per product per location. Plan for 1,000 to 5,000 products per tenant.
- Selling happens in a separate billing module in the same overall system. This product exposes a sales API that reduces a store's stock; it contains no billing screen.

STACK

- Frontend: Next.js (App Router) + TypeScript (strict), Tailwind CSS, shadcn/ui, TanStack Table for data tables, React Hook Form + Zod
- Backend: Supabase (Postgres, Auth, Row Level Security, Storage, Edge Functions, pg_cron). Do not add a separate custom API server.
- Supabase CLI for local development (supabase start), SQL migrations committed in /supabase/migrations, seed in /supabase/seed.sql, generated TypeScript types (supabase gen types) committed and refreshed in the dev workflow
- @supabase/ssr for auth in server components, route handlers, and middleware
- Tests: Vitest for logic, pgTAP (or SQL test scripts) for database rules and RLS, Playwright for end-to-end at three viewport sizes
- Barcodes: Code 128 rendering with bwip-js or JsBarcode; PDF generation for dispatch notes and label sheets; camera scanning with @zxing/browser (USB scanners work as keyboard input in a focused field)
- Tooling: pnpm, ESLint, Prettier, Husky pre-commit (lint + typecheck), GitHub Actions CI (lint, typecheck, unit tests, database tests, build)
- Environment: .env.example with every variable documented; never commit secrets; the service-role key is used only in server-side code and Edge Functions

MULTI-TENANCY, ROLES, AND PORTALS

- Every business table has tenant_id. RLS is enabled on EVERY table with no exceptions. Policies use security-definer helper functions (for example current_tenant_id(), current_role(), user_location_ids()) so rules live in one place. Never rely on the frontend for security.
- Roles: OWNER, STOREROOM_MANAGER, STORE_STAFF. A profiles table links each auth user to a tenant, role, and assigned location(s).
- STORE_STAFF can only read and write data for their own store (enforced by RLS, not by the UI).
- Cost price lives in a separate table (product_costs) readable only by OWNER and STOREROOM_MANAGER, so store staff can never fetch it through any query.
- Portals by role after login: OWNER -> /owner, STOREROOM_MANAGER -> /storeroom, STORE_STAFF -> /store. Tenants are reached by subdomain ({slug}.localhost in dev, {slug}.yourdomain in production) resolved in middleware, with the auth cookie domain configured for subdomains. If subdomain auth proves unreliable in local dev, use a path-based fallback, note it in DECISIONS.md, and keep the tenant-resolution code in one module so it can be switched back.
- Signup creates the tenant, its Store Room, the first Store, and the OWNER profile in one database function. The Owner can add a second store and invite users (name, email, role, location) with an invite email.

DATA MODEL (refine details but keep these concepts)
tenants, locations (STORE_ROOM | STORE), profiles, suppliers, products (name, category CLOTHING | ACCESSORY, sku, barcode, selling_price, supplier_id, reorder_level, image_path, active), product_costs, stock_levels (product_id, location_id, quantity, unique pair, check quantity >= 0), stock_movements (append-only ledger: product_id, location_id, type, quantity_delta, ref_type, ref_id, user_id, note, created_at), receipts (+lines), dispatches (+lines), restock_requests (+lines), return_damage_entries, label_print_log, audit_log, api_keys (hashed).
Movement types: RECEIPT, DISPATCH_OUT, DISPATCH_IN, SALE, RETURN_OUT, RETURN_IN, DAMAGE, SUPPLIER_RETURN, ADJUSTMENT.
Indexes: tenant_id on every table, plus (tenant_id, barcode) unique, (tenant_id, sku) unique, stock_levels (location_id, product_id), stock_movements (product_id, location_id, created_at).
Product images go in a Supabase Storage bucket with per-tenant paths and storage policies.

STOCK RULES (implement as Postgres functions called through RPC, each running in a single transaction, never as multi-step client-side updates)

1. stock_levels changes only through functions that also write a stock_movements row. Direct inserts/updates/deletes on stock_levels and stock_movements are blocked for all client roles.
2. Stock can never go negative; the function raises a clear error that the UI shows in plain language.
3. receive_stock(): supplier, invoice number, lines (product, quantity, optional cost). Adds to Store Room stock. Allowed: STOREROOM_MANAGER, OWNER.
4. create_dispatch() and send_dispatch(): Draft -> Dispatched. Sending deducts Store Room stock (DISPATCH_OUT) and marks the lines in transit for the destination store.
5. receive_dispatch(): store staff enter received quantity per line and flag missing and/or damaged quantity with a note. Good quantity is added to store stock (DISPATCH_IN). If any line has missing or damaged quantity, the dispatch becomes "Received with issues" and appears in the Store Room's discrepancy list. resolve_discrepancy() lets the Store Room Manager either return the quantity to Store Room stock or write it off; both write ledger movements.
6. Returns and damaged: staff create an entry (type, product, quantity, reason). Store-to-Store-Room returns and write-offs need approval by STOREROOM_MANAGER or OWNER; stock changes only on approval.
7. Sales API: an Edge Function POST /sales authenticated by a per-tenant API key (stored hashed; the Owner can create and rotate it in Settings). Body: location_id, external_ref, items [{barcode, quantity}]. Idempotent on external_ref, reduces that store's stock via a database function, returns clear error codes. Also expose the same database function for the in-system billing module to call directly. Document both in the README.
8. Every state-changing function writes an audit_log row.

RESTOCK REQUESTS

- Manual: store staff search products, enter quantities, submit.
- Suggested: a pg_cron job (nightly) plus an on-demand button creates suggested requests for store products at or below reorder_level, with suggested quantity = max(1, reorder_level * 2 - current quantity), in status "Waiting for Staff Approval". Store staff must Approve / Edit / Skip each line and press "Forward to Store Room". Suggestions are invisible to the Store Room (enforced by RLS) until forwarded.
- Status flow: Draft -> Waiting for Staff Approval (suggested only) -> Sent -> Approved or Rejected -> Dispatched. Approving creates a pre-filled draft dispatch in one click.

BARCODES AND LABELS

- Every product gets a unique barcode on creation (auto-generated Code 128 value unless an existing one is entered; unique per tenant).
- Barcode Labels page: pick products individually or "all items from a recent receipt"; labels per product; A4 sticker sheet presets (24, 40, 65 per sheet); optional start position on a partly used sheet via a clickable grid; live preview; Print and Download PDF. Each label shows product name, price, SKU, and barcode. Log each print.
- A scan-capable search field on every inventory screen. On phone and tablet, a camera button opens a full-screen scanner with an item card and quantity stepper.

SCREENS (minimal; each one earns its place)
Store Room: Dashboard (total products, total pieces, low-stock items, pending requests, recent activity); Products (searchable, filterable, paginated; add/edit; CSV/Excel import with validation preview); Receive Stock; Dispatch (+ printable dispatch note); Restock Requests; Returns and Damaged (+ discrepancies); Barcode Labels; Reports.
Store: Dashboard; My Stock; Incoming Dispatches (confirm receipt with missing/damaged flags); Request Restock (manual + suggested); Return or Report Damaged; Stock History.
Owner: Dashboard comparing Store Room, Store A, Store B (pieces, low-stock counts, one bar chart, pending approvals); Reports with location filter; Users and Locations; Settings (company details, API key).
Reports (date filters, CSV/Excel and PDF export): stock list, low stock, dispatch history by store, damaged and returns, stock movement history.
Plus: login, password reset, a notification bell (low stock, pending approvals, dispatches to confirm), and a short first-run checklist for new tenants. Do not build anything not listed here.

RESPONSIVE AND DEVICE REQUIREMENTS (hard requirements, not polish)

- Mobile-first CSS. Verified at 360x800 (phone), 768x1024 and 1024x768 (tablet), 1280x800 and 1920x1080 (desktop). Nothing may overflow horizontally at any size.
- Navigation: desktop = left sidebar with 5-7 items; tablet = collapsed icon rail with large touch targets; phone = bottom navigation (Home, Stock, Scan, Requests, More) with a central Scan button. Respect safe-area insets on notched phones.
- Data tables turn into compact stacked cards on phone (key fields visible, details on tap). Forms are single column on phone, with correct input types and numeric keypads for quantities.
- Touch targets at least 44px; no hover-only interactions; sticky action bars for primary actions on phone.
- Ship as an installable PWA (manifest, icons, standalone display) so shop staff can add it to a home screen. Camera scanning must work in the installed app on Android and iOS Safari. Handle camera permission denial with a clear fallback to typing the code.
- Performance: server-side pagination and search for product lists (never load all 5,000 products), debounced search, optimistic UI only where safe, Lighthouse mobile score of 90 or higher for performance, accessibility, and best practices on the main screens.
- Accessibility: keyboard navigable, visible focus states, labels on every input, WCAG AA contrast, respects reduced-motion.
- Handle poor connections gracefully: clear loading states, retry on failure, and never double-submit a stock action (disable buttons while pending and use idempotency keys on mutating RPC calls).

VISUAL DESIGN (professional, restrained)

- Clean, calm, business-grade UI in the spirit of well-made admin tools: a neutral base, one primary accent (soft teal), and soft pastel tints (mint, powder blue, peach, lavender) used sparingly for status chips and chart series. No heavy gradients, no animations beyond subtle transitions.
- Light and dark themes (follow system, with a toggle). If I attach exported Stitch designs, match them closely.
- Rounded sans-serif font (Nunito or Poppins) with tabular numbers for quantities; consistent spacing scale; 12px radius; subtle shadows.
- Build a small shared component set first (page header, data table, status chip, stat card, empty state, confirm dialog, scanner sheet, form fields) and reuse it everywhere so the product feels consistent.
- Clear microcopy, helpful empty states, confirmation for destructive actions, and toast feedback.

SAAS LAYER (final phase, kept lean)

- Plans Starter / Standard / Pro that differ only by limits (products, locations, users), enforced in database functions with friendly upgrade prompts.
- 14-day trial, then subscription through Razorpay (INR) behind a payment-provider interface, with a webhook Edge Function that updates tenant plan and status. Tenant states: trial, active, past_due (read-only), canceled.
- Owner can export all tenant data as CSV.

PHASES (stop after each for my review)

1. Repo setup, tooling, CI, Supabase local setup, schema + RLS + helper functions, seed data, auth, tenant and role routing, shared UI shell with responsive navigation, and RLS isolation tests (a user can never read or write another tenant's data, and store staff can never see another store).
2. Products, suppliers, product_costs, barcode generation, CSV import, images, and the scan/search component.
3. Receive Stock and the stock functions with database tests for every rule above.
4. Dispatch, store receipt with missing/damaged flags, discrepancy resolution.
5. Restock requests (manual + suggested with staff approval).
6. Returns and damaged, the sales Edge Function with idempotency, and API docs.
7. Barcode label sheets (A4 presets, start position, PDF).
8. Dashboards, reports, notifications, exports.
9. PWA, device pass (phone, tablet, desktop), accessibility pass, performance pass.
10. SaaS layer: signup, onboarding checklist, plans and limits, Razorpay billing.
11. Production readiness: hosted Supabase project setup, migration deployment steps, backups note, error monitoring hook, README with setup and deployment instructions.

DEFINITION OF DONE
Lint, typecheck, unit, database, and end-to-end tests all pass in CI; a fresh clone runs with documented commands and seeded demo logins for each role; RLS tests prove tenant and store isolation; every screen works at phone, tablet, and desktop sizes; the README documents setup, environment variables, the sales API, and deployment.
