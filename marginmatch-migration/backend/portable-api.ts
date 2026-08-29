import { route, handleRequest } from './http-portable';
import { portableRuntime } from './portable-runtime';
import { createMattressTestCheckout, getMattressTestConfirmation } from './stripe-test';
import { sendMattressConfirmation } from './resend-portable';
import { sendTestSms } from './twilio-portable';
import { writeProof } from './storage-supabase';

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

    let emailSent=false;
    let emailId='';
    if(order?.email){
      try{
        const sent=await sendMattressConfirmation({
          to:String(order.email),receiptNumber,amount:Number(receipt.amount||0),zip:String(receipt.zip||''),
          serviceType:String(receipt.serviceType||''),preferredDate:String(receipt.preferredDate||''),preferredTime:String(receipt.preferredTime||'')
        });
        emailSent=Boolean(sent.id); emailId=sent.id;
      }catch(error){
        console.warn('Migration confirmation email skipped:',error instanceof Error?error.message:'unknown');
      }
    }

    let dispatch={matched:false,offered:0,offers:[] as any[],orderRef:sessionId,testMode:true};
    if(order && receipt.serviceType==='pickup'){
      try{
        dispatch=await createDispatchOffers({
          orderRef:sessionId,
          zip:String(order.zip||receipt.zip||''),
          address:String(order.address||''),
          item:String(order.item||'Mattress'),
          count:Math.max(1,Number(order.count||1)),
          serviceDate:String(order.preferredDate||''),
          preferredTime:String(order.preferredTime||'')
        }) as any;
      }catch(error){
        console.warn('Migration auto-dispatch skipped:',error instanceof Error?error.message:'unknown');
      }
    }

    if(receipt.serviceType==='pickup' && !dispatch.matched){
      await upsertPortableException({
        key:'coverage-gap:'+sessionId,type:'No contractor coverage',orderRef:sessionId,severity:'high',
        action:'Add or approve a contractor covering this ZIP before fulfillment.',
        note:'Confirmed test booking has no approved contractor coverage for ZIP '+String(receipt.zip||'')+'.',
        autoAction:'Keep the booking in exception review; do not promise fulfillment automatically.'
      });
    }else if(receipt.serviceType==='pickup' && dispatch.matched){
      await resolvePortableException('coverage-gap:'+sessionId,'Eligible contractor offers created');
    }

    return Response.json({
      receipt,testMode:true,liveFunds:false,emailSent,emailId,
      dispatch,
      nextStep:receipt.serviceType==='customer-drop-off'?'drop-off instructions':'contractor offer routing'
    });
  }catch(error){
    const message=error instanceof Error?error.message:'Could not load booking confirmation';
    const status=message.includes('Valid Stripe test session')?400:502;
    return Response.json({error:message},{status});
  }
});

route('POST', '/api/mattress-test-dispatch', async (request) => {
  const body=await request.json() as Record<string,unknown>;
  const phone=String(body.phone||'').trim();
  const jobUrl=String(body.jobUrl||'').trim();
  const serviceDate=String(body.serviceDate||'').trim();
  const serviceTime=String(body.serviceTime||'').trim();
  if(phone.replace(/\D/g,'').length<10||!jobUrl)
    return Response.json({error:'Valid phone and job URL are required'},{status:400});
  try{
    const sent=await sendTestSms(phone,'Mattress Rescue TEST job offer: '+serviceDate+' '+serviceTime+'. Open job: '+jobUrl);
    return Response.json({sent:true,sid:sent.sid,testMode:true});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'SMS send failed',testMode:true},{status:423});
  }
});

route('POST', '/api/mattress-test-contractor', async (request) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});
  const body=await request.json() as Record<string,unknown>;
  const name=String(body.name||'').trim();
  const phone=String(body.phone||'').trim();
  const payPerJob=Math.max(0,Number(body.payPerJob||0));
  if(!name||phone.replace(/\D/g,'').length<10||payPerJob<=0)
    return Response.json({error:'Name, valid phone and positive pay-per-job are required'},{status:400});
  const token=crypto.randomUUID();
  const profile={
    name,phone,payPerJob,portalToken:token,contractorApproved:true,
    status:'approved-test',serviceZips:Array.isArray(body.serviceZips)?body.serviceZips:[],
    createdAt:new Date().toISOString(),testMode:true
  };
  const [id]=await portableRuntime.db.add('mattress-driver-profiles',[profile]);
  if(!id) return Response.json({error:'Could not create test contractor'},{status:500});
  const portalUrl=(process.env.PORTABLE_PUBLIC_URL||'http://localhost:3000')+'/#contractor='+token;
  return Response.json({created:true,id,token,portalUrl,profile:{...profile,id}},{status:201});
});

