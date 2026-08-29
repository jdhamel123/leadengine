import {useEffect,useState} from 'react';
import {api,auth} from './platform-client';

type Check={id:string;label:string;pass:boolean};
type Readiness={
  checks:Check[];readyForIndependentPreview:boolean;readyForDomainCutover:boolean;
  productionPaymentsUnlocked:boolean;productionMessagingUnlocked:boolean;
  appDeployRequiredForPortableRuntime:boolean;blocking:string[];
};

export function MigrationControl(){
  const[data,setData]=useState<Readiness|null>(null);
  const[msg,setMsg]=useState('Loading migration readiness…');
  async function load(){
    try{
      const r=await api.get('/api/migration-readiness');
      setData(r.data);setMsg('');
    }catch(e:any){setData(null);setMsg(e?.message||'Owner access required.');}
  }
  useEffect(()=>{load()},[]);
  if(!data)return <div className='min-h-screen bg-slate-950 p-4 text-white'><div className='mx-auto mt-20 max-w-md rounded-3xl bg-slate-900 p-6 text-center'><h1 className='text-2xl font-black'>Migration Control</h1><p className='mt-3 text-slate-400'>{msg}</p>{!auth.isSignedIn()&&<button onClick={()=>auth.signIn()} className='mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Sign in</button>}</div></div>;
  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-5xl'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <div className='text-xs font-black tracking-[.2em] text-cyan-300'>MARGINMATCH PORTABLE</div>
      <h1 className='mt-2 text-3xl font-black'>Migration & Deployment Control</h1>
      <p className='mt-2 text-sm text-slate-400'>Independent-runtime readiness without AppDeploy.</p>
    </header>

    <section className='mt-4 grid gap-3 sm:grid-cols-3'>
      <Status label='Independent preview' pass={data.readyForIndependentPreview}/>
      <Status label='Domain cutover' pass={data.readyForDomainCutover}/>
      <Status label='AppDeploy required' pass={!data.appDeployRequiredForPortableRuntime} invert/>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Readiness checks</h2>
      <div className='mt-4 grid gap-2 md:grid-cols-2'>
        {data.checks.map(x=><div key={x.id} className='flex items-center justify-between rounded-xl bg-slate-950 p-3'>
          <span className='text-sm'>{x.label}</span><span className={x.pass?'text-emerald-300 font-black':'text-amber-300 font-black'}>{x.pass?'READY':'NEEDS SETUP'}</span>
        </div>)}
      </div>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Safety locks</h2>
      <div className='mt-3 text-sm text-slate-300'>Production payments: <b>{data.productionPaymentsUnlocked?'UNLOCKED':'LOCKED'}</b></div>
      <div className='mt-2 text-sm text-slate-300'>Production messaging: <b>{data.productionMessagingUnlocked?'UNLOCKED':'LOCKED'}</b></div>
      <p className='mt-3 text-xs text-slate-500'>Cutover readiness does not automatically unlock money movement or external messaging.</p>
    </section>

    <div className='mt-4 grid gap-3 sm:grid-cols-3'>
      <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner Cockpit</a>
      <a href='#exceptions' className='rounded-2xl bg-orange-400 p-4 text-center font-black text-slate-950'>Exceptions</a>
      <button onClick={load} className='rounded-2xl bg-blue-400 p-4 text-center font-black text-slate-950'>Refresh readiness</button>
    </div>
  </div></div>;
}

function Status({label,pass,invert=false}:{label:string;pass:boolean;invert?:boolean}){
  return <div className='rounded-2xl border border-slate-800 bg-slate-900 p-4'><div className='text-xs text-slate-500'>{label}</div><div className={'mt-2 text-xl font-black '+(pass?'text-emerald-300':'text-amber-300')}>{pass?(invert?'NO':'READY'):(invert?'YES':'BLOCKED')}</div></div>;
}
