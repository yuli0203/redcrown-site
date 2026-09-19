(() => {
 const api={online:false,config:null};
 api.ready=fetch('/calendar/api/health',{cache:'no-store',signal:AbortSignal.timeout(4000)}).then(async r=>{if(!r.ok)return false;const value=await r.json();api.config=value;return api.online=value.ready===true;}).catch(()=>false);
 api.request=async(path,{method='GET',data,publicRequest=false}={})=>{
  const headers={'Content-Type':'application/json'};
  if(!publicRequest){const token=await window.CrownAuth?.token();if(!token)throw new Error('Sign in to continue.');headers.Authorization=`Bearer ${token}`;}
  const response=await fetch('/calendar/api'+path,{method,headers,credentials:'same-origin',cache:'no-store',...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(60000)});
  const result=await response.json().catch(()=>({error:'The scheduling service is unavailable.'}));if(!response.ok)throw Object.assign(new Error(result.error||'Please retry.'),{status:response.status});return result;
 };
 window.CrownAPI=api;
})();
