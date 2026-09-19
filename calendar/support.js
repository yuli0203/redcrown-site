(async()=>{
 'use strict';
 try{
  const response=await fetch('/calendar/support-config.json',{cache:'no-store'});if(!response.ok)return;
  const config=await response.json();if(!config.tipUrl)return;
  const url=new URL(config.tipUrl);if(url.protocol!=='https:'||url.username||url.password)return;
  const link=document.querySelector('#calendar-tip-link');link.href=url.href;link.hidden=false;
  document.querySelector('#calendar-tip-pending').hidden=true;
  document.querySelector('#calendar-tip-note').textContent='Opens our secure payment page. Choose your tip amount there.';
 }catch{/* Keep the honest unavailable state when configuration cannot be loaded. */}
})();
