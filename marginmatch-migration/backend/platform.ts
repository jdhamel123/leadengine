/**
 * AppDeploy-compatible portable platform shim.
 *
 * This lets the preserved legacy MarginMatch backend compile and execute
 * against standard infrastructure without importing @appdeploy/sdk.
 * Legacy traffic remains disabled until parity/safety tests pass.
 */
import { postgresDb } from './platform-postgres';
import { envSecrets } from './secrets-env';
import { openAiAdapter } from './ai-openai';
import { resolveUser } from './auth-portable';
import { writeProof, signedProofUrls } from './storage-supabase';

type AnyRecord=Record<string,any>;
type Ctx={request:Request;body:any;params:Record<string,string>;query:Record<string,string>;user?:{id:string;email?:string}};

export const json=(value:unknown,status=200)=>Response.json(value,{status});
export const error=(message:string,status=400)=>Response.json({error:message},{status});

export const db={
  list:<T extends AnyRecord>(collection:string,options:AnyRecord={})=>postgresDb.list<T>(collection,options),
  get:<T extends AnyRecord>(collection:string,ids:string[])=>postgresDb.get<T>(collection,ids),
  add:<T extends AnyRecord>(collection:string,records:T[])=>postgresDb.add<T>(collection,records),
  update:<T extends AnyRecord>(collection:string,records:Array<{id:string;record:T}>)=>postgresDb.update<T>(collection,records),
  delete:(collection:string,ids:string[])=>postgresDb.delete(collection,ids)
};

export const secrets={
  async listSecretNames(){
    const names=await envSecrets.listSecretNames();
    return names.filter((name)=>{
      if(['RESEND_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'].includes(name))
        return process.env.ENABLE_LEGACY_EXTERNAL_MESSAGING==='true';
      if(name==='STRIPE_RESTRICTED_KEY'||name==='STRIPE_SECRET_KEY'){
        const value=process.env[name]||'';
        return value.includes('_test_') || process.env.ENABLE_LEGACY_LIVE_PAYMENTS==='true';
      }
      return true;
    });
  },
  async readSecret(name:string){
    if(['RESEND_API_KEY','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER'].includes(name) &&
       process.env.ENABLE_LEGACY_EXTERNAL_MESSAGING!=='true')
      throw new Error('Legacy external messaging credentials are locked');
    const value=await envSecrets.readSecret(name);
    if((name==='STRIPE_RESTRICTED_KEY'||name==='STRIPE_SECRET_KEY') &&
       value.includes('_live_') &&
       process.env.ENABLE_LEGACY_LIVE_PAYMENTS!=='true')
      throw new Error('Legacy live Stripe credentials are locked');
    return value;
  }
};

export const ai={
  generate:(options:AnyRecord)=>openAiAdapter.generate(options),
  run:(options:AnyRecord)=>openAiAdapter.run(options),
  async extract(options:AnyRecord){
    const prompt=[
      String(options.prompt||'Extract structured data from the supplied content.'),
      'Content:',
      String(options.content||''),
      'Return JSON only matching this JSON schema as closely as possible:',
      JSON.stringify(options.schema||{})
    ].join('\n');
    const result=await openAiAdapter.run({system:'Extract only explicitly supported facts. Do not invent missing values.',prompt,maxTokens:Number(options.maxTokens||800)});
    return {data:result.data||{}};
  }
};

export const storage={
  async write(items:Array<{path:string;content:string;contentType:string}>){
    const results:boolean[]=[];
    for(const item of items){
      try{await writeProof(item.path,item.content,item.contentType);results.push(true);}
      catch{results.push(false);}
    }
    return results;
  },
  async url(paths:string[]){return signedProofUrls(paths);}
};

function matchPath(pattern:string,actual:string){
  const p=pattern.split('/').filter(Boolean),a=actual.split('/').filter(Boolean);
  if(p.length!==a.length)return null;
  const params:Record<string,string>={};
  for(let i=0;i<p.length;i++){
    if(p[i].startsWith(':'))params[p[i].slice(1)]=decodeURIComponent(a[i]);
    else if(p[i]!==a[i])return null;
  }
  return params;
}

export function requireAuth(){
  return async (ctx:Ctx)=>{
    const user=await resolveUser(ctx.request);
    if(!user)return error('Unauthorized',401);
    ctx.user=user;
  };
}

export function requireAdminEmailAllowlist(passedAllowlist:string[]=[]){
  return async (ctx:Ctx)=>{
    const user=ctx.user||await resolveUser(ctx.request);
    if(!user)return error('Unauthorized',401);
    const configured=String(process.env.ADMIN_EMAIL_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    const allow=(configured.length?configured:passedAllowlist.map(x=>x.toLowerCase()));
    if(!user.email||!allow.includes(user.email.toLowerCase()))return error('Forbidden',403);
    ctx.user=user;
  };
}

export function router(routeMap:Record<string,Array<(ctx:Ctx)=>unknown>>){
  const entries=Object.entries(routeMap).map(([key,chain])=>{
    const firstSpace=key.indexOf(' ');
    return {method:key.slice(0,firstSpace).toUpperCase(),path:key.slice(firstSpace+1),chain};
  });
  return async function legacyPortableHandler(request:Request){
    const url=new URL(request.url);
    const route=entries.find(r=>r.method===request.method.toUpperCase()&&matchPath(r.path,url.pathname));
    if(!route)return error('Not found',404);
    const params=matchPath(route.path,url.pathname)||{};
    const query=Object.fromEntries(url.searchParams.entries());
    let body:any=undefined;
    if(!['GET','HEAD'].includes(request.method.toUpperCase())){
      const text=await request.text();
      if(text){
        try{body=JSON.parse(text);}catch{body=text;}
      }
    }
    const ctx:Ctx={request,body,params,query};
    try{
      for(const fn of route.chain){
        const result=await fn(ctx);
        if(result instanceof Response)return result;
      }
      return error('Handler returned no response',500);
    }catch(e){
      if(e instanceof Response)return e;
      console.error(e);
      return error(e instanceof Error?e.message:'Internal server error',500);
    }
  };
}

// Realtime compatibility is intentionally inert until the portable realtime
// migration is explicitly enabled.
export const ws={
  subscribe:async()=>false,
  publish:async()=>false
};
