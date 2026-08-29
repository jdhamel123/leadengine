import assert from 'node:assert/strict';
import { handleRequest } from '../backend/portable-api';
import { portableRuntime } from '../backend/portable-runtime';

async function call(path:string, body?:unknown) {
  return handleRequest(new Request('http://localhost'+path,{
    method:body===undefined?'GET':'POST',
    headers:body===undefined?undefined:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  }));
}
async function data(response:Response){
  const body=await response.json() as Record<string,any>;
  if(!response.ok) throw new Error(response.status+' '+JSON.stringify(body));
  return body;
}

async function run(){
  if(!(process.env.SUPABASE_URL||process.env.POSTGREST_URL)){
    console.log('Portable workflow integration test skipped: database not configured.');
    return;
  }

  const suffix=Date.now().toString().slice(-6);
  const phone='508555'+suffix.slice(-4).padStart(4,'0');

  // Exercise the actual contractor application onboarding flow.
  const application=await data(await call('/api/contractor-applications',{
    name:'Portable Test Driver '+suffix,
    email:'portable-driver-'+suffix+'@example.com',
    phone,
    address:'1 Test Way',
    city:'Foxborough',
    state:'MA',
    zip:'02035',
    serviceZips:'02035 02766',
    vehicle:'Pickup truck',
    availability:'Test availability',
    experience:'Migration workflow test',
    licenseConfirmed:true,
    insuranceConfirmed:true,
    backgroundConsent:true,
    contractorAcknowledged:true
  }));
  assert.equal(application.status,'pending');
  assert.ok(application.id);

  const approved=await data(await call('/api/contractor-applications/'+application.id+'/approve',{
    payPerJob:45
  }));
  assert.equal(approved.approved,true);
  assert.equal(approved.moneyMoved,false);
  assert.ok(approved.driverProfileId);
  assert.ok(approved.portalUrl);

  const token=String(approved.portalUrl).split('#contractor=')[1];
  assert.ok(token);
  const contractor={id:approved.driverProfileId,token};

  const job=await data(await call('/api/mattress-test-driver-job',{
    driverProfileId:contractor.id,
    driverPhone:phone,
    address:'100 Main St',
    zip:'02035',
    item:'Mattress',
    count:1,
    serviceDate:'2026-09-01',
    preferredTime:'09:00'
  }));
  assert.ok(job.token);

  const accepted=await data(await call('/api/mattress-driver-job/'+job.token+'/respond',{decision:'accept'}));
  assert.equal(accepted.status,'accepted');

  const enroute=await data(await call('/api/mattress-driver-job/'+job.token+'/progress',{status:'en-route'}));
  assert.equal(enroute.status,'en-route');

  const onsite=await data(await call('/api/mattress-driver-job/'+job.token+'/progress',{status:'at-pickup'}));
  assert.equal(onsite.status,'at-pickup');

  // For the integration harness, seed proof paths directly into the test record.
  // Storage transport has its own validation path; this verifies lifecycle + payroll.
  const dispatches=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:200})).items;
  const dispatch=dispatches.find((d:any)=>String(d.token||'')===job.token);
  assert.ok(dispatch);
  const seeded={...dispatch,pickupPhotoPath:'test/pickup.jpg',completionPhotoPath:'test/completion.jpg'};
  delete seeded.id;
  await portableRuntime.db.update('mattress-driver-dispatches',[{id:dispatch.id,record:seeded}]);

  const completed=await data(await call('/api/mattress-driver-job/'+job.token+'/complete',{notes:'portable workflow test'}));
  assert.equal(completed.status,'completed');
  assert.equal(completed.compensationRecorded,true);
  assert.equal(completed.compensationAmount,45);

  const portal=await data(await call('/api/contractor-portal/'+contractor.token));
  assert.equal(portal.summary.completedJobs,1);
  assert.equal(portal.summary.ytdEarned,45);
  assert.equal(portal.summary.ytdPaid,0);
  assert.equal(portal.summary.owed,45);

  // Payment recording reduces owed balance but does not move money.
  const payment=await data(await call('/api/contractor-payments',{
    driverProfileId:contractor.id,amount:20,note:'portable workflow test payment'
  }));
  assert.equal(payment.recorded,true);
  assert.equal(payment.moneyMoved,false);
  assert.equal(payment.summary.owed,25);

  const portalAfterPay=await data(await call('/api/contractor-portal/'+contractor.token));
  assert.equal(portalAfterPay.summary.ytdPaid,20);
  assert.equal(portalAfterPay.summary.owed,25);

  const overpay=await call('/api/contractor-payments',{
    driverProfileId:contractor.id,amount:30,note:'should fail'
  });
  assert.equal(overpay.status,422);

  // Completion is idempotent from a compensation perspective.
  const after=(await portableRuntime.db.list<any>('mattress-driver-dispatches',{limit:200})).items
    .find((d:any)=>String(d.token||'')===job.token);
  assert.equal(Number(after.compensationAmount||0),45);

  console.log('Portable Mattress Rescue lifecycle + payroll integration test passed.');
}

run().catch(error=>{
  console.error(error);
  process.exit(1);
});
