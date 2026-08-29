# Existing MarginMatch collections

The migration currently preserves these AppDeploy collection names exactly:

providers, orders, ledger, order-exceptions, ops-followups, ai-agent-actions,
mattress-driver-dispatches, ops-health, vertical-registry, analytics-events,
universal-fulfillment-jobs, customer-leads, universal-providers, call-workflows,
partner-call-records, vertical-suppliers, project-concierge,
staymargin-properties, staymargin-management-inquiries, staymargin-reservations,
staymargin-tasks, staymargin-vendors, compliance-readiness, launch-policy,
search-console-readiness, support-cases, customer-suppressions, ad-campaigns,
vertical-opportunities, evidence-ledger, retail-arbitrage,
rack-rivet-suppliers, rack-rivet-products, rack-rivet-inbound-evidence,
rack-rivet-inbound-attachments, customer-recovery-events, supplier-acquisition,
mattress-suppliers, mattress-test-orders, email-events,
mattress-fulfillment-events, mattress-driver-profiles, contractor-applications,
contractor-payments, universal-provider-offers, supplier-candidates,
service-coordination.

Initial migration uses `platform_records` with a collection discriminator and
JSONB payload. This is deliberate: it gives us a reversible, low-risk migration
before optimizing specific entities such as orders, drivers and payments into
strongly typed tables.
