from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1]

PAGES = [
    dict(slug="vr-development", title="פיתוח מציאות מדומה לעסקים", eyebrow="פיתוח מציאות מדומה ורבודה בהתאמה לארגון", lead="הפכו הדרכה, המחשה או ניסוי מורכב לחוויה שאנשים יכולים להבין, לתרגל ולהפעיל. נבנה מערכת יציבה מהאפיון ועד ההטמעה — לא רק הדגמת טכנולוגיה.", project="VR / מציאות משולבת", project_type="XR", hero="/assets/lioness/vr.webp", hero_model="/assets/models/meta_quest_3_opt.glb", image="/assets/work-vr-fugacity.jpg?v=20260814", case="מעבדה וירטואלית פעילה, שפותחה עבור הטכניון, ומאפשרת לסטודנטים לתרגל ניסוי מורכב בסביבה בטוחה ומבוקרת.", bullets=["פיתוח למשקפי מציאות מדומה ומציאות משולבת", "חיבור למערכות, נתונים ותהליכים קיימים", "פיילוט ממוקד לפני הרחבה מלאה"], uses=[("הדרכה ותרגול","תרחישים אינטראקטיביים עם משוב, מדידה ושליטה למדריכים."),("המחשת מוצר","הצגת מערכות, חללים ותהליכים שאי אפשר להביא לחדר."),("מחקר וניסויים","סביבה מבוקרת לאיסוף נתונים ולשחזור עקבי של תרחישים.")]),
    dict(slug="training-simulations", title="סימולציות הדרכה לעובדים", eyebrow="תרגול מורכב בלי לסכן אנשים, ציוד או זמן ייצור", lead="אפשרו לעובדים לתרגל החלטות ותהליכים שוב ושוב, ולמדריכים לראות התקדמות — בלי לעצור עבודה ובלי לסכן אנשים או ציוד.", project="סימולציות והדרכה", project_type="XR", hero="/assets/lioness/vr.webp", hero_model="/assets/models/meta_quest_3_opt.glb", image="/assets/work-class-setup.jpg?v=20260814", case="מערכת כיתתית פעילה שפותחה עבור הטכניון, עם עד 12 משקפיים, הפעלה מרוכזת וכלים למדריך.", bullets=["תרחישים, ניקוד ומשוב לפי יעדי ההדרכה", "מערכת ניהול והפעלה למדריכים", "הטמעה מדורגת בארגון"], uses=[("בטיחות ותפעול","תרגול מצבי קיצון ונהלים בלי לעצור קו או לסכן עובד."),("הכשרת עובדים","חזרה עקבית על תהליך עד להשגת רמת ביצוע נדרשת."),("מעבדות וכיתות","הפעלה סימולטנית, שליטה בתוכן ותמיכה במדריך.")]),
    dict(slug="interactive-3d", title="פיתוח תוכנה אינטראקטיבית בתלת־ממד", eyebrow="גרפיקה והנדסת תוכנה שנבנות כמוצר אחד", lead="הפכו מידע, מוצר או תהליך מורכב לכלי חזותי שאפשר להבין ולהפעיל. נבנה את הקוד, הממשק והתלת־ממד כמוצר אחד, יציב ומהיר.", project="תלת־ממד ותוכנה", project_type="PC", hero="/assets/lioness/pc.webp", hero_model="/assets/models/robi_opt.glb", image="/assets/work-ar-enzymatic.jpg?v=20260814", case="מערכת אינטראקטיבית שמחברת מודל תלת־ממדי, חישוב מדעי וחוויית שימוש ברורה.", bullets=["ארכיטקטורה שניתנת להרחבה", "אופטימיזציה לחומרת היעד", "חיבור למידע, שירותים וחישובים"], uses=[("הדמיה הנדסית","הפיכת מידע ומבנים מורכבים לכלי שאפשר לחקור ולהפעיל."),("קונפיגורטורים","הצגת אפשרויות מוצר ותוצאות באופן חזותי ואינטראקטיבי."),("כלים מקצועיים","ממשקים תלת־ממדיים לעבודה, בדיקה, תכנון וקבלת החלטות.")]),
    dict(slug="research-software", title="פיתוח תוכנה למחקר והנדסה", eyebrow="ממודל מדעי לכלי שאנשים באמת יכולים להשתמש בו", lead="אפשרו לחוקרים לחקור, להשוות ולהסביר תוצאות בלי להילחם בכלי העבודה. נחבר חישוב, נתונים ותלת־ממד למערכת מדויקת ונוחה לשימוש.", project="תוכנה למחקר", project_type="PC", hero="/assets/lioness/pc.webp", hero_model="/assets/models/caffeine2_opt.glb", image="/assets/work-ml-livemol.jpg?v=20260814", case="כלי מחקר חזותי שמחבר חישוב מדעי ותצוגת מולקולות אינטראקטיבית בסביבת עבודה אחת.", bullets=["חיבור בין חישוב מדעי לממשק אינטראקטיבי", "כלים למעבדות, מוסדות וחברות הנדסיות", "תכנון לניסוי, הדגמה או שימוש מתמשך"], uses=[("כלי מחקר חזותיים","הצגת תוצאות ומודלים בצורה שאפשר לחקור, להשוות ולהסביר."),("מערכות ניסוי","שליטה בפרוטוקול, תרחישים ואיסוף נתונים באופן עקבי."),("המחשה מדעית","הפיכת חישובים מורכבים לחוויה ברורה לחוקרים ולבעלי עניין.")]),
    dict(slug="medical-prototypes", title="פיתוח אבות־טיפוס רפואיים", eyebrow="מ־MedTech מורכב לאב־טיפוס שאפשר לראות, להפעיל ולבחון", lead="הפכו רעיון למכשור רפואי, תוכנה קלינית או הדמיה מדעית לאב־טיפוס אינטראקטיבי שאפשר לבחון עם אנשי מקצוע — לפני שמשקיעים במערכת מלאה.", project="אבות־טיפוס רפואיים", project_type="PC", hero="/assets/lioness/pc.webp", hero_model="/assets/models/enzym_opt.glb", image="/assets/codex-epd-philips.png?v=20260814", case="ניסיון אישי בפיתוח CODEX EPD ב־Philips — מערכת רפואית תלת־ממדית מורכבת שתומכת בעבודה קלינית מדויקת דרך המחשה אינטראקטיבית של מידע אנטומי.", bullets=["אב־טיפוס פונקציונלי לבדיקת זרימת העבודה", "תלת־ממד והמחשה מדעית למידע רפואי מורכב", "בסיס הנדסי ברור להמשך פיתוח המוצר"], uses=[("כשהרעיון חייב להפוך למשהו שאפשר לבדוק","בונים את התרחיש המרכזי כאב־טיפוס פעיל, כדי לקבל משוב מאנשי מקצוע לפני פיתוח מלא."),("כשהמידע הרפואי מורכב מדי למסך שטוח","מחברים נתונים, אנטומיה ותלת־ממד לממשק שמאפשר להבין יחסים מרחביים ולפעול בביטחון."),("כשצריך ליישר קו בין רפואה, מוצר והנדסה","יוצרים מערכת מוחשית שמאפשרת לצוותים לבדוק יחד החלטות, מגבלות וסדרי עדיפויות.")]),
    dict(slug="startup-mvp-poc", title="פיתוח MVP ו־POC לסטארטאפים", eyebrow="מרעיון למוצר שאפשר להדגים, לבדוק ולקדם", lead="הפכו רעיון למוצר עובד שממחיש את הערך המרכזי מול לקוחות, שותפים ומשקיעים — בלי לבנות מוקדם מדי מערכת גדולה ויקרה.", project="MVP / POC לסטארטאפים", project_type="PC", hero="/assets/lioness/pc.webp", hero_model="/assets/models/robi_opt.glb", image="/assets/work-ml-livemol.jpg?v=20260814", case="LiveMol נבנה עבור הטכניון: רעיון למוצר תוכנה חזותי שהפך לכלי אינטראקטיבי עובד, המחבר חישוב, תלת־ממד וחוויית משתמש במערכת אחת.", bullets=["תרחיש מרכזי עובד במקום מצגת בלבד", "ארכיטקטורה שמתאימה לשלב ולתקציב", "בסיס ברור ללמידה, גיוס והמשך פיתוח"], uses=[("כשצריך להוכיח שהרעיון עובד","בונים POC ממוקד שבודק את הסיכון הטכנולוגי או חוויית השימוש החשובה ביותר."),("כשצריך להציג מוצר ולא רק חזון","יוצרים MVP שאפשר להדגים ללקוחות, שותפים ומשקיעים ולקבל עליו משוב אמיתי."),("כשצריך להתקדם מהר בלי לצבור חוב מיותר","מגדירים מה חייב להיכנס לגרסה הראשונה ומה נכון להשאיר לשלב הבא.")]),
]

