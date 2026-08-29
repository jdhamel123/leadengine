/**
 * Portable admin authentication.
 * Supports a locally-issued HMAC session for the owner preview and an optional
 * external bearer-token verifier for future Supabase/Auth.js migration.
 */
export type PortableUser = { id: string; email?: string };

function b64url(bytes:Uint8Array){
  return Buffer.from(bytes).toString('base64url');
}
function decodeB64url(value:string){
  return new Uint8Array(Buffer.from(value,'base64url'));
}
async function hmac(value:string){
  const secret=process.env.PORTABLE_SESSION_SECRET||'';
  if(!secret) throw new Error('PORTABLE_SESSION_SECRET is not configured');
  const key=await crypto.subtle.importKey(
    'raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
}

export async function issueAdminSession(email:string){
  const now=Math.floor(Date.now()/1000);
  const payload=b64url(new TextEncoder().encode(JSON.stringify({
    sub:'portable-admin',
    email:email.toLowerCase(),
    iat:now,
    exp:now+12*60*60
  })));
  const sig=b64url(await hmac(payload));
  return payload+'.'+sig;
}

async function verifyLocalSession(token:string):Promise<PortableUser|null>{
  if(!process.env.PORTABLE_SESSION_SECRET) return null;
  const [payload,sig]=token.split('.');
  if(!payload||!sig) return null;
  const expected=await hmac(payload);
  const actual=decodeB64url(sig);
  if(expected.length!==actual.length) return null;
  let diff=0;
  for(let i=0;i<expected.length;i++) diff|=expected[i]^actual[i];
  if(diff!==0) return null;
  try{
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as Record<string,unknown>;
    if(Number(parsed.exp||0)<Math.floor(Date.now()/1000)) return null;
    if(parsed.sub!=='portable-admin') return null;
    return {id:'portable-admin',email:String(parsed.email||'')};
  }catch{return null;}
}

export async function resolveUser(request: Request): Promise<PortableUser | null> {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token=auth.slice(7).trim();

  const local=await verifyLocalSession(token);
  if(local) return local;

  const verifierUrl = process.env.AUTH_VERIFY_URL;
  if (!verifierUrl) return null;
  const response = await fetch(verifierUrl, { headers: { authorization: auth } });
  if (!response.ok) return null;
  const data = await response.json() as Record<string, unknown>;
  if (!data.id) return null;
  return { id:String(data.id), email:data.email?String(data.email):undefined };
}

export async function requireUser(request: Request): Promise<PortableUser> {
  const user = await resolveUser(request);
  if (!user) throw new Response('Unauthorized', { status: 401 });
  return user;
}

export async function requireAdmin(request: Request): Promise<PortableUser> {
  const user = await requireUser(request);
  const allowlist = String(process.env.ADMIN_EMAIL_ALLOWLIST || '')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !allowlist.includes(user.email.toLowerCase())) {
    throw new Response('Forbidden', { status: 403 });
  }
  return user;
}
