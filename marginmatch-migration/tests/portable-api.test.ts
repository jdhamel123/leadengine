import assert from 'node:assert/strict';
import { handleRequest } from '../backend/portable-api';

async function call(path:string, body?:unknown) {
  return handleRequest(new Request('http://localhost'+path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {'content-type':'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

async function json(response:Response) {
  return response.json() as Promise<Record<string,unknown>>;
}

async function run() {
  {
    const response=await call('/api/health');
    assert.equal(response.status,200);
    const body=await json(response);
    assert.equal(body.runtime,'portable');
    assert.equal(body.productionActionsUnlocked,false);
  }

  {
    const response=await call('/api/mattress-quote',{
      zip:'02035',item:'Mattress',count:1,access:'Curbside / garage',condition:'Clean and dry'
    });
    assert.equal(response.status,200);
    const body=await json(response);
    assert.equal(body.customerPrice,119);
    assert.equal(body.verified,true);
    assert.equal(body.checkout,false);
  }

  {
    const response=await call('/api/mattress-quote',{
      zip:'02766',item:'Mattress + box spring',count:1,access:'Customer drop-off',condition:'Clean and dry'
    });
    const body=await json(response);
    assert.equal(body.customerPrice,99);
    assert.equal(body.verified,true);
  }

  {
    const response=await call('/api/mattress-quote',{
      zip:'99999',item:'Mattress',count:1,access:'Curbside / garage',condition:'Clean and dry'
    });
    const body=await json(response);
    assert.equal(body.customerPrice,null);
    assert.equal(body.status,'PRELIVE');
  }

  {
    const response=await call('/api/mattress-quote',{
      zip:'02035',item:'Mattress',count:1,access:'Curbside / garage',condition:'Wet / contaminated'
    });
    const body=await json(response);
    assert.equal(body.customerPrice,null);
    assert.equal(body.status,'MANUAL REVIEW');
  }

  {
    const response=await call('/api/mattress-test-checkout',{
      zip:'02035',email:'test@example.com',phone:'5085551212',address:'1 Main St',
      preferredDate:'2026-09-01',preferredTime:'09:00',item:'Mattress',count:1,
      access:'Curbside / garage',condition:'Clean and dry',customerPrice:999
    });
    assert.equal(response.status,422);
    const body=await json(response);
    assert.match(String(body.error),/price does not match/i);
  }

  {
    const old=process.env.STRIPE_RESTRICTED_KEY;
    process.env.STRIPE_RESTRICTED_KEY='rk_live_not_allowed';
    const response=await call('/api/mattress-test-checkout',{
      zip:'02035',email:'test@example.com',phone:'5085551212',address:'1 Main St',
      preferredDate:'2026-09-01',preferredTime:'09:00',item:'Mattress',count:1,
      access:'Curbside / garage',condition:'Clean and dry',customerPrice:119
    });
    assert.equal(response.status,502);
    const body=await json(response);
    assert.match(String(body.error),/test-mode key required/i);
    if(old===undefined) delete process.env.STRIPE_RESTRICTED_KEY;
    else process.env.STRIPE_RESTRICTED_KEY=old;
  }

  {
    const response=await call('/api/mattress-test-dispatch',{
      phone:'5085551212',jobUrl:'https://example.com/job',serviceDate:'2026-09-01',serviceTime:'09:00'
    });
    assert.equal(response.status,423);
    const body=await json(response);
    assert.match(String(body.error),/not allowlisted/i);
  }

  {
    const response=await call('/api/mattress-driver-job/test-token/photo',{
      kind:'wrong',content:'x'.repeat(200),contentType:'image/jpeg'
    });
    assert.equal(response.status,400);
    const body=await json(response);
    assert.match(String(body.error),/pickup or completion/i);
  }

  {
    const response=await call('/api/mattress-driver-job/test-token/photo',{
      kind:'pickup',content:'x'.repeat(200),contentType:'application/pdf'
    });
    assert.equal(response.status,422);
    const body=await json(response);
    assert.match(String(body.error),/JPG, PNG or WebP/i);
  }

  {
    const response=await call('/api/mattress-test-contractor',{
      name:'Test Driver',phone:'5085551212',payPerJob:0
    });
    assert.ok([400,503].includes(response.status));
    if(response.status===400){
      const body=await json(response);
      assert.match(String(body.error),/positive pay-per-job/i);
    }
  }

  {
    const response=await call('/api/contractor-applications',{
      name:'Test Applicant',email:'test@example.com',phone:'5085551212',zip:'02035',
      licenseConfirmed:true,insuranceConfirmed:true,backgroundConsent:false,contractorAcknowledged:true
    });
    assert.ok([422,503].includes(response.status));
    if(response.status===422){
      const body=await json(response);
      assert.match(String(body.error),/acknowledgments/i);
    }
  }

  console.log('Portable API contract tests passed.');
}

run().catch((error)=>{
  console.error(error);
  process.exit(1);
});
