(() => {
 'use strict';
 const form=document.querySelector('#calendar-feedback-form'),status=document.querySelector('#feedback-status');
 if(!form)return;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.dataset.sending==='true')return;
  for(const name of ['name','message']){const input=form.elements.namedItem(name);input.setCustomValidity(input.value.trim().length<(name==='message'?10:1)?(name==='message'?'Please enter at least 10 characters.':'Please enter your name.'):'');}
  if(!form.reportValidity())return;if(form.elements.namedItem('botcheck').checked)return;
  const button=form.querySelector('button[type=submit]');form.dataset.sending='true';button.disabled=true;status.textContent='Sending your message...';
  try{
   const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form))),signal:AbortSignal.timeout(20000)});
   const result=await response.json();if(!response.ok||result.success!==true)throw Error('rejected');
   form.reset();status.textContent='Thank you. Your message has been sent to Red Crown Interactive.';
  }catch{status.textContent='We could not confirm delivery. Your message is still here. Please try again later or email hello@redcrowninteractive.com.';}
  finally{form.dataset.sending='false';button.disabled=false;}
 });
 for(const input of form.querySelectorAll('input,textarea'))input.addEventListener('input',()=>input.setCustomValidity(''));
})();
