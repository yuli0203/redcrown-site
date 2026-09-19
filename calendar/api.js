(() => {
 'use strict';
 const api={online:false,config:null,base:'/calendar/api',configured:false,error:''};
 api.ready=(async()=>{
  try{
   const response=await fetch('/calendar/auth-config.json',{cache:'no-store',signal:AbortSignal.timeout(4000)});
   if(response.ok){const settings=await response.json();if(settings.apiOrigin){api.configured=true;const url=new URL(settings.apiOrigin);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Invalid scheduling service address.');api.base=url.origin+'/calendar/api';}}
   const health=await fetch(api.base+'/health',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!health.ok)throw Error('The scheduling service is unavailable. Please refresh to retry.');
   api.config=await health.json();api.online=api.config.ready===true;return api.online;
  }catch(error){api.error=error.message;return false;}
 })();
 api.request=async(path,{method='GET',data,publicRequest=false,bookingToken}={})=>{
  if(api.configured&&!api.online)throw Error(api.error||'The scheduling service is unavailable. Please refresh.');
  const headers={};if(data)headers['Content-Type']='application/json';if(bookingToken)headers['X-Booking-Token']=bookingToken;
  if(!publicRequest){const token=await window.CrownAuth?.token();if(!token)throw Error('Sign in to continue.');headers.Authorization=`Bearer ${token}`;}
  const response=await fetch(api.base+path,{method,headers,credentials:'omit',cache:'no-store',...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>({error:'The scheduling service is unavailable.'}));if(!response.ok)throw Object.assign(Error(result.error||'Please retry.'),{status:response.status,connectionId:result.connectionId});return result;
 };
 api.connect=async (provider,mailConnectionId=null)=>{
  if(!['google','microsoft'].includes(provider))throw Error('Unknown calendar provider.');
  const token=await window.CrownAuth?.token();if(!token)throw Error('Sign in to connect your calendar.');
  // Navigation establishes the API cookie without third-party cookie access.
  // Credentials go in the POST body, never in the URL or browser storage.
  const form=document.createElement('form');form.method='POST';form.action=api.base+'/connect/'+provider+'/navigate';form.hidden=true;
  const input=document.createElement('input');input.type='hidden';input.name='idToken';input.value=token;form.append(input);if(mailConnectionId){const mail=document.createElement('input');mail.type='hidden';mail.name='mailConnectionId';mail.value=mailConnectionId;form.append(mail);}document.body.append(form);form.submit();form.remove();
 };
 window.CrownAPI=api;
})();
