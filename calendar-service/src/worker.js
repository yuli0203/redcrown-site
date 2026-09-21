import { feedUrl, fetchFeed, parseFeed } from './ical-feed.js';
import { holidayOptions, holidayEvents, holidayCountry } from './holidays.js';
import { recordWorkspaceUsage } from './analytics.js';
import { notificationsReady, sendBookingNotifications } from './notifications.js';
import { remindersReady, sendReminders } from './reminders.js';
import { assert, Problem, validateWorkspace, slots, dateRange, localDate, validZone } from './scheduling.js';
import { identity, body, hash, random, encrypt, rateLimit } from './security.js';
import * as providers from './providers.js';
import { publicRoutes,finalizeBooking,managementToken } from './public.js';
export const prefix='/calendar/api';
export const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export const all=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results;
export const one=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
export const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
export const connections=(db,uid)=>all(db,'SELECT * FROM connections WHERE uid=?',uid);
export function createHandler({authenticate=identity,provider=providers}={}){async function handle(request,env){
 const url=new URL(request.url),path=url.pathname.slice(prefix.length),method=request.method,db=env.DB;
 try {
  assert(url.pathname.startsWith(prefix+'/'),'Not found.',404);
  const origin=request.headers.get('Origin');if(origin)assert(origin===env.PUBLIC_ORIGIN,'This origin is not allowed.',403);
  if(method==='OPTIONS'){assert(['GET','POST','PUT','DELETE'].includes(request.headers.get('Access-Control-Request-Method')),'Method not allowed.',405);return new Response(null,{status:204});}
  if(path==='/health')return json({ready:Boolean(db),publicHolidays:true,emailReminders:remindersReady(env),bookingNotifications:notificationsReady(env),google:Boolean(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.TOKEN_ENCRYPTION_KEY),microsoft:Boolean(env.MICROSOFT_CLIENT_ID&&env.MICROSOFT_CLIENT_SECRET&&env.TOKEN_ENCRYPTION_KEY),turnstileSiteKey:env.TURNSTILE_SITE_KEY||''});
  assert(db,'The scheduling service is not configured yet.',503);

  await rateLimit(env,`ip:${await hash(request.headers.get('CF-Connecting-IP')||'local')}`,120);
  if(path.startsWith('/oauth/')&&path.endsWith('/callback')){
   const providerName=path.split('/')[2],state=url.searchParams.get('state')||'',browser=request.headers.get('Cookie')?.match(/(?:^|; )crown_oauth=([^;]+)/)?.[1]||'';
   const saved=await one(db,'DELETE FROM oauth_states WHERE state=? AND expires>? RETURNING *',await hash(state),Date.now());
   assert(saved&&saved.provider===providerName&&saved.browser_hash===await hash(browser),'Calendar connection expired. Start again.');assert(!url.searchParams.has('error'),'Calendar permission was declined.');
   const config=provider.providerConfig(providerName,env),token=await provider.exchange(providerName,{grant_type:'authorization_code',code:url.searchParams.get('code')||'',redirect_uri:config.redirect,code_verifier:saved.verifier},env);
   const granted=new Set((token.scope||'').split(' '));
   if(providerName==='google')assert(granted.has('https://www.googleapis.com/auth/calendar')||['calendar.calendarlist.readonly','calendar.events','calendar.events.freebusy'].every(scope=>granted.has('https://www.googleapis.com/auth/'+scope)),'Allow calendar list, event and availability permissions to enable bookings.');
   else assert([...granted].some(scope=>scope.toLowerCase()==='calendars.readwrite'),'Allow calendar read/write access to enable bookings.');
   const info=await provider.accountInfo(providerName,token.access_token),accountId=info.sub||info.id,email=info.email||info.mail||info.userPrincipalName;
   assert(accountId&&email,'The calendar account could not be identified.',503);

   const existing=await one(db,'SELECT * FROM connections WHERE uid=? AND provider=? AND account_id=?',saved.uid,providerName,accountId);
   assert(token.refresh_token||existing,'Persistent calendar access was not granted. Reconnect and allow access.',503);
   const calendars=await provider.listCalendars(providerName,token.access_token),previous=existing?JSON.parse(existing.calendars):[];
   for(const c of calendars)c.selected=previous.find(p=>p.id===c.id)?.selected||false;
   for(const c of previous)if(c.selected&&!calendars.some(v=>v.id===c.id))calendars.push({...c,missing:true,writable:false});
   await run(db,'INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid,provider,account_id) DO UPDATE SET email=excluded.email,refresh_token=excluded.refresh_token,calendars=excluded.calendars',existing?.id||crypto.randomUUID(),saved.uid,providerName,accountId,email,token.refresh_token?await encrypt(token.refresh_token,env):existing.refresh_token,JSON.stringify(calendars));
   return new Response(null,{status:303,headers:{Location:`${env.PUBLIC_ORIGIN}/calendar/?connected=1#sync-availability`,'Set-Cookie':'crown_oauth=; Path=/calendar/api/oauth; HttpOnly; SameSite=Lax; Max-Age=0','Cache-Control':'no-store'}});
  }
  if(path.startsWith('/public/')||path.startsWith('/booking/'))return await publicRoutes(request,env,provider,path);
  const navigation=method==='POST'&&/^\/connect\/(google|microsoft)\/navigate$/.test(path);
  let authRequest=request;
  if(navigation){assert(request.headers.get('Origin')===env.PUBLIC_ORIGIN,'Start calendar connection from the scheduling page.',403);assert(request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'),'Invalid connection request.');const input=await body(request,16000,true);assert(typeof input.idToken==='string'&&input.idToken.length<12000,'Sign in to connect a calendar.',401);authRequest=new Request(request.url,{headers:{Authorization:`Bearer ${input.idToken}`}});}
  const user=await authenticate(authRequest,env);assert(user.verified===true,'Verify your email before using your calendar workspace.',403);await rateLimit(env,`user:${user.uid}`,90);
  if(path==='/holiday-options'&&method==='GET'){
   const zone=url.searchParams.get('timezone')||'UTC';assert(validZone(zone),'Choose a valid time zone.');return json(holidayOptions(zone));
  }
  if(path==='/workspace'&&method==='GET'){try{await recordWorkspaceUsage(user,env);}catch{console.warn('Usage metric unavailable');}const row=await one(db,'SELECT * FROM profiles WHERE uid=?',user.uid);return json({data:row?JSON.parse(row.data):null,version:row?.version||0});}
  if(path==='/workspace'&&method==='PUT'){
   const input=await body(request);
   if(input.version===0&&input.data&&input.data.holidays===undefined)input.data.holidays={enabled:true,country:'auto'};
   const data=validateWorkspace(input.data);if(user.displayName)data.hostName=user.displayName;assert(Number.isInteger(input.version)&&input.version>=0,'Invalid workspace version.');
   if(data.published)assert(user.verified,'Verify your email before publishing a booking page.',403);
   if(data.destination&&data.published){const c=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',data.destination.connectionId,user.uid);assert(c&&JSON.parse(c.calendars).some(v=>v.id===data.destination.calendarId&&v.writable&&v.selected),'Choose a connected, writable calendar selected for conflict checks.');}
   try {
    const result=input.version===0?await run(db,'INSERT INTO profiles(uid,slug,data,version,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(uid) DO NOTHING',user.uid,data.slug||null,JSON.stringify(data),Date.now()):await run(db,'UPDATE profiles SET slug=?,data=?,version=version+1,updated_at=? WHERE uid=? AND version=?',data.slug||null,JSON.stringify(data),Date.now(),user.uid,input.version);
    assert(result.meta.changes===1,'Settings changed in another tab. Reload before saving.',409);
   }catch(error){if(/UNIQUE/.test(error.message))throw new Problem('That page address is already taken.',409);throw error;}
   return json({data,version:input.version+1});
  }
  if(path==='/connections/feed'&&method==='POST'){
   const input=await body(request,6000),url=feedUrl(input.url);assert(typeof input.name==='string'&&input.name.trim()&&input.name.length<=80,'Enter a calendar name.');
   const timezone=input.timezone||'UTC';assert(typeof timezone==='string'&&validZone(timezone),'Choose the calendar time zone.');
   parseFeed(await fetchFeed(url),Date.now(),Date.now()+42*86400000,timezone);
   const accountId=await hash(url),id=crypto.randomUUID(),calendars=JSON.stringify([{id:'feed',name:input.name.trim(),selected:true,writable:false,timezone}]);
   assert((await connections(db,user.uid)).length<20,'You can connect up to 20 calendar accounts.');
   await run(db,'INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?) ON CONFLICT(uid,provider,account_id) DO UPDATE SET email=excluded.email,refresh_token=excluded.refresh_token,calendars=excluded.calendars',id,user.uid,'ical',accountId,input.name.trim(),await encrypt(url,env),calendars);
   return json({connected:true});
  }
  if(path==='/connections'&&method==='GET')return json({accounts:(await connections(db,user.uid)).map(c=>({id:c.id,email:c.email,provider:c.provider,calendars:JSON.parse(c.calendars)}))});
  if(path.startsWith('/connect/')&&method==='POST'){
   const name=path.split('/')[2];
   const config=provider.providerConfig(name,env),state=random(),browser=random(),verifier=random();
   await run(db,'INSERT INTO oauth_states(state,uid,provider,verifier,browser_hash,expires) VALUES(?,?,?,?,?,?)',await hash(state),user.uid,name,verifier,await hash(browser),Date.now()+600000);
   const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const url=new URL(config.authorize);for(const [k,v] of Object.entries({client_id:config.clientId,redirect_uri:config.redirect,response_type:'code',scope:config.scope,state,code_challenge:challenge,code_challenge_method:'S256',...(name==='google'?{access_type:'offline',prompt:'consent select_account'}:{prompt:'select_account'})}))url.searchParams.set(k,v);
   const response=navigation?new Response(null,{status:303,headers:{Location:url.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}}):json({url:url.href});response.headers.set('Set-Cookie',`crown_oauth=${browser}; Path=/calendar/api/oauth; HttpOnly; SameSite=Lax; Max-Age=600${new URL(request.url).protocol==='https:'?'; Secure':''}`);return response;
  }
  if(path.startsWith('/connections/')){
   const id=path.split('/')[2],connection=await one(db,'SELECT * FROM connections WHERE id=? AND uid=?',id,user.uid);assert(connection,'Connection not found.',404);
   const profile=await one(db,'SELECT data FROM profiles WHERE uid=?',user.uid),settings=profile?JSON.parse(profile.data):null;
   if(method==='POST'&&path.endsWith('/refresh')){if(connection.provider==='ical')return json({calendars:JSON.parse(connection.calendars)});const fresh=await provider.listCalendars(connection.provider,await provider.tokenFor(connection,env)),old=JSON.parse(connection.calendars);for(const c of fresh)c.selected=old.some(v=>v.id===c.id&&v.selected);for(const c of old)if(c.selected&&!fresh.some(v=>v.id===c.id))fresh.push({...c,missing:true,writable:false});await run(db,'UPDATE connections SET calendars=? WHERE id=? AND uid=?',JSON.stringify(fresh),id,user.uid);return json({calendars:fresh});}
   if(method==='PUT'){const input=await body(request,50000),calendars=JSON.parse(connection.calendars);assert(Array.isArray(input.selected)&&input.selected.every(id=>calendars.some(c=>c.id===id)),'Invalid calendar selection.');if(settings?.destination?.connectionId===id)assert(input.selected.includes(settings.destination.calendarId),'This calendar receives your bookings. Choose another booking destination in Availability before deselecting it.',409);for(const c of calendars)c.selected=input.selected.includes(c.id);await run(db,'UPDATE connections SET calendars=? WHERE id=? AND uid=?',JSON.stringify(calendars),id,user.uid);return json({calendars});}
   if(method==='DELETE'){assert(settings?.destination?.connectionId!==id,'This account receives your bookings. Choose another booking destination in Availability before removing it.',409);assert(!await one(db,"SELECT id FROM bookings WHERE connection_id=? AND status IN ('pending','confirmed','cancelling','rescheduling') AND end>?",id,Date.now()),'This calendar has upcoming bookings. Cancel them before removing it.',409);await run(db,'DELETE FROM connections WHERE id=? AND uid=?',id,user.uid);return json({removed:true});}
  }
  if(path==='/availability'&&method==='GET'){
   const start=Number(url.searchParams.get('start')),end=Number(url.searchParams.get('end'));assert(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&end>start&&end-start<=42*86400000,'Choose a date range up to six weeks.');
   const linked=await connections(db,user.uid),profile=await one(db,'SELECT data FROM profiles WHERE uid=?',user.uid);
   const workspace=profile?JSON.parse(profile.data):{timezone:'UTC'},selected=linked.some(c=>JSON.parse(c.calendars).some(v=>v.selected));
   assert(!workspace.holidays?.enabled||holidayCountry(workspace),'Choose your public holiday country in booking availability settings.',409);
   const result=selected?await provider.readAvailability(linked,start,end,env,{details:true,timezone:workspace.timezone}):{busy:[],events:[]};
   const holidays=holidayEvents(workspace,start,end);
   return json({...result,busy:[...result.busy,...holidays.filter(h=>h.busy).map(({start,end})=>({start,end}))],events:[...(result.events||[]),...holidays],calendarsChecked:selected,start,end});
  }
  if(path==='/bookings'&&method==='GET'){
   const bookings=await all(db,'SELECT * FROM bookings WHERE uid=? AND end>? AND removed_from_list_at IS NULL ORDER BY start LIMIT 100',user.uid,Date.now());const results=[];
   for(const b of bookings)results.push({id:b.id,start:b.start,end:b.end,status:b.status,notificationState:b.notification_sent_at?'accepted':b.notification_state||'not_sent',data:JSON.parse(b.data),manageToken:await managementToken(b.id,env)});
   return json({bookings:results});
  }
  if(/^\/bookings\/[^/]+$/.test(path)&&method==='DELETE'){
   const id=path.split('/')[2],booking=await one(db,'SELECT status FROM bookings WHERE id=? AND uid=?',id,user.uid);
   assert(booking,'Booking not found.',404);assert(booking.status==='cancelled','Only cancelled meetings can be removed.',409);
   await run(db,"UPDATE bookings SET removed_from_list_at=COALESCE(removed_from_list_at,?) WHERE id=? AND uid=? AND status='cancelled'",Date.now(),id,user.uid);
   return json({removed:true});
  }
  if(path.startsWith('/bookings/')&&path.endsWith('/retry')&&method==='POST'){
   const booking=await one(db,'SELECT * FROM bookings WHERE id=? AND uid=?',path.split('/')[2],user.uid);assert(booking,'Booking not found.',404);await finalizeBooking(booking,env,provider);return json({status:booking.status});
  }
  throw new Problem('Not found.',404);
 }catch(error){return json({...((path==='/availability'&&error.connectionId)?{connectionId:error.connectionId}:{}),error:error instanceof Problem?error.message:'The request could not be completed. Please retry.'},error instanceof Problem?error.status:500);}
}
 return async(request,env)=>{const response=await handle(request,env);const headers=new Headers(response.headers);headers.set('Vary','Origin');if(request.headers.get('Origin')===env.PUBLIC_ORIGIN){headers.set('Access-Control-Allow-Origin',env.PUBLIC_ORIGIN);headers.set('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');headers.set('Access-Control-Allow-Headers','Authorization, Content-Type, X-Booking-Token');headers.set('Access-Control-Max-Age','600');}return new Response(response.body,{status:response.status,headers});};
}
const handler=createHandler();
export default {fetch:handler,async scheduled(event,env){await sendReminders(env);await sendBookingNotifications(env);await env.DB.batch([env.DB.prepare('DELETE FROM usage_sessions WHERE day<?').bind(new Date(Date.now()-90*86400000).toISOString().slice(0,10)),env.DB.prepare('DELETE FROM oauth_states WHERE expires<?').bind(Date.now()),env.DB.prepare('DELETE FROM rate_limits WHERE expires<?').bind(Date.now())]);}};
