import { createRemoteJWKSet, jwtVerify } from 'jose';
import { assert, Problem } from './scheduling.js';
const jwks=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
export async function identity(request,env){
 const token=request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];assert(token,'Sign in to continue.',401);
 try {const {payload}=await jwtVerify(token,jwks,{algorithms:['RS256'],issuer:`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,audience:env.FIREBASE_PROJECT_ID});assert(payload.sub&&payload.sub.length<=128&&payload.auth_time<=Date.now()/1000,'Invalid sign-in.',401);return {uid:payload.sub,verified:payload.email_verified===true,authTime:payload.auth_time,provider:payload.firebase?.sign_in_provider};}catch{throw new Problem('Your sign-in expired. Sign in again.',401);}
}
export const random=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function key(env){assert(env.TOKEN_ENCRYPTION_KEY,'Calendar connections are not configured yet.',503);const bytes=Uint8Array.from(atob(env.TOKEN_ENCRYPTION_KEY),c=>c.charCodeAt(0));assert(bytes.length===32,'Calendar encryption is not configured.',503);return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function encrypt(value,env){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(value));return btoa(String.fromCharCode(...iv,...new Uint8Array(cipher)));}
export async function decrypt(value,env){const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await key(env),bytes.slice(12)));}
export async function body(request,max=950000,form=false){assert(Number(request.headers.get('Content-Length')||0)<=max,'Request too large.',413);const reader=request.body?.getReader();assert(reader,'Missing request body.');let count=0,chunks=[];for(;;){const {value,done}=await reader.read();if(done)break;count+=value.byteLength;if(count>max){await reader.cancel();throw new Problem('Request too large.',413);}chunks.push(value);}const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}try{const text=new TextDecoder().decode(bytes);return form?Object.fromEntries(new URLSearchParams(text)):JSON.parse(text);}catch{throw new Problem('Invalid request.');}}
export async function rateLimit(env,key,limit=30,windowMs=60000){const now=Date.now(),bucket=Math.floor(now/windowMs);const result=await env.DB.prepare('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(`${key}:${windowMs}:${bucket}`,now+windowMs*2).first();assert(result.count<=limit,'Too many requests. Please try again later.',429);}
export async function invitationLimits(env,uid,recipients){
 await rateLimit(env,`invite-host:${uid}`,30,3600000);
 await rateLimit(env,`invite-host-day:${uid}`,100,86400000);
 for(const email of new Set(recipients.filter(Boolean).map(v=>v.trim().toLowerCase()))){
  const recipient=await hash(email);
  await rateLimit(env,`invite-recipient:${recipient}`,5,3600000);
  await rateLimit(env,`invite-recipient-day:${recipient}`,15,86400000);
 }
}
