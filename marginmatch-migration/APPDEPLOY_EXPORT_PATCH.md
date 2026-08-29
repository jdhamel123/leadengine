# Live AppDeploy migration-export patch

AppDeploy rejected the attempted read-only export deployment because the account
has reached its hard lifetime deployment limit: **60/60 deploy_app requests**.

The intended live patch is preserved here so it can be applied only if the
AppDeploy account limit is increased. It is not required for the portable
runtime itself.

## Backend behavior

Add two owner-authenticated, read-only routes to the live AppDeploy backend:

- `GET /api/migration-export-manifest`
- `GET /api/migration-export/:collection?nextToken=...`

The manifest contains the 47 known collections, version 1, page size 100,
`readOnly:true`, and `secretsIncluded:false`.

The collection route:
- requires AppDeploy auth plus the existing owner email allowlist;
- allows only the 47 known collection names;
- calls one bounded `db.list(...,{limit:100,nextToken})`;
- returns `items` plus `nextToken`;
- never calls add/update/delete;
- never reads AppDeploy secrets.

## Frontend behavior

The Owner Cockpit adds **Export migration snapshot**. It reads the manifest,
walks each collection page-by-page, assembles the version-1 snapshot, downloads
JSON locally, and displays:

`Snapshot ready: <N> records across 47 collections. Source data was not changed.`

## Known collections

ad-campaigns, ai-agent-actions, analytics-events, call-workflows,
compliance-readiness, contractor-applications, contractor-payments,
customer-leads, customer-recovery-events, customer-suppressions, email-events,
evidence-ledger, launch-policy, ledger, mattress-driver-dispatches,
mattress-driver-profiles, mattress-fulfillment-events, mattress-suppliers,
mattress-test-orders, ops-followups, ops-health, order-exceptions, orders,
partner-call-records, project-concierge, providers, rack-rivet-inbound-attachments,
rack-rivet-inbound-evidence, rack-rivet-products, rack-rivet-suppliers,
retail-arbitrage, search-console-readiness, service-coordination,
staymargin-management-inquiries, staymargin-properties, staymargin-reservations,
staymargin-tasks, staymargin-vendors, supplier-acquisition, supplier-candidates,
support-cases, universal-fulfillment-jobs, universal-provider-offers,
universal-providers, vertical-opportunities, vertical-registry, vertical-suppliers.

## Safety

Do not expose an unauthenticated data-export URL. Customer records may contain
personal information. Never put a migration token or customer-data snapshot in
source code, chat, or a public repository.
