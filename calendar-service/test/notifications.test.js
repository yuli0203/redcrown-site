import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../database.js';
import {bookingNotification,sendBookingNotifications} from '../src/notifications.js';
const now=Date.parse('2026-10-01T09:00:00Z');
const data={title:'30 Minute Meeting',hostName:'Julia',hostEmail:'host@example.test',name:'Guest <script>alert(1)</script>',email:'guest@example.test',timezone:'Asia/Jerusalem',inviteeTimezone:'Europe/London',location:'javascript:alert(1)',manageUrl:'https://example.test/calendar/meet/?booking=test#token'};
test('Branded notification escapes guest content, formats time zones and excludes unsafe links',()=>{
 const n=bookingNotification({data:JSON.stringify(data),start:now,end:now+1800000});
 assert.ok(n.subject.startsWith('New Event:'));assert.ok(n.html.includes('Hi Julia,'));assert.ok(n.html.includes('Europe/London'));assert.ok(n.html.includes('Asia/Jerusalem'));assert.ok(!n.html.includes('<script>'));assert.ok(!n.html.includes('href="javascript:'));assert.ok(n.text.includes('Invitee Email: guest@example.test'));
});
test('Host notification sends only after confirmation and retries identical payload once',async()=>{
 const DB=database(),env={DB,RESEND_API_KEY:'test',REMINDER_FROM:'calendar@example.test'},sent=[];
 for(const status of ['confirmed','pending','cancelled'])await DB.prepare(`INSERT INTO bookings(id,uid,meeting_id,request_id,start,end,busy_start,busy_end,status,data,manage_hash,connection_id,calendar_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(status,'host','intro',status,now+3600000,now+5400000,now+3600000,now+5400000,status,JSON.stringify(data),'hash','connection','primary',now).run();
 const send=async(u,o)=>{sent.push(o);if(sent.length===1)throw Error('timeout');return Response.json({id:'sent'});};
 await sendBookingNotifications({DB},now,send);assert.equal(sent.length,0);
 await sendBookingNotifications(env,now,send);await sendBookingNotifications(env,now+60000,send);await sendBookingNotifications(env,now+120000,send);
 assert.equal(sent.length,2);assert.equal(sent[0].body,sent[1].body);assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);assert.deepEqual(JSON.parse(sent[0].body).to,['host@example.test']);DB.close();
});
