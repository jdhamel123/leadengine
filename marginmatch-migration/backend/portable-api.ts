import { route, handleRequest } from './http-portable';
import { portableRuntime } from './portable-runtime';
import { createMattressTestCheckout, getMattressTestConfirmation } from './stripe-test';

type MattressQuoteBody = {
  zip?: string;
  item?: string;
  count?: number;
  access?: string;
  condition?: string;
};

const launchZips = new Set(['02035','02048','02093','02081','02067','02760','02766']);

function ownerHandledPrice(body: MattressQuoteBody) {
  const zip = String(body.zip || '').trim();
  if (!['02035','02766'].includes(zip)) return null;
  if (body.condition !== 'Clean and dry') return null;
  if (!['Curbside / garage','Customer drop-off'].includes(String(body.access || ''))) return null;

  const n = Math.max(1, Math.floor(Number(body.count) || 1));
  const drop = body.access === 'Customer drop-off';
  let customerPrice: number | null = null;

  if (drop) {
    if (body.item === 'Mattress') customerPrice = n === 1 ? 69 : n === 2 ? 119 : 119 + 50 * (n - 2);
    else if (body.item === 'Box spring') customerPrice = 49 + 50 * (n - 1);
    else if (body.item === 'Mattress + box spring') customerPrice = 99 + 50 * (n - 1);
  } else {
    if (body.item === 'Mattress') customerPrice = n === 1 ? 119 : n === 2 ? 199 : 199 + 70 * (n - 2);
    else if (body.item === 'Box spring') customerPrice = 99 + 70 * (n - 1);
    else if (body.item === 'Mattress + box spring') customerPrice = 159 + 70 * (n - 1);
  }
  return customerPrice;
}

route('GET', '/api/health', async () => {
  const checks: Record<string, unknown> = {
    runtime: 'portable',
    databaseConfigured: Boolean(process.env.SUPABASE_URL || process.env.POSTGREST_URL),
    secretsMode: 'environment',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    authVerifierConfigured: Boolean(process.env.AUTH_VERIFY_URL),
    productionActionsUnlocked: false,
  };

  if (checks.databaseConfigured) {
    try {
      await portableRuntime.db.list('ops-health', { limit: 1 });
      checks.databaseReachable = true;
    } catch (error) {
      checks.databaseReachable = false;
      checks.databaseError = error instanceof Error ? error.message : 'unknown';
    }
  }

  return Response.json(checks);
});

