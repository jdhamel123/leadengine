/**
 * Transactional Resend adapter with migration safety gates.
 * Sends only when explicitly enabled and only to allowlisted recipients.
 */
function apiKey(){
  const key=process.env.RESEND_API_KEY||'';
  if(!key) throw new Error('RESEND_API_KEY is not configured');
  return key;
}
function allowedRecipient(email:string){
  if(process.env.ENABLE_OUTBOUND_TEST_EMAILS!=='true') return false;
  const allow=(process.env.TEST_EMAIL_ALLOWLIST||'')
    .split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}
export async function sendMattressConfirmation(input:{
  to:string;receiptNumber:string;amount:number;zip:string;serviceType:string;
  preferredDate?:string;preferredTime?:string;
}){
  if(!allowedRecipient(input.to))
    throw new Error('Recipient is not allowlisted for migration email testing');

  const from=process.env.MATTRESS_FROM_EMAIL||'Mattress Rescue <orders@mattressrescue.com>';
  const subject='Mattress Rescue test booking '+input.receiptNumber;
  const text=[
    'Mattress Rescue booking confirmation',
    '',
    'Receipt: '+input.receiptNumber,
    'Amount: $'+Math.round(input.amount),
    'Service: '+(input.serviceType==='customer-drop-off'?'Customer drop-off':'Local pickup'),
    'ZIP: '+input.zip,
    input.preferredDate?'Date: '+input.preferredDate:'',
    input.preferredTime?'Time: '+input.preferredTime:'',
    '',
    'This is a migration test confirmation. No live payment has been captured.'
  ].filter(Boolean).join('\n');

  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+apiKey(),
      'Content-Type':'application/json',
      'Idempotency-Key':'mattress-'+input.receiptNumber
    },
    body:JSON.stringify({from,to:[input.to],subject,text})
  });
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok) throw new Error(String(data.message||'Resend send failed'));
  return {id:String(data.id||'')};
}
