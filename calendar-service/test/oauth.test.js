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