TEMPLATE = '''<!doctype html><html lang="he" dir="rtl" data-page-lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0e080a">
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18313532220"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag('js',new Date());gtag('config','AW-18313532220');</script>
<title>{title} | Red Crown Interactive</title><meta name="description" content="{description}"><link rel="canonical" href="https://redcrowninteractive.com/he/{slug}/"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/site.css"><link rel="stylesheet" href="/he/solutions.css?v=20260814-4">
<meta property="og:title" content="{title}"><meta property="og:description" content="{description}"><meta property="og:url" content="https://redcrowninteractive.com/he/{slug}/"><meta property="og:image" content="https://redcrowninteractive.com/og-image.png"><meta property="og:type" content="website">
<script type="application/ld+json">{{"@context":"https://schema.org","@type":"Service","name":"{title}","provider":{{"@type":"Organization","name":"Red Crown Interactive","url":"https://redcrowninteractive.com/"}},"areaServed":"IL","url":"https://redcrowninteractive.com/he/{slug}/"}}</script></head><body class="campaign-page">
<a class="skip-link" href="#main">דילוג לתוכן הראשי</a>
<header class="top-shell"><div class="wrap top"><a class="brand" href="/he/" aria-label="Red Crown Interactive"><img src="/assets/logo-kit/redcrown-solid-scarlet.svg" alt=""><span><b>RED CROWN</b><small>INTERACTIVE</small></span></a><nav aria-label="ניווט"><a href="#solutions">פתרונות</a><a href="#case">ניסיון</a><a href="#contact">בדיקת היתכנות</a></nav></div></header>
<main><section class="hero-shell"><div class="hero-grid"></div><div class="hero-glow"></div><div class="wrap hero"><div class="hero-copy"><div class="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{lead}</p><ul class="hero-benefits">{bullets}</ul>{ar_service_note}<div class="hero-actions"><a class="btn" href="#contact">לשיחת היתכנות קצרה</a><span class="quiet">ללא התחייבות · שיחה ישירה עם מי שמאפיינת ומפתחת בפועל</span></div></div><div class="hero-stage">{hero_visual}</div></div><div class="scroll-cue">גלו עוד <i></i></div></section>
<div class="trust"><div class="wrap"><span>עבודה מקצועית ופרויקטים עם</span><div class="trust-logos"><img src="/assets/Companies/technion_w.png" alt="הטכניון"><img src="/assets/Companies/philips_w.png" alt="Philips"><img src="/assets/Companies/playtika_w.png" alt="Playtika"><img src="/assets/Companies/tel_aviv_university_w.png" alt="אוניברסיטת תל אביב"><img src="/assets/Companies/israelnavy_w.png" alt="חיל הים"></div></div></div>
<section class="wrap" id="solutions"><h2 class="section-title">{solutions_title}</h2><p class="section-lead">{solutions_lead}</p><div class="cards">{uses}</div></section>
<section class="wrap case" id="case"><img src="{image}" alt="{image_alt}" loading="lazy"><div><div class="eyebrow">ניסיון רלוונטי · {project}</div><h2 class="section-title">מערכת אמיתית, לא הבטחה שיווקית</h2><p class="section-lead">{case}</p><p class="case-outcome"><strong>מה זה מאפשר</strong>{case_outcome}</p><ul>{case_bullets}</ul></div></section>
<section class="wrap journey" id="journey"><div class="journey-head"><div class="eyebrow">{journey_eyebrow}</div><h2 class="section-title">המסע שלכם איתנו</h2><p class="section-lead">בכל שלב ברור מה בודקים, מה מאשרים וכמה נכון להשקיע לפני שמתקדמים.</p></div><div class="journey-track" aria-label="שלבי הפרויקט"><div class="journey-line"><i></i><b><span></span></b></div><article class="journey-step" data-step="1"><span class="journey-number">01</span><div><small>אתם מגיעים עם</small><h3>רעיון או אתגר</h3><p>גם אם עדיין אין מפרט, פלטפורמה או פתרון מוגדר.</p></div></article><article class="journey-step" data-step="2"><span class="journey-number">02</span><div><small>יחד מגדירים</small><h3>היתכנות וכיוון</h3><p>משתמשים, תרחיש מרכזי, סיכונים ומדד הצלחה.</p></div></article><article class="journey-step" data-step="3"><span class="journey-number">03</span><div><small>אנחנו מוכיחים</small><h3>{journey_step3_title}</h3><p>{journey_step3_text}</p></div></article><article class="journey-step" data-step="4"><span class="journey-number">04</span><div><small>אתם מקבלים</small><h3>{journey_step4_title}</h3><p>{journey_step4_text}</p></div></article></div><div class="journey-outcome"><span>התוצאה</span><b>{journey_outcome}</b></div></section>
<section class="wrap" id="contact"><div class="contact contact-grid"><div class="contact-intro"><div class="eyebrow">שיחת התאמה ללא התחייבות</div><h2>{contact_title}</h2><p>{contact_lead}</p><ul class="contact-assurance"><li>לא צריך להכין מסמך דרישות</li><li>אין צורך לבחור טכנולוגיה מראש</li><li>{fit_promise}</li></ul><canvas class="crown-particles" aria-hidden="true"></canvas></div><form class="contact-form" action="https://api.web3forms.com/submit" method="POST"><input type="hidden" name="access_key" value="35f8e692-deb5-4865-86a3-7a4be79eb90b"><input type="hidden" name="subject" value="Lead from {slug}"><input type="hidden" name="from_name" value="Red Crown Interactive website"><input type="hidden" name="landing_page" value="{slug}"><input type="hidden" name="utm_source"><input type="hidden" name="utm_campaign"><input type="hidden" name="utm_content"><input type="hidden" name="gclid"><input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true"><label class="field"><span>שם</span><input type="text" name="name" autocomplete="name" placeholder="השם שלכם" required></label><label class="field"><span>אימייל</span><input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@company.com" required></label><label class="field"><span>חברה (אופציונלי)</span><input type="text" name="company" autocomplete="organization" placeholder="החברה שלכם"></label><label class="field"><span>כבר יש כיוון לפלטפורמה?</span><select name="project">{project_options}</select></label><label class="field"><span>במשפט אחד, מה תרצו לאפשר? (אופציונלי)</span><textarea name="message" rows="3" placeholder="{message_placeholder}"></textarea></label><button class="btn" type="submit">בדיקת התאמה לפרויקט</button><p class="form-privacy">הפרטים משמשים רק כדי לחזור אליכם בנוגע לפרויקט.</p><p class="form-msg form-ok" hidden>תודה! אחזור אליכם בקרוב.</p><p class="form-msg form-err" hidden>משהו השתבש. אפשר לכתוב ל־hello@redcrowninteractive.com.</p></form></div></section></main>
<footer class="wrap">Red Crown Interactive · חיפה · <a href="mailto:hello@redcrowninteractive.com">hello@redcrowninteractive.com</a> · <a href="/he/legal/">פרטיות ונגישות</a></footer><a class="wa" href="https://wa.me/972585760550?text={wa}" target="_blank" rel="noopener">WhatsApp</a>
<script src="/site.js?v=20260814-1"></script><script src="/model-cards.js?v=20260814-2" defer></script><script src="/landing-motion.js?v=20260813-3" defer></script><script src="/crown-particles.js" defer></script><script>const q=new URLSearchParams(location.search);for(const n of ['utm_source','utm_campaign','utm_content','gclid']){{const e=document.querySelector(`[name="${{n}}"]`);if(e)e.value=q.get(n)||''}}window.addEventListener('DOMContentLoaded',()=>window.RCModels?.load())</script><script data-goatcounter="https://redcrowninteractive.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script></body></html>'''

