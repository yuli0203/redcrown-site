import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
import { validateWorkspace,dateRange } from '../src/scheduling.js';
import { encrypt,decrypt } from '../src/security.js';
async function fixture(){const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};let failed=false,writes=0;
 const provider={async readAvailability(){return {busy:[],events:[]};},async writeBooking(c,id,b){writes++;if(failed)throw Error();return {id:b.id};},async cancelEvent(){}};
 const handle=createHandler({authenticate:async r=>({uid:r.headers.get('x-test-user')||'host',verified:true}),provider});
 const api=async(path,method='GET',data,user='host',headers={})=>{const result=await handle(new Request('http://localhost/calendar/api'+path,{method,headers:{'x-test-user':user,...headers,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:result.status,data:await result.json()};};
 const date=new Date(Date.now()+2*86400000);date.setUTCHours(9,0,0,0);const start=+date;
 const workspace=validateWorkspace({pageName:'Host',slug:'test-host',timezone:'UTC',weekly:Object.fromEntries([1,2,3,4,5,6,7].map(d=>[d,[['09:00','17:00']]])),meetings:[{id:'intro',title:'Intro',duration:30,before:0,after:15,notice:0}],destination:{connectionId:'one',calendarId:'primary'},published:true});
 await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?)').bind('one','host','google','account','host@example.test','encrypted',JSON.stringify([{id:'primary',selected:true,writable:true}])).run();
 assert.equal((await api('/workspace','PUT',{data:workspace,version:0})).status,200);
 const request=()=>({meetingId:'intro',start,name:'Guest',email:'guest@example.test',requestId:crypto.randomUUID()});return {DB,env,api,workspace,start,request,provider,fail(value){failed=value;},writes:()=>writes};}
test('Public page excludes internal settings and ownership is enforced',async()=>{const f=await fixture();const pub=await f.api('/public/test-host');assert.equal(pub.status,200);assert.equal(pub.data.destination,undefined);assert.equal(pub.data.weekly,undefined);assert.equal((await f.api('/connections/one','PUT',{selected:[]},'other')).status,404);f.DB.close();});
test('Concurrent overlapping bookings produce exactly one reservation',async()=>{const f=await fixture();const results=await Promise.all([f.api('/public/test-host/book','POST',f.request()),f.api('/public/test-host/book','POST',f.request())]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(f.writes(),1);f.DB.close();});
test('Pending provider failure retains reservation and same request can retry',async()=>{const f=await fixture(),request=f.request();f.fail(true);assert.equal((await f.api('/public/test-host/book','POST',request)).status,503);assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,409);f.fail(false);const result=await f.api('/public/test-host/book','POST',request);assert.equal(result.status,201);const again=await f.api('/public/test-host/book','POST',request);assert.equal(again.data.id,result.data.id);assert.equal(again.data.manageToken,result.data.manageToken);assert.equal(f.writes(),2);f.DB.close();});
test('Cancellation requires secret management token and releases slot',async()=>{const f=await fixture(),result=await f.api('/public/test-host/book','POST',f.request());assert.equal((await f.api(`/booking/${result.data.id}/cancel`,'POST',{token:'wrong'})).status,404);assert.equal((await f.api(`/booking/${result.data.id}/cancel`,'POST',{token:result.data.manageToken})).status,200);assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,201);f.DB.close();});
test('Optimistic save rejects stale settings',async()=>{const f=await fixture();assert.equal((await f.api('/workspace','PUT',{data:f.workspace,version:0})).status,409);assert.equal((await f.api('/workspace','PUT',{data:f.workspace,version:1})).status,200);f.DB.close();});
test('Refresh token encryption authenticates ciphertext',async()=>{const env={TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64')},value=await encrypt('private-refresh-token',env);assert.ok(!value.includes('private'));assert.equal(await decrypt(value,env),'private-refresh-token');await assert.rejects(decrypt(value,{TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64')}));});
test('Rescheduling confirms replacement and cancels original without freeing either during failure',async()=>{
 const f=await fixture(),original=await f.api('/public/test-host/book','POST',f.request());
 const move={...f.request(),start:f.start+2*3600000,previousId:original.data.id,rescheduleToken:original.data.manageToken};
 f.fail(true);assert.equal((await f.api('/public/test-host/book','POST',move)).status,503);
 assert.equal((await f.api(`/booking/${original.data.id}/cancel`,'POST',{token:original.data.manageToken})).status,409);
 f.fail(false);const replacement=await f.api('/public/test-host/book','POST',move);assert.equal(replacement.status,201);
 assert.equal((await f.api(`/booking/${original.data.id}?token=${original.data.manageToken}`)).data.status,'cancelled');
 assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,201);f.DB.close();
});


