import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { encrypt,decrypt } from '../src/security.js';
import { readAvailability,listCalendars,writeBooking } from '../src/providers.js';
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

test('Google calendars without freeBusy support use complete event reads and fail closed on pagination errors',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64'),PUBLIC_ORIGIN:'http://localhost'},connection={id:'fallback',uid:'u',provider:'google',refresh_token:await encrypt('refresh',env),calendars:JSON.stringify([{id:'holidays',name:'Holidays',selected:true}])};let fail=false;
 t.mock.method(globalThis,'fetch',async url=>{url=String(url);if(url.includes('oauth2'))return response({access_token:'access'});if(url.endsWith('freeBusy'))return response({calendars:{holidays:{errors:[{reason:'notFound'}]}}});if(url.includes('pageToken='))return fail?response({},403):response({kind:'calendar#events',items:[{summary:'Free holiday',transparency:'transparent',start:{date:'2026-09-22'},end:{date:'2026-09-23'}}]});return response({timeZone:'Asia/Jerusalem',nextPageToken:'next',items:[{summary:'Closed',start:{date:'2026-09-21'},end:{date:'2026-09-22'}}]});});
 const data=await readAvailability([connection],Date.parse('2026-09-20'),Date.parse('2026-09-24'),env,{details:false});assert.deepEqual(data.busy,[{start:Date.parse('2026-09-20T21:00:00Z'),end:Date.parse('2026-09-21T21:00:00Z')}]);assert.equal(data.events.length,0);
 fail=true;await assert.rejects(readAvailability([connection],Date.parse('2026-09-20'),Date.parse('2026-09-24'),env),/Holidays could not be checked/);env.DB.close();
});


test('Guest booking requests a Google email invitation with meeting details',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};
 const connection={id:'invite-test',provider:'google',refresh_token:await encrypt('refresh',env)};let sent;
 t.mock.method(globalThis,'fetch',async (url,options={})=>{
  if(String(url).includes('oauth2'))return response({access_token:'access'});
  if(options.method==='POST'){sent={url:String(url),body:JSON.parse(options.body)};return response({id:'event'});}
  return response({},404);
 });
 const start=Date.parse('2026-10-20T09:00:00Z');
 await writeBooking(connection,'primary',{id:'12345678-abcd-1234-abcd-123456789012',start,end:start+1800000,data:JSON.stringify({title:'Project conversation',location:'Video call',name:'Guest',email:'guest@example.test',notes:'Discuss website',manageUrl:'https://example.test/manage'})},env);
 assert.match(sent.url,/sendUpdates=all/);assert.deepEqual(sent.body.attendees,[{email:'guest@example.test',displayName:'Guest'}]);assert.equal(sent.body.summary,'Project conversation');assert.equal(sent.body.location,'Video call');assert.equal(sent.body.start.dateTime,'2026-10-20T09:00:00.000Z');assert.match(sent.body.description,/Discuss website/);assert.match(sent.body.description,/https:\/\/example.test\/manage/);env.DB.close();
});


test('Google and Microsoft invitations include additional participants',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};let sent;
 t.mock.method(globalThis,'fetch',async(url,options={})=>{if(String(url).includes('oauth2'))return response({access_token:'access'});if(options.method==='POST'){sent=JSON.parse(options.body);return response({id:'event'});}return response({},404);});
 for(const provider of ['google','microsoft']){
  const connection={id:'participants-'+provider,provider,refresh_token:await encrypt('refresh',env)};
  await writeBooking(connection,'primary',{id:crypto.randomUUID(),start:Date.now(),end:Date.now()+1800000,data:JSON.stringify({title:'Meeting',name:'Guest',email:'guest@example.test',participants:['extra@example.test']})},env);
  assert.equal(sent.attendees.length,2);assert.equal(provider==='google'?sent.attendees[1].email:sent.attendees[1].emailAddress.address,'extra@example.test');
 }
 env.DB.close();
});


test('Google booking retry fails safely on lookup errors and cancelled events',async t=>{
 const env={DB:database(),GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};
 const connection={id:'safe-retry',provider:'google',refresh_token:await encrypt('refresh',env)};let mode=403,writes=0;
 t.mock.method(globalThis,'fetch',async(url,options={})=>{if(String(url).includes('oauth2'))return response({access_token:'access'});if(options.method==='POST'){writes++;return response({id:'created'});}return mode===200?response({id:'existing',status:'cancelled'}):response({},mode);});
 const booking={id:crypto.randomUUID(),start:Date.now(),end:Date.now()+1800000,data:JSON.stringify({title:'Test',email:'guest@example.test'})};
 for(mode of [403,429,500,200])await assert.rejects(writeBooking(connection,'primary',booking,env));assert.equal(writes,0);
 mode=404;await writeBooking(connection,'primary',booking,env);assert.equal(writes,1);env.DB.close();
});

test('Outlook availability handles paginated busy, free, declined and all-day events',async t=>{
 const env={DB:database(),MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64')};
 const connection={id:'outlook-busy',uid:'host',provider:'microsoft',refresh_token:await encrypt('refresh',env),calendars:JSON.stringify([{id:'work',name:'Work',selected:true}])};let fail=false;
 const event=(showAs,responseValue='accepted')=>({start:{dateTime:'2026-10-01T09:00:00',timeZone:'UTC'},end:{dateTime:'2026-10-01T10:00:00',timeZone:'UTC'},showAs,responseStatus:{response:responseValue}});
 t.mock.method(globalThis,'fetch',async url=>{url=String(url);if(url.includes('oauth2'))return response({access_token:'access'});if(url.includes('page=2'))return fail?response({},503):response({value:[{...event('oof'),isAllDay:true,start:{dateTime:'2026-10-02T00:00:00'},end:{dateTime:'2026-10-03T00:00:00'}}]});return response({value:[event('busy'),event('free'),event('workingElsewhere'),event('busy','declined'),{...event('busy'),isCancelled:true}],'@odata.nextLink':'https://graph.microsoft.com/v1.0/me/calendars/work/calendarView?page=2'});});
 const data=await readAvailability([connection],Date.parse('2026-10-01'),Date.parse('2026-10-04'),env,{details:true});assert.equal(data.busy.length,2);assert.equal(data.busy[0].start,Date.parse('2026-10-01T09:00:00Z'));assert.ok(data.events.some(e=>e.allDay));
 fail=true;await assert.rejects(readAvailability([connection],Date.parse('2026-10-01'),Date.parse('2026-10-04'),env),/could not be checked/);env.DB.close();
});

test('Invalid calendar list response is not treated as an empty account',async t=>{t.mock.method(globalThis,'fetch',async()=>response({}));await assert.rejects(listCalendars('microsoft','access'));await assert.rejects(listCalendars('google','access'));});
