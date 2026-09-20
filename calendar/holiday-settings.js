window.CrownHolidays = {
 create(timezone) {
  const he=document.documentElement.lang.startsWith('he'),t=(en,hebrew)=>he?hebrew:en;
  const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  const box=make('div');box.className='holiday-import';box.lang=he?'he':'en';box.dir=he?'rtl':'ltr';
  const enabled=make('input');enabled.type='checkbox';enabled.id='holidays-enabled';
  const toggle=make('label',t('Automatically sync public holidays','סנכרון אוטומטי של חגים רשמיים'));toggle.className='holiday-toggle';toggle.prepend(enabled);
  const country=make('select');country.id='holidays-country';
  const label=make('label',t('Holiday country','מדינה לחגים רשמיים'));label.htmlFor=country.id;label.append(country);
  const status=make('p');status.className='sync-small';status.setAttribute('role','status');
  const help=make('p',t('National public holidays close the full day in your scheduling time zone, including future years. Date overrides take priority. State/local holidays and holiday eves are not included.','חגים רשמיים ארציים חוסמים את היום המלא באזור הזמן של היומן, גם בשנים הבאות. הגדרות לתאריך מסוים מקבלות עדיפות. חגים מקומיים וערבי חג אינם כלולים.'));help.className='sync-small';
  const source=make('a',t('Holiday data','מקור נתוני החגים'));source.href='https://github.com/commenthol/date-holidays';source.target='_blank';source.rel='noopener';help.append(' ',source);
  box.append(toggle,label,status,help);document.querySelector('.holiday-import').replaceWith(box);
  const summary=make('button');summary.type='button';summary.className='auth-link';summary.lang=box.lang;
  document.querySelector('#open-availability-settings').parentElement.after(summary);
  summary.addEventListener('click',()=>document.querySelector('#open-availability-settings').click());
  let settings={enabled:false,country:'auto'},options=null,generation=0,savedSettings=settings,savedZone='UTC';
  const names=new Intl.DisplayNames([he?'he':'en'],{type:'region'});
  const name=code=>{try{return names.of(code);}catch{return code;}};
  function render(){
   const selected=settings.country;country.replaceChildren();
   const auto=make('option',t('Follow time zone','לפי אזור הזמן')+(options?.detected?` (${name(options.detected)})`:''));auto.value='auto';country.append(auto);
   for(const item of [...(options?.countries||[])].sort((a,b)=>name(a.code).localeCompare(name(b.code),he?'he':'en'))){const option=make('option',name(item.code)||item.name);option.value=item.code;country.append(option);}
   if(selected!=='auto'&&![...country.options].some(o=>o.value===selected)){const option=make('option',name(selected));option.value=selected;country.append(option);}
   country.value=selected;enabled.checked=settings.enabled;country.disabled=!settings.enabled;
   const resolved=selected==='auto'?options?.detected:selected;
   status.textContent=!settings.enabled?t('Automatic public holidays are off.','סנכרון חגים אוטומטי כבוי.'):!options?t('Loading holiday countries...','טוען מדינות לחגים...'):resolved?t(`Syncing ${name(resolved)} public holidays automatically.`,`סנכרון אוטומטי של חגים רשמיים: ${name(resolved)}.`):t('This time zone does not identify one supported country. Choose your holiday country.','אזור הזמן אינו מזהה מדינה נתמכת אחת. בחרו מדינה לחגים.');
  }
  async function load(){
   const request=++generation;options=null;render();
   try{
    const result=await window.CrownAPI.request('/holiday-options?timezone='+encodeURIComponent(timezone.value));
    if(request!==generation)return;options=result;render();
    if(settings.country===savedSettings.country&&settings.enabled===savedSettings.enabled&&timezone.value===savedZone)summary.textContent=status.textContent+' '+t('Configure','הגדרות');
   }catch{if(request===generation){status.textContent=t('Holiday countries could not load. Reopen settings to retry.','לא ניתן לטעון מדינות. פתחו שוב את ההגדרות כדי לנסות מחדש.');summary.textContent=status.textContent;}}
  }
  enabled.addEventListener('change',()=>{settings.enabled=enabled.checked;render();});
  country.addEventListener('change',()=>{settings.country=country.value;render();});
  timezone.element.addEventListener('timezonechange',load);
  return {
   apply(data){savedSettings={...(data.holidays||{enabled:false,country:'auto'})};settings={...savedSettings};savedZone=data.timezone||timezone.value;summary.textContent=t('Public holidays: loading settings...','חגים רשמיים: טוען הגדרות...');load();},
   read(){if(settings.enabled&&settings.country==='auto'&&!options?.detected)throw Error(t('Choose a country to sync public holidays.','בחרו מדינה לסנכרון חגים רשמיים.'));return {...settings};}
  };
 }
};