async function upsertPortableException(input:{
  key:string;type:string;orderRef?:string;dispatchId?:string;severity:'low'|'medium'|'high';
  action:string;note:string;autoAction?:string;
}) {
  const rows=(await portableRuntime.db.list<any>('order-exceptions',{limit:500})).items;
  const existing=rows.find((x:any)=>String(x.exceptionKey||'')===input.key && String(x.status||'open')!=='resolved');
  const now=new Date().toISOString();
  const record={
    exceptionKey:input.key,type:input.type,orderRef:input.orderRef||'',dispatchId:input.dispatchId||'',
    severity:input.severity,status:'open',action:input.action,note:input.note,
    autoAction:input.autoAction||'',updatedAt:now,createdAt:existing?.createdAt||now,
    source:'portable-exception-engine'
  };
  if(existing){
    const next={...existing,...record}; delete next.id;
    await portableRuntime.db.update('order-exceptions',[{id:existing.id,record:next}]);
    return {...record,id:existing.id,duplicate:true};
  }
  const [id]=await portableRuntime.db.add('order-exceptions',[record]);
  return {...record,id,duplicate:false};
}

async function resolvePortableException(key:string,resolution:string){
  const rows=(await portableRuntime.db.list<any>('order-exceptions',{limit:500})).items;
  const existing=rows.find((x:any)=>String(x.exceptionKey||'')===key && String(x.status||'')!=='resolved');
  if(!existing) return false;
  const record={...existing,status:'resolved',resolution,resolvedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  delete record.id;
  await portableRuntime.db.update('order-exceptions',[{id:existing.id,record}]);
  return true;
}

async function scanPortableExceptions() {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return {scanned:false,created:[],resolved:[],reason:'database-not-configured'};

  const dispatches=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:500})).items;
  const now=Date.now(), created:any[]=[], resolved:string[]=[];
  for(const d of dispatches){
    const orderRef=String(d.orderRef||d.sessionId||d.id||'');
    const status=String(d.status||'');
    const createdAt=new Date(String(d.createdAt||0)).getTime();
    const serviceAt=d.serviceDate ? new Date(String(d.serviceDate)+'T'+String(d.preferredTime||'12:00')).getTime() : 0;

    const noAcceptanceKey='dispatch-no-accept:'+orderRef;
    const overdueKey='dispatch-overdue:'+orderRef;
    const missingProofKey='dispatch-missing-proof:'+String(d.id);
    const declinedKey='dispatch-declined:'+String(d.id);

    if(['offered','text-sent'].includes(status) && createdAt && now-createdAt>2*60*60*1000){
      created.push(await upsertPortableException({
        key:noAcceptanceKey,type:'No contractor accepted',orderRef,dispatchId:String(d.id),severity:'high',
        action:'Offer the job to additional approved contractors or escalate for manual coverage.',
        note:'No contractor accepted within two hours of the first offer.',
        autoAction:'Re-run ZIP matching against any newly approved contractors; do not contact non-allowlisted numbers in migration mode.'
      }));
    }else if(['accepted','en-route','at-pickup','completed'].includes(status)){
      if(await resolvePortableException(noAcceptanceKey,'Contractor accepted or job progressed')) resolved.push(noAcceptanceKey);
    }

    if(status==='declined'){
      created.push(await upsertPortableException({
        key:declinedKey,type:'Driver declined',orderRef,dispatchId:String(d.id),severity:'medium',
        action:'Continue routing to remaining eligible contractors.',
        note:'A contractor declined this offer.',
        autoAction:'Leave sibling offers active; create a coverage-gap exception only if no eligible offers remain.'
      }));
    }else{
      if(await resolvePortableException(declinedKey,'Dispatch no longer in declined state')) resolved.push(declinedKey);
    }

    if(serviceAt && now>serviceAt+60*60*1000 && !['completed','declined','superseded'].includes(status)){
      created.push(await upsertPortableException({
        key:overdueKey,type:'Pickup overdue',orderRef,dispatchId:String(d.id),severity:'high',
        action:'Check driver progress and customer impact.',
        note:'Scheduled pickup time is more than one hour past due and the job is not completed.',
        autoAction:'Flag for owner review; outbound customer/driver contact remains gated in migration mode.'
      }));
    }else if(status==='completed' || (serviceAt && now<=serviceAt+60*60*1000)){
      if(await resolvePortableException(overdueKey,'Pickup completed or no longer overdue')) resolved.push(overdueKey);
    }

    if(status==='completed' && (!d.pickupPhotoPath || !d.completionPhotoPath)){
      created.push(await upsertPortableException({
        key:missingProofKey,type:'Completion proof missing',orderRef,dispatchId:String(d.id),severity:'high',
        action:'Hold completion reconciliation until both proof photos are present.',
        note:'Job is marked complete without both required proof images.',
        autoAction:'Do not create additional contractor earnings or final reconciliation until proof is restored.'
      }));
    }else if(d.pickupPhotoPath && d.completionPhotoPath){
      if(await resolvePortableException(missingProofKey,'Both proof photos are present')) resolved.push(missingProofKey);
    }
  }

  return {scanned:true,created,resolved};
}

