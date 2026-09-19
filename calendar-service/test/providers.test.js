import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { encrypt,decrypt } from '../src/security.js';
import { readAvailability,listCalendars } from '../src/providers.js';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
test('Google refresh credentials stay encrypted and busy failures block availability',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64'),PUBLIC_ORIGIN:'http://localhost'},connection={id:'c',uid:'u',provider:'google',refresh_token:await encrypt('refresh',env),calendars:JSON.stringify([{id:'work',name:'Work',selected:true}])};
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('oauth2')?response({access_token:'access'}):response({calendars:{work:{errors:[{reason:'forbidden'}]}}}));
 await assert.rejects(readAvailability([connection],Date.now(),Date.now()+86400000,env),error=>error.connectionId==='c'&&/Work could not be checked/.test(error.message));env.DB.close();
});
test('Google all-day event names use the calendar time zone and private details can fail safely',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64'),PUBLIC_ORIGIN:'http://localhost'},connection={id:'c',uid:'u',provider:'google',refresh_token:await encrypt('refresh',env),calendars:JSON.stringify([{id:'work',name:'Work',selected:true}])};
 let detailsFail=false;
 t.mock.method(globalThis,'fetch',async url=>{url=String(url);if(url.includes('oauth2'))return response({access_token:'access'});if(url.endsWith('freeBusy'))return response({calendars:{work:{busy:[{start:'2026-09-20T21:00:00Z',end:'2026-09-21T21:00:00Z'}]}}});return detailsFail?response({},403):response({timeZone:'Asia/Jerusalem',items:[{summary:'Holiday',start:{date:'2026-09-21'},end:{date:'2026-09-22'}}]});});
 const data=await readAvailability([connection],Date.parse('2026-09-20'),Date.parse('2026-09-23'),env,{details:true,timezone:'UTC'});assert.equal(data.events[0].start,Date.parse('2026-09-20T21:00:00Z'));assert.equal(data.events[0].title,'Holiday');
 detailsFail=true;const fallback=await readAvailability([connection],Date.parse('2026-09-20'),Date.parse('2026-09-23'),env,{details:true});assert.equal(fallback.busy.length,1);assert.equal(fallback.events.length,0);env.DB.close();
});
test('Microsoft calendar pagination cannot send bearer tokens to another host',async t=>{
 t.mock.method(globalThis,'fetch',async()=>response({value:[],'@odata.nextLink':'https://example.test/steal'}));await assert.rejects(listCalendars('microsoft','access'),/Invalid provider pagination/);
});