test('Failed cancellation retains the slot and can be retried',async()=>{
 const f=await fixture(),original=await f.api('/public/test-host/book','POST',f.request());
 f.provider.cancelEvent=async()=>{throw Error('Provider unavailable');};
 const path=`/booking/${original.data.id}/cancel`,data={token:original.data.manageToken};
 assert.equal((await f.api(path,'POST',data)).status,500);
 assert.equal((await f.api(`/booking/${original.data.id}?token=${data.token}`)).data.status,'cancelling');
 assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,409);
 f.provider.cancelEvent=async()=>{};
 assert.equal((await f.api(path,'POST',data)).status,200);
 assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,201);
 f.DB.close();
});

test('Database refuses a stale replacement after cancellation starts',async()=>{
 const f=await fixture(),original=await f.api('/public/test-host/book','POST',f.request());
 await f.DB.prepare("UPDATE bookings SET status='cancelling' WHERE id=?").bind(original.data.id).run();
 await assert.rejects(async()=>f.DB.prepare("INSERT INTO bookings(id,uid,meeting_id,request_id,start,end,busy_start,busy_end,status,data,manage_hash,connection_id,calendar_id,created_at,replaces) SELECT ?,uid,meeting_id,?,start+7200000,end+7200000,busy_start+7200000,busy_end+7200000,'pending',data,manage_hash,connection_id,calendar_id,created_at,id FROM bookings WHERE id=?").bind(crypto.randomUUID(),crypto.randomUUID(),original.data.id).run(),/BOOKING_CHANGED/);
 assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM bookings').first()).n,1);
 f.DB.close();
});


test('Rescheduling at the daily limit replaces the count without allowing an extra booking',async()=>{
 const f=await fixture();f.workspace.meetings[0].dailyLimit=1;
 assert.equal((await f.api('/workspace','PUT',{data:f.workspace,version:1})).status,200);
 const original=await f.api('/public/test-host/book','POST',f.request());assert.equal(original.status,201);
 const date=new Date(f.start).toISOString().slice(0,10),base=`/public/test-host/slots?meeting=intro&days=1&timezone=UTC&from=${date}`;
 assert.deepEqual((await f.api(base)).data.slots,[]);
 assert.equal((await f.api(base+`&previousId=${original.data.id}`)).status,409);
 const choices=await f.api(base+`&previousId=${original.data.id}`,'GET',null,'host',{'X-Booking-Token':original.data.manageToken});
 assert.equal(choices.status,200);assert.ok(choices.data.slots.some(s=>s.start===f.start+7200000));
 const moved=await f.api('/public/test-host/book','POST',{...f.request(),start:f.start+7200000,previousId:original.data.id,rescheduleToken:original.data.manageToken});
 assert.equal(moved.status,201);assert.equal((await f.api('/public/test-host/book','POST',f.request())).status,409);
 f.DB.close();
});


test('Public availability failures do not disclose private calendar names',async()=>{
 const f=await fixture();f.provider.readAvailability=async()=>{throw Error('Private medical calendar unavailable');};
 const result=await f.api(`/public/test-host/slots?meeting=intro&days=1&timezone=UTC&from=${new Date(f.start).toISOString().slice(0,10)}`);
 assert.equal(result.status,503);assert.ok(!JSON.stringify(result.data).includes('medical'));f.DB.close();
});


test('Calendar refresh retains conflict selections and protects the booking destination',async()=>{
 const f=await fixture();f.provider.tokenFor=async()=> 'test';f.provider.listCalendars=async()=>[{id:'new',name:'New calendar',writable:true,selected:false}];
 assert.equal((await f.api('/connections/one','PUT',{selected:[]})).status,409);
 assert.equal((await f.api('/connections/one','DELETE')).status,409);
 const refresh=await f.api('/connections/one/refresh','POST',{});assert.equal(refresh.status,200);
 assert.equal(refresh.data.calendars.find(c=>c.id==='primary').missing,true);assert.equal(refresh.data.calendars.find(c=>c.id==='primary').selected,true);
 assert.equal(refresh.data.calendars.find(c=>c.id==='new').selected,false);
 assert.equal((await f.api('/workspace','PUT',{data:{...f.workspace,published:false},version:1})).status,200);
 f.DB.close();
});