async function createDispatchOffers(input:{
  orderRef:string;zip:string;address:string;item:string;count:number;serviceDate:string;preferredTime:string;
}) {
  const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:200})).items
    .filter((p:any)=>p.contractorApproved===true && Array.isArray(p.serviceZips) && p.serviceZips.includes(input.zip))
    .sort((a:any,b:any)=>Number(a.priority||10)-Number(b.priority||10)||String(a.name||'').localeCompare(String(b.name||'')));

  if(!profiles.length) return {offered:0,offers:[],matched:false,error:'No approved contractors cover this ZIP',orderRef:input.orderRef,testMode:true};

  const all=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:500})).items;
  const existing=all.filter((d:any)=>String(d.orderRef||'')===input.orderRef);
  if(existing.some((d:any)=>String(d.status||'')==='accepted'))
    return {offered:0,offers:[],matched:true,error:'A contractor has already accepted this order',orderRef:input.orderRef,testMode:true};
  const active=existing.filter((d:any)=>!['declined','superseded','expired'].includes(String(d.status||'')));
  if(active.length){
    return {
      offered:active.length,
      offers:active.map((d:any)=>({
        id:d.id,driverProfileId:d.driverProfileId,driverName:d.driverName,
        jobUrl:(process.env.PORTABLE_PUBLIC_URL||'http://localhost:3000')+'/#driver-job='+d.token,
        smsSent:false,status:d.status
      })),
      matched:true,orderRef:input.orderRef,testMode:true,idempotent:true
    };
  }

  const offers:any[]=[];
  for(const p of profiles){
    const token=crypto.randomUUID();
    const record={
      orderRef:input.orderRef,status:'offered',token,driverPhone:String(p.phone||''),driverName:String(p.name||'Driver'),
      driverProfileId:String(p.id||''),item:input.item,count:input.count,address:input.address,zip:input.zip,
      serviceDate:input.serviceDate,preferredTime:input.preferredTime,
      pickupPhotoPath:'',completionPhotoPath:'',compensationAmount:0,compensationRecordedAt:'',
      createdAt:new Date().toISOString(),testMode:true
    };
    const [id]=await portableRuntime.db.add('mattress-driver-dispatches',[record]);
    if(!id) continue;
    const jobUrl=(process.env.PORTABLE_PUBLIC_URL||'http://localhost:3000')+'/#driver-job='+token;
    let smsSent=false;
    try{
      if(p.phone){
        const sent=await sendTestSms(String(p.phone),'Mattress Rescue TEST job offer: '+input.item+' × '+input.count+', ZIP '+input.zip+', '+(input.serviceDate||'date TBD')+' '+(input.preferredTime||'')+'. First approved contractor to accept gets the job: '+jobUrl);
        smsSent=Boolean(sent.sid);
      }
    }catch(error){
      console.warn('Migration driver offer SMS skipped:',error instanceof Error?error.message:'unknown');
    }
    offers.push({id,driverProfileId:p.id,driverName:p.name,jobUrl,smsSent,status:'offered'});
  }
  return {offered:offers.length,offers,matched:offers.length>0,orderRef:input.orderRef,testMode:true};
}

