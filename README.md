# BoonBaby Store Manager

Stock management for baby clothing and accessory shops. Each shop (tenant) has one **Store Room** and a few
**Stores**: stock is received from suppliers into the Store Room, dispatched to stores, and sold through a separate
billing module that calls this product's sales API. Every stock change is recorded in an append-only ledger.

Built with Next.js 16, Supabase (Postgres + RLS, Auth, Storage, Edge Functions), Tailwind CSS, and shadcn/ui.

> Status: **feature-complete, in user testing.** Payments are out of scope: purchase bills are tracked as paid/unpaid with deadlines, but no money moves through the app. See [docs/TESTING.md](docs/TESTING.md).

## Prerequisites

- Node.js 24+ and pnpm 12 (`npm i -g pnpm`)
- Docker Desktop (running) — local Supabase runs in containers
- Supabase CLI 2.x ([install](https://supabase.com/docs/guides/local-development/cli/getting-started))

## Set up and run locally

```bash
pnpm install
cp .env.example .env.local        # local defaults work as-is
pnpm db:start                     # starts Supabase, applies migrations and seed
pnpm dev                          # http://boonbaby.localhost:3000
```

`*.localhost` subdomains resolve automatically in Chrome, Edge, and Firefox. Safari: use the path fallback
(set `NEXT_PUBLIC_TENANT_MODE=path`, then open http://localhost:3000/t/boonbaby).

### Demo logins

Password for all: `123`. Pick an account from the **Demo account** dropdown on the login page (shown when `DEMO_LOGIN=true`).

| Shop (open)                    | Owner               | Store Room Manager      | Store A staff        | Store B staff        |
| ------------------------------ | ------------------- | ----------------------- | -------------------- | -------------------- |
| http://boonbaby.localhost:3000 | owner@boonbaby.test | storeroom@boonbaby.test | storea@boonbaby.test | storeb@boonbaby.test |
| http://tinytots.localhost:3000 | owner@tinytots.test | storeroom@tinytots.test | storea@tinytots.test | storeb@tinytots.test |

Local emails (invites, password resets) appear in Mailpit: http://127.0.0.1:54324. Supabase Studio: http://127.0.0.1:54323.

## Commands

| Command                                        | What it does                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Dev server                                                                                      |
| `pnpm build` / `pnpm start`                    | Production build / serve                                                                        |
| `pnpm lint` · `pnpm typecheck` · `pnpm format` | Code quality                                                                                    |
| `pnpm test`                                    | Unit tests (Vitest)                                                                             |
| `pnpm db:test`                                 | Database tests (pgTAP): RLS isolation and stock rules                                           |
| `pnpm e2e`                                     | End-to-end tests (Playwright) at phone, tablet, and desktop sizes; first run `pnpm e2e:install` |
| `pnpm db:start` / `pnpm db:stop`               | Start / stop local Supabase                                                                     |
| `pnpm db:reset`                                | Recreate the local DB from migrations + seed, then regenerate types                             |
| `pnpm db:types`                                | Regenerate `src/types/database.ts` from the local schema                                        |
| `pnpm db:lint`                                 | Lint SQL functions                                                                              |
| `pnpm brand:emails`                            | Regenerate auth email templates from `src/config/brand.ts`                                      |

A pre-commit hook (Husky) runs ESLint/Prettier on staged files and the typechecker. CI (`.github/workflows/ci.yml`)
runs lint, format check, typecheck, unit tests, database lint and tests, a types-up-to-date check, the production
build, and the E2E suite.

## Environment variables

All variables are documented in [.env.example](.env.example).

| Variable                               | Where            | Purpose                                                                            |
| -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | browser + server | Supabase API URL                                                                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable key; all access governed by RLS                                        |
| `SUPABASE_SECRET_KEY`                  | **server only**  | Service-role key (bypasses RLS) — used only for admin auth actions such as invites |
| `NEXT_PUBLIC_ROOT_DOMAIN`              | browser + server | Root host, e.g. `localhost:3000` or `yourdomain.com`                               |
| `NEXT_PUBLIC_TENANT_MODE`              | browser + server | `subdomain` (default) or `path`                                                    |
| `NEXT_PUBLIC_SITE_PROTOCOL`            | browser + server | `http` in dev, `https` in production                                               |
| `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN`       | browser + server | Empty in dev; `.yourdomain.com` in production                                      |
| `ERROR_WEBHOOK_URL`                    | **server only**  | Optional. Server errors are POSTed here as JSON (Slack, Sentry relay, etc.)        |

## How it is organised

- `supabase/migrations/` — schema, RLS policies, and the Postgres functions that implement every stock rule
- `supabase/tests/database/` — pgTAP tests (tenant isolation, store isolation, ledger protection)
- `src/proxy.ts` — tenant resolution and session refresh; `src/lib/tenant/resolve.ts` — subdomain/path switch
- `src/features/<domain>/` — queries, server actions, schemas, and components per feature
- `src/components/shared/` — the shared component set; `src/components/shell/` — responsive navigation
- `docs/DECISIONS.md` — every design decision with reason and alternative

## Sales API

The billing module records each sale here. The sale reduces the store's stock in the same transaction.

```
POST {NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sales
Authorization: Bearer bb_live_…          (or  X-API-Key: bb_live_…)
Content-Type: application/json

{
  "location_id": "<store UUID>",
  "external_ref": "INV-2026-000123",
  "items": [ { "barcode": "BB0000000012", "quantity": 2 } ]
}
```

- **API keys.** Create keys in **Owner → Settings → Sales API keys**. A key is shown only once, and only its hash is stored. Rotate a key by creating a new one and then revoking the old one.
- **Store ID.** Each store's `location_id` is shown on the same Settings page.
- **Idempotent.** `external_ref` is unique per shop. Sending the same sale again returns `200` with `"duplicate": true` and does not change stock again. If a request fails, retry it with the same `external_ref`.
- **All or nothing.** If any item fails, the whole sale is rejected and no stock changes.

Success response (`201` for a new sale, `200` for a duplicate):

```json
{ "sale_id": "…", "external_ref": "INV-2026-000123", "duplicate": false, "location_id": "…",
  "lines": [ { "barcode": "BB0000000012", "quantity": 2 } ] }
```

Errors return `{ "error": { "code": "…", "message": "…" } }`:

| HTTP | code                 | When                                                                 |
| ---- | -------------------- | -------------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`    | Body missing or malformed (the message names the field)              |
| 401  | `INVALID_API_KEY`    | Key missing, wrong or revoked                                        |
| 403  | `ACCOUNT_READ_ONLY`  | The shop account has been closed                                     |
| 404  | `LOCATION_NOT_FOUND` | `location_id` is not one of this shop's stores                       |
| 409  | `INSUFFICIENT_STOCK` | The store doesn't have enough of an item (the message says which)    |
| 422  | `UNKNOWN_BARCODE`    | A barcode doesn't match any product                                  |
| 500  | `INTERNAL_ERROR`     | Unexpected. Safe to retry with the same `external_ref`               |

## Deployment (production)

You need:
- a hosted **Supabase** project
- a Node host for Next.js, for example **Vercel**
- a domain with **wildcard DNS**, so that every shop gets `shopname.yourdomain.com`

### 1. Supabase

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push                         # applies every migration in supabase/migrations
supabase functions deploy sales --no-verify-jwt   # the API authenticates with its own keys
```

Do **not** run `seed.sql` in production: it creates the demo shops.

In the Supabase dashboard:
1. **Auth → URL configuration.** Set Site URL to `https://yourdomain.com`. Add `https://*.yourdomain.com/**` to the redirect URLs.
2. **Auth → SMTP.** Connect a real email sender (Resend, SES, Postmark, …). Without one, invites and password resets are heavily rate-limited.
3. **Auth → Email templates.** Paste the templates from `supabase/templates/`.
4. **Database → Extensions.** Make sure `pg_cron` is enabled. The nightly restock suggestions job (`restock-suggestions`, 20:30 UTC = 02:00 IST) is created by the migrations. Check it with `select * from cron.job;`.
5. **Storage.** The `product-images` and `purchase-bills` buckets are created by the migrations. Both are private.
6. **Backups.** The Pro plan has daily backups. Turn on Point-in-Time Recovery if you can't lose a day of stock data. Owners can also download a full CSV export from Settings.

### 2. Next.js app (Vercel)

1. Import the project and set the environment variables from the table above:
   - `NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com`
   - `NEXT_PUBLIC_SITE_PROTOCOL=https`
   - `NEXT_PUBLIC_AUTH_COOKIE_DOMAIN=.yourdomain.com`
   - the Supabase URL, the publishable key and `SUPABASE_SECRET_KEY`
2. Add both `yourdomain.com` and `*.yourdomain.com` as domains in the Vercel project. Vercel issues the wildcard certificate.
3. At your DNS provider, point `yourdomain.com` and `*.yourdomain.com` at Vercel, following Vercel's instructions.
4. Optional: set `ERROR_WEBHOOK_URL` to get server errors sent to Slack or another tool.

### 3. After the first deploy

1. Open `https://yourdomain.com/signup` and create your shop.
2. Sign in at `https://yourshop.yourdomain.com` and follow the setup checklist on the dashboard.
3. Install the app on phones: in Chrome use **Add to Home screen**, and in Safari use **Share → Add to Home Screen**.

### Updating

Push the code, then run `supabase db push` (and `supabase functions deploy sales` if the function changed). Migrations only ever add to the schema, so the app keeps working while they run.