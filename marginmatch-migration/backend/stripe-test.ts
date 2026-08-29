/**
 * Stripe test-mode adapter for the portable runtime.
 * Refuses live keys and never captures funds automatically.
 */
function stripeKey() {
  const key=process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY || '';
  if (!key) throw new Error('Stripe test key is not configured');
  if (!key.includes('_test_')) throw new Error('Stripe test-mode key required');
  return key;
}

async function stripeRequest(path:string, method:'GET'|'POST', params?:URLSearchParams) {
  const response=await fetch('https://api.stripe.com/v1/'+path,{
    method,
    headers:{
      Authorization:'Bearer '+stripeKey(),
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body:method==='POST'?(params||new URLSearchParams()).toString():undefined
  });
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok){
    const error=data.error as Record<string,unknown>|undefined;
    throw new Error(String(error?.message || 'Stripe request failed'));
  }
  return data;
}

export async function createMattressTestCheckout(input:{
  zip:string;email:string;phone:string;address:string;preferredDate:string;preferredTime:string;
  item:string;count:number;access:string;condition:string;customerPrice:number;
}) {
  const p=new URLSearchParams();
  const drop=input.access==='Customer drop-off';
  p.set('mode','payment');
  p.set('success_url',(process.env.MATTRESS_SUCCESS_URL || 'http://localhost:3000/')+'?payment_test=success&session_id={CHECKOUT_SESSION_ID}');
  p.set('cancel_url',(process.env.MATTRESS_CANCEL_URL || 'http://localhost:3000/')+'?payment_test=cancel');
  p.set('customer_email',input.email);
  p.set('payment_intent_data[capture_method]','manual');
  p.set('line_items[0][price_data][currency]','usd');
  p.set('line_items[0][price_data][unit_amount]',String(input.customerPrice*100));
  p.set('line_items[0][price_data][product_data][name]',drop?'Mattress Rescue — Customer Drop-off':'Mattress Rescue — Local Pickup');
  p.set('line_items[0][price_data][product_data][description]',input.item+' · quantity '+input.count+' · '+(drop?'customer drop-off':'curbside / garage pickup')+' · ZIP '+input.zip);
  p.set('line_items[0][quantity]','1');
  p.set('metadata[brand]','Mattress Rescue');
  p.set('metadata[zip]',input.zip);
  p.set('metadata[service_type]',drop?'customer-drop-off':'pickup');
  p.set('metadata[preferred_date]',input.preferredDate);
  p.set('metadata[preferred_time]',input.preferredTime);
  p.set('metadata[test_only]','true');
  if(!drop)p.set('metadata[pickup_address]',input.address.slice(0,180));

  const session=await stripeRequest('checkout/sessions','POST',p);
  return {
    sessionId:String(session.id||''),
    url:String(session.url||'')
  };
}

export async function getMattressTestConfirmation(sessionId:string){
  if(!sessionId.startsWith('cs_')) throw new Error('Valid Stripe test session required');
  return stripeRequest('checkout/sessions/'+encodeURIComponent(sessionId)+'?expand[]=payment_intent','GET');
}