route('POST', '/api/mattress-test-dispatch-offers', async (request) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});
  const body=await request.json() as Record<string,unknown>;
  const zip=String(body.zip||'').trim();
  const address=String(body.address||'').trim();
  const item=String(body.item||'Mattress').trim();
  const count=Math.max(1,Math.floor(Number(body.count)||1));
  const serviceDate=String(body.serviceDate||'').trim();
  const preferredTime=String(body.preferredTime||'').trim();
  const orderRef=String(body.orderRef||crypto.randomUUID());
  if(!/^[0-9]{5}$/.test(zip)||!address)
    return Response.json({error:'Valid service ZIP and pickup address are required'},{status:400});
  const result=await createDispatchOffers({orderRef,zip,address,item,count,serviceDate,preferredTime});
  return Response.json(result,{status:result.matched?200:422});
});

route('POST', '/api/mattress-test-driver-job', async (request) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});
  const body=await request.json() as Record<string,unknown>;
  const phone=String(body.driverPhone||'').trim();
  const address=String(body.address||'').trim();
  const zip=String(body.zip||'').trim();
  const item=String(body.item||'Mattress').trim();
  const count=Math.max(1,Math.floor(Number(body.count)||1));
  const serviceDate=String(body.serviceDate||'').trim();
  const preferredTime=String(body.preferredTime||'').trim();
  if(phone.replace(/\D/g,'').length<10||!address||!zip)
    return Response.json({error:'Driver phone, pickup address and ZIP are required'},{status:400});
  const token=crypto.randomUUID();
  const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:100})).items;
  const normalizedPhone=phone.replace(/\D/g,'');
  const requestedProfileId=String(body.driverProfileId||'');
  const profile=profiles.find((p:any)=>String(p.id||'')===requestedProfileId) ||
    profiles.find((p:any)=>String(p.phone||'').replace(/\D/g,'')===normalizedPhone && p.contractorApproved===true);
  const record={
    status:'offered',token,driverPhone:phone,driverName:String(profile?.name||body.driverName||'Test Driver'),
    driverProfileId:String(profile?.id||''),
    item,count,address,zip,serviceDate,preferredTime,
    pickupPhotoPath:'',completionPhotoPath:'',
    compensationAmount:0,compensationRecordedAt:'',
    createdAt:new Date().toISOString(),testMode:true
  };
  const [id]=await portableRuntime.db.add('mattress-driver-dispatches',[record]);
  if(!id) return Response.json({error:'Could not create test driver job'},{status:500});
  const jobUrl=(process.env.PORTABLE_PUBLIC_URL||'http://localhost:3000')+'/#driver-job='+token;
  return Response.json({created:true,id,token,jobUrl,testMode:true},{status:201});
});

route('GET', '/api/mattress-driver-job/:token', async (_request,params) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});
  const rows=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:100})).items;
  const d=rows.find((x:any)=>String(x.token||'')===params.token);
  if(!d) return Response.json({error:'Driver job link is invalid'},{status:404});
  return Response.json({job:{
    dispatchId:d.id,status:d.status,driverName:d.driverName||'',item:d.item||'Mattress',
    count:Number(d.count||1),serviceDate:d.serviceDate||'',preferredTime:d.preferredTime||'',
    address:d.address||'',zip:d.zip||'',
    pickupPhotoUploaded:Boolean(d.pickupPhotoPath),
    completionPhotoUploaded:Boolean(d.completionPhotoPath)
  }});
});

