/*
 * Scheduled internal exception scan.
 * Logs in using the internal admin credentials and uses the
 * resulting short-lived session token for protected API calls.
 */

const base=(process.env.PORTABLE_INTERNAL_URL||'http://app:3000').replace(/\/$/,'');
const email=(process.env.SCHEDULED_ADMIN_EMAIL||process.env.ADMIN_EMAIL_ALLOWLIST||'')
  .split(',')[0].trim();
const accessKey=process.env.MM_ADMIN_TOKEN||'';

if(!email) throw new Error('SCHEDULED_ADMIN_EMAIL or ADMIN_EMAIL_ALLOWLIST is required');
if(!accessKey) throw new Error('MM_ADMIN_TOKEN is required');

async function login():Promise<string>{
  const r=await fetch(base+'/api/auth/login',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email,accessKey})
  });

  const text=await r.text();

  if(!r.ok) throw new Error('/api/auth/login failed: '+r.status+' '+text);

  const data=JSON.parse(text);
  const token=data.token||data.accessToken||data.session;

  if(!token) throw new Error('Login succeeded but no session token was returned');

  return String(token);
}

async function request(
  path:string,
  method:'GET'|'POST',
  token:string
){
  const r=await fetch(base+path,{
    method,
    headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'application/json'
    },
    body:method==='POST'?'{}':undefined
  });

  const text=await r.text();

  if(!r.ok) throw new Error(path+' failed: '+r.status+' '+text);

  return text;
}

(async()=>{
  console.log('Scheduled exception scan starting');
  const token=await login();
  console.log('Admin session acquired');

  console.log(await request('/api/portable-exceptions','GET',token));
  console.log(await request('/api/portable-exceptions/scan','POST',token));

  console.log('Scheduled exception scan complete');
})().catch(err=>{
  console.error(err);
  process.exit(1);
});