route('POST', '/api/mattress-quote', async (request) => {
  const body = await request.json() as MattressQuoteBody;
  const zip = String(body.zip || '').trim();

  if (!launchZips.has(zip)) {
    return Response.json({
      status: 'PRELIVE',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'This ZIP is not in the current MattressRescue launch area yet.',
    });
  }

  if (body.condition !== 'Clean and dry') {
    return Response.json({
      status: 'MANUAL REVIEW',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'This condition requires manual handling review before pricing.',
    });
  }

  const directPrice = ownerHandledPrice(body);
  if (directPrice != null) {
    const drop = body.access === 'Customer drop-off';
    return Response.json({
      status: 'OWNER-FULFILLED PRICE',
      verified: true,
      customerPrice: directPrice,
      checkout: false,
      fulfillment: 'owner-guaranteed',
      message: directPrice + ' owner-fulfilled ' + (drop ? 'customer drop-off' : 'curbside / garage pickup') + ' in ' + (zip === '02766' ? 'Norton' : 'Foxborough') + '.',
    });
  }

  if (!['Curbside / garage','Inside home - stairs'].includes(String(body.access || ''))) {
    return Response.json({
      status: 'MANUAL REVIEW',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'This access type needs supplier-specific handling verification before a firm price.',
    });
  }

  if (!(process.env.SUPABASE_URL || process.env.POSTGREST_URL)) {
    return Response.json({
      status: 'PRELIVE',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'Local fulfillment pricing is not connected in this preview yet.',
    });
  }

  const units = body.item === 'Mattress + box spring'
    ? 2
    : body.item === 'Multiple items'
      ? Math.max(1, Math.min(20, Math.floor(Number(body.count) || 1)))
      : 1;

  const rows = (await portableRuntime.db.list<any>('mattress-suppliers', { limit: 50 })).items
    .filter((r) => r.haulerVerified && r.recyclerVerified && Array.isArray(r.serviceZips) && r.serviceZips.includes(zip));

  const matches = rows.map((r) => ({
    cost: (Number(r.pickupCost || 0) + Number(r.recyclingCost || 0)) * units +
      (body.access === 'Inside home - stairs' ? Number(r.stairsSurcharge || 0) : 0),
  })).sort((a,b) => a.cost - b.cost);

  if (matches.length < 2) {
    return Response.json({
      status: 'PRELIVE',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'We are still verifying a backup-safe local fulfillment route for this ZIP.',
    });
  }

  const safeCost = Math.max(matches[0].cost, matches[1].cost);
  const reserve = 15;
  const target = Math.max(35, Math.ceil(safeCost * 0.3));
  const customerPrice = Math.ceil((safeCost + reserve + target) / 0.97 / 5) * 5;
  const processing = Math.ceil(customerPrice * 0.03);
  const expectedProfit = customerPrice - safeCost - processing - reserve;
  const marginPct = Math.round(expectedProfit / customerPrice * 100);

  if (expectedProfit < 35 || marginPct < 20) {
    return Response.json({
      status: 'MARGIN HOLD',
      verified: false,
      customerPrice: null,
      checkout: false,
      message: 'Local fulfillment exists, but protected pricing is not ready for checkout.',
    });
  }

  return Response.json({
    status: 'VERIFIED PRICE',
    verified: true,
    customerPrice,
    checkout: false,
    marginProtected: true,
    message: 'Price calculated from two verified local fulfillment routes. Checkout remains locked during migration testing.',
  });
});

route('POST', '/api/leads', async (request) => {
  if (!(process.env.SUPABASE_URL || process.env.POSTGREST_URL)) {
    return Response.json({ error: 'Database is not configured in this preview.' }, { status: 503 });
  }

  const body = await request.json() as Record<string, unknown>;
  const zip = String(body.zip || '').trim();
  if (!zip) return Response.json({ error: 'ZIP required' }, { status: 400 });

  const attributionIn = (body.attribution || {}) as Record<string, unknown>;
  const attribution = {
    source: String(attributionIn.source || body.source || 'direct'),
    medium: String(attributionIn.medium || ''),
    campaign: String(attributionIn.campaign || ''),
    term: String(attributionIn.term || ''),
    content: String(attributionIn.content || ''),
    referrer: String(attributionIn.referrer || ''),
    landingPage: String(attributionIn.landingPage || ''),
  };

  const record = {
    zip,
    email: String(body.email || '').trim().slice(0,200),
    phone: String(body.phone || '').trim().slice(0,40),
    address: String(body.address || '').trim().slice(0,180),
    preferredDate: String(body.preferredDate || '').trim().slice(0,40),
    preferredTime: String(body.preferredTime || '').trim().slice(0,20),
    source: String(body.source || attribution.source || 'direct'),
    stage: String(body.stage || 'quote-started'),
    customerType: String(body.customerType || 'residential'),
    projectTiming: String(body.projectTiming || '').trim().slice(0,60),
    budgetRange: String(body.budgetRange || '').trim().slice(0,60),
    contactPreference: ['Email','Phone'].includes(String(body.contactPreference || '')) ? String(body.contactPreference) : 'Email',
    attribution,
    createdAt: new Date().toISOString(),
  };

  const [id] = await portableRuntime.db.add('customer-leads', [record]);
  if (!id) return Response.json({ error: 'Could not save lead' }, { status: 500 });
  return Response.json({ id, attribution }, { status: 201 });
});