route('POST', '/api/mattress-driver-job/:token/respond', async (request,params) => {
  const body=await request.json() as Record<string,unknown>;
  const decision=String(body.decision||'');
  if(!['accept','decline'].includes(decision))
    return Response.json({error:'Decision must be accept or decline'},{status:400});
  const rows=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:100})).items;
  const d=rows.find((x:any)=>String(x.token||'')===params.token);
  if(!d) return Response.json({error:'Driver job link is invalid'},{status:404});
  if(!['offered','text-sent'].includes(String(d.status||'')))
    return Response.json({error:'Job is no longer awaiting a response'},{status:409});
  if(decision==='accept' && d.orderRef){
    const winner=rows.find((x:any)=>
      String(x.orderRef||'')===String(d.orderRef||'') &&
      String(x.id||'')!==String(d.id||'') &&
      String(x.status||'')==='accepted'
    );
    if(winner) return Response.json({error:'Another contractor already accepted this job'},{status:409});
  }

  const record={...d,status:decision==='accept'?'accepted':'declined',
    [decision==='accept'?'acceptedAt':'declinedAt']:new Date().toISOString()};
  delete (record as any).id;
  await portableRuntime.db.update('mattress-driver-dispatches',[{id:d.id,record}]);

  if(decision==='accept' && d.orderRef){
    for(const sibling of rows.filter((x:any)=>
      String(x.orderRef||'')===String(d.orderRef||'') &&
      String(x.id||'')!==String(d.id||'') &&
      String(x.status||'')==='offered'
    )){
      const superseded={...sibling,status:'superseded',supersededAt:new Date().toISOString()};
      delete (superseded as any).id;
      await portableRuntime.db.update('mattress-driver-dispatches',[{id:sibling.id,record:superseded}]);
    }
  }

  return Response.json({status:record.status,firstAccepted:decision==='accept'});
});

route('POST', '/api/mattress-driver-job/:token/progress', async (request,params) => {
  const body=await request.json() as Record<string,unknown>;
  const next=String(body.status||'');
  const rows=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:100})).items;
  const d=rows.find((x:any)=>String(x.token||'')===params.token);
  if(!d) return Response.json({error:'Driver job link is invalid'},{status:404});
  const current=String(d.status||'');
  const allowed=(current==='accepted'&&next==='en-route')||(current==='en-route'&&next==='at-pickup');
  if(!allowed) return Response.json({error:'Invalid driver progress transition'},{status:409});
  const record={...d,status:next,[next==='en-route'?'enRouteAt':'atPickupAt']:new Date().toISOString()};
  delete (record as any).id;
  await portableRuntime.db.update('mattress-driver-dispatches',[{id:d.id,record}]);
  return Response.json({status:next});
});

route('POST', '/api/mattress-driver-job/:token/photo', async (request,params) => {
  const body=await request.json() as Record<string,unknown>;
  const kind=String(body.kind||'');
  const content=String(body.content||'');
  const contentType=String(body.contentType||'');
  if(!['pickup','completion'].includes(kind))
    return Response.json({error:'Photo kind must be pickup or completion'},{status:400});
  if(!['image/jpeg','image/png','image/webp'].includes(contentType))
    return Response.json({error:'Upload a JPG, PNG or WebP image'},{status:422});
  if(content.length<100||content.length>7_500_000)
    return Response.json({error:'Photo is missing or too large'},{status:422});
  const rows=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:100})).items;
  const d=rows.find((x:any)=>String(x.token||'')===params.token);
  if(!d) return Response.json({error:'Driver job link is invalid'},{status:404});
  if(!['accepted','en-route','at-pickup'].includes(String(d.status||'')))
    return Response.json({error:'Accept the job before uploading proof'},{status:409});
  try{
    const ext=contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
    const proofPath='mattress-driver/'+d.id+'/'+kind+'-'+Date.now()+'.'+ext;
    await writeProof(proofPath,content,contentType);
    const record={...d,[kind==='pickup'?'pickupPhotoPath':'completionPhotoPath']:proofPath,
      [kind==='pickup'?'pickupPhotoAt':'completionPhotoAt']:new Date().toISOString()};
    delete (record as any).id;
    await portableRuntime.db.update('mattress-driver-dispatches',[{id:d.id,record}]);
    return Response.json({uploaded:true,kind});
  }catch(error){
    return Response.json({error:error instanceof Error?error.message:'Photo upload failed'},{status:502});
  }
});

