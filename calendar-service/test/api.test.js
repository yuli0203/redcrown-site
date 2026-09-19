import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
import { validateWorkspace,dateRange } from '../src/scheduling.js';
import { encrypt,decrypt } from '../src/security.js';
async function fixture(){const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};let failed=false,writes=0;
 const provider={async readAvailability(){return {busy:[],events:[]};},async writeBooking(c,id,b){writes++;if(failed)throw Error();return {id:b.id};},async cancelEvent(){}};
 const handle=createHandler({authenticate:async r=>({uid:r.headers.get('x-test-user')||'host',verified:true}),provider});
 const api=async(path,method='GET',data,user='host')=>{const result=await handle(new Request('http://localhost/calendar/api'+path,{method,headers:{'x-test-user':user,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:result.status,data:await result.json()};};
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
