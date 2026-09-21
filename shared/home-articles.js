/* Read the public embed's metadata without executing vendor code on the homepage.
   If Soro changes its format or is unavailable, retain the crawlable HTML cards. */
(()=>{
  'use strict';
  const root=document.getElementById('home-articles');
  if(!root)return;
  const controls=document.querySelector('.journal-controls');
  const previous=controls.querySelector('[data-journal-prev]');
  const next=controls.querySelector('[data-journal-next]');
  const position=controls.querySelector('.journal-position');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let current=0;
  function update(){
    const cards=[...root.children];
    const rtl=getComputedStyle(root).direction==='rtl';
    const box=root.getBoundingClientRect();
    let distance=Infinity;
    cards.forEach((card,index)=>{
      const rect=card.getBoundingClientRect();
      const delta=Math.abs(rtl?box.right-rect.right:rect.left-box.left);
      if(delta<distance){distance=delta;current=index;}
    });
    const overflow=root.scrollWidth>root.clientWidth+4;
    controls.hidden=!overflow;
    root.tabIndex=overflow?0:-1;
    const first=cards[0]?.getBoundingClientRect();
    const last=cards.at(-1)?.getBoundingClientRect();
    if(!first||!last)return;
    previous.disabled=rtl?first.right<=box.right+4:first.left>=box.left-4;
    next.disabled=rtl?last.left>=box.left-4:last.right<=box.right+4;
    position.textContent=(current+1)+' / '+cards.length;
  }
  function move(step){
    const cards=[...root.children];
    const card=cards[Math.max(0,Math.min(cards.length-1,current+step))];
    if(!card)return;
    const box=root.getBoundingClientRect();
    const rect=card.getBoundingClientRect();
    const rtl=getComputedStyle(root).direction==='rtl';
    root.scrollBy({left:rtl?rect.right-box.right:rect.left-box.left,behavior:reduced.matches?'instant':'smooth'});
  }
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  root.addEventListener('scroll',update,{passive:true});
  root.addEventListener('keydown',event=>{
    if(event.target!==root||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    const rtl=getComputedStyle(root).direction==='rtl';
    move((event.key==='ArrowRight'?1:-1)*(rtl?-1:1));
  });
  new ResizeObserver(update).observe(root);
  new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['dir','lang']});
  update();
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
      valid.slice(0,12).forEach(a=>{
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
      if(!root.contains(document.activeElement)){root.replaceChildren(fragment);update();}
    })
    .catch(()=>{})
    .finally(()=>clearTimeout(timeout));
})();
