import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../src/worker.js';
import { database } from '../database.js';
import { validateWorkspace } from '../src/scheduling.js';
const root=resolve(fileURLToPath(new URL('../../',import.meta.url))),DB=database(),env={DB,PUBLIC_ORIGIN:'http://127.0.0.1:8771',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,5).toString('base64'),GOOGLE_CLIENT_SECRET:'fixture-only',MICROSOFT_CLIENT_SECRET:'fixture-only'};
const provider={async readAvailability(connections,start,end){const day=new Date(start);day.setDate(day.getDate()+2);day.setHours(10,0,0,0);return {busy:[{start:+day,end:+day+3600000}],events:[{start:+day,end:+day+3600000,title:'Design review (sample)',calendar:'Work',busy:true}]};},async writeBooking(c,id,b){return {id:b.id};},async cancelEvent(){}};
const handler=createHandler({authenticate:async()=>({uid:'fixture',verified:true}),provider});
await DB.prepare('INSERT INTO connections(id,uid,provider,account_id,email,refresh_token,calendars) VALUES(?,?,?,?,?,?,?)').bind('sample','fixture','google','sample','sample@example.test','unused',JSON.stringify([{id:'primary',name:'Work',selected:true,writable:true},{id:'other',name:'Personal',selected:false,writable:true}])).run();
const workspace=validateWorkspace({pageName:'Sample host',slug:'sample-host',timezone:'Asia/Jerusalem',destination:{connectionId:'sample',calendarId:'primary'},published:true,meetings:[{id:'intro',title:'Introduction',description:'A short conversation about your project.',duration:30,before:0,after:15,notice:0}]});
await DB.prepare('INSERT INTO profiles(uid,slug,data,version,updated_at) VALUES(?,?,?,?,?)').bind('fixture','sample-host',JSON.stringify(workspace),1,Date.now()).run();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'};
createServer(async(req,res)=>{try{const url=new URL(req.url,env.PUBLIC_ORIGIN);if(url.pathname.startsWith('/calendar/api/')){const response=await handler(new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
if(url.pathname==='/calendar/auth.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`window.CrownAuth={token:async()=> 'fixture'};window.addEventListener('load',async()=>{await CrownAPI.ready;document.querySelector('#auth-identity').textContent='Sample account - test only';document.querySelector('#auth-account').hidden=false;document.querySelector('#auth-open').hidden=true;document.dispatchEvent(new CustomEvent('crown-auth-change',{detail:{uid:'fixture',displayName:'Sample host'}}));});`);return;}
const decoded=decodeURIComponent(url.pathname);if(decoded.split('/').some(p=>p.startsWith('.')||['calendar-service','tools'].includes(p)))throw Error();let path=resolve(root,'.'+decoded);if(!path.startsWith(root+sep))throw Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(8771,'127.0.0.1',()=>console.log('Isolated sample-only QA server: http://127.0.0.1:8771/calendar/'));

