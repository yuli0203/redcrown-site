/* Soro published articles at /blog/?post=<slug>; those links now point at
   /blog/<slug>/. Keep them working instead of dropping visitors on the list. */
(()=>{
  'use strict';
  const slug=new URLSearchParams(location.search).get('post');
  if(!slug||!/^[a-z0-9-]{1,80}$/.test(slug))return;
  fetch('/blog/articles.json',{credentials:'omit'})
    .then(r=>r.ok?r.json():[])
    .then(list=>{
      const match=list.find(a=>a.slug===slug||(a.aliases||[]).includes(slug));
      if(match)location.replace(match.url);
    })
    .catch(()=>{});
})();