route('POST', '/api/mattress-driver-job/:token/complete', async (request,params) => {
  const body=await request.json() as Record<string,unknown>;
  const rows=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:100})).items;
  const d=rows.find((x:any)=>String(x.token||'')===params.token);
  if(!d) return Response.json({error:'Driver job link is invalid'},{status:404});
  if(!d.pickupPhotoPath||!d.completionPhotoPath)
    return Response.json({error:'Both pickup and completion photos are required'},{status:422});
  if(!['accepted','en-route','at-pickup'].includes(String(d.status||'')))
    return Response.json({error:'Job is not active'},{status:409});
  let compensationAmount=Number(d.compensationAmount||0);
  let compensationRecordedAt=String(d.compensationRecordedAt||'');
  if(!compensationRecordedAt && d.driverProfileId){
    const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:100})).items;
    const profile=profiles.find((p:any)=>String(p.id||'')===String(d.driverProfileId));
    if(profile?.contractorApproved===true){
      compensationAmount=Math.max(0,Number(profile.payPerJob||0));
      compensationRecordedAt=new Date().toISOString();
    }
  }
  const record={...d,status:'completed',completedAt:new Date().toISOString(),
    completionNotes:String(body.notes||'').slice(0,1000),
    compensationAmount,compensationRecordedAt};
  delete (record as any).id;
  await portableRuntime.db.update('mattress-driver-dispatches',[{id:d.id,record}]);
  return Response.json({
    status:'completed',proofValidated:true,testMode:Boolean(d.testMode),
    compensationRecorded:Boolean(compensationRecordedAt),
    compensationAmount
  });
});

route('POST', '/api/contractor-applications', async (request) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});

  const body=await request.json() as Record<string,unknown>;
  const name=String(body.name||'').trim();
  const email=String(body.email||'').trim().toLowerCase();
  const phone=String(body.phone||'').trim();
  const zip=String(body.zip||'').trim();
  const acknowledgments=[
    Boolean(body.licenseConfirmed),
    Boolean(body.insuranceConfirmed),
    Boolean(body.backgroundConsent),
    Boolean(body.contractorAcknowledged)
  ];

  if(!name||!email.includes('@')||phone.replace(/\D/g,'').length<10||!/^[0-9]{5}$/.test(zip))
    return Response.json({error:'Valid name, email, mobile phone and ZIP are required'},{status:400});
  if(acknowledgments.some(v=>!v))
    return Response.json({error:'All required acknowledgments must be confirmed'},{status:422});

  const existing=(await portableRuntime.db.list<any>('contractor-applications',{limit:200})).items;
  if(existing.some((a:any)=>['pending','approved'].includes(String(a.status||'')) &&
    (String(a.email||'').toLowerCase()===email || String(a.phone||'').replace(/\D/g,'')===phone.replace(/\D/g,''))))
    return Response.json({error:'An active contractor application already exists for this contact'},{status:409});

  const serviceZips=String(body.serviceZips||'').split(/[^0-9]+/).filter((z)=>/^[0-9]{5}$/.test(z));
  const applicationNumber='MRD-'+Date.now().toString().slice(-8);
  const record={
    applicationNumber,name,email,phone,address:String(body.address||'').trim().slice(0,180),
    city:String(body.city||'').trim().slice(0,80),state:String(body.state||'MA').trim().slice(0,2).toUpperCase(),zip,
    serviceZips,vehicle:String(body.vehicle||'').trim().slice(0,80),
    availability:String(body.availability||'').trim().slice(0,300),
    experience:String(body.experience||'').trim().slice(0,1500),
    licenseConfirmed:true,insuranceConfirmed:true,backgroundConsent:true,contractorAcknowledged:true,
    status:'pending',createdAt:new Date().toISOString(),testMode:true
  };
  const [id]=await portableRuntime.db.add('contractor-applications',[record]);
  if(!id) return Response.json({error:'Could not save contractor application'},{status:500});
  return Response.json({id,applicationNumber,status:'pending'},{status:201});
});

