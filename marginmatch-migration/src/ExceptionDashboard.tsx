import { useEffect, useMemo, useState } from 'react';
import { api } from './platform-client';

type ExceptionRow={
  id:string; exceptionKey:string; type:string; severity:string; status:string; orderRef?:string;
  action?:string; note?:string; createdAt?:string; updatedAt?:string;
  aiDecision?:{classification?:string;priority?:string;recommendedAction?:string;rationale?:string};
  aiExecution?:{executed?:boolean;kind?:string;reason?:string};
};

export default function ExceptionDashboard(){
  const [rows,setRows]=useState<ExceptionRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true); setError('');
    try{
      const r=await api.get('/api/portable-exceptions');
      setRows((r.data?.exceptions||[]) as ExceptionRow[]);
    }catch(e:any){ setError(e?.message||'Could not load exceptions'); }
    finally{ setLoading(false); }
  }

  async function runTriage(){
    setRunning(true); setError('');
    try{
      await api.post('/api/portable-exceptions/scan',{});
      await api.post('/api/portable-exceptions/ai-resolve',{});
      await load();
    }catch(e:any){ setError(e?.message||'Could not run exception triage'); }
    finally{ setRunning(false); }
  }

  useEffect(()=>{ load(); },[]);

  const open=useMemo(()=>rows.filter(r=>r.status!=='resolved'),[rows]);
  const high=open.filter(r=>r.severity==='high').length;
  const unresolvedByAi=open.filter(r=>!r.aiExecution?.executed).length;

  return <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-[.25em] text-slate-400">MarginMatch Operations</div>
          <h1 className="text-3xl font-bold mt-1">Owner Exception Center</h1>
          <p className="text-slate-400 mt-2">Only cases that need attention after automation and AI triage.</p>
        </div>
        <button onClick={runTriage} disabled={running} className="rounded-xl bg-white text-slate-950 px-5 py-3 font-semibold disabled:opacity-50">
          {running?'Running triage…':'Scan + AI triage'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Open" value={open.length}/>
        <Stat label="High priority" value={high}/>
        <Stat label="Need owner" value={unresolvedByAi}/>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-400/40 bg-red-950/40 p-4 text-red-100">{error}</div>}
      {loading ? <div className="text-slate-400">Loading exceptions…</div> :
       open.length===0 ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-8 text-center">
          <div className="text-xl font-semibold">No open exceptions</div>
          <div className="text-slate-400 mt-2">Automation currently has nothing waiting for owner intervention.</div>
        </div> :
        <div className="space-y-3">
          {open.map(x=><article key={x.id||x.exceptionKey} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap gap-2 items-center">
              <span className={x.severity==='high'?'rounded-full bg-red-500/20 text-red-200 px-3 py-1 text-xs font-bold':'rounded-full bg-amber-500/20 text-amber-200 px-3 py-1 text-xs font-bold'}>
                {String(x.severity||'medium').toUpperCase()}
              </span>
              <span className="text-xs text-slate-500">{x.orderRef||'No order reference'}</span>
            </div>
            <h2 className="text-lg font-semibold mt-3">{x.aiDecision?.classification||x.type}</h2>
            <p className="text-slate-300 mt-2">{x.aiDecision?.recommendedAction||x.action||x.note}</p>
            {x.aiDecision?.rationale && <p className="text-sm text-slate-500 mt-2">{x.aiDecision.rationale}</p>}
            <div className="mt-4 text-xs text-slate-500">
              {x.aiExecution?.executed ? 'Safe automation executed: '+(x.aiExecution.kind||'internal action') : 'Waiting for owner review'}
            </div>
          </article>)}
        </div>}
    </div>
  </main>;
}

function Stat({label,value}:{label:string;value:number}){
  return <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-slate-400 mt-1">{label}</div>
  </div>;
}
