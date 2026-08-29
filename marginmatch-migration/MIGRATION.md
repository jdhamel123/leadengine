# MarginMatch — AppDeploy exit status

## Objective

Remove AppDeploy as a required runtime dependency while preserving the current
live deployment as rollback until independent replacements pass parity testing.

## Completed architecture

- Frontend AppDeploy client removed from the portable path.
- AppDeploy SDK removed from the portable backend platform boundary.
- PostgreSQL record adapter supports direct `DATABASE_URL` or Supabase/PostgREST.
- Object storage supports S3-compatible providers or Supabase Storage.
- Standard Request/Response HTTP router implemented.
- Portable Node server and Docker image implemented.
- Fully self-hosted Docker Compose stack added: app + PostgreSQL + MinIO.
- Environment-backed secrets implemented.
- Provider-neutral AI adapter implemented.
- Portable HMAC owner sessions + admin allowlist implemented.
- Stripe test-mode adapter rejects live keys.
- Resend/Twilio migration messaging is disabled by default and allowlist gated.
- Owner cockpit, portable operations, exception center and migration control added.
- Portable self-test and legacy compatibility self-test added.
- CI definition includes typecheck, frontend build, contract tests and workflow harness.
- AppDeploy-compatible shim built for the preserved legacy backend.

## Mattress Rescue native portable parity

Implemented portable routes/workflows for:

- customer quote
- lead capture
- Stripe test checkout
- Stripe confirmation / receipt
- gated transactional confirmation email
- approved-contractor application and approval
- ZIP-based dispatch offers
- first-accept-wins job routing
- en-route / at-pickup progress
- pickup + completion proof
- completion
- compensation earning ledger
- contractor payment-record ledger
- contractor portal
- supplier / recycler qualification
- backup-safe supplier pricing
- exception detection
- constrained AI exception triage
- owner exception dashboard

Production payments and production messaging remain locked.

## Legacy portfolio compatibility

The original MarginMatch backend now imports `backend/platform.ts`, which is a
portable compatibility shim rather than `@appdeploy/sdk`.

Compatibility traffic remains disabled by default.

Required gates before the legacy portfolio is allowed to serve traffic:

1. `ENABLE_LEGACY_PORTABLE_ROUTES=true`
2. `VITE_ENABLE_LEGACY_PORTFOLIO=true` during frontend build
3. `LEGACY_PORTFOLIO_PARITY_APPROVED=true`

Outbound legacy messaging and live Stripe credentials have additional,
independent locks.

## Cutover policy

Migration Control reports readiness per brand. Mattress Rescue can be cut over
independently; Dumpster Hound, Handled Stays, Rack & Rivet and the full legacy
MarginMatch admin remain validation-locked until compatibility parity passes.

Never repoint every domain at once. Move one validated brand, observe real
traffic, preserve rollback, then continue brand by brand.

## Verification status

Repository-level structural verification has been performed through the GitHub
connector.

An actual independent build/deployment has not yet run because:

- no non-AppDeploy hosting account/connector is connected in this chat;
- GitHub Actions currently shows no workflow runs for the migration branch,
  despite the workflow being committed and push-triggered.

These are infrastructure/account execution blockers, not reasons to modify the
live AppDeploy sites.

## Next external execution

1. Connect a Docker-capable host or Vercel-compatible deployment account.
2. Provision ordinary PostgreSQL + S3 storage, or use the bundled Docker Compose stack.
3. Supply private environment variables.
4. Deploy with all production locks off.
5. Sign in through `#portable-login`.
6. Run Migration Control self-tests.
7. Run Mattress Rescue end-to-end test traffic.
8. Only after all checks pass, move Mattress Rescue DNS.
9. Test the legacy compatibility shim.
10. Migrate remaining brands one at a time.


## Snapshot migration tooling

The portable repository now includes:
- `npm run migrate:import -- snapshot.json`
- `npm run migrate:export -- backup.json`
- `npm run migrate:reconcile -- snapshot.json`

Reconciliation verifies both per-collection record counts and canonical SHA-256
content hashes. Source AppDeploy data must remain intact for rollback.
