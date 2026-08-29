import {portableRuntime} from './portable-runtime';

export function requestId(request:Request){
  return request.headers.get('x-request-id')||crypto.randomUUID();
}

export async function audit(event:{
  requestId?:string;kind:string;action:string;status:'ok'|'error'|'blocked';
  actor?:string;orderRef?:string;dispatchId?:string;detail?:Record<string,unknown>;
}){
  try{
    if(!(process.env.DATABASE_URL||process.env.SUPABASE_URL||process.env.POSTGREST_URL))return;
    await portableRuntime.db.add('audit-events',[{
      requestId:event.requestId||'',
      kind:event.kind,
      action:event.action,
      status:event.status,
      actor:event.actor||'system',
      orderRef:event.orderRef||'',
      dispatchId:event.dispatchId||'',
      detail:event.detail||{},
      createdAt:new Date().toISOString(),
      runtime:'portable'
    }]);
  }catch(error){
    console.warn('Audit write failed:',error instanceof Error?error.message:'unknown');
  }
}

export async function deadLetter(input:{
  kind:string;operation:string;payload?:Record<string,unknown>;error:string;
  orderRef?:string;dispatchId?:string;retryable?:boolean;
}){
  if(!(process.env.DATABASE_URL||process.env.SUPABASE_URL||process.env.POSTGREST_URL))return '';
  const [id]=await portableRuntime.db.add('dead-letter-events',[{
    kind:input.kind,
    operation:input.operation,
    payload:input.payload||{},
    error:input.error.slice(0,3000),
    orderRef:input.orderRef||'',
    dispatchId:input.dispatchId||'',
    retryable:input.retryable!==false,
    status:'open',
    attempts:0,
    createdAt:new Date().toISOString(),
    runtime:'portable'
  }]);
  return id||'';
}
