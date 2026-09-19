import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
test('OAuth requires the initiating browser, rejects replay, and encrypts refresh credentials',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64')};let exchanges=0;
 const provider={providerConfig(){return {authorize:'https://accounts.google.com/o/oauth2/v2/auth',clientId:'client',redirect:'http://localhost/calendar/api/oauth/google/callback',scope:'openid'};},async exchange(){exchanges++;return {access_token:'access',refresh_token:'private-refresh',scope:'https://www.googleapis.com/auth/calendar'};},async accountInfo(){return {sub:'account',email:'host@example.test'};},async listCalendars(){return [{id:'work',name:'Work',writable:true,selected:false}];}};
 const handle=createHandler({authenticate:async()=>({uid:'owner',verified:true}),provider});
 async function start(){const r=await handle(new Request('http://localhost/calendar/api/connect/google',{method:'POST',body:'{}'}),env);return {cookie:r.headers.get('Set-Cookie').split(';')[0],state:new URL((await r.json()).url).searchParams.get('state')};}
 const first=await start();let r=await handle(new Request('http://localhost/calendar/api/oauth/google/callback?code=code&state='+first.state),env);assert.equal(r.status,400);assert.equal(exchanges,0);
 const second=await start();const callback=()=>new Request('http://localhost/calendar/api/oauth/google/callback?code=code&state='+second.state,{headers:{Cookie:second.cookie}});
 r=await handle(callback(),env);assert.equal(r.status,303);assert.equal(exchanges,1);assert.equal((await handle(callback(),env)).status,400);
 const saved=await DB.prepare('SELECT refresh_token FROM connections').first();assert.ok(!saved.refresh_token.includes('private-refresh'));DB.close();
});


test('Separate API origin accepts only the site and navigates OAuth without third-party cookies',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'https://site.example',API_ORIGIN:'https://api.example',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,6).toString('base64')};
 let authHeader='';const handle=createHandler({authenticate:async r=>{authHeader=r.headers.get('Authorization');return {uid:'host',verified:true};},provider:{providerConfig(){return {authorize:'https://accounts.google.com/o/oauth2/v2/auth',clientId:'client',redirect:env.API_ORIGIN+'/calendar/api/oauth/google/callback',scope:'openid'};}}});
 const preflight=await handle(new Request(env.API_ORIGIN+'/calendar/api/workspace',{method:'OPTIONS',headers:{Origin:env.PUBLIC_ORIGIN,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'authorization, content-type'}}),env);
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_ORIGIN);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
 const denied=await handle(new Request(env.API_ORIGIN+'/calendar/api/health',{headers:{Origin:'https://untrusted.example'}}),env);
 assert.equal(denied.status,403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
 const nav=await handle(new Request(env.API_ORIGIN+'/calendar/api/connect/google/navigate',{method:'POST',headers:{Origin:env.PUBLIC_ORIGIN,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({idToken:'sample-token'})}),env);
 assert.equal(nav.status,303);assert.equal(authHeader,'Bearer sample-token');assert.match(nav.headers.get('Set-Cookie'),/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
 const destination=new URL(nav.headers.get('Location'));assert.equal(destination.searchParams.get('redirect_uri'),env.API_ORIGIN+'/calendar/api/oauth/google/callback');assert.ok(!destination.href.includes('sample-token'));
 const noOrigin=await handle(new Request(env.API_ORIGIN+'/calendar/api/connect/google/navigate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'idToken=sample-token'}),env);assert.equal(noOrigin.status,403);DB.close();
});


test('Mail consent is restricted to the saved destination and rejects a different returned account',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64')};
 await DB.prepare('INSERT INTO profiles(uid,data,updated_at) VALUES(?,?,?)').bind('owner',JSON.stringify({destination:{connectionId:'dest',calendarId:'primary'}}),Date.now()).run();
 for(const id of ['dest','availability'])await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?)').bind(id,'owner','google',id,id+'@example.test','encrypted','[]').run();
 const provider={providerConfig(name,env,{mail=false}={}){return {authorize:'https://accounts.google.com/o/oauth2/v2/auth',clientId:'client',redirect:'http://localhost/calendar/api/oauth/google/callback',scope:mail?'calendar gmail.send':'calendar'};},async exchange(){return {access_token:'access',refresh_token:'new-secret',scope:'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send'};},async accountInfo(){return {sub:'availability',email:'availability@example.test'};}};
 const handle=createHandler({authenticate:async()=>({uid:'owner',verified:true}),provider});
 const start=mailConnectionId=>handle(new Request('http://localhost/calendar/api/connect/google',{method:'POST',body:JSON.stringify({mailConnectionId})}),env);
 let r=await start('availability');assert.equal(r.status,403);
 r=await start();assert.ok(!new URL((await r.json()).url).searchParams.get('scope').includes('gmail.send'));
 r=await start('dest');const cookie=r.headers.get('Set-Cookie').split(';')[0],url=new URL((await r.json()).url);assert.match(url.searchParams.get('scope'),/gmail.send/);assert.equal(url.searchParams.get('login_hint'),'dest@example.test');
 r=await handle(new Request('http://localhost/calendar/api/oauth/google/callback?code=code&state='+url.searchParams.get('state'),{headers:{Cookie:cookie}}),env);assert.equal(r.status,403);
 assert.equal((await DB.prepare("SELECT mail_enabled FROM connections WHERE id='availability'").first()).mail_enabled,0);DB.close();
});