route('POST', '/api/contractor-applications/:id/approve', async (request,params) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});

  const body=await request.json() as Record<string,unknown>;
  const payPerJob=Math.round(Number(body.payPerJob||0)*100)/100;
  if(payPerJob<=0) return Response.json({error:'Approved pay per job must be positive'},{status:400});

  const apps=(await portableRuntime.db.list<any>('contractor-applications',{limit:200})).items;
  const app=apps.find((a:any)=>String(a.id||'')===params.id);
  if(!app) return Response.json({error:'Contractor application not found'},{status:404});
  if(String(app.status||'')!=='pending')
    return Response.json({error:'Only pending applications can be approved'},{status:409});

  const token=crypto.randomUUID();
  const profile={
    name:app.name,email:app.email,phone:app.phone,payPerJob,portalToken:token,
    contractorApproved:true,status:'approved',serviceZips:Array.isArray(app.serviceZips)?app.serviceZips:[],
    vehicle:app.vehicle||'',sourceApplicationId:app.id,approvedAt:new Date().toISOString(),
    createdAt:new Date().toISOString(),testMode:true
  };
  const [profileId]=await portableRuntime.db.add('mattress-driver-profiles',[profile]);
  if(!profileId) return Response.json({error:'Could not create contractor profile'},{status:500});

  const updated={...app,status:'approved',approvedAt:new Date().toISOString(),driverProfileId:profileId,payPerJob};
  delete (updated as any).id;
  await portableRuntime.db.update('contractor-applications',[{id:app.id,record:updated}]);

  const portalUrl=(process.env.PORTABLE_PUBLIC_URL||'http://localhost:3000')+'/#contractor='+token;
  let smsSent=false;
  try{
    const sms=await sendTestSms(String(app.phone||''),'Mattress Rescue TEST contractor approval. Portal: '+portalUrl);
    smsSent=Boolean(sms.sid);
  }catch(error){
    console.warn('Migration contractor approval SMS skipped:',error instanceof Error?error.message:'unknown');
  }

  return Response.json({
    approved:true,driverProfileId:profileId,portalUrl,smsSent,
    moneyMoved:false,testMode:true
  },{status:201});
});

route('GET', '/api/contractor-admin', async () => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});

  const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:200})).items
    .filter((p:any)=>p.contractorApproved===true);
  const applications=(await portableRuntime.db.list<any>('contractor-applications',{limit:200})).items;
  const dispatches=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:500})).items;
  const payments=(await portableRuntime.db.list<any>('contractor-payments',{limit:500})).items;
  const year=String(new Date().getFullYear());

  const drivers=profiles.map((p:any)=>{
    const jobs=dispatches.filter((d:any)=>
      String(d.driverProfileId||'')===String(p.id) &&
      String(d.status||'')==='completed' &&
      String(d.completedAt||'').startsWith(year)
    );
    const ytdEarned=jobs.reduce((n:number,j:any)=>n+Number(j.compensationAmount||p.payPerJob||0),0);
    const ytdPaid=payments.filter((x:any)=>
      String(x.driverProfileId||'')===String(p.id) &&
      String(x.paidAt||'').startsWith(year)
    ).reduce((n:number,x:any)=>n+Number(x.amount||0),0);
    return {
      id:p.id,name:p.name,phone:p.phone,payPerJob:Number(p.payPerJob||0),
      completedJobs:jobs.length,ytdEarned,ytdPaid,owed:Math.max(0,ytdEarned-ytdPaid)
    };
  }).sort((a:any,b:any)=>b.owed-a.owed||String(a.name).localeCompare(String(b.name)));

  return Response.json({
    applications,
    drivers,
    summary:{
      contractors:drivers.length,
      ytdEarned:drivers.reduce((n:number,d:any)=>n+d.ytdEarned,0),
      ytdPaid:drivers.reduce((n:number,d:any)=>n+d.ytdPaid,0),
      owed:drivers.reduce((n:number,d:any)=>n+d.owed,0)
    },
    testMode:true
  });
});