for p in PAGES:
    situations = {
        "vr-development": [("כשהתרגול האמיתי מסוכן או יקר", "מאפשרים לאנשים להתנסות, לטעות ולחזור על תרחיש מורכב בסביבה בטוחה ומבוקרת."), ("כשהמוצר מורכב מדי למצגת", "נותנים ללקוח להיכנס למערכת, להבין אותה ולחוות אותה גם כשאי אפשר להביא אותה לחדר."), ("כשניסוי חייב להיות עקבי ומדיד", "משחזרים את אותו תרחיש, שולטים בתנאים ואוספים נתונים בצורה מסודרת.")],
        "training-simulations": [("כשאי אפשר לעצור את העבודה כדי לתרגל", "מתרגלים תהליך מורכב בלי להשבית קו, לסכן עובד או לפגוע בציוד."), ("כשהעובדים מכירים את הנוהל אך מתקשים לבצע", "הופכים ידע תאורטי להתנסות פעילה עם משוב וחזרה עד לביצוע בטוח."), ("כשהמדריך צריך לדעת מי באמת מוכן", "רואים התקדמות, מזהים טעויות וממקדים את ההדרכה במקום שבו היא נחוצה.")],
        "interactive-3d": [("כשקשה להבין מידע מורכב על מסך שטוח", "הופכים מבנים, נתונים ותהליכים לכלי חזותי שאפשר לחקור ולהפעיל."), ("כשהלקוח צריך לראות מוצר לפני שהוא קיים", "מאפשרים לבחון אפשרויות ולהבין את התוצאה לפני ייצור או התקנה."), ("כשהצוות צריך כלי מקצועי, לא עוד הדמיה", "מחברים תלת־ממד, חישוב וממשק למערכת שעוזרת לבצע עבודה ולקבל החלטות.")],
        "research-software": [("לראות את מה שהנתונים עדיין לא מגלים", "להפוך תוצאות ומודלים לתמונה חיה שאפשר לחקור — ולזהות בה קשרים שקשה לראות בטבלאות."), ("להגיע לתוצאה שאפשר לסמוך עליה", "לחזור על אותו ניסוי בתנאים ברורים, להשוות תוצאות ולדעת בדיוק מה השתנה."), ("להפוך מורכבות לרגע של הבנה", "לתת לחוקרים, לשותפים ולמקבלי החלטות לחקור את המודל יחד ולהבין מדוע התוצאה חשובה.")],
        "medical-prototypes": [("כשהרעיון חייב להפוך למשהו שאפשר לבדוק", "בונים את התרחיש המרכזי כאב־טיפוס פעיל, כדי לקבל משוב מאנשי מקצוע לפני פיתוח מלא."), ("כשהמידע הרפואי מורכב מדי למסך שטוח", "מחברים נתונים, אנטומיה ותלת־ממד לממשק שמאפשר להבין יחסים מרחביים ולפעול בביטחון."), ("כשצריך ליישר קו בין רפואה, מוצר והנדסה", "יוצרים מערכת מוחשית שמאפשרת לצוותים לבדוק יחד החלטות, מגבלות וסדרי עדיפויות.")],
        "startup-mvp-poc": [("כשצריך להוכיח שהרעיון עובד", "בונים POC ממוקד שבודק את הסיכון הטכנולוגי או חוויית השימוש החשובה ביותר."), ("כשצריך להציג מוצר ולא רק חזון", "יוצרים MVP שאפשר להדגים ללקוחות, שותפים ומשקיעים ולקבל עליו משוב אמיתי."), ("כשצריך להתקדם מהר בלי לצבור חוב מיותר", "מגדירים מה חייב להיכנס לגרסה הראשונה ומה נכון להשאיר לשלב הבא.")],
    }[p['slug']]
    case_outcomes = {
        "vr-development": "במקום רק לצפות בהסבר, הסטודנטים מבצעים את התהליך בעצמם ויכולים ללמוד גם מטעויות בסביבה מבוקרת.",
        "training-simulations": "המדריך מפעיל תרגול כיתתי מרוכז, והלומדים מתנסים באותו תרחיש בלי לאבד שליטה על הקצב והתוכן.",
        "interactive-3d": "המשתמש לא רק רואה מודל — הוא חוקר מידע, מפעיל תהליכים ומקבל החלטות בתוך אותו כלי.",
        "research-software": "החוקר יכול לעבור מחישוב לתצוגה ולחקירה אינטראקטיבית בלי לפצל את העבודה בין כלים מנותקים.",
        "medical-prototypes": "צוותי רפואה, מוצר והנדסה יכולים לבחון יחד את זרימת העבודה, ההמחשה והאינטראקציה לפני שמתחייבים לפיתוח המערכת המלאה.",
        "startup-mvp-poc": "המייסדים מקבלים מוצר שאפשר להפעיל ולהציג, יחד עם תובנות שמאפשרות לבחור בביטחון מה לבנות בשלב הבא.",
    }
    card_icons = [
        '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><path d="M24 3v8M24 37v8M3 24h8M37 24h8"/></svg>',
        '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 5 16 9v20l-16 9-16-9V14z"/><path d="m8 14 16 9 16-9M24 23v20"/></svg>',
        '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 39h34M10 34l9-10 7 6 12-17"/><circle cx="19" cy="24" r="2"/><circle cx="26" cy="30" r="2"/><circle cx="38" cy="13" r="2"/></svg>'
    ]
    card_cta = "בואו נהפוך את זה למוצר עובד ←" if p['slug'] == "startup-mvp-poc" else ("בואו נהפוך את זה לכלי עובד ←" if p['slug'] in {"research-software", "medical-prototypes"} else "זה דומה לאתגר שלנו ←")
    uses = ''.join(f'<a class="card" data-use-card href="#contact"><div class="card-top">{card_icons[i-1]}</div><h3>{escape(a)}</h3><p>{escape(b)}</p><b>{card_cta}</b></a>' for i,(a,b) in enumerate(situations,1))
    bullets = ''.join(f'<li>{escape(x)}</li>' for x in p['bullets'])
    project_choices = [("Open to recommendation", "פתוחים לבחירת הפלטפורמה המתאימה"), ("XR", "XR / VR / AR"), ("Mobile", "אפליקציה לנייד"), ("PC", "תוכנת מחשב / Desktop"), ("Web", "אפליקציית Web")]
    project_options = ''.join(
        f'<option value="{value}"{" selected" if value == "Open to recommendation" else ""}>{label}</option>'
        for value, label in project_choices
    )
    description = p['lead'][:155]
    wa = escape(f"שלום, אני מתעניין/ת ב{p['title']}").replace(' ', '%20')
    context = {k: v for k, v in p.items() if k not in {'uses', 'bullets'}}
    context['ar_service_note'] = '<p>אנו מתמחים בפיתוח סימולציות בטכנולוגיות <strong>מציאות רבודה (AR)</strong>, מציאות מדומה (VR) ומציאות מעורבת (MR) עבור משקפי Meta Quest 3 ומכשירים ניידים.</p>' if p['slug'] == 'training-simulations' else ''
    context['image_alt'] = "מסך CODEX EPD מניסיון קודם בפיתוח ב־Philips" if p['slug'] == 'medical-prototypes' else ("מוצר LiveMol אינטראקטיבי בפיתוח Red Crown Interactive" if p['slug'] == 'startup-mvp-poc' else "פרויקט רלוונטי של Red Crown Interactive")
    context['hero_model_key'] = {'vr-development': 'quest3', 'training-simulations': 'quest3', 'interactive-3d': 'robi', 'research-software': 'caffeine', 'medical-prototypes': 'enzym', 'startup-mvp-poc': 'robi'}[p['slug']]
    context['hero_visual'] = f'<div class="stage-ring ring-a"></div><div class="stage-ring ring-b"></div><div class="wd-model-wrap" data-model="{context["hero_model_key"]}" data-alt="מודל תלת־ממד אינטראקטיבי עבור {escape(p["project"])}" data-zoom-label="הגדלה והקטנה של מודל התלת־ממד"></div><div class="stage-floor"></div><div class="stage-label"><b>3D בזמן אמת</b><span>גררו כדי לסובב</span></div>'
    if p['slug'] == 'startup-mvp-poc':
        context['hero_visual'] = '''<div class="mvp-product-visual" aria-label="תהליך אינטראקטיבי מרעיון ל-MVP עובד">
          <div class="mvp-window">
            <div class="mvp-window-bar"><i></i><i></i><i></i><span>גרסה ראשונה שאפשר לבדוק</span></div>
            <div class="mvp-window-body">
              <div class="mvp-core">
                <span>הליבה של המוצר</span>
                <p class="mvp-core-title">תרחיש מרכזי<br>שעובד באמת</p>
                <p>מוכן להדגמה, בדיקה ומשוב</p>
              </div>
            </div>
            <div class="mvp-roadmap" aria-label="שלבי הפיתוח מרעיון למוצר עובד">
              <div><span>01</span><b>רעיון ממוקד</b><small>בעיה שחשוב לפתור</small></div>
              <i></i>
              <div><span>02</span><b>הוכחת היתכנות</b><small>הסיכון המרכזי נבדק</small></div>
              <i></i>
              <div class="is-active"><span>03</span><b>MVP עובד</b><small>מוכן להדגמה ומשוב</small></div>
            </div>
          </div>
        </div><div class="stage-label mvp-label"><b>מיקוד · הוכחה · מוצר עובד</b><span>בונים רק את מה שמקדם את ההחלטה הבאה</span></div>'''
    context['case_outcome'] = case_outcomes[p['slug']]
    context['fit_promise'] = "אם VR אינו הפתרון הנכון, נגיד זאת" if p['slug'] in {'vr-development', 'training-simulations'} else "אם פלטפורמה אחרת מתאימה יותר, נגיד זאת"
    context['journey_eyebrow'] = "מהרעיון למערכת שעובדת בשטח"
    context['journey_step3_title'] = "פיילוט ממוקד"
    context['journey_step3_text'] = "חוויה מרכזית שמאפשרת לראות, לנסות וללמוד מוקדם."
    context['journey_step4_title'] = "מערכת והטמעה"
    context['journey_step4_text'] = "פיתוח מלא, בדיקות, הדרכה ותמיכה בהפעלה."
    context['journey_outcome'] = "מערכת שאנשים מבינים, משתמשים בה ומפיקים ממנה ערך"
    context['contact_title'] = "בדקו אם הרעיון שלכם ישים לפני שאתם משקיעים בפיתוח"
    context['contact_lead'] = "גם רעיון ראשוני מספיק. תדברו ישירות עם מי שמאפיינת ומפתחת בפועל, ותקבלו הערכה כנה של מה נכון לבדוק קודם."
    context['message_placeholder'] = "למשל: לאפשר לעובדים לתרגל תהליך מורכב בלי לעצור את העבודה."
    context['case_bullets'] = "<li>אפיון טכני וחוויית משתמש באותו תהליך</li><li>פיתוח, תלת־ממד ואופטימיזציה תחת אחריות אחת</li><li>מסירה, הדרכה ותמיכה בהטמעה</li>"
    if p['slug'] == 'startup-mvp-poc':
        context['journey_eyebrow'] = "מרעיון לראיה שאפשר להציג"
        context['journey_step3_title'] = "POC או MVP ממוקד"
        context['journey_step3_text'] = "בונים את הליבה שמוכיחה היתכנות או מאפשרת לקבל משוב ממשתמשים."
        context['journey_step4_title'] = "מוצר ותכנית המשך"
        context['journey_step4_text'] = "מקבלים גרסה עובדת, ממצאים ברורים והחלטות לגרסה הבאה."
        context['journey_outcome'] = "מוצר שאפשר להציג, לבדוק ולבסס עליו את הצעד העסקי הבא"
        context['contact_title'] = "בואו נבדוק מה צריך לבנות כדי להתקדם"
        context['contact_lead'] = "ספרו מה אתם רוצים להוכיח ולמי. נמקד את גרסת ה־MVP או ה־POC שתיתן לכם את הראיה החשובה ביותר בלי לנפח את ההיקף."
        context['message_placeholder'] = "למשל: להציג למשקיעים תרחיש עובד ולבדוק אותו עם שלושה לקוחות ראשונים."
        context['case_bullets'] = "<li>מוצר, חוויית משתמש והנדסה באותו תהליך</li><li>היקף ממוקד שמשרת שאלה עסקית ברורה</li><li>קוד, תיעוד ותכנית מסודרת להמשך</li>"
    if p['slug'] == 'research-software':
        context['solutions_title'] = "כשהמחקר הופך למשהו שאפשר לראות, לחקור ולהסביר"
        context['solutions_lead'] = "במקום לעבור בין קוד, טבלאות וכלים מנותקים, אפשר לרכז את החישוב והחקירה בסביבה אחת שמובילה מהר יותר להבנה."
    elif p['slug'] == 'medical-prototypes':
        context['solutions_title'] = "בודקים את המוצר הרפואי במקום רק להסביר אותו"
        context['solutions_lead'] = "אב־טיפוס אינטראקטיבי מאפשר לצוותים מקצועיים לראות את זרימת העבודה, לגעת בנקודות המורכבות ולגלות מוקדם מה דורש שינוי."
    elif p['slug'] == 'startup-mvp-poc':
        context['solutions_title'] = "בונים בדיוק את מה שצריך כדי לקבל את ההחלטה הבאה"
        context['solutions_lead'] = "POC מוכיח היתכנות. MVP בודק ערך עם משתמשים. נגדיר יחד מה צריך להראות, למי, ואיזו ראיה תאפשר לכם להתקדם ללקוח, למשקיע או לגרסה הבאה."
    else:
        context['solutions_title'] = "מתחילים מהתוצאה שאתם צריכים"
        context['solutions_lead'] = "נבין מה המשתמש צריך לעשות, להבין או לתרגל. רק אחר כך נבחר אם הפתרון הנכון הוא מחשב, נייד, מציאות מדומה או מערכת משולבת."
    html = TEMPLATE.format(**context, uses=uses, bullets=bullets, project_options=project_options, description=escape(description), wa=wa)
    # Accessibility attributes are applied centrally so every generated campaign
    # page shares the same landmarks and assistive-technology announcements.
    html = html.replace('<main>', '<main id="main" tabindex="-1">', 1)
    html = html.replace('<section class="wrap" id="contact">', '<section class="wrap" id="contact" aria-labelledby="contact-title">', 1)
    html = html.replace('<h2>' + context['contact_title'] + '</h2>', '<h2 id="contact-title">' + context['contact_title'] + '</h2>', 1)
    html = html.replace('<form class="contact-form"', '<form class="contact-form" aria-describedby="form-privacy-' + p['slug'] + '"', 1)
    html = html.replace('<p class="form-privacy">', '<p class="form-privacy" id="form-privacy-' + p['slug'] + '">', 1)
    html = html.replace('<p class="form-msg form-ok" hidden>', '<p class="form-msg form-ok" role="status" aria-live="polite" hidden>', 1)
    html = html.replace('<p class="form-msg form-err" hidden>', '<p class="form-msg form-err" role="alert" aria-live="assertive" hidden>', 1)
    html = html.replace('<span>שם</span><input type="text"', '<span>שם (חובה)</span><input type="text"', 1)
    html = html.replace('<span>אימייל</span><input type="email"', '<span>אימייל (חובה)</span><input type="email"', 1)
    html = html.replace('<input type="checkbox" name="botcheck"', '<input type="checkbox" name="botcheck" hidden', 1)
    html = html.replace('<a class="wa"', '<aside class="quick-contact" aria-label="יצירת קשר מהירה"><a class="wa"', 1)
    html = html.replace('</a>\n<script src="/site.js', '</a></aside>\n<script src="/site.js', 1)
    html = html.replace('/landing-motion.js?v=20260813-3', '/landing-motion.js?v=20260814-1')
    dest = ROOT / 'he' / p['slug'] / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding='utf-8')
    print(dest.relative_to(ROOT))
