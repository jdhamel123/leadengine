import {useState} from 'react';
import {api,auth} from './platform-client';

export function PortableLogin(){
  const[email,setEmail]=useState('');
  const[accessKey,setAccessKey]=useState('');
  const[msg,setMsg]=useState('');
  const[busy,setBusy]=useState(false);

  async function submit(){
    setBusy(true);setMsg('');
    try{
      const r=await api.post('/api/auth/login',{email,accessKey});
      auth.setAccessToken(String(r.data.token||''));
      window.location.hash='#owner';
    }catch(e:any){
      setMsg(e?.message||'Sign-in failed');
    }finally{setBusy(false);}
  }

  return <div className='min-h-screen bg-slate-950 p-4 text-white'>
    <div className='mx-auto mt-20 max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7'>
      <div className='text-xs font-black tracking-[.2em] text-emerald-300'>MARGINMATCH</div>
      <h1 className='mt-2 text-3xl font-black'>Owner sign in</h1>
      <p className='mt-2 text-sm text-slate-400'>Independent portable admin access.</p>
      <input value={email} onChange={e=>setEmail(e.target.value)} type='email' placeholder='Owner email' className='mt-6 w-full rounded-xl border border-slate-700 bg-slate-950 p-3'/>
      <input value={accessKey} onChange={e=>setAccessKey(e.target.value)} type='password' placeholder='Admin access key' className='mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 p-3'/>
      <button disabled={busy} onClick={submit} className='mt-4 w-full rounded-xl bg-emerald-400 p-4 font-black text-slate-950 disabled:opacity-50'>{busy?'Signing in…':'Sign in'}</button>
      {msg&&<div className='mt-3 rounded-xl bg-red-950/50 p-3 text-sm text-red-200'>{msg}</div>}
    </div>
  </div>;
}
