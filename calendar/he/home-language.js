(async()=>{
 const response=await fetch('/calendar/he/strings.json');if(!response.ok)return;const dict=await response.json();
 const selectors=['.entry-card','.footer-signin','#auth-message','#workspace-auth-status','#feedback-status','#calendar-tip-note','#calendar-feedback-form button','#theme-toggle'];
 function translate(){for(const selector of selectors)for(const root of document.querySelectorAll(selector)){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){const key=node.textContent.trim();if(dict[key])node.textContent=node.textContent.replace(key,dict[key]);}
  for(const key of ['aria-label','title']){const value=root.getAttribute(key);if(dict[value])root.setAttribute(key,dict[value]);}
 }}
 translate();const observer=new MutationObserver(()=>{observer.disconnect();translate();observe();});
 function observe(){for(const selector of selectors)for(const root of document.querySelectorAll(selector))observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});}observe();
})();
