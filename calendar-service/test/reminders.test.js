import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { sendReminders } from '../src/reminders.js';
import { validateWorkspace } from '../src/scheduling.js';
const now=Date.parse('2026-10-01T09:00:00Z');
async function add(DB,id,status='confirmed',start=now+600000,minutes=15){
 const data=JSON.stringify({title:'Introduction',name:'Guest',timezone:'UTC',reminderEmail:'owner@example.test',reminderMinutes:minutes});
 await DB.prepare(`INSERT INTO bookings(id,uid,meeting_id,request_id,start,end,busy_start,busy_end,status,data,manage_hash,connection_id,calendar_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,'host','intro',id,start,start+1800000,start,start+1800000,status,data,'hash','connection','primary',now-86400000).run();
}
test('Reminder delivery skips disabled, future, cancelled, pending, replaced and past meetings; sends once',async()=>{
 const DB=database(),env={DB,RESEND_API_KEY:'test',REMINDER_FROM:'calendar@example.test'},sent=[];
 for(const [id,status] of [['due','confirmed'],['cancelled','cancelled'],['pending','pending'],['replaced','rescheduling']])await add(DB,id,status);
 await add(DB,'future','confirmed',now+7200000);await add(DB,'past','confirmed',now-1);await add(DB,'off','confirmed',now+600000,0);
 const send=async(url,options)=>{sent.push({url,...options});return Response.json({id:'message'});};
 await sendReminders({DB},now,send);assert.equal(sent.length,0);
 await sendReminders(env,now,send);await sendReminders(env,now,send);assert.equal(sent.length,1);
 assert.deepEqual(JSON.parse(sent[0].body).to,['owner@example.test']);assert.equal(sent[0].headers['Idempotency-Key'],'booking-reminder/due');DB.close();
});
test('An uncertain delivery retries with identical payload and key, within the idempotency window',async()=>{
 const DB=database(),env={DB,RESEND_API_KEY:'test',REMINDER_FROM:'calendar@example.test'},sent=[];await add(DB,'retry');
 const send=async(url,options)=>{sent.push(options);if(sent.length===1)throw Error('timeout');return Response.json({id:'message'});};
 await sendReminders(env,now,send);await sendReminders(env,now+60000,send);
 assert.equal(sent.length,2);assert.equal(sent[0].body,sent[1].body);assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);
 await add(DB,'expired','confirmed',now+25*3600000,2880);
 await DB.prepare('UPDATE bookings SET reminder_attempt_at=? WHERE id=?').bind(now-24*3600000,'expired').run();
 await sendReminders(env,now,send);assert.equal(sent.length,2);DB.close();
});
test('Workspace validates reminder recipient and lead time while preserving older meeting types',()=>{
 const meeting={id:'intro',title:'Introduction',duration:30};
 assert.equal(validateWorkspace({meetings:[meeting]}).meetings[0].reminderMinutes,0);
 const m={...meeting,reminderMinutes:60,reminderEmail:'owner@example.test'};
 assert.equal(validateWorkspace({meetings:[m]}).meetings[0].reminderEmail,m.reminderEmail);
 for(const change of [{reminderEmail:''},{reminderEmail:'invalid'},{reminderMinutes:-1},{reminderMinutes:10081}])assert.throws(()=>validateWorkspace({meetings:[{...m,...change}]}));
});
