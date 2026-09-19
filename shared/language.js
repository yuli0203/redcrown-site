// Share the studio's rc_lang preference without storing account or calendar data.
(()=>{
 'use strict';
 const supported=['en','he','ru'],homes={en:'/calendar/',he:'/calendar/he/'},studio={en:'/',he:'/he/',ru:'/ru/'};
 const read=()=>{try{return localStorage.getItem('rc_lang');}catch{return null;}};
 const save=lang=>{try{localStorage.setItem('rc_lang',lang);}catch{}};
 const explicit=new URLSearchParams(location.search).get('lang');
 const calendarHome=/^\/calendar(?:\/|\/he\/)?$/.test(location.pathname);
 const current=location.pathname.startsWith('/calendar/he/')?'he':'en';
 if(supported.includes(explicit))save(explicit);
 else if(/^\/(he|ru)\//.test(location.pathname))save(location.pathname.split('/')[1]);
 else if(current==='he')save('he');
 const detected=(navigator.languages||[navigator.language||'en']).map(v=>v.slice(0,2).toLowerCase()).find(v=>supported.includes(v))||'en';
 const preference=supported.includes(explicit)?explicit:read()||detected;
 // Explicit localized URLs stay crawlable; only the neutral calendar home follows a saved preference.
 if(calendarHome&&((supported.includes(explicit)&&homes[explicit]&&explicit!==current)||(current==='en'&&!explicit&&preference==='he'))){const u=new URL(location.href);u.pathname=homes[explicit]||homes.he;location.replace(u.href);return;}
 document.addEventListener('click',event=>{
  const toggle=event.target.closest('.calendar-languages .lang-toggle');
  document.querySelectorAll('.calendar-languages').forEach(picker=>{
   const button=picker.querySelector('.lang-toggle');
   const open=button===toggle&&!picker.classList.contains('open');
   picker.classList.toggle('open',open);button.setAttribute('aria-expanded',String(open));
  });
  const link=event.target.closest('a');if(!link)return;
  if(link.closest('.lang-static')){const lang=link.getAttribute('lang');if(supported.includes(lang)){save(lang);const url=new URL(link.href);url.searchParams.set('lang',lang);link.href=url.href;}return;}
  if(link.closest('.calendar-languages')){
   const lang=link.hreflang;if(!homes[lang])return;save(lang);
   const url=new URL(link.href);url.search=location.search;url.searchParams.set('lang',lang);url.hash=location.hash;link.href=url.href;
  }else{
   const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
   const lang=read()||preference;
   if(url.pathname==='/calendar/'&&lang==='he'){url.pathname=homes.he;link.href=url.href;}
   if(['/', '/he/', '/ru/'].includes(url.pathname)){url.pathname=studio[lang]||'/';url.searchParams.set('lang',lang);link.href=url.href;}
  }
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  document.querySelectorAll('.calendar-languages.open').forEach(picker=>{
   picker.classList.remove('open');const button=picker.querySelector('.lang-toggle');
   button.setAttribute('aria-expanded','false');button.focus();
  });
 });
})();
