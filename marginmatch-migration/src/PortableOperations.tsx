import {useEffect,useState} from 'react';
import {api,auth} from './platform-client';

type Ops={
  summary:{leads:number;testOrders:number;dispatches:number;activeDispatches:number;completedDispatches:number;openExceptions:number;approvedContractors:number;contractorOwed:number};
  recentDispatches:Array<Record<string,unknown>>;
  recentExceptions:Array<Record<string,unknown>>;
};

export function PortableOperations(){
  const[data,setData]=useState<Ops|null>(null);
  const[msg,setMsg]=useState('Loading portable operations…');
  async function load(){
    try{const r=await api.get('/api/portable-operations');const payload=r.data;if(!payload||typeof payload!=='object'||Array.isArray(payload)||!('summary' in payload))throw new Error('Portable API is not connected to this preview.');setData(payload as Ops);setMsg('');}
    catch(e:any){setData(null);setMsg(e?.message||'Owner access required.');}
  }
  useEffect(()=>{load()},[]);
  if(!data)return <div className='min-h-screen bg-slate-950 p-4 text-white'><div className='mx-auto mt-20 max-w-md rounded-3xl bg-slate-900 p-6 text-center'><h1 className='text-2xl font-black'>Portable Operations</h1><p className='mt-3 text-slate-400'>{msg}</p>{!auth.isSignedIn()&&<button onClick={()=>auth.signIn()} className='mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Sign in</button>}</div></div>;

  const s=data.summary;
  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-6xl'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <div className='text-xs font-black tracking-[.2em] text-orange-300'>MARGINMATCH PORTABLE</div>
      <h1 className='mt-2 text-3xl font-black'>Operations</h1>
      <p className='mt-2 text-sm text-slate-400'>Independent Mattress Rescue operations and exception status.</p>
    </header>
    <section className='mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4'>
      {[
        ['Leads',s.leads],['Test orders',s.testOrders],['Active dispatches',s.activeDispatches],['Completed',s.completedDispatches],
        ['Exceptions',s.openExceptions],['Contractors',s.approvedContractors],['Contractor owed','$'+Math.round(s.contractorOwed)],['All dispatches',s.dispatches]
      ].map(([a,b])=><div key={String(a)} className='rounded-2xl border border-slate-800 bg-slate-900 p-4'><div className='text-xs uppercase text-slate-500'>{a}</div><div className='mt-2 text-2xl font-black'>{String(b)}</div></div>)}
    </section>
    <section className='mt-4 grid gap-4 lg:grid-cols-2'>
      <div className='rounded-3xl border border-slate-800 bg-slate-900 p-5'><h2 className='text-xl font-black'>Recent dispatches</h2><div className='mt-4 space-y-2'>{data.recentDispatches.map((d,i)=><div key={String(d.id||i)} className='rounded-xl bg-slate-950 p-3'><div className='flex justify-between'><b>{String(d.item||'Mattress')} × {String(d.count||1)}</b><span className='text-xs text-emerald-300'>{String(d.status||'')}</span></div><div className='mt-1 text-xs text-slate-500'>{String(d.zip||'')} · {String(d.driverName||'Unassigned')}</div></div>)}</div></div>
      <div className='rounded-3xl border border-slate-800 bg-slate-900 p-5'><h2 className='text-xl font-black'>Open exceptions</h2><div className='mt-4 space-y-2'>{data.recentExceptions.map((x,i)=><div key={String(x.id||i)} className='rounded-xl bg-slate-950 p-3'><div className='font-black'>{String(x.type||'Exception')}</div><div className='mt-1 text-xs text-slate-400'>{String(((x.aiDecision as Record<string,unknown>|undefined)?.recommendedAction)||x.action||x.note||'Review')}</div></div>)}{!data.recentExceptions.length&&<div className='text-sm text-emerald-300'>No open exceptions.</div>}</div></div>
    </section>
    <div className='mt-4 grid gap-3 sm:grid-cols-4'>
      <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner</a>
      <a href='#contractor-admin' className='rounded-2xl bg-blue-400 p-4 text-center font-black text-slate-950'>Contractors</a>
      <a href='#exceptions' className='rounded-2xl bg-amber-300 p-4 text-center font-black text-slate-950'>Exceptions</a>
      <a href='#migration' className='rounded-2xl bg-cyan-300 p-4 text-center font-black text-slate-950'>Migration</a>
    </div>
  </div></div>;
}
