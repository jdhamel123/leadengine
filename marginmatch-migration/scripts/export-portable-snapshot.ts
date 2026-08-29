import {writeFile} from 'node:fs/promises';
import {Pool} from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const output=process.argv[2]||'marginmatch-portable-snapshot.json';
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
const q=await pool.query('select collection,id,record from platform_records order by collection,created_at,id');
const collections:Record<string,Array<Record<string,unknown>>>={};
for(const row of q.rows){
  (collections[row.collection] ||= []).push({...row.record,id:String(row.id)});
}
await writeFile(output,JSON.stringify({version:1,exportedAt:new Date().toISOString(),collections},null,2));
console.log('Wrote '+q.rows.length+' records to '+output);
await pool.end();
