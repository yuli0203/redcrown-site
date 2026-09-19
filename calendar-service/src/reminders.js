// Reminder settings are snapshotted with each booking. Cancelled and replaced
// bookings are excluded. Never put the private recipient on the public page.
export const remindersReady = env => Boolean(env.RESEND_API_KEY && env.REMINDER_FROM);
export async function sendReminders(env, now=Date.now(), send=fetch) {
 if(!remindersReady(env))return;
 const rows=(await env.DB.prepare(`SELECT * FROM bookings WHERE status='confirmed'
  AND reminder_sent_at IS NULL AND start>?
  AND (reminder_attempt_at IS NULL OR reminder_attempt_at>?)
  AND json_extract(data,'$.reminderMinutes')>0
  AND start-json_extract(data,'$.reminderMinutes')*60000<=?
  ORDER BY start LIMIT 50`).bind(now,now-23*3600000,now).all()).results;
 for(const row of rows){
  // Recheck status immediately before sending. The stable key protects retries
  // and concurrent cron runs; stop retries before the provider's 24h expiry.
  const claimed=await env.DB.prepare(`UPDATE bookings SET reminder_attempt_at=COALESCE(reminder_attempt_at,?)
   WHERE id=? AND status='confirmed' AND reminder_sent_at IS NULL RETURNING id`).bind(now,row.id).first();
  if(!claimed)continue;
  const data=JSON.parse(row.data);
  const when=new Intl.DateTimeFormat('en',{dateStyle:'full',timeStyle:'short',timeZone:data.timezone||'UTC'}).format(new Date(row.start));
  const payload={from:env.REMINDER_FROM,to:[data.reminderEmail],subject:'Red Crown Calendar - meeting reminder',
   text:`Meeting: ${data.title}\nWhen: ${when} (${data.timezone||'UTC'})\nGuest: ${data.name}\n${data.location?'Location: '+data.location+'\n':''}`};
  try{
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`booking-reminder/${row.id}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   if(!response.ok){console.error('Reminder delivery failed',row.id,response.status);continue;}
   const result=await response.json();if(!result.id)continue;
   await env.DB.prepare('UPDATE bookings SET reminder_sent_at=? WHERE id=?').bind(now,row.id).run();
  }catch{console.error('Reminder delivery pending retry',row.id);}
 }
}
