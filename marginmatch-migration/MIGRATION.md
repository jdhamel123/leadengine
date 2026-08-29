# MarginMatch — AppDeploy exit plan

The live AppDeploy deployment remains untouched until an independent preview passes parity testing.

## Replacement map
- database -> Postgres/Supabase
- secrets -> host environment/secret manager
- storage -> S3-compatible storage
- AI -> provider-neutral adapter
- auth -> Supabase Auth/Auth.js-compatible adapter
- router -> standard HTTP/serverless handlers
- realtime -> standard WebSocket/realtime provider
- cron -> managed scheduler

## Sequence
1. Isolate AppDeploy SDK behind backend/platform.ts.
2. Inventory database collections and routes.
3. Build Postgres schema and adapter.
4. Copy data without deleting the source.
5. Move secrets without exposing their values.
6. Deploy an independent preview.
7. Run checkout, dispatch, email, admin and safety-gate parity tests.
8. Keep Stripe test mode during migration testing.
9. Move one domain only after parity passes.
10. Preserve rollback until the replacement is proven.

Existing locks must remain locked during migration: production payments, paid ads, unsolicited outreach, supplier commitments and inventory purchasing.
