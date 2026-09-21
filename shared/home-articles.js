/* Read the public embed's metadata without executing vendor code on the homepage.
   If Soro changes its format or is unavailable, retain the crawlable HTML cards. */
(()=>{
  'use strict';
  const root=document.getElementById('home-articles');
  if(!root)return;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  fetch('https://app.trysoro.com/api/embed/231358a2-cbdb-4736-83c3-36facdda3e9c?theme=dark',{signal:controller.signal,credentials:'omit'})
    .then(r=>{if(!r.ok)throw new Error('Feed unavailable');return r.text();})
    .then(source=>{
      const match=source.match(/^\s*var SORO_ARTICLES = (\[.*\]);\s*$/m);
      if(!match)return;
      const articles=JSON.parse(match[1]);
      if(!Array.isArray(articles))return;
      const valid=articles.filter(a=>a&&typeof a.title==='string'&&typeof a.slug==='string'&&a.slug&&typeof a.excerpt==='string'&&Number.isFinite(Date.parse(a.isoDate)));
      valid.sort((a,b)=>Date.parse(b.isoDate)-Date.parse(a.isoDate));
      if(!valid.length)return;
      const fragment=document.createDocumentFragment();
      valid.slice(0,3).forEach(a=>{
        const card=document.createElement('a');
        card.className='journal-card';card.lang='he';card.dir='rtl';
        card.href='/blog/?post='+encodeURIComponent(a.slug);
        const date=document.createElement('time');date.dateTime=a.isoDate;
        date.textContent=new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(new Date(a.isoDate));
        const title=document.createElement('h3');title.textContent=a.title;
        const excerpt=document.createElement('p');excerpt.textContent=a.excerpt;
        const more=document.createElement('span');more.className='journal-read';more.textContent='לקריאת המאמר';
        const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='←';more.append(arrow);
        card.append(date,title,excerpt,more);fragment.append(card);
      });
      // Avoid replacing a link while a keyboard user is focused inside it.
      if(!root.contains(document.activeElement))root.replaceChildren(fragment);
    })
    .catch(()=>{})
    .finally(()=>clearTimeout(timeout));
})();
