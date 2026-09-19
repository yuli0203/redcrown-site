import { assert, Problem, slots, dateRange, localDate } from './scheduling.js';
import { body, hash, rateLimit } from './security.js';
import { json, one, all, run, connections } from './worker.js';
export async function managementToken(id,env){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.TOKEN_ENCRYPTION_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`manage:${id}`)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function publicHost(db,slug){const row=await one(db,'SELECT * FROM profiles WHERE slug=?',slug);assert(row,'Booking page not found.',404);const workspace=JSON.parse(row.data);assert(workspace.published,'This booking page is not published.',404);return {...row,workspace};}
function publicData(workspace){return {pageName:workspace.pageName,timezone:workspace.timezone,slug:workspace.slug,accent:workspace.accent,background:workspace.background,text:workspace.text,logo:workspace.logo,photo:workspace.photo,meetings:workspace.meetings.filter(m=>m.enabled).map(({id,title,description,duration,location})=>({id,title,description,duration,location}))};}
async function available(host,meeting,range,env,provider,previousId=null){
 const linked=await connections(env.DB,host.uid);assert(linked.some(c=>JSON.parse(c.calendars).some(v=>v.selected)),'The host needs to connect a calendar before bookings can be accepted.',503);
 const padding=8*3600000,external=await provider.readAvailability(linked,range.start-padding,range.end+padding,env);
 const reserved=await all(env.DB,"SELECT * FROM bookings WHERE uid=? AND status IN ('pending','confirmed','cancelling','rescheduling') AND busy_start<? AND busy_end>?",host.uid,range.end+padding,range.start-padding);
 const busy=[...external.busy,...reserved.map(b=>({start:b.busy_start,end:b.busy_end}))];
 return slots(host.workspace,meeting,busy,range,Date.now(),reserved.filter(b=>b.meeting_id===meeting.id&&b.id!==previousId));
}
async function rescheduleSource(db,host,meeting,id,token){
 if(!id)return null;
 const previous=await one(db,'SELECT * FROM bookings WHERE id=? AND uid=?',id,host.uid);
 assert(previous&&previous.status==='confirmed'&&previous.meeting_id===meeting.id&&await hash(token||'')===previous.manage_hash,'This booking cannot be rescheduled. Refresh its management page.',409);
 return previous;
}
async function checkCaptcha(input,request,env){
 if(!env.TURNSTILE_SECRET){assert(['127.0.0.1','localhost'].includes(new URL(env.PUBLIC_ORIGIN).hostname)&&new URL(request.url).origin===env.PUBLIC_ORIGIN,'Booking protection is not configured yet.',503);return;}
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:input.turnstileToken||'',remoteip:request.headers.get('CF-Connecting-IP')||''}),signal:AbortSignal.timeout(10000)});const result=await response.json();assert(result.success&&result.hostname===new URL(env.PUBLIC_ORIGIN).hostname,'Please complete the booking verification.',403);
}
export async function publicRoutes(request,env,provider,path){
 const url=new URL(request.url),method=request.method,db=env.DB;
 if(path.startsWith('/public/')){
  const parts=path.split('/'),slug=decodeURIComponent(parts[2]),host=await publicHost(db,slug);
  if(parts.length===3&&method==='GET')return json(publicData(host.workspace));
  if(parts[3]==='slots'&&method==='GET'){
   const meeting=host.workspace.meetings.find(m=>m.id===url.searchParams.get('meeting')&&m.enabled);assert(meeting,'Meeting not found.',404);
   const range=dateRange(url.searchParams.get('from'),Number(url.searchParams.get('days')||7),url.searchParams.get('timezone')||host.workspace.timezone);
   assert(range.start>=Date.now()-2*86400000&&range.end<=Date.now()+367*86400000,'Choose dates within the booking window.');
   const previous=await rescheduleSource(db,host,meeting,url.searchParams.get('previousId'),request.headers.get('X-Booking-Token'));
   return json({slots:await available(host,meeting,range,env,provider,previous?.id),timezone:host.workspace.timezone});
  }
  if(parts[3]==='book'&&method==='POST'){
   const input=await body(request,12000);await checkCaptcha(input,request,env);await rateLimit(env,`booking:${host.uid}:${await hash(request.headers.get('CF-Connecting-IP')||'local')}`,10);
   assert(typeof input.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(input.requestId),'Invalid booking request.');
   const meeting=host.workspace.meetings.find(m=>m.id===input.meetingId&&m.enabled);assert(meeting,'Meeting not found.',404);
   assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=100&&typeof input.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)&&input.email.length<=254,'Enter your name and a valid email.');
   assert(typeof(input.notes||'')==='string'&&(input.notes||'').length<=2000&&Number.isSafeInteger(input.start),'Invalid booking details.');
   let booking=await one(db,'SELECT * FROM bookings WHERE uid=? AND request_id=?',host.uid,input.requestId);
   if(booking){const prior=JSON.parse(booking.data);assert(booking.start===input.start&&booking.meeting_id===input.meetingId&&prior.email===input.email,'This booking request was already used.',409);}
   else {
    const previous=await rescheduleSource(db,host,meeting,input.previousId,input.rescheduleToken);
    const date=localDate(input.start,host.workspace.timezone),range=dateRange(date,1,host.workspace.timezone),choices=await available(host,meeting,range,env,provider,previous?.id);
    assert(choices.some(s=>s.start===input.start),'This time is no longer available. Choose another.',409);
    const destination=host.workspace.destination,connection=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',destination.connectionId,host.uid);assert(connection,'The host must reconnect their booking calendar.',503);
    assert(JSON.parse(connection.calendars).some(c=>c.id===destination.calendarId&&c.writable&&c.selected),'The booking calendar must be writable and selected for conflict checks.',503);
    const id=crypto.randomUUID(),manage=await managementToken(id,env),end=input.start+meeting.duration*60000,paddedStart=input.start-meeting.before*60000,paddedEnd=end+meeting.after*60000;
    const data=JSON.stringify({title:meeting.title,location:meeting.location,name:input.name.trim(),email:input.email,notes:input.notes||'',timezone:host.workspace.timezone,manageUrl:`${env.PUBLIC_ORIGIN}/calendar/meet/?booking=${encodeURIComponent(id)}#${manage}`});
    let inserted;try{inserted=await run(db,"INSERT INTO bookings(id,uid,meeting_id,request_id,start,end,busy_start,busy_end,status,data,manage_hash,connection_id,calendar_id,created_at,replaces) SELECT ?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE uid=? AND status IN ('pending','confirmed','cancelling','rescheduling') AND busy_start<? AND busy_end>?) AND (?=0 OR (SELECT COUNT(*) FROM bookings WHERE uid=? AND meeting_id=? AND status IN ('pending','confirmed','cancelling','rescheduling') AND start>=? AND start<? AND id<>?)<?)",id,host.uid,meeting.id,input.requestId,input.start,end,paddedStart,paddedEnd,data,await hash(manage),connection.id,destination.calendarId,Date.now(),previous?.id||null,host.uid,paddedEnd,paddedStart,meeting.dailyLimit,host.uid,meeting.id,range.start,range.end,previous?.id||'',meeting.dailyLimit);}catch(error){if(/UNIQUE|BOOKING_CHANGED/.test(error.message))throw new Problem('A matching booking or reschedule is already in progress. Retry the original request.',409);throw error;}
    assert(inserted.meta.changes===1,'This time was just booked. Choose another.',409);booking=await one(db,'SELECT * FROM bookings WHERE id=?',id);
   }
   await finalizeBooking(booking,env,provider);
   assert(booking.status==='confirmed','This booking is no longer active.',409);
   return json({id:booking.id,start:booking.start,end:booking.end,status:booking.status,manageToken:await managementToken(booking.id,env)},201);
  }
 }
 if(path.startsWith('/booking/')){
  const id=path.split('/')[2],input=method==='POST'?await body(request,5000):null,token=input?.token||url.searchParams.get('token')||'';
  const booking=await one(db,'SELECT * FROM bookings WHERE id=?',id);assert(booking&&await hash(token)===booking.manage_hash,'Booking not found.',404);
  if(method==='GET'){const data=JSON.parse(booking.data),profile=await one(db,'SELECT slug FROM profiles WHERE uid=?',booking.uid);return json({id,slug:profile?.slug,meetingId:booking.meeting_id,start:booking.start,end:booking.end,status:booking.status,title:data.title,name:data.name,location:data.location,timezone:data.timezone});}
  if(path.endsWith('/cancel')&&method==='POST'){
   if(booking.status==='cancelled')return json({status:'cancelled'});
   assert(booking.status==='confirmed'||booking.status==='cancelling','This booking is awaiting calendar confirmation. Contact the host.',409);
   const claimed=await one(db,"UPDATE bookings SET status='cancelling' WHERE id=? AND status IN ('confirmed','cancelling') RETURNING id",id);
   assert(claimed,'This booking changed while cancellation was requested. Refresh its management page.',409);
   const connection=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',booking.connection_id,booking.uid);assert(connection,'The host needs to reconnect this calendar before cancellation.',503);await provider.cancelEvent(connection,booking,env);
   await run(db,"UPDATE bookings SET status='cancelled' WHERE id=?",id);return json({status:'cancelled'});
  }
 }
 throw new Problem('Not found.',404);
}

export async function finalizeBooking(booking,env,provider){const db=env.DB;
 if(booking.status==='pending'){
    const connection=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',booking.connection_id,booking.uid);assert(connection,'The host must reconnect their calendar.',503);
    try{const event=await provider.writeBooking(connection,booking.calendar_id,booking,env);assert(event.id,'Calendar confirmation is pending.',503);if(booking.replaces){const previous=await one(db,'SELECT * FROM bookings WHERE id=? AND uid=?',booking.replaces,booking.uid);const previousConnection=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',previous.connection_id,booking.uid);assert(previousConnection,'Reconnect the original calendar to finish rescheduling.',503);await provider.cancelEvent(previousConnection,previous,env);await db.batch([db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").bind(previous.id),db.prepare("UPDATE bookings SET status='confirmed',event_id=? WHERE id=? AND status='pending'").bind(event.id,booking.id)]);}else await run(db,"UPDATE bookings SET status='confirmed',event_id=? WHERE id=? AND status='pending'",event.id,booking.id);booking.status='confirmed';}catch{throw new Problem('Calendar confirmation is pending. Retry this same booking to check its status. This time remains reserved.',503);}
   }

}
