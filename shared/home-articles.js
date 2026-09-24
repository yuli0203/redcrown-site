/* Fill the homepage carousel from the journal's own feed. The cards in the HTML
   are crawlable and correct on their own; this only keeps them current. */
(()=>{
  'use strict';
  const root=document.getElementById('home-articles');
  if(!root)return;
  const section=root.closest('.home-journal')||document;
  const viewport=root.closest('.journal-viewport');
  const controls=section.querySelector('.journal-controls');
  const previous=section.querySelector('[data-journal-prev]');
  const next=section.querySelector('[data-journal-next]');
  const dots=section.querySelector('[data-journal-dots]');
  const dotLabel=section.querySelector('[data-journal-dot-label]');
  const position=section.querySelector('.journal-position');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let current=0,labelled='';
  function rtlNow(){return getComputedStyle(root).direction==='rtl';}
  // One dot per scroll position a card can actually snap to, so every dot leads somewhere.
  function stops(count){
    const cards=[...root.children];
    const max=root.scrollWidth-root.clientWidth;
    if(max<=4||cards.length<2)return 1;
    // Subpixel card widths are common, so measure the step from rects, not rounded offsets.
    const first=cards[0].getBoundingClientRect();
    const step=Math.abs(cards[1].getBoundingClientRect().left-first.left)||first.width;
    if(step<1)return 1;
    return Math.min(count,Math.max(1,Math.floor((max+2)/step)+1));
  }
  function renderDots(total){
    const label=dotLabel?dotLabel.textContent.trim():'';
    if(dots.children.length!==total||labelled!==label){
      labelled=label;
      const fragment=document.createDocumentFragment();
      for(let i=0;i<total;i++){
        const dot=document.createElement('button');
        dot.type='button';dot.className='journal-dot';
        dot.setAttribute('aria-label',(label?label+' ':'')+(i+1));
        dot.setAttribute('aria-controls','home-articles');
        dot.addEventListener('click',()=>goTo(i));
        fragment.append(dot);
      }
      dots.replaceChildren(fragment);
    }
    [...dots.children].forEach((dot,index)=>{
      if(index===current)dot.setAttribute('aria-current','true');
      else dot.removeAttribute('aria-current');
    });
  }
  function update(){
    const cards=[...root.children];
    const rtl=rtlNow();
    const box=root.getBoundingClientRect();
    let distance=Infinity;
    cards.forEach((card,index)=>{
      const rect=card.getBoundingClientRect();
      const delta=Math.abs(rtl?box.right-rect.right:rect.left-box.left);
      if(delta<distance){distance=delta;current=index;}
    });
    const overflow=root.scrollWidth>root.clientWidth+4;
    controls.hidden=!overflow;
    if(viewport)viewport.classList.toggle('is-scrollable',overflow);
    root.tabIndex=overflow?0:-1;
    const first=cards[0]?.getBoundingClientRect();
    const last=cards.at(-1)?.getBoundingClientRect();
    if(!first||!last)return;
    previous.disabled=rtl?first.right<=box.right+4:first.left>=box.left-4;
    next.disabled=rtl?last.left>=box.left-4:last.right<=box.right+4;
    const total=stops(cards.length);
    if(current>total-1)current=total-1;
    renderDots(total);
    position.textContent=(current+1)+' / '+cards.length;
  }
  function goTo(index){
    const cards=[...root.children];
    const card=cards[Math.max(0,Math.min(cards.length-1,index))];
    if(!card)return;
    const box=root.getBoundingClientRect();
    const rect=card.getBoundingClientRect();
    root.scrollBy({left:rtlNow()?rect.right-box.right:rect.left-box.left,behavior:reduced.matches?'instant':'smooth'});
  }
  const move=step=>goTo(current+step);
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  root.addEventListener('scroll',update,{passive:true});
  root.addEventListener('keydown',event=>{
    if(event.target!==root||!['ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    move((event.key==='ArrowRight'?1:-1)*(rtlNow()?-1:1));
  });
  new ResizeObserver(update).observe(root);
  new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['dir','lang']});
  update();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  fetch('/blog/articles.json',{signal:controller.signal,credentials:'omit'})
    .then(r=>{if(!r.ok)throw new Error('Feed unavailable');return r.json();})
    .then(articles=>{
      if(!Array.isArray(articles))return;
      const valid=articles.filter(a=>a&&typeof a.title==='string'&&typeof a.slug==='string'&&a.slug&&typeof a.excerpt==='string'&&Number.isFinite(Date.parse(a.isoDate)));
      valid.sort((a,b)=>Date.parse(b.isoDate)-Date.parse(a.isoDate));
      if(!valid.length)return;
      const fragment=document.createDocumentFragment();
      valid.slice(0,12).forEach(a=>{
        const card=document.createElement('a');
        card.className='journal-card';card.lang='he';card.dir='rtl';
        card.href='/blog/'+encodeURIComponent(a.slug)+'/';
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
