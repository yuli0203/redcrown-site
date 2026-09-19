import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';

test('Unverified identities cannot read or mutate protected scheduling resources', async () => {
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost'};
 try {
  for (const verified of [false, undefined]) {
   const handle=createHandler({authenticate:async()=>({uid:'unverified',verified})});
   for (const [path,method] of [['/workspace','GET'],['/workspace','PUT'],['/connections','GET'],['/connect/google','POST']]) {
    const response=await handle(new Request('http://localhost/calendar/api'+path,{method}),env);
    assert.equal(response.status,403,`${method} ${path}`);
    assert.match(JSON.stringify(await response.json()),/Verify your email/);
   }
  }
  const handle=createHandler({authenticate:async()=>({uid:'verified',verified:true})});
  assert.equal((await handle(new Request('http://localhost/calendar/api/workspace'),env)).status,200);
 } finally {DB.close();}
});
