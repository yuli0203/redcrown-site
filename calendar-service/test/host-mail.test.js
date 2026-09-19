import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../database.js';
import {hostMailRequest,sendHostMail} from '../src/host-mail.js';
import {sendBookingNotifications} from '../src/notifications.js';
import {providerConfig} from '../src/providers.js';

test('Native mail is send-only, addressed to the authenticated mailbox, and encodes Hebrew safely',()=>{
 const mail={subject:'פגישה חדשה\r\nBcc: attacker@example.test',text:'פגישה עם אורח',to:'attacker@example.test'};
 const c={email:'host@example.test',provider:'google'};
 const raw=Buffer.from(hostMailRequest(c,mail).body.raw,'base64url').toString('utf8');
 assert.match(raw,/From: host@example.test\r\nTo: host@example.test/);assert.ok(!raw.includes('\r\nBcc:'));
 assert.equal(Buffer.from(raw.split('\r\n\r\n')[1].replaceAll('\r\n',''),'base64').toString(),mail.text);
 const ms=hostMailRequest({...c,provider:'microsoft'},mail);assert.deepEqual(ms.body.message.toRecipients,[{emailAddress:{address:c.email}}]);
 assert.throws(()=>hostMailRequest({...c,email:'host@example.test\r\nBcc: x@y.test'},mail));
 const env={GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',MICROSOFT_CLIENT_ID:'id',MICROSOFT_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:'key'};
 assert.match(providerConfig('google',env).scope,/gmail.send/);assert.ok(!providerConfig('google',env).scope.includes('gmail.read'));
 assert.match(providerConfig('microsoft',env).scope,/Mail.Send/);assert.ok(!providerConfig('microsoft',env).scope.includes('Mail.Read'));
});
test('Mail API handles Graph empty accepted response, revoked permission, throttling and uncertain submissions',async()=>{
 const c={email:'host@example.test',provider:'microsoft'},m={subject:'Meeting',text:'Test'},getToken=async()=>'token';
 for(const [code,state] of [[202,'accepted'],[403,'permission_required'],[429,'retry'],[500,'unknown'],[400,'failed']]){
  const r=await sendHostMail(c,m,{}, {getToken,send:async()=>new Response(null,{status:code})});assert.equal(r.state,state);
 }
 assert.equal((await sendHostMail(c,m,{}, {getToken,send:async()=>{throw Error('timeout');}})).state,'unknown');
});
test('Native notifications require consent, prevent concurrent duplicate sends and never replay unknown delivery',async()=>{
 const DB=database(),now=Date.now(),env={DB};
 await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars,mail_enabled) VALUES(?,?,?,?,?,?,?,?)').bind('c','host','google','a','host@example.test','encrypted','[]',0).run();
 for(const id of ['booking','cancelled'])await DB.prepare(`INSERT INTO bookings(id,uid,meeting_id,request_id,start,end,busy_start,busy_end,status,data,manage_hash,connection_id,calendar_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,'host','intro',id,now+3600000,now+5400000,now+3600000,now+5400000,id==='booking'?'confirmed':'cancelled',JSON.stringify({name:'Guest',email:'guest@example.test',hostEmail:'attacker@example.test',timezone:'UTC',title:'Intro'}),'hash','c','primary',now-3*86400000).run();
 let sends=0;const deliver=async connection=>{sends++;assert.equal(connection.email,'host@example.test');return {state:'unknown'};};
 await sendBookingNotifications(env,now,fetch,null,deliver);assert.equal(sends,0);
 await DB.prepare('UPDATE connections SET mail_enabled=1').run();
 await Promise.all([sendBookingNotifications(env,now,fetch,null,deliver),sendBookingNotifications(env,now,fetch,null,deliver)]);
 await sendBookingNotifications(env,now+600000,fetch,null,deliver);assert.equal(sends,1);
 assert.equal((await DB.prepare("SELECT notification_state FROM bookings WHERE id='booking'").first()).notification_state,'unknown');DB.close();
});
