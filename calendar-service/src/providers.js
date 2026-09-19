import { Temporal } from '@js-temporal/polyfill';
import { assert, Problem } from './scheduling.js';
import { decrypt, encrypt } from './security.js';
const google='https://www.googleapis.com/calendar/v3',graph='https://graph.microsoft.com/v1.0';
export function providerConfig(provider,env){
 assert(['google','microsoft'].includes(provider),'Unknown calendar provider.');
 const microsoft=provider==='microsoft';
 const clientId=microsoft?env.MICROSOFT_CLIENT_ID:env.GOOGLE_CLIENT_ID,secret=microsoft?env.MICROSOFT_CLIENT_SECRET:env.GOOGLE_CLIENT_SECRET;
 assert(clientId&&secret&&env.TOKEN_ENCRYPTION_KEY,'This calendar provider is not configured yet.',503);
 return {clientId,secret,authorize:microsoft?'https://login.microsoftonline.com/common/oauth2/v2.0/authorize':'https://accounts.google.com/o/oauth2/v2/auth',token:microsoft?'https://login.microsoftonline.com/common/oauth2/v2.0/token':'https://oauth2.googleapis.com/token',scope:microsoft?'openid email offline_access User.Read Calendars.ReadWrite':'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.events.freebusy',redirect:`${env.API_ORIGIN||env.PUBLIC_ORIGIN}/calendar/api/oauth/${provider}/callback`};
}
async function request(url,token,options={}){const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Problem(response.status===401||response.status===403?'Calendar access needs to be reconnected.':'The calendar provider could not complete this request. Please retry.',503);return response.status===204?{}:response.json();}
export async function exchange(provider,values,env){const config=providerConfig(provider,env);const response=await fetch(config.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.secret,...values}),signal:AbortSignal.timeout(15000)});assert(response.ok,'Calendar authorization expired or was declined. Reconnect the account.',503);return response.json();}
const accessCache=new Map(),refreshing=new Map();
export async function tokenFor(connection,env){
 const cached=accessCache.get(connection.id);if(cached&&cached.cipher===connection.refresh_token&&cached.expires>Date.now())return cached.token;
 const key=connection.id+':'+connection.refresh_token;
 if(refreshing.has(key))return refreshing.get(key);
 const promise=(async()=>{
  const result=await exchange(connection.provider,{grant_type:'refresh_token',refresh_token:await decrypt(connection.refresh_token,env)},env);assert(result.access_token,'Reconnect your calendar account.',503);
  let cipher=connection.refresh_token;
  if(result.refresh_token){cipher=await encrypt(result.refresh_token,env);await env.DB.prepare('UPDATE connections SET refresh_token=? WHERE id=? AND uid=? AND refresh_token=?').bind(cipher,connection.id,connection.uid,connection.refresh_token).run();}
  // Bounded, short-lived process memory only. Nothing here is sent to the client.
  if(accessCache.size>=500)accessCache.delete(accessCache.keys().next().value);
  accessCache.set(connection.id,{cipher,token:result.access_token,expires:Date.now()+Math.max(0,Number(result.expires_in||3600)-60)*1000});return result.access_token;
 })();refreshing.set(key,promise);try{return await promise;}finally{refreshing.delete(key);}
}
export async function accountInfo(provider,token){return provider==='google'?request('https://www.googleapis.com/oauth2/v3/userinfo',token):request(`${graph}/me?$select=id,mail,userPrincipalName,displayName`,token);}
export async function listCalendars(provider,token){let url=provider==='google'?`${google}/users/me/calendarList?maxResults=250&showHidden=true`:`${graph}/me/calendars?$top=100`;const calendars=[];for(let i=0;url&&i<30;i++){const page=await request(url,token);for(const c of page.items||page.value||[])if(!c.deleted)calendars.push({id:c.id,name:c.summaryOverride||c.summary||c.name||'Calendar',selected:false,writable:provider==='google'?['owner','writer'].includes(c.accessRole):c.canEdit===true});url=provider==='google'?(page.nextPageToken?`${google}/users/me/calendarList?maxResults=250&showHidden=true&pageToken=${encodeURIComponent(page.nextPageToken)}`:null):safeGraphNext(page['@odata.nextLink']);}assert(!url,'Too many calendars to load safely.',503);return calendars;}
function safeGraphNext(url){if(!url)return null;assert(url.startsWith(`${graph}/`),'Invalid provider pagination.',503);return url;}
function eventTime(value,zone){return value?.date?Number(Temporal.PlainDate.from(value.date).toZonedDateTime({timeZone:zone,plainTime:'00:00'}).epochMilliseconds):Date.parse(value?.dateTime ? /Z$|[+-]\d\d:\d\d$/.test(value.dateTime)?value.dateTime:value.dateTime+'Z' : '');}
export async function readAvailability(connections,start,end,env,{details=false,timezone='UTC'}={}){
 const busy=[],events=[];
 for(const connection of connections){try{const selected=JSON.parse(connection.calendars).filter(c=>c.selected);if(!selected.length)continue;const token=await tokenFor(connection,env),eventFallback=new Set();
  if(connection.provider==='google'){
   for(let i=0;i<selected.length;i+=50){const batch=selected.slice(i,i+50),data=await request(`${google}/freeBusy`,token,{method:'POST',body:JSON.stringify({timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),items:batch.map(c=>({id:c.id}))})});for(const c of batch){const result=data.calendars?.[c.id];if(result?.errors?.length){eventFallback.add(c.id);continue;}assert(result&&Array.isArray(result.busy),`Availability for ${c.name} could not be checked. Reconnect or deselect this calendar.`,503);for(const b of result.busy)busy.push({start:Date.parse(b.start),end:Date.parse(b.end)});}}
   if(!details&&!eventFallback.size)continue;
  }
  for(const calendar of selected){const requiredEvents=connection.provider==='microsoft'||eventFallback.has(calendar.id);if(connection.provider==='google'&&!details&&!requiredEvents)continue;let url=connection.provider==='google'?`${google}/calendars/${encodeURIComponent(calendar.id)}/events?${new URLSearchParams({timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString(),singleEvents:'true',maxResults:'250',fields:'kind,nextPageToken,timeZone,items(id,summary,start,end,status,transparency,attendees(self,responseStatus))'})}`:`${graph}/me/calendars/${encodeURIComponent(calendar.id)}/calendarView?${new URLSearchParams({startDateTime:new Date(start).toISOString(),endDateTime:new Date(end).toISOString(),'$top':'250','$select':'id,subject,start,end,isAllDay,isCancelled,showAs'})}`;
   const base=url;try{for(let pageNumber=0;url&&pageNumber<40;pageNumber++){
    const page=await request(url,token,{headers:{Prefer:'outlook.timezone="UTC"'}});assert(connection.provider==='google'?(Array.isArray(page.items)||page.kind==='calendar#events'):Array.isArray(page.value),'Invalid calendar event response.',503);
    for(const event of page.items||page.value||[]){if(event.status==='cancelled'||event.isCancelled)continue;const from=eventTime(event.start,page.timeZone||timezone),to=eventTime(event.end,page.timeZone||timezone);assert(Number.isFinite(from)&&Number.isFinite(to)&&from<to,'Calendar returned an invalid event time.',503);const blocking=connection.provider==='google'?event.transparency!=='transparent'&&!event.attendees?.some(a=>a.self&&a.responseStatus==='declined'):!['free','workingElsewhere'].includes(event.showAs);if(requiredEvents&&blocking)busy.push({start:from,end:to});if(details)events.push({start:from,end:to,title:event.summary||event.subject||'Busy',calendar:calendar.name,allDay:Boolean(event.start?.date||event.isAllDay),busy:blocking});}
    url=connection.provider==='google'?(page.nextPageToken?`${base}&pageToken=${encodeURIComponent(page.nextPageToken)}`:null):safeGraphNext(page['@odata.nextLink']);
   }assert(!url,'Calendar returned too many events. Choose a smaller date range.',503);}catch(error){if(requiredEvents)throw new Problem(`Availability for ${calendar.name} could not be checked. Check access or deselect this calendar.`,503);/* Google busy data remains authoritative when private details are unavailable. */}
  }
 }catch(error){error.connectionId=connection.id;throw error;}
 }
 assert(busy.every(b=>Number.isFinite(b.start)&&Number.isFinite(b.end)&&b.start<b.end),'Invalid busy data.',503);return {busy,events};
}
export async function writeBooking(connection,calendarId,booking,env){const token=await tokenFor(connection,env),data=JSON.parse(booking.data),googleEventId=booking.id.replaceAll('-','');
 const content=connection.provider==='google'?{id:googleEventId,summary:data.title,description:`Booked through Red Crown Calendar.\n${data.notes||''}${data.manageUrl?'\n\nManage or cancel this booking: '+data.manageUrl:''}`,location:data.location||'',start:{dateTime:new Date(booking.start).toISOString()},end:{dateTime:new Date(booking.end).toISOString()},attendees:[{email:data.email,displayName:data.name}]}:{transactionId:booking.id,subject:data.title,body:{contentType:'text',content:`Booked through Red Crown Calendar.\n${data.notes||''}${data.manageUrl?'\n\nManage or cancel this booking: '+data.manageUrl:''}`},location:{displayName:data.location||''},start:{dateTime:new Date(booking.start).toISOString(),timeZone:'UTC'},end:{dateTime:new Date(booking.end).toISOString(),timeZone:'UTC'},attendees:[{emailAddress:{address:data.email,name:data.name},type:'required'}]};
 const url=connection.provider==='google'?`${google}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`:`${graph}/me/calendars/${encodeURIComponent(calendarId)}/events`;
 // Deterministic provider IDs make a retry safe after a network timeout.
 if(connection.provider==='google'){try{return await request(`${google}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,token);}catch{}}
 return request(url,token,{method:'POST',body:JSON.stringify(content)});
}
export async function cancelEvent(connection,booking,env){const token=await tokenFor(connection,env);const url=connection.provider==='google'?`${google}/calendars/${encodeURIComponent(booking.calendar_id)}/events/${encodeURIComponent(booking.event_id)}?sendUpdates=all`:`${graph}/me/calendars/${encodeURIComponent(booking.calendar_id)}/events/${encodeURIComponent(booking.event_id)}`;const response=await fetch(url,{method:'DELETE',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});assert(response.ok||[404,410].includes(response.status),'Cancellation could not reach your calendar. Please retry.',503);}
