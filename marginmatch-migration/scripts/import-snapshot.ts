import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';

type Snapshot={version:number;exportedAt:string;collections:Record<string,Array<Record<string,unknown>&{id?:string}>>};

const file=process.argv[2];
if(!file)throw new Error('Usage: npm run migrate:import -- snapshot.json');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for snapshot import');

const snapshot=JSON.parse(await readFile(file,'utf8')) as Snapshot;
if(snapshot.version!==1)throw new Error('Unsupported snapshot version');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='false'?false:{rejectUnauthorized:false}});
const client=await pool.connect();

try{
  await client.query('begin');
  let total=0;
  for(const [collection,records] of Object.entries(snapshot.collections)){
    for(const source of records){
      const {id,...record}=source;
      if(id&&/^[0-9a-f-]{36}$/i.test(id)){
        await client.query(
          'insert into platform_records(collection,id,record) values($1,$2::uuid,$3::jsonb) on conflict(collection,id) do update set record=excluded.record',
          [collection,id,JSON.stringify(record)]
        );
      }else{
        await client.query(
          'insert into platform_records(collection,record) values($1,$2::jsonb)',
          [collection,JSON.stringify(record)]
        );
      }
      total++;
    }
    console.log(collection+': '+records.length);
  }
  await client.query('commit');
  console.log('Imported records: '+total);
} catch(error){
  await client.query('rollback');
  throw error;
} finally {
  client.release();
  await pool.end();
}
