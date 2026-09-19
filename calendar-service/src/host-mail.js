import {tokenFor} from './providers.js';

const base64 = value => {
 const bytes=new TextEncoder().encode(value);let binary='';
 for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary);
};
// Recipient comes exclusively from the authenticated connection, never guest input.
export function hostMailRequest(connection,mail){
 const email=connection.email;
 if(!/^[^\s<>"(),;:@]+@[^\s<>"(),;:@]+\.[^\s<>"(),;:@]+$/.test(email))throw Error('Invalid connected mailbox');
 if(connection.provider==='google'){
  const chars=Array.from(mail.subject.replace(/[\r\n]/g,' ')),words=[];
  for(let i=0;i<chars.length;i+=10)words.push('=?UTF-8?B?'+base64(chars.slice(i,i+10).join(''))+'?=');
  const subject=words.join('\r\n ');
  const content=base64(mail.text).match(/.{1,76}/g).join('\r\n');
  const mime=`From: ${email}\r\nTo: ${email}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}`;
  return {url:'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',body:{raw:base64(mime).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}};
 }
 if(connection.provider==='microsoft')return {url:'https://graph.microsoft.com/v1.0/me/sendMail',body:{message:{subject:mail.subject,body:{contentType:'Text',content:mail.text},toRecipients:[{emailAddress:{address:email}}]},saveToSentItems:true}};
 throw Error('Unsupported sending account');
}
export async function sendHostMail(connection,mail,env,{send=fetch,getToken=tokenFor}={}){
 const payload=hostMailRequest(connection,mail);
 // A token refresh failure occurs before submission and can safely be retried.
 let token;try{token=await getToken(connection,env);}catch{return {state:'retry',delay:300000};}
 let response;
 try{response=await send(payload.url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload.body),redirect:'manual',signal:AbortSignal.timeout(15000)});}
 catch{return {state:'unknown'};}
 if(response.ok)return {state:'accepted'};
 if([401,403].includes(response.status))return {state:'permission_required'};
 if(response.status===429){const seconds=Number(response.headers.get('Retry-After'));return {state:'retry',delay:Math.max(60000,Math.min(86400000,Number.isFinite(seconds)?seconds*1000:300000))};}
 // Gmail and Graph send APIs provide no idempotency key. Do not resend an
 // uncertain submission automatically: it may already have reached the host.
 return {state:response.status>=500?'unknown':'failed'};
}
