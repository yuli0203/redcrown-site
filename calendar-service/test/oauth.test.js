import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from '../database.js';
import { createHandler } from '../src/worker.js';
import { providerConfig } from '../src/providers.js';
const realScope=name=>providerConfig(name,{GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',MICROSOFT_CLIENT_ID:'id',MICROSOFT_CLIENT_SECRET:'secret',TOKEN_ENCRYPTION_KEY:'key',PUBLIC_ORIGIN:'http://localhost'}).scope;
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


test('Connecting a calendar never requests mail sending permission',async()=>{
 const DB=database(),env={DB,PUBLIC_ORIGIN:'http://localhost',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64')};
 await DB.prepare('INSERT INTO profiles(uid,data,updated_at) VALUES(?,?,?)').bind('owner',JSON.stringify({destination:{connectionId:'dest',calendarId:'primary'}}),Date.now()).run();
 await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?)').bind('dest','owner','google','dest','dest@example.test','encrypted','[]').run();
 const provider={providerConfig(name,env){return {authorize:'https://accounts.google.com/o/oauth2/v2/auth',clientId:'client',redirect:'http://localhost/calendar/api/oauth/google/callback',scope:realScope(name)};},async exchange(){return {access_token:'access',refresh_token:'new-secret',scope:'https://www.googleapis.com/auth/calendar'};},async accountInfo(){return {sub:'dest',email:'dest@example.test'};},async listCalendars(){return [];}};
 const handle=createHandler({authenticate:async()=>({uid:'owner',verified:true}),provider});
 // A request that names a destination account cannot widen the consent screen.
 for(const body of ['{}',JSON.stringify({mailConnectionId:'dest'})]){
  const r=await handle(new Request('http://localhost/calendar/api/connect/google',{method:'POST',body}),env);
  const url=new URL((await r.json()).url),scope=url.searchParams.get('scope');
  assert.ok(!scope.includes('gmail.send'));assert.ok(!scope.toLowerCase().includes('mail.send'));assert.equal(url.searchParams.get('login_hint'),null);
 }
 DB.close();
});
