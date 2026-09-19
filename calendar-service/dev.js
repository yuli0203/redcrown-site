import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { readFileSync,existsSync,writeFileSync } from 'node:fs';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from './src/worker.js';
import { database } from './database.js';
const here=fileURLToPath(new URL('.',import.meta.url)),root=resolve(here,'..'),port=Number(process.env.PORT||8769),callbackPort=Number(process.env.CALLBACK_PORT||8770),vars=resolve(here,'.dev.vars');
if(!existsSync(vars))writeFileSync(vars,`TOKEN_ENCRYPTION_KEY=${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64')}\n`);
const values=Object.fromEntries(readFileSync(vars,'utf8').split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')];}));
const env={...values,FIREBASE_PROJECT_ID:'crown-calendar-89e18',PUBLIC_ORIGIN:`http://127.0.0.1:${port}`,API_ORIGIN:`http://127.0.0.1:${callbackPort}`,DB:database(resolve(here,'calendar.sqlite'))};
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
const serve=async(req,res)=>{try{
 const url=new URL(req.url,env.PUBLIC_ORIGIN);
 if(url.pathname.startsWith('/calendar/api/')){const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 const decoded=decodeURIComponent(url.pathname);if(decoded.split('/').some(p=>p.startsWith('.')||['calendar-service','tools','functions','node_modules'].includes(p))){res.writeHead(404);res.end();return;}
 let path=resolve(root,'.'+decoded);if(!path.startsWith(root+sep)){res.writeHead(404);res.end();return;}if((await stat(path)).isDirectory())path=resolve(path,'index.html');
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(path));
 }catch{res.writeHead(404);res.end('Not found');}};
createServer(serve).listen(port,'127.0.0.1',()=>console.log(`Calendar development server: http://127.0.0.1:${port}/calendar/`));
// Preserve the registered OAuth callback while keeping the existing browser origin,
// Firebase session and local drafts on port 8769. Cookies are scoped by host, not port.
if(callbackPort!==port)createServer((req,res)=>{
 if(!/^\/calendar\/api\/oauth\/(google|microsoft)\/callback(?:\?|$)/.test(req.url)){res.writeHead(404);res.end('Not found');return;}
 return serve(req,res);
}).listen(callbackPort,'127.0.0.1',()=>console.log(`OAuth callback listener: http://127.0.0.1:${callbackPort}`));