route('POST', '/api/mattress-test-checkout', async (request) => {
  const x=await request.json() as Record<string,unknown>;
  const zip=String(x.zip||'').trim();
  const email=String(x.email||'').trim().toLowerCase();
  const phone=String(x.phone||'').trim();
  const address=String(x.address||'').trim();
  const preferredDate=String(x.preferredDate||'').trim();
  const preferredTime=String(x.preferredTime||'').trim();
  const item=String(x.item||'');
  const access=String(x.access||'');
  const condition=String(x.condition||'');
  const count=Math.max(1,Math.floor(Number(x.count)||1));
  const quoted=ownerHandledPrice({zip,item,count,access,condition});
  const drop=access==='Customer drop-off';

  if(!['02035','02766'].includes(zip))
    return Response.json({error:'Test checkout is limited to the current owner-handled launch ZIPs'},{status:422});
  if(!email.includes('@')||phone.replace(/\D/g,'').length<10||!preferredDate||!preferredTime||(!drop&&!address))
    return Response.json({error:drop?'Email, phone and preferred drop-off date are required':'Email, phone, pickup address and preferred pickup date are required'},{status:400});
  if(condition!=='Clean and dry'||!['Curbside / garage','Customer drop-off'].includes(access))
    return Response.json({error:'Test checkout supports clean owner-handled pickup or drop-off offers only'},{status:422});
  if(quoted==null||Number(x.customerPrice)!==quoted)
    return Response.json({error:'Test checkout price does not match the current owner-handled quote'},{status:422});

  try{
    const created=await createMattressTestCheckout({
      zip,email,phone,address,preferredDate,preferredTime,item,count,access,condition,customerPrice:quoted
    });
    if(!created.sessionId||!created.url)
      return Response.json({error:'Stripe did not return a test checkout session'},{status:502});

    if(process.env.SUPABASE_URL||process.env.POSTGREST_URL){
      await portableRuntime.db.add('mattress-test-orders',[{
        sessionId:created.sessionId,zip,email,phone,address:drop?'PRIVATE DROP-OFF LOCATION':address,
        preferredDate,preferredTime,item,count,access,customerPrice:quoted,
        status:'test-checkout-created',createdAt:new Date().toISOString()
      }]);
    }

    return Response.json({
      url:created.url,sessionId:created.sessionId,mode:'test',amount:quoted,
      serviceType:drop?'customer-drop-off':'pickup',liveFunds:false
    });
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'Could not create Mattress Rescue test checkout'},{status:502});
  }
});

route('POST', '/api/mattress-test-confirmation', async (request) => {
  const x=await request.json() as Record<string,unknown>;
  const sessionId=String(x.sessionId||'').trim();
  try{
    const session=await getMattressTestConfirmation(sessionId);
    const status=String(session.status||'');
    const pi=session.payment_intent as Record<string,unknown>|null;
    const piStatus=pi?String(pi.status||''):'';
    if(status!=='complete'||!['requires_capture','succeeded'].includes(piStatus))
      return Response.json({error:'Stripe test booking is not complete'},{status:409});

    let order:any=null;
    if(process.env.SUPABASE_URL||process.env.POSTGREST_URL){
      const rows=(await portableRuntime.db.list<any>('mattress-test-orders',{limit:100})).items;
      order=rows.find((r:any)=>r.sessionId===sessionId)||null;
    }

    const receiptNumber='MR-'+sessionId.slice(-8).toUpperCase();
    const receipt={
      receiptNumber,
      amount:order?.customerPrice ?? Math.round(Number(session.amount_total||0)/100),
      zip:order?.zip || String((session.metadata as Record<string,unknown>|undefined)?.zip||''),
      serviceType:order?.access==='Customer drop-off'?'customer-drop-off':'pickup',
      preferredDate:order?.preferredDate || '',
      preferredTime:order?.preferredTime || '',
      paymentMode:'test',
      paymentStatus:piStatus,
      captured:false
    };
    return Response.json({receipt,testMode:true,liveFunds:false});
  }catch(error){
    const message=error instanceof Error?error.message:'Could not load booking confirmation';
    const status=message.includes('Valid Stripe test session')?400:502;
    return Response.json({error:message},{status});
  }
});

export { handleRequest };
