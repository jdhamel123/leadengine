import {useState} from 'react';
import {api,auth} from './platform-client';

type Snapshot={version:number;exportedAt:string;source?:string;collections:Record<string,Array<Record<string,unknown>>>};

export function DataMigration(){
  const[msg,setMsg]=useState('Choose an AppDeploy migration snapshot.');
  const[busy,setBusy]=useState(false);
  const[progress,setProgress]=useState(0);

  async function importFile(file:File){
    setBusy(true);setProgress(0);setMsg('Reading snapshot…');
    try{
      const snapshot=JSON.parse(await file.text()) as Snapshot;
      if(snapshot.version!==1||!snapshot.collections||typeof snapshot.collections!=='object')
        throw new Error('Unsupported migration snapshot format');
      const entries=Object.entries(snapshot.collections);
      const expectedRecords=entries.reduce((n,[,rows])=>n+rows.length,0);
      const start=await api.post('/api/migration-import/start',{
        source:snapshot.source||'AppDeploy MarginMatch',
        snapshotExportedAt:snapshot.exportedAt,
        expectedCollections:entries.length,
        expectedRecords
      });
      const id=String(start.data.id||'');
      if(!id)throw new Error('Could not start import');

      let imported=0;
      for(const [collection,rows] of entries){
        if(rows.length===0){
          // Send an explicit marker through a zero-data session update is unnecessary;
          // empty collections are counted locally and validated by hash reconciliation.
          continue;
        }
        for(let i=0;i<rows.length;i+=100){
          const batch=rows.slice(i,i+100);
          const r=await api.post('/api/migration-import/'+id+'/batch',{collection,records:batch});
          imported+=Number(r.data.imported||0);
          setProgress(expectedRecords?Math.min(99,Math.round(imported/expectedRecords*100)):99);
          setMsg('Importing '+collection+' · '+imported+' / '+expectedRecords+' records');
        }
      }
      const done=await api.post('/api/migration-import/'+id+'/complete',{});
      setProgress(100);
      setMsg(
        'Import '+String(done.data.status||'complete')+
        ': '+String(done.data.importedRecords||imported)+' records. '+
        String(done.data.nextStep||'Run reconciliation before cutover.')
      );
    }catch(e:any){
      setMsg(e?.message||'Snapshot import failed');
    }finally{setBusy(false);}
  }

  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-3xl pt-12'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <div className='text-xs font-black tracking-[.2em] text-cyan-300'>MARGINMATCH PORTABLE</div>
      <h1 className='mt-2 text-3xl font-black'>Data Migration</h1>
      <p className='mt-2 text-sm text-slate-400'>Import a read-only AppDeploy snapshot into portable PostgreSQL in bounded batches.</p>
    </header>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      {!auth.isSignedIn()?<button onClick={()=>auth.signIn()} className='rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Owner sign in</button>:
      <label className={'block rounded-2xl border border-dashed border-cyan-500/50 bg-slate-950 p-8 text-center '+(busy?'opacity-50':'cursor-pointer')}>
        <div className='text-xl font-black'>Choose snapshot JSON</div>
        <div className='mt-2 text-sm text-slate-500'>Nothing is deleted from the portable database. Matching source IDs are updated; new IDs are inserted.</div>
        <input disabled={busy} type='file' accept='application/json,.json' className='hidden' onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f)}}/>
      </label>}

      <div className='mt-5 h-3 overflow-hidden rounded-full bg-slate-950'><div className='h-full bg-cyan-300 transition-all' style={{width:progress+'%'}}/></div>
      <div className='mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300'>{msg}</div>
      <div className='mt-4 rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-100'>Count completion is not final cutover approval. Run canonical SHA-256 reconciliation before moving DNS.</div>
    </section>

    <div className='mt-4 grid gap-3 sm:grid-cols-3'>
      <a href='#migration' className='rounded-2xl bg-cyan-300 p-4 text-center font-black text-slate-950'>Migration Control</a>
      <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner Cockpit</a>
      <a href='#control-center' className='rounded-2xl bg-orange-400 p-4 text-center font-black text-slate-950'>Operations</a>
    </div>
  </div></div>;
}
