import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Pool} from 'pg';

type Snapshot={version:number;collections:Record<string,Array<Record<string,unknown>&{id?:string}>>};
const file=process.argv[2];
if(!file)throw new Error('Usage: npm run migrate:reconcile -- snapshot.json');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');

const snapshot=JSON.parse(await readFile(file,'utf8')) as Snapshot;
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});

function canonical(v:unknown):string{
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object'){
    const o=v as Record<string,unknown>;
    return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
  }
  return JSON.stringify(v);
}
function digest(rows:Array<Record<string,unknown>>){
  const normalized=rows.map(r=>canonical(r)).sort().join('\n');
  return createHash('sha256').update(normalized).digest('hex');
}

let failed=false;
for(const [collection,sourceRows] of Object.entries(snapshot.collections)){
  const q=await pool.query('select id,record from platform_records where collection=$1 order by id',[collection]);
  const targetRows=q.rows.map((r:any)=>({...r.record,id:String(r.id)}));
  const sourceHash=digest(sourceRows);
  const targetHash=digest(targetRows);
  const ok=sourceRows.length===targetRows.length&&sourceHash===targetHash;
  console.log(JSON.stringify({collection,source:sourceRows.length,target:targetRows.length,hashMatch:sourceHash===targetHash,ok}));
  if(!ok)failed=true;
}
await pool.end();
if(failed)process.exit(2);
console.log('Snapshot reconciliation passed.');
