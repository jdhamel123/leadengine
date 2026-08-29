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
    const response=await call('/api/mattress-test-checkout',{});
    assert.equal(response.status,423);
    const body=await json(response);
    assert.equal(body.code,'MIGRATION_PAYMENT_LOCK');
  }

  console.log('Portable API contract tests passed.');
}

run().catch((error)=>{
  console.error(error);
  process.exit(1);
});
