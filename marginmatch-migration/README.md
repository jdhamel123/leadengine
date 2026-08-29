# MarginMatch Portable

Independent runtime extracted from the AppDeploy-hosted MarginMatch system.

## What is portable now

- React/Vite frontend client with no `@appdeploy/client`
- standard HTTP runtime
- direct PostgreSQL or Supabase/PostgREST database
- S3-compatible or Supabase object storage
- environment-backed secrets
- provider-neutral AI adapter
- signed portable owner sessions
- Stripe test-mode checkout
- gated Resend/Twilio migration messaging
- Mattress Rescue customer, dispatch, contractor, proof, exception and payroll-ledger workflows
- owner cockpit, operations, exception center and migration control
- AppDeploy-compatible backend shim for the preserved legacy portfolio
- Docker and Docker Compose deployment paths

## Default safety state

Production payments: locked  
Production messaging: locked  
Legacy compatibility traffic: locked  
Legacy portfolio frontend: locked

See `DEPLOY.md` and `MIGRATION.md`.
