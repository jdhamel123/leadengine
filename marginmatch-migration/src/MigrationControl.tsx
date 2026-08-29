import {useEffect,useState} from 'react';
import {api,auth} from './platform-client';

type Check={id:string;label:string;pass:boolean};
type Brand={brand:string;domain:string;parity:string;domainCutoverReady:boolean;blockers:string[]};
type Readiness={
  checks:Check[];brands:Brand[];readyForIndependentPreview:boolean;mattressRescueCutoverReady:boolean;
  readyForPortfolioDomainCutover:boolean;productionPaymentsUnlocked:boolean;productionMessagingUnlocked:boolean;
  appDeployRequiredForMattressRescueRuntime:boolean;appDeployRequiredForFullPortfolio:boolean;blocking:string[];
};

export function MigrationControl(){
  const[data,setData]=useState<Readiness|null>(null);
  const[msg,setMsg]=useState('Loading migration readiness…');
  const[testMsg,setTestMsg]=useState('');
  async function load(){
    try{const r=await api.get('/api/migration-readiness');setData(r.data);setMsg('');}
    catch(e:any){setData(null);setMsg(e?.message||'Owner access required.');}
  }
  async function runSelfTests(){
    setTestMsg('Running portable core and legacy compatibility tests…');
    try{
      const core=await api.get('/api/self-test');
      const legacy=await api.get('/api/legacy-compat-self-test');
      setTestMsg('Core: '+(core.data.pass?'PASS':'CHECKS FAILED')+' · Legacy shim: '+(legacy.data.loaded&&legacy.data.healthStatus===200?'PASS':'FAILED')+' · Legacy traffic remains '+(legacy.data.trafficEnabled?'ENABLED':'DISABLED'));
      await load();
    }catch(e:any){setTestMsg(e?.message||'Self-test failed');}
  }
  useEffect(()=>{load()},[]);
  if(!data)return <div className='min-h-screen bg-slate-950 p-4 text-white'><div className='mx-auto mt-20 max-w-md rounded-3xl bg-slate-900 p-6 text-center'><h1 className='text-2xl font-black'>Migration Control</h1><p className='mt-3 text-slate-400'>{msg}</p>{!auth.isSignedIn()&&<button onClick={()=>auth.signIn()} className='mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950'>Sign in</button>}</div></div>;

  return <div className='min-h-screen bg-[#07111f] p-4 text-white'><div className='mx-auto max-w-6xl'>
    <header className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <div className='text-xs font-black tracking-[.2em] text-cyan-300'>MARGINMATCH PORTABLE</div>
      <h1 className='mt-2 text-3xl font-black'>Migration & Deployment Control</h1>
      <p className='mt-2 text-sm text-slate-400'>Per-brand cutover readiness without pretending the entire portfolio is migrated.</p>
    </header>

    <section className='mt-4 grid gap-3 sm:grid-cols-3'>
      <Status label='Independent preview' pass={data.readyForIndependentPreview}/>
      <Status label='Mattress Rescue cutover' pass={data.mattressRescueCutoverReady}/>
      <Status label='Full portfolio cutover' pass={data.readyForPortfolioDomainCutover}/>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Brand parity</h2>
      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        {data.brands.map(b=><div key={b.brand} className='rounded-2xl bg-slate-950 p-4'>
          <div className='flex items-start justify-between gap-3'><div><div className='font-black'>{b.brand}</div><div className='text-xs text-slate-500'>{b.domain}</div></div><span className={b.domainCutoverReady?'text-emerald-300 text-xs font-black':'text-amber-300 text-xs font-black'}>{b.domainCutoverReady?'CUTOVER READY':b.parity}</span></div>
          {!!b.blockers.length&&<div className='mt-3 text-xs text-slate-400'>Blockers: {b.blockers.join(', ')}</div>}
        </div>)}
      </div>
    </section>

    <section className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-5'>
      <h2 className='text-xl font-black'>Infrastructure checks</h2>
      <div className='mt-4 grid gap-2 md:grid-cols-2'>
        {data.checks.map(x=><div key={x.id} className='flex items-center justify-between rounded-xl bg-slate-950 p-3'>
          <span className='text-sm'>{x.label}</span><span className={x.pass?'text-emerald-300 font-black':'text-amber-300 font-black'}>{x.pass?'READY':'NEEDS SETUP'}</span>
        </div>)}
      </div>
    </section>

    <section className='mt-4 grid gap-4 md:grid-cols-2'>
      <div className='rounded-3xl border border-slate-800 bg-slate-900 p-5'>
        <h2 className='text-xl font-black'>Safety locks</h2>
        <div className='mt-3 text-sm text-slate-300'>Production payments: <b>{data.productionPaymentsUnlocked?'UNLOCKED':'LOCKED'}</b></div>
        <div className='mt-2 text-sm text-slate-300'>Production messaging: <b>{data.productionMessagingUnlocked?'UNLOCKED':'LOCKED'}</b></div>
      </div>
      <div className='rounded-3xl border border-slate-800 bg-slate-900 p-5'>
        <h2 className='text-xl font-black'>AppDeploy dependency</h2>
        <div className='mt-3 text-sm text-slate-300'>Mattress Rescue runtime: <b>{data.appDeployRequiredForMattressRescueRuntime?'STILL REQUIRED':'NOT REQUIRED'}</b></div>
        <div className='mt-2 text-sm text-slate-300'>Full portfolio: <b>{data.appDeployRequiredForFullPortfolio?'STILL REQUIRED':'NOT REQUIRED'}</b></div>
      </div>
    </section>

    {testMsg&&<div className='mt-4 rounded-2xl border border-violet-400/20 bg-violet-950/30 p-4 text-sm text-violet-100'>{testMsg}</div>}
    <div className='mt-4 grid gap-3 sm:grid-cols-4'>
      <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner Cockpit</a>
      <a href='#control-center' className='rounded-2xl bg-orange-400 p-4 text-center font-black text-slate-950'>Operations</a>
      <a href='#exceptions' className='rounded-2xl bg-amber-300 p-4 text-center font-black text-slate-950'>Exceptions</a>
      <button onClick={runSelfTests} className='rounded-2xl bg-violet-300 p-4 text-center font-black text-slate-950'>Run self-tests</button>
    </div>
  </div></div>;
}

function Status({label,pass}:{label:string;pass:boolean}){
  return <div className='rounded-2xl border border-slate-800 bg-slate-900 p-4'><div className='text-xs text-slate-500'>{label}</div><div className={'mt-2 text-xl font-black '+(pass?'text-emerald-300':'text-amber-300')}>{pass?'READY':'BLOCKED'}</div></div>;
}
