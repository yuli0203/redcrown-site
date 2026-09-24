/* Show the Red Crown journal on any site: drop a <div id="redcrown-journal">
   in the page and load this. It reads the same feed the homepage uses, renders
   text-only cards, and links to the full article - no iframe, no styles
   imposed on the host page beyond the widget's own scope. */
(()=>{
  'use strict';
  const root=document.getElementById('redcrown-journal');
  if(!root)return;
  const origin=new URL(document.currentScript?.src||'https://redcrowninteractive.com/blog/embed.js').origin;
  const limit=Number(root.dataset.limit)||6;
  const dark=root.dataset.theme!=='light';
  const style=document.createElement('style');
  style.textContent=`#redcrown-journal{display:flex;flex-direction:column;gap:16px;font-family:inherit;direction:rtl}
#redcrown-journal a{display:block;padding:22px;border:1px solid ${dark?'rgba(240,234,228,.12)':'rgba(14,8,10,.12)'};border-inline-start:3px solid #76232f;border-radius:16px;text-decoration:none;color:inherit;background:${dark?'#1a1013':'#fff'}}
#redcrown-journal a:hover{border-inline-start-color:#c8102e}
#redcrown-journal time{font-size:13px;opacity:.7}
#redcrown-journal h3{margin:8px 0;font-size:19px;line-height:1.35}
#redcrown-journal p{margin:0;font-size:15px;line-height:1.7;opacity:.8}`;
  root.append(style);
  fetch(origin+'/blog/articles.json',{credentials:'omit'})
    .then(response=>{if(!response.ok)throw new Error('feed unavailable');return response.json();})
    .then(articles=>{
      const fragment=document.createDocumentFragment();
      articles.slice(0,limit).forEach(article=>{
        const card=document.createElement('a');
        card.href=origin+article.url;card.lang='he';card.dir='rtl';
        const date=document.createElement('time');date.dateTime=article.isoDate;
        date.textContent=new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(new Date(article.isoDate));
        const title=document.createElement('h3');title.textContent=article.title;
        const excerpt=document.createElement('p');excerpt.textContent=article.excerpt;
        card.append(date,title,excerpt);fragment.append(card);
      });
      root.append(fragment);
    })
    .catch(()=>{});
})();
