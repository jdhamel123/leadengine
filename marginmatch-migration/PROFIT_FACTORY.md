# MarginMatch Profit Factory

Mission: operate a large portfolio of tiny-to-large automated businesses.
A business does not need to be huge to survive. It needs to be measurably
profitable, lawful, low-maintenance, and worth its resource footprint.

## Portfolio rules

Every experiment gets:
- unique business/experiment ID
- revenue attribution
- direct API/email/SMS/payment/ad cost attribution
- estimated human-exception minutes
- gross profit
- contribution profit after variable costs
- automation rate
- confidence/sample-size indicator
- lifecycle: idea -> build -> test -> earning -> scale / hold / kill

## Decision engine

SCALE
- contribution profit > 0
- no unresolved critical compliance/safety issue
- automation rate >= target
- evidence is sufficient for the spend increase
- increase spend/capacity gradually, never uncapped

HOLD / IMPROVE
- revenue exists but contribution profit <= 0, or sample is too small
- diagnose acquisition cost, conversion, fulfillment/API cost, pricing
- run bounded improvement experiments

KEEP TINY
- contribution profit > 0 but market is small
- leave automated and running
- minimize maintenance
- periodically retest pricing/acquisition

KILL / ARCHIVE
- persistent negative contribution after bounded tests
- excessive manual intervention
- compliance/reputation risk
- opportunity cost exceeds plausible upside

## Shared factory modules

- tenant/business provisioning
- landing/intake forms
- email inbox + reply classification
- consent/suppression
- AI qualification
- quote/RFQ generation
- vendor matching
- follow-up cadences
- Stripe payment links/checkout
- attribution ledger
- exception queue
- monitoring/audit/dead-letter queue
- deployment/versioning

## Initial experiment families

1. Lead Rescue
2. Dead Quote Recovery
3. Past Customer Reactivation
4. Estimate Chase
5. Review + Referral Loop
6. Cancellation Slot Filler
7. AI Procurement Broker
8. Vendor Bid Desk
9. Equipment Rental Broker
10. Event Rental Broker
11. Commercial Property Vendor Desk
12. Group Hotel Bidder
13. RFP Opportunity Alerts
14. Vendor Price Monitor
15. Competitor Intelligence Digest
16. AI Email Receptionist
17. Website Lead Qualifier
18. Contractor Dispatch Desk
19. Automated Local SEO Audit
20. Business Follow-up Assistant

## Core metric

Contribution profit =
collected revenue
- refunds
- payment fees
- AI/API costs
- email/SMS costs
- advertising attributable to the experiment
- fulfillment/vendor cost
- allocated infrastructure variable cost

Do not confuse revenue with profit.

## Owner experience

The owner should primarily see:
- total collected revenue
- contribution profit
- businesses earning today / 7d / 30d
- businesses losing money
- experiments needing authorization
- exceptions requiring judgment
- recommended SCALE / HOLD / KILL actions

No autonomous uncapped spending. Spending increases and production-risk changes
must stay behind explicit limits/approval.