test('Reminder settings persist, stay private on landing pages and snapshot into bookings',async()=>{
 const f=await fixture();f.workspace.meetings[0].reminderMinutes=60;f.workspace.meetings[0].reminderEmail='owner@example.test';
 const saved=await f.api('/workspace','PUT',{data:f.workspace,version:1});assert.equal(saved.data.data.meetings[0].reminderEmail,'owner@example.test');
 const page=await f.api('/public/test-host');assert.equal(page.data.meetings[0].reminderEmail,undefined);
 const booked=await f.api('/public/test-host/book','POST',f.request());assert.equal(booked.status,201);
 const row=await f.DB.prepare('SELECT data FROM bookings WHERE id=?').bind(booked.data.id).first();assert.equal(JSON.parse(row.data).reminderEmail,'owner@example.test');assert.equal(JSON.parse(row.data).reminderMinutes,60);f.DB.close();
});


test('Additional participants validate, deduplicate, persist and cannot change on retry',async()=>{
 const f=await fixture();
 for(const participants of [['bad-address'],Array(11).fill('a@example.test'),'not-an-array'])assert.equal((await f.api('/public/test-host/book','POST',{...f.request(),participants})).status,400);
 assert.equal(f.writes(),0);
 const input={...f.request(),participants:[' Extra@example.test ','extra@example.test','guest@example.test','second@example.test']};
 const result=await f.api('/public/test-host/book','POST',input);assert.equal(result.status,201);
 const detail=await f.api(`/booking/${result.data.id}?token=${result.data.manageToken}`);assert.deepEqual(detail.data.participants,['extra@example.test','second@example.test']);
 assert.equal((await f.api('/public/test-host/book','POST',{...input,participants:['replacement@example.test']})).status,409);
 assert.equal((await f.api('/public/test-host/book','POST',input)).status,201);
 const publicPage=await f.api('/public/test-host');assert.ok(!JSON.stringify(publicPage.data).includes('extra@example.test'));
 const moved=await f.api('/public/test-host/book','POST',{...f.request(),start:f.start+7200000,participants:detail.data.participants,previousId:result.data.id,rescheduleToken:result.data.manageToken});assert.equal(moved.status,201);
 const movedDetail=await f.api(`/booking/${moved.data.id}?token=${moved.data.manageToken}`);assert.deepEqual(movedDetail.data.participants,detail.data.participants);f.DB.close();
});

test('Guest meeting names propagate and blank names use guest and host',async()=>{
 const f=await fixture();
 try {
  const first=await f.api('/public/test-host/book','POST',{...f.request(),meetingName:'  Project planning  '});
  assert.equal(first.status,201);assert.equal(first.data.title,'Project planning');
  const saved=JSON.parse((await f.DB.prepare('SELECT data FROM bookings WHERE id=?').bind(first.data.id).first()).data);
  assert.equal(saved.title,'Project planning');
  const second=await f.api('/public/test-host/book','POST',{...f.request(),start:f.start+2*3600000,meetingName:'   '});
  assert.equal(second.data.title,'Guest and Host');
  assert.equal((await f.api('/public/test-host/book','POST',{...f.request(),meetingName:'x'.repeat(161)})).status,400);
 }finally{f.DB.close();}
});

test('Feed connections encrypt URLs, hide links and cannot receive bookings',async()=>{
 const f=await fixture(),old=globalThis.fetch;
 const url='https://calendar.google.com/calendar/ical/private-test/basic.ics';
 globalThis.fetch=async()=>new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR');
 try {
  assert.equal((await f.api('/connections/feed','POST',{url,name:'Work busy times'})).status,200);
  const row=await f.DB.prepare("SELECT * FROM connections WHERE provider='ical'").first();assert.ok(row);assert.ok(!row.refresh_token.includes(url));assert.equal(await decrypt(row.refresh_token,f.env),url);
  const list=await f.api('/connections');assert.ok(!JSON.stringify(list.data).includes(url));
  const calendar=JSON.parse(row.calendars)[0];assert.equal(calendar.writable,false);assert.equal(calendar.selected,true);
  const invalid={...f.workspace,destination:{connectionId:row.id,calendarId:'feed'}};
  assert.equal((await f.api('/workspace','PUT',{data:invalid,version:1})).status,400);
 }finally{globalThis.fetch=old;f.DB.close();}
});
