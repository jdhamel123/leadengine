/**
 * Twilio migration-test adapter.
 * SMS is disabled by default and limited to explicitly allowlisted numbers.
 */
function normalizePhone(v:string){ return v.replace(/\D/g,''); }
function allowed(phone:string){
  if(process.env.ENABLE_OUTBOUND_TEST_SMS!=='true') return false;
  const target=normalizePhone(phone);
  const allow=(process.env.TEST_SMS_ALLOWLIST||'').split(',').map(normalizePhone).filter(Boolean);
  return allow.includes(target);
}
export async function sendTestSms(to:string,body:string){
  if(!allowed(to)) throw new Error('Phone is not allowlisted for migration SMS testing');
  const sid=process.env.TWILIO_ACCOUNT_SID||'';
  const auth=process.env.TWILIO_AUTH_TOKEN||'';
  const from=process.env.TWILIO_FROM_NUMBER||'';
  if(!sid||!auth||!from) throw new Error('Twilio test configuration is incomplete');

  const form=new URLSearchParams({To:to,From:from,Body:body.slice(0,1500)});
  const response=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{
    method:'POST',
    headers:{
      Authorization:'Basic '+btoa(sid+':'+auth),
      'Content-Type':'application/x-www-form-urlencoded'
    },
    body:form.toString()
  });
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok) throw new Error(String(data.message||'Twilio send failed'));
  return {sid:String(data.sid||'')};
}
