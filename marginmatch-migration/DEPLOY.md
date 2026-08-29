# MarginMatch independent deployment

## Preferred path: Docker

The portable runtime is intentionally host-neutral. A Docker-capable host is the
cleanest deployment target because the same image can run on a VPS, container
platform, or managed Docker host.

### Quality gates built into the image

The Docker build runs:

1. `npm run typecheck`
2. `npm run build`
3. `npm test`

A failed typecheck/build/contract test stops the image build.

### Fully self-hosted stack

`docker-compose.yml` can run:

- MarginMatch portable app
- PostgreSQL 16
- private MinIO S3-compatible object storage

Copy `.env.selfhost.example` to a private environment file and replace every
placeholder secret before starting the stack. Use URL-safe characters in the
PostgreSQL password because it is embedded in a connection URL.

After startup:

- public health: `/api/health`
- owner login: `#portable-login`
- owner cockpit: `#owner`
- operations: `#control-center`
- exceptions: `#exceptions`
- migration control: `#migration`
- Mattress supplier qualification: `#mattress-suppliers`

Run both owner self-tests from Migration Control before any domain cutover.

## Managed infrastructure option

Instead of the bundled PostgreSQL/MinIO stack, the app accepts:

### Database

Either:

- `DATABASE_URL` for ordinary PostgreSQL, or
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, or
- `POSTGREST_URL` + `POSTGREST_SERVICE_KEY`

Apply `database/001_platform_records.sql` before starting the app.

### Object storage

Either:

- S3-compatible storage using `S3_*` variables, or
- Supabase Storage using `SUPABASE_*` plus `SUPABASE_PROOF_BUCKET`

## Payment and messaging migration

During migration:

- Stripe must use a `*_test_*` key.
- outbound email and SMS remain disabled unless the migration-test switches and
  allowlists are explicitly enabled.
- legacy compatibility cannot access outbound messaging credentials unless
  `ENABLE_LEGACY_EXTERNAL_MESSAGING=true`.
- legacy live Stripe credentials remain blocked unless
  `ENABLE_LEGACY_LIVE_PAYMENTS=true`.

## Brand cutover

Mattress Rescue is the first native portable path. It has dedicated portable
quote, lead, Stripe-test checkout, confirmation, contractor onboarding,
dispatch, proof, exception, payroll-ledger, supplier qualification, and owner
operations routes.

The preserved legacy MarginMatch backend now runs against a portable compatibility
shim, but legacy traffic is disabled by default.

Full legacy portfolio traffic requires all three gates:

- `ENABLE_LEGACY_PORTABLE_ROUTES=true`
- `VITE_ENABLE_LEGACY_PORTFOLIO=true` at frontend build time
- `LEGACY_PORTFOLIO_PARITY_APPROVED=true`

Do not enable the third gate until `/api/legacy-compat-self-test` and end-to-end
parity testing pass.

## Vercel option

The repository also contains Vite/Vercel configuration and API function
wrappers. Treat Docker as the canonical deployment path until the Vercel
deployment is exercised successfully in an actual connected Vercel project.

## Domain rule

Do not repoint a customer domain merely because a deployment exists. Move a
domain only when its row in Migration Control reports cutover ready. Keep the
current AppDeploy deployment available as rollback until the replacement has
processed real traffic successfully.
