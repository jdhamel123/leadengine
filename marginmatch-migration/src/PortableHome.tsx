export function PortableHome(){
  return <div className='min-h-screen bg-[#07111f] p-4 text-white'>
    <div className='mx-auto max-w-5xl pt-16'>
      <div className='rounded-3xl border border-slate-800 bg-slate-900 p-7'>
        <div className='text-xs font-black tracking-[.2em] text-emerald-300'>MARGINMATCH PORTABLE</div>
        <h1 className='mt-2 text-4xl font-black'>Independent runtime</h1>
        <p className='mt-3 max-w-2xl text-slate-400'>Mattress Rescue operations are being migrated first. Other MarginMatch brands stay on their current production deployment until their API parity checks pass.</p>
        <div className='mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <a href='#owner' className='rounded-2xl bg-emerald-400 p-4 text-center font-black text-slate-950'>Owner Cockpit</a>
          <a href='#control-center' className='rounded-2xl bg-orange-400 p-4 text-center font-black text-slate-950'>Operations</a>
          <a href='#exceptions' className='rounded-2xl bg-amber-300 p-4 text-center font-black text-slate-950'>Exceptions</a>
          <a href='#migration' className='rounded-2xl bg-cyan-300 p-4 text-center font-black text-slate-950'>Migration</a>
        </div>
      </div>
      <div className='mt-4 rounded-3xl border border-slate-800 bg-slate-900 p-6'>
        <h2 className='text-xl font-black'>Cutover policy</h2>
        <p className='mt-2 text-sm text-slate-400'>A brand is moved here only after its customer flow, operations, payments, messaging, fulfillment, auth and exception handling pass portable parity checks.</p>
      </div>
    </div>
  </div>;
}
