# MarginMatch AI Revenue Lab

Goal: create cash quickly without distracting from the AppDeploy exit.

## Selection rule
Only launch offers that:
1. can be demonstrated in under 5 minutes;
2. solve a problem already costing a small business money;
3. require little/no customer AI knowledge;
4. can be fulfilled mostly by the existing portable stack;
5. create recurring revenue or a transaction fee;
6. can be sold before building a large custom product.

## Launch order

### 1. Lead Rescue — FIRST
Promise: "We recover leads you are already paying for."

For home-service businesses:
- web lead captured;
- immediate branded response;
- qualification questions;
- persistent follow-up;
- appointment request;
- owner receives only qualified/escalated conversations;
- outcome/revenue attribution.

Pilot commercial model:
- no large setup fee;
- 14-day pilot;
- charge per qualified appointment OR monthly after proof;
- configurable pricing, never hard-coded.

Differentiator: not an AI chatbot. It is a revenue-recovery service with an
owner-visible audit trail showing which leads were recovered.

### 2. Estimate Chase
Automatically follows open estimates/quotes until won, lost, or human-needed.
Revenue attribution makes ROI obvious.

### 3. No-Show Rescue
Appointment reminders, confirmation, reschedule links, and automatic filling of
cancellations from a waitlist.

### 4. Review + Referral Loop
After a completed job, request feedback/review and ask happy customers for a
referral. Escalate unhappy responses privately.

### 5. AI Dispatch Desk
Reusable version of Mattress Rescue dispatch: coverage, offer, first acceptance,
reminders, proof-of-work photos, completion, contractor ledger.

## What not to build yet
- generic "AI agency" website;
- general chatbot builder;
- huge CRM replacement;
- dozens of verticals before first outside paying pilot;
- expensive local-model/GPU infrastructure.

## MVP Lead Rescue data model
Collections:
- revenue-lab-tenants
- revenue-lab-leads
- revenue-lab-conversations
- revenue-lab-appointments
- revenue-lab-attribution

Tenant configuration:
- business name
- service types
- service ZIPs
- hours
- approved FAQ/price guidance
- escalation contact
- booking URL
- follow-up cadence
- messaging consent/compliance settings

Safety:
- no outbound production messaging until tenant explicitly enables it;
- no invented prices;
- no legal/medical/financial advice;
- STOP/opt-out suppresses future automated SMS;
- uncertain requests escalate;
- all AI actions auditable.
