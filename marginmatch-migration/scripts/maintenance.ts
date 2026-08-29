import {portableRuntime} from '../backend/portable-runtime';

const now=Date.now();
const auditRetentionDays=Math.max(7,Number(process.env.AUDIT_RETENTION_DAYS||30));
const deadLetterRetentionDays=Math.max(30,Number(process.env.DEAD_LETTER_RETENTION_DAYS||90));

async function purge(collection:string,days:number,statusField?:string,statusValue?:string){
  const rows=(await portableRuntime.db.list<any>(collection,{limit:1000})).items;
  const cutoff=now-days*86400000;
  const ids=rows.filter((x:any)=>{
    const ts=new Date(String(x.createdAt||x.resolvedAt||0)).getTime();
    const statusOk=statusField?String(x[statusField]||'')===String(statusValue||''):true;
    return statusOk&&Number.isFinite(ts)&&ts>0&&ts<cutoff;
  }).map((x:any)=>String(x.id));
  if(ids.length)await portableRuntime.db.delete(collection,ids);
  return ids.length;
}

const auditDeleted=await purge('audit-events',auditRetentionDays);
const deadDeleted=await purge('dead-letter-events',deadLetterRetentionDays,'status','resolved');

await portableRuntime.db.add('system-health-events',[{
  kind:'maintenance',
  status:'ok',
  auditDeleted,
  deadLettersDeleted:deadDeleted,
  auditRetentionDays,
  deadLetterRetentionDays,
  createdAt:new Date().toISOString(),
  runtime:'portable'
}]);

console.log(JSON.stringify({auditDeleted,deadDeleted,auditRetentionDays,deadLetterRetentionDays}));