route('POST', '/api/contractor-payments', async (request) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});

  const body=await request.json() as Record<string,unknown>;
  const driverProfileId=String(body.driverProfileId||'').trim();
  const amount=Math.round(Number(body.amount||0)*100)/100;
  const note=String(body.note||'Contractor payment').trim().slice(0,300);
  if(!driverProfileId||amount<=0)
    return Response.json({error:'Contractor and positive payment amount are required'},{status:400});

  const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:200})).items;
  const profile=profiles.find((p:any)=>String(p.id||'')===driverProfileId && p.contractorApproved===true);
  if(!profile) return Response.json({error:'Approved contractor not found'},{status:404});

  const year=String(new Date().getFullYear());
  const dispatches=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:500})).items
    .filter((d:any)=>String(d.driverProfileId||'')===driverProfileId && String(d.status||'')==='completed' && String(d.completedAt||'').startsWith(year));
  const payments=(await portableRuntime.db.list<any>('contractor-payments',{limit:500})).items
    .filter((p:any)=>String(p.driverProfileId||'')===driverProfileId && String(p.paidAt||'').startsWith(year));

  const earned=dispatches.reduce((n:number,d:any)=>n+Number(d.compensationAmount||profile.payPerJob||0),0);
  const paid=payments.reduce((n:number,p:any)=>n+Number(p.amount||0),0);
  const owed=Math.max(0,Math.round((earned-paid)*100)/100);
  if(amount>owed)
    return Response.json({error:'Payment exceeds current amount owed',owed},{status:422});

  const record={
    driverProfileId,amount,note,paidAt:new Date().toISOString(),
    paymentMode:'record-only',testMode:true,createdAt:new Date().toISOString()
  };
  const [id]=await portableRuntime.db.add('contractor-payments',[record]);
  if(!id) return Response.json({error:'Could not record contractor payment'},{status:500});

  return Response.json({
    recorded:true,id,payment:record,
    summary:{earned,paid:Math.round((paid+amount)*100)/100,owed:Math.max(0,Math.round((owed-amount)*100)/100)},
    moneyMoved:false
  },{status:201});
});

route('GET', '/api/contractor-portal/:token', async (_request,params) => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({error:'Database is not configured in this preview.'},{status:503});
  const profiles=(await portableRuntime.db.list<any>('mattress-driver-profiles',{limit:100})).items;
  const profile=profiles.find((p:any)=>String(p.portalToken||'')===params.token && p.contractorApproved===true);
  if(!profile) return Response.json({error:'Contractor portal link is invalid'},{status:404});

  const year=String(new Date().getFullYear());
  const dispatches=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:500})).items
    .filter((d:any)=>String(d.driverProfileId||'')===String(profile.id));
  const jobs=dispatches.filter((d:any)=>String(d.status||'')==='completed' && String(d.completedAt||'').startsWith(year))
    .map((d:any)=>({...d,compensationAmount:Number(d.compensationAmount||profile.payPerJob||0)}))
    .sort((a:any,b:any)=>String(b.completedAt||'').localeCompare(String(a.completedAt||'')));

  const payments=(await portableRuntime.db.list<any>('contractor-payments',{limit:500})).items
    .filter((p:any)=>String(p.driverProfileId||'')===String(profile.id) && String(p.paidAt||'').startsWith(year))
    .sort((a:any,b:any)=>String(b.paidAt||'').localeCompare(String(a.paidAt||'')));

  const ytdEarned=jobs.reduce((n:number,j:any)=>n+Number(j.compensationAmount||0),0);
  const ytdPaid=payments.reduce((n:number,p:any)=>n+Number(p.amount||0),0);
  return Response.json({
    profile:{id:profile.id,name:profile.name,payPerJob:Number(profile.payPerJob||0)},
    summary:{ytdEarned,ytdPaid,owed:Math.max(0,ytdEarned-ytdPaid),completedJobs:jobs.length},
    jobs,payments,
    testMode:Boolean(profile.testMode)
  });
});

route('POST', '/api/portable-exceptions/scan', async () => {
  const result=await scanPortableExceptions();
  return Response.json(result);
});

route('GET', '/api/portable-exceptions', async () => {
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL))
    return Response.json({exceptions:[],databaseConfigured:false});
  const rows=(await portableRuntime.db.list<any>('order-exceptions',{limit:500})).items
    .filter((x:any)=>String(x.source||'')==='portable-exception-engine')
    .sort((a:any,b:any)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
  return Response.json({
    exceptions:rows,
    open:rows.filter((x:any)=>String(x.status||'')!=='resolved').length,
    high:rows.filter((x:any)=>String(x.status||'')!=='resolved'&&String(x.severity||'')==='high').length
  });
});

export { handleRequest };
