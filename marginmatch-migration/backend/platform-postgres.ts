/**
 * Portable record database.
 * Supports either a direct PostgreSQL DATABASE_URL or Supabase/PostgREST.
 */
import { Pool } from 'pg';

type RecordValue = Record<string, unknown>;
type PostgrestRow = { id:string; record:RecordValue };

let pool:Pool|null=null;
function directPool(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool)pool=new Pool({
    connectionString:process.env.DATABASE_URL,
    ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false},
    max:Math.max(1,Number(process.env.DATABASE_POOL_MAX||5))
  });
  return pool;
}

const baseUrl=()=>{
  const value=process.env.SUPABASE_URL||process.env.POSTGREST_URL;
  if(!value)throw new Error('DATABASE_URL, SUPABASE_URL or POSTGREST_URL is required');
  return value.replace(/\/$/,'');
};
const serviceKey=()=>{
  const value=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.POSTGREST_SERVICE_KEY;
  if(!value)throw new Error('Database service credential is required');
  return value;
};
async function restRequest(path:string,init:RequestInit={}){
  const key=serviceKey();
  const response=await fetch(baseUrl()+path,{
    ...init,
    headers:{
      apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',
      Prefer:'return=representation',...(init.headers||{})
    }
  });
  if(!response.ok)throw new Error('PostgREST adapter request failed: '+response.status+' '+await response.text());
  if(response.status===204)return [];
  return response.json();
}
const encode=(value:string)=>encodeURIComponent(value);

export const postgresDb={
  async list<T extends RecordValue>(collection:string,options:RecordValue={}):Promise<{items:Array<T&{id:string}>}>{
    const limit=Math.max(1,Math.min(1000,Number(options.limit||100)));
    const p=directPool();
    if(p){
      const q=await p.query('select id, record from platform_records where collection=$1 order by created_at desc limit $2',[collection,limit]);
      return {items:q.rows.map((row:any)=>({...row.record,id:String(row.id)}))};
    }
    const rows=(await restRequest('/rest/v1/platform_records?collection=eq.'+encode(collection)+'&select=id,record&order=created_at.desc&limit='+limit)) as PostgrestRow[];
    return {items:rows.map(row=>({...row.record as T,id:row.id}))};
  },

  async get<T extends RecordValue>(collection:string,ids:string[]):Promise<Array<(T&{id:string})|null>>{
    if(!ids.length)return [];
    const p=directPool();
    let rows:Array<{id:string;record:RecordValue}>=[];
    if(p){
      const q=await p.query('select id, record from platform_records where collection=$1 and id = any($2::uuid[])',[collection,ids]);
      rows=q.rows.map((row:any)=>({id:String(row.id),record:row.record}));
    }else{
      rows=(await restRequest('/rest/v1/platform_records?collection=eq.'+encode(collection)+'&id=in.('+ids.map(encode).join(',')+')&select=id,record')) as PostgrestRow[];
    }
    const byId=new Map(rows.map(row=>[row.id,{...(row.record as T),id:row.id}]));
    return ids.map(id=>byId.get(id)||null);
  },

  async add<T extends RecordValue>(collection:string,records:T[]):Promise<string[]>{
    if(!records.length)return [];
    const p=directPool();
    if(p){
      const client=await p.connect();
      try{
        await client.query('begin');
        const ids:string[]=[];
        for(const record of records){
          const q=await client.query('insert into platform_records(collection,record) values($1,$2::jsonb) returning id',[collection,JSON.stringify(record)]);
          ids.push(String(q.rows[0].id));
        }
        await client.query('commit');
        return ids;
      }catch(error){
        await client.query('rollback');
        throw error;
      }finally{client.release();}
    }
    const rows=(await restRequest('/rest/v1/platform_records',{method:'POST',body:JSON.stringify(records.map(record=>({collection,record}))) })) as PostgrestRow[];
    return rows.map(row=>row.id);
  },

  async update<T extends RecordValue>(collection:string,records:Array<{id:string;record:T}>):Promise<boolean[]>{
    const p=directPool();
    const results:boolean[]=[];
    for(const item of records){
      if(p){
        const q=await p.query('update platform_records set record=$3::jsonb where collection=$1 and id=$2::uuid returning id',[collection,item.id,JSON.stringify(item.record)]);
        results.push(q.rowCount===1);
      }else{
        const rows=(await restRequest('/rest/v1/platform_records?collection=eq.'+encode(collection)+'&id=eq.'+encode(item.id),{method:'PATCH',body:JSON.stringify({record:item.record})})) as PostgrestRow[];
        results.push(rows.length>0);
      }
    }
    return results;
  },

  async delete(collection:string,ids:string[]):Promise<boolean[]>{
    const p=directPool();
    const results:boolean[]=[];
    for(const id of ids){
      if(p){
        const q=await p.query('delete from platform_records where collection=$1 and id=$2::uuid returning id',[collection,id]);
        results.push(q.rowCount===1);
      }else{
        const rows=(await restRequest('/rest/v1/platform_records?collection=eq.'+encode(collection)+'&id=eq.'+encode(id),{method:'DELETE'})) as PostgrestRow[];
        results.push(rows.length>0);
      }
    }
    return results;
  }
};
