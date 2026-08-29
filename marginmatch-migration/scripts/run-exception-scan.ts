/**
 * Scheduled internal exception scan for the portable runtime.
 * Calls the same scanner endpoint through a short-lived locally issued owner
 * session so auth remains enforced even for cron.
 */
import {issueAdminSession} from '../backend/auth-portable';

const base=(process.env.PORTABLE_INTERNAL_URL||'http://app:3000').replace(/\/$/,'');
const email=(process.env.SCHEDULED_ADMIN_EMAIL||String(process.env.ADMIN_EMAIL_ALLOWLIST||'').split(',')[0]||'').trim();
if(!email)throw new Error('SCHEDULED_ADMIN_EMAIL or ADMIN_EMAIL_ALLOWLIST is required');

const token=await issueAdminSession(email);

async function post(path:string){
  const r=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  const text=await r.text();
  if(!r.ok)throw new Error(path+' failed: '+r.status+' '+text);
  return text;
}

console.log(await post('/api/portable-exceptions/scan'));
console.log(await post('/api/portable-exceptions/ai-resolve'));
