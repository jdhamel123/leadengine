import {issueAdminSession} from '../backend/auth-portable';

const base=(process.env.PORTABLE_INTERNAL_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
const email=(process.env.SCHEDULED_ADMIN_EMAIL||String(process.env.ADMIN_EMAIL_ALLOWLIST||'').split(',')[0]||'').trim();

const health=await fetch(base+'/api/health');
if(!health.ok)throw new Error('Public health failed: '+health.status);

if(email){
  const token=await issueAdminSession(email);
  const r=await fetch(base+'/api/self-test',{headers:{Authorization:'Bearer '+token}});
  const body=await r.json() as Record<string,unknown>;
  if(!r.ok||body.pass!==true)throw new Error('Portable self-test failed: '+JSON.stringify(body));
}

console.log('Deep health check passed.');
