// Generate the Hebrew public page from the shared calendar markup and dictionary.
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dict=JSON.parse(fs.readFileSync(path.join(root,'calendar/he/strings.json'),'utf8'));
let html=fs.readFileSync(path.join(root,'calendar/index.html'),'utf8');
const t=value=>dict[value.replaceAll('&amp;','&')]||value;
html=html.replace('<html lang="en">','<html lang="he" dir="rtl">').replace(/<title>.*?<\/title>/,'<title>יומן פגישות חינמי עם סנכרון יומנים | Red Crown Calendar</title>');
html=html.replace(/<meta name="description"[^>]*>/,'<meta name="description" content="יומן פגישות חינמי לניהול זמינות, סנכרון עם יומנים קיימים ושיתוף קישור לקביעת פגישות. הגדירו שעות עבודה, משכי פגישות ומרווחים עם Red Crown Calendar.">');
html=html.replace('rel="canonical" href="https://redcrowninteractive.com/calendar/"','rel="canonical" href="https://redcrowninteractive.com/calendar/he/"');
html=html.replace('hreflang="en" aria-current="page"','hreflang="en"').replace('lang="he" hreflang="he">','lang="he" hreflang="he" aria-current="page">');
html=html.replace(/>([^<>]+)</g,(all,text)=>'>'+text.replace(text.trim(),t(text.trim()))+'<');
html=html.replace(/(placeholder|aria-label|title)="([^"]+)"/g,(all,key,value)=>key+'="'+t(value)+'"');
html=html.replace('</head>','<meta property="og:locale" content="he_IL"><meta property="og:title" content="יומן פגישות חינמי | Red Crown Calendar"><meta property="og:description" content="תיאום פגישות, ניהול זמינות וסנכרון עם יומנים קיימים."><meta property="og:url" content="https://redcrowninteractive.com/calendar/he/"><script defer src="/calendar/he/home-language.js"></script></head>');
// The account workspace and legal policies are still in English.
html=html.replace('<h2 id="entry-title">','<p class="language-scope-note">ממשק ניהול היומן והמסמכים המשפטיים זמינים כרגע באנגלית.</p><h2 id="entry-title">');
const target=path.join(root,'calendar/he/index.html');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==html)throw Error('Run node tools/build-calendar-he.cjs');}else fs.writeFileSync(target,html);
