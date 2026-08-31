export {};
/**
 * Scheduled internal exception scan for the portable runtime.
 * Uses a short-lived locally issued owner session so auth remains enforced.
 */
const token=process.env.MM_ADMIN_TOKEN||'';

const base=(process.env.PORTABLE_INTERNAL_URL||'http://app:3000').replace(/\/$/,'');
const email=(process.env.SCHEDULED_ADMIN_EMAIL||String(process.env.ADMIN_EMAIL_ALLOWLIST||'').split(',')[0]||'').trim();
if(!email)throw new Error('SCHEDULED_ADMIN_EMAIL or ADMIN_EMAIL_ALLOWLIST is required');


async function request(path:string,method:'GET'|'POST'){
  const r=await fetch(base+path,{
    method,
    headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'application/json'
    },
    body:method==='POST'?'{}':undefined
  });
  const text=await r.text();
  if(!r.ok)throw new Error(path+' failed: '+r.status+' '+text);
  return text;
}

console.log(await request('/api/order-exceptions','GET'));
console.log(await request('/api/ai-exception-agent/run','POST'));
