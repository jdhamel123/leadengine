# Independent deployment

## Vercel preview

This extracted app is prepared as a Vite project with Vercel Functions.

Project root directory:
`marginmatch-migration`

Build command:
`npm run build`

Output:
`dist`

Health check after deployment:
`/api/health`

## Environment variables

Start with only the variables required for the preview:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY (optional until AI parity testing)
- OPENAI_MODEL (optional)
- AUTH_VERIFY_URL (optional until admin auth migration)
- ADMIN_EMAIL_ALLOWLIST

Keep Stripe, Resend and Twilio production credentials unset in the first preview.
The migration preview must not perform real charges or external operational actions.

## Promotion rule

Do not point MarginMatch, Mattress Rescue, Dumpster Hound, Handled Stays or
other customer domains at this deployment until frontend build, health,
database, API parity, checkout test-mode, dispatch, email sandbox and admin
authorization checks all pass.
