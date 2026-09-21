// Booking notifications are sent by our own email service, never from a
// host's mailbox. Calendar invitations stay with the calendar provider.
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=value=>String(value||'').replace(/[\r\n]+/g,' ').trim();
function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export const notificationsReady=env=>Boolean(env.RESEND_API_KEY&&(env.NOTIFICATION_FROM||env.REMINDER_FROM));
export function bookingNotification(row){
 const d=JSON.parse(row.data),zone=d.timezone||'UTC';
 const when=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone}).format(row.start);
 const short=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone}).format(row.start);
 const fields=[['Event Type',d.title],['Invitee',d.name],['Invitee Email',d.email],['Event Date/Time',when+' ('+zone+')'],['Duration',Math.round((row.end-row.start)/60000)+' minutes'],['Location',d.location||'Contact the host for location details.'],['Invitee Time Zone',d.inviteeTimezone||'Not recorded']];
 if(d.participants?.length)fields.push(['Additional participants',d.participants.join(', ')]);
 if(d.notes)fields.push(['Invitee notes',d.notes]);
 const url=safeUrl(d.manageUrl),location=safeUrl(d.location),greeting='Hi '+(d.hostName||'there')+',';
 const intro=row.replaces?'An event has been rescheduled.':'A new event has been scheduled.';
 const subject=clean((row.replaces?'Rescheduled Event: ':'New Event: ')+d.name+' - '+short+' - '+d.title);
 const text=[greeting,'',intro,'',...fields.map(([label,value])=>label+': '+value),location?'Join meeting: '+location:'',url?'View booking in Red Crown Calendar: '+url:'','','Red Crown Calendar by Red Crown Interactive','We build apps, websites and interactive experiences.','Support or report abuse: hello@redcrowninteractive.com'].filter(v=>v!==undefined).join('\n');
 const html=`<!doctype html><html lang="en"><body style="margin:0;background:#f5f1f2;font-family:Arial,sans-serif;color:#271c22"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #eadfe3;border-radius:12px"><tr><td style="padding:24px 30px;background:#190f14;color:#fff;font-size:20px;font-weight:bold">Red Crown Calendar</td></tr><tr><td style="padding:30px"><p>${escape(greeting)}</p><h1 style="font-size:23px;line-height:1.4">${escape(intro)}</h1>${fields.map(([label,value])=>`<p style="margin:22px 0;line-height:1.6"><strong>${escape(label)}:</strong><br>${escape(value).replaceAll('\n','<br>')}</p>`).join('')}${location?`<p><a style="color:#c8102e" href="${escape(location)}">Join meeting</a></p>`:''}${url?`<p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;background:#c8102e;color:#fff;padding:14px 20px;border-radius:7px;text-decoration:none;font-weight:bold">View booking</a></p>`:''}<p style="font-size:12px;color:#62565c">Keep your booking-management link private.</p></td></tr><tr><td style="padding:24px 30px;background:#190f14;color:#e9dfe3;font-size:12px;line-height:1.8">A free scheduling tool by <a href="https://redcrowninteractive.com/" style="color:#fff">Red Crown Interactive</a><br>We build apps, websites and interactive experiences.<br><a href="mailto:hello@redcrowninteractive.com" style="color:#fff">Support or report abuse</a></td></tr></table></td></tr></table></body></html>`;
 return {subject,text,html};
}
export async function sendBookingNotifications(env,now=Date.now(),send=fetch,bookingId=null){
 if(!notificationsReady(env))return;
 const rows=(await env.DB.prepare(`SELECT * FROM bookings WHERE status='confirmed' AND notification_sent_at IS NULL AND start>? AND json_extract(data,'$.hostEmail') IS NOT NULL AND (notification_attempt_at IS NULL OR notification_attempt_at>?) AND (? IS NULL OR id=?) ORDER BY created_at LIMIT 50`).bind(now,now-23*3600000,bookingId,bookingId).all()).results;
 for(const row of rows){
  const claimed=await env.DB.prepare(`UPDATE bookings SET notification_attempt_at=COALESCE(notification_attempt_at,?) WHERE id=? AND status='confirmed' AND notification_sent_at IS NULL RETURNING id`).bind(now,row.id).first();if(!claimed)continue;
  const d=JSON.parse(row.data);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.hostEmail||''))continue;
  try{const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'booking-notification/'+row.id},body:JSON.stringify({from:env.NOTIFICATION_FROM||env.REMINDER_FROM,to:[d.hostEmail],...bookingNotification(row)}),signal:AbortSignal.timeout(15000)});if(!response.ok){console.error('Booking notification rejected',row.id,response.status);continue;}const result=await response.json();if(result.id)await env.DB.prepare('UPDATE bookings SET notification_sent_at=? WHERE id=?').bind(now,row.id).run();}catch{console.error('Booking notification pending retry',row.id);}
 }
}
