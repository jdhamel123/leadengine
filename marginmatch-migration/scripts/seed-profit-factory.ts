import {portableRuntime} from '../backend/portable-runtime';

const experiments=[
['Lead Rescue','recover-paid-leads','home-services'],
['Dead Quote Recovery','reactivate-dormant-estimates','b2b-services'],
['Past Customer Reactivation','reactivate-past-customers','local-services'],
['Estimate Chase','follow-open-estimates','home-services'],
['Review + Referral Loop','post-job-review-referral','local-services'],
['Cancellation Slot Filler','refill-cancelled-appointments','appointments'],
['AI Procurement Broker','buyer-vendor-arbitrage','b2b-procurement'],
['Vendor Bid Desk','opportunity-to-bid-draft','b2b-vendors'],
['Equipment Rental Broker','rental-arbitrage','equipment'],
['Event Rental Broker','rental-arbitrage','events'],
['Commercial Property Vendor Desk','maintenance-vendor-match','property'],
['Group Hotel Bidder','group-rate-bid-match','travel'],
['RFP Opportunity Alerts','rfp-match-alert','b2b'],
['Vendor Price Monitor','price-monitor','procurement'],
['Competitor Intelligence Digest','competitive-monitor','b2b'],
['AI Email Receptionist','email-intake-resolution','local-services'],
['Website Lead Qualifier','web-lead-qualification','local-services'],
['Contractor Dispatch Desk','dispatch-as-service','field-services'],
['Automated Local SEO Audit','seo-audit-report','local-services'],
['Business Follow-up Assistant','follow-up-as-service','b2b']
] as const;

const existing=(await portableRuntime.db.list<any>('profit-factory-experiments',{limit:1000})).items;
const names=new Set(existing.map((x:any)=>String(x.name||'').toLowerCase()));
let added=0;
for(const [name,model,vertical] of experiments){
 if(names.has(name.toLowerCase()))continue;
 await portableRuntime.db.add('profit-factory-experiments',[{
   name,model,vertical,status:'idea',maxTestSpend:0,
   collectedRevenue:0,refunds:0,paymentFees:0,apiCost:0,messagingCost:0,
   advertisingCost:0,fulfillmentCost:0,infrastructureVariableCost:0,
   humanExceptionMinutes:0,automationRate:100,
   recommendation:'build',createdBy:'factory-seed',createdAt:new Date().toISOString()
 }]);
 added++;
}
console.log(JSON.stringify({seeded:added,total:existing.length+added}));
