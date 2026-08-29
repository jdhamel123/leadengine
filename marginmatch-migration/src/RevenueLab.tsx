import {useEffect,useState} from 'react';
import {api,auth} from './platform-client';

type Summary={tenants:number;leads:number;qualified:number;appointments:number;recoveredRevenue:number;messagingLocked:number};

export function RevenueLab(){
  const[d,setD]=useState<Summary|null>(null),[msg,setMsg]=useState('Loading Revenue Lab…');
  async function load(){try{const r=await api.get('/api/revenue-lab/summary');setD(r.data);setMsg('')}catch(e:any){setMsg(e?.message||'Owner access required')}}
  useEffect(()=>{load()},[]);
  if(!d)return <div className='min-h-screen bg-slate-950 p-6 text-white'><div className='mx-auto mt-20 max-w-md rounded-3xl bg-slate-900 p-6 text-center'><h1 className='text-2xl font-black'>AI Revenue Lab</h1><p className='mt-3 text-slate-400'>{msg}</p>{!auth.isSignedIn()&&<button onClick={()=>auth.signIn()} className='mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Owner sign in</button>}</div></div>;
  const stats=[['Tenants',d.tenants],['Leads',d.leads],['Qualified',d.qualified],['Appointments',d.appointments],['Recovered','$'+d.recoveredRevenue.toLocaleString()],['Messaging locked',d.messagingLocked]];
  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-6xl'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'><div className='text-xs font-black tracking-[.2em] text-violet-300'>MARGINMATCH</div><h1 className='mt-2 text-3xl font-black'>AI Revenue Lab</h1><p className='mt-2 text-slate-400'>Build small. Sell outcomes. Automate winners. Kill weak experiments.</p></header>
    <section className='mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6'>{stats.map(([k,v])=><div key={String(k)} className='rounded-2xl border border-slate-800 bg-slate-900 p-4'><div className='text-2xl font-black'>{String(v)}</div><div className='mt-1 text-xs text-slate-500'>{String(k)}</div></div>)}</section>
    <section className='mt-4 grid gap-4 md:grid-cols-2'>
      <Offer title='Lead Rescue' status='BUILDING / PILOT FIRST' body='Recover web leads businesses are already paying for. Qualify, follow up, request appointments and attribute recovered revenue.'/>
      <Offer title='Dead Quote Recovery' status='NEXT' body='Reactivate old estimates and dormant inquiries by email, classify replies, suppress opt-outs and track won revenue.'/>
      <Offer title='AI Procurement Broker' status='QUEUED' body='Collect buyer requirements, solicit vendor bids by email, compare offers and monetize the spread or service fee.'/>
      <Offer title='AI Bid Desk' status='QUEUED' body='Find suitable opportunities for vendors, prepare compliant bid drafts, follow up and track outcomes.'/>
    </section>
    <div className='mt-4 grid gap-3 sm:grid-cols-4'><a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner</a><a href='#system-health' className='rounded-2xl bg-rose-300 p-4 text-center font-black text-slate-950'>Health</a><a href='#migration' className='rounded-2xl bg-cyan-300 p-4 text-center font-black text-slate-950'>Migration</a><button onClick={load} className='rounded-2xl bg-blue-400 p-4 font-black text-slate-950'>Refresh</button></div>
  </div></div>;
}
function Offer({title,status,body}:{title:string;status:string;body:string}){return <div className='rounded-3xl border border-slate-800 bg-slate-900 p-5'><div className='text-xs font-black text-violet-300'>{status}</div><h2 className='mt-2 text-xl font-black'>{title}</h2><p className='mt-2 text-sm leading-6 text-slate-400'>{body}</p></div>}
