import {useEffect,useState} from 'react';
import {api,auth} from './platform-client';

type Health={
  summary:{openDeadLetters:number;highExceptions:number;recentErrors:number};
  deadLetters:Array<Record<string,unknown>>;
  byKind:Array<Record<string,unknown>>;
  recentAudit:Array<Record<string,unknown>>;
};

export function SystemHealth(){
  const[data,setData]=useState<Health|null>(null);
  const[msg,setMsg]=useState('Loading system health…');

  async function load(){
    try{
      const r=await api.get('/api/system-health');
      setData(r.data);setMsg('');
    }catch(e:any){setData(null);setMsg(e?.message||'Owner access required.');}
  }
  async function resolve(id:string){
    const note=window.prompt('Resolution note','Owner reviewed / no retry needed');
    if(note===null)return;
    await api.post('/api/dead-letter/'+encodeURIComponent(id)+'/resolve',{resolution:note});
    await load();
  }

  useEffect(()=>{load()},[]);

  if(!data)return <div className='min-h-screen bg-slate-950 p-4 text-white'><div className='mx-auto mt-20 max-w-md rounded-3xl bg-slate-900 p-6 text-center'><h1 className='text-2xl font-black'>System Health</h1><p className='mt-3 text-slate-400'>{msg}</p>{!auth.isSignedIn()&&<button onClick={()=>auth.signIn()} className='mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Sign in</button>}</div></div>;

  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-6xl'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <div className='text-xs font-black tracking-[.2em] text-rose-300'>MARGINMATCH PORTABLE</div>
      <h1 className='mt-2 text-3xl font-black'>System Health</h1>
      <p className='mt-2 text-sm text-slate-400'>Operational failures, dead letters, and recent audit history.</p>
    </header>

    <section className='mt-4 grid grid-cols-3 gap-3'>
      <Stat label='Open failures' value={data.summary.openDeadLetters}/>
      <Stat label='High exceptions' value={data.summary.highExceptions}/>
      <Stat label='Recent audit errors' value={data.summary.recentErrors}/>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Failure queue</h2>
      <div className='mt-4 space-y-2'>
        {data.deadLetters.map((x,i)=><div key={String(x.id||i)} className='rounded-2xl bg-slate-950 p-4'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='font-black'>{String(x.kind||'failure')} · {String(x.operation||'operation')}</div>
              <div className='mt-1 text-xs text-slate-500'>{String(x.orderRef||'')} {String(x.dispatchId||'')}</div>
            </div>
            <button onClick={()=>resolve(String(x.id||''))} className='rounded-xl bg-slate-800 px-4 py-2 text-xs font-black'>Resolve</button>
          </div>
          <div className='mt-3 text-sm text-rose-200'>{String(x.error||'Unknown error')}</div>
        </div>)}
        {!data.deadLetters.length&&<div className='rounded-xl bg-emerald-950 p-4 text-sm text-emerald-200'>No open automation failures.</div>}
      </div>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Failures by type</h2>
      <div className='mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
        {data.byKind.map((x,i)=><div key={String(x.kind||i)} className='rounded-xl bg-slate-950 p-4'><div className='font-black'>{String(x.kind||'unknown')}</div><div className='mt-2 text-2xl font-black'>{String(x.count||0)}</div><div className='text-xs text-slate-500'>oldest {String(x.oldestAgeMinutes||0)} min</div></div>)}
      </div>
    </section>

    <div className='mt-4 grid gap-3 sm:grid-cols-4'>
      <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner</a>
      <a href='#control-center' className='rounded-2xl bg-orange-400 p-4 text-center font-black text-slate-950'>Operations</a>
      <a href='#exceptions' className='rounded-2xl bg-amber-300 p-4 text-center font-black text-slate-950'>Exceptions</a>
      <button onClick={load} className='rounded-2xl bg-blue-400 p-4 text-center font-black text-slate-950'>Refresh</button>
    </div>
  </div></div>;
}

function Stat({label,value}:{label:string;value:number}){
  return <div className='rounded-2xl border border-slate-800 bg-slate-900 p-4'><div className='text-2xl font-black'>{value}</div><div className='mt-1 text-xs text-slate-500'>{label}</div></div>;
}
