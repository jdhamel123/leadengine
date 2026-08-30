/**
 * Stripe LIVE adapter. Disabled unless ENABLE_LIVE_MATTRESS_PAYMENTS=true.
 * Never accept an amount from the browser; callers must pass a server-calculated price.
 */
function liveKey(){
 const key=process.env.STRIPE_LIVE_SECRET_KEY||'';
 if(!key)throw new Error('Stripe live secret key is not configured');
 if(!key.includes('_live_'))throw new Error('Stripe LIVE key required');
 if(process.env.ENABLE_LIVE_MATTRESS_PAYMENTS!=='true')throw new Error('Live Mattress Rescue payments are locked');
 return key;
}
async function stripe(path:string,method:'GET'|'POST',params?:URLSearchParams){
 const r=await fetch('https://api.stripe.com/v1/'+path,{method,headers:{Authorization:'Bearer '+liveKey(),'Content-Type':'application/x-www-form-urlencoded'},body:method==='POST'?(params||new URLSearchParams()).toString():undefined});
 const d=await r.json() as any;if(!r.ok)throw new Error(String(d?.error?.message||'Stripe request failed'));return d;
}
export async function createMattressLiveCheckout(input:{orderId:string;zip:string;email:string;phone:string;address:string;preferredDate:string;preferredTime:string;item:string;count:number;access:string;customerPrice:number;}){
 const p=new URLSearchParams(),drop=input.access==='Customer drop-off',base=(process.env.MATTRESS_PUBLIC_URL||'https://mattressrescue.com').replace(/\/$/,'');
 p.set('mode','payment');p.set('success_url',base+'/?payment=success&session_id={CHECKOUT_SESSION_ID}');p.set('cancel_url',base+'/?payment=cancel');
 p.set('customer_email',input.email);p.set('line_items[0][price_data][currency]','usd');p.set('line_items[0][price_data][unit_amount]',String(Math.round(input.customerPrice*100)));
 p.set('line_items[0][price_data][product_data][name]',drop?'Mattress Rescue — Customer Drop-off':'Mattress Rescue — Local Pickup');
 p.set('line_items[0][price_data][product_data][description]',input.item+' · quantity '+input.count+' · ZIP '+input.zip);p.set('line_items[0][quantity]','1');
 p.set('metadata[brand]','Mattress Rescue');p.set('metadata[order_id]',input.orderId);p.set('metadata[zip]',input.zip);p.set('metadata[service_type]',drop?'customer-drop-off':'pickup');p.set('metadata[preferred_date]',input.preferredDate);p.set('metadata[preferred_time]',input.preferredTime);
 const s=await stripe('checkout/sessions','POST',p);return {sessionId:String(s.id||''),url:String(s.url||'')};
}
export async function getMattressLiveCheckout(sessionId:string){if(!sessionId.startsWith('cs_live_'))throw new Error('Valid Stripe live Checkout Session required');return stripe('checkout/sessions/'+encodeURIComponent(sessionId),'GET')}
