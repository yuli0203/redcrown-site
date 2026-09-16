"""Service-specific content and rendering for the approved landing-page design."""
from html import escape
import json
import re
from pathlib import Path
from string import Template
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]

# Existing portfolio work is evidence of relevant experience, never a fabricated
# client, outcome, testimonial, medical approval, or startup funding claim.
CONTENT = {
    'training-simulations': {
        'headline': ['לתרגל את המורכב.', 'להגיע מוכנים לשטח.'],
        'lead': 'סימולציות הדרכה שמאפשרות להתנסות, לטעות ולנסות שוב. מהתרחיש הראשון ועד מערכת שהמדריך יכול להפעיל והצוות יכול ללמוד ממנה.',
        'model': 'meta_quest_3_opt.glb', 'model_label': 'META QUEST 3',
        'model_alt': 'משקפי Meta Quest 3 בתלת-ממד - גררו כדי לסובב',
        'proof': ['עד 12 משקפיים במקביל', 'כלים למדריך', 'הפעלה בטכניון'],
        'work_title': ['ההדרכה ממשיכה.', 'גם כשהכיתה וירטואלית.'],
        'work_intro': 'מערכת כיתתית פעילה בטכניון. חומרה, תוכן וזרימת העבודה של המדריכים תוכננו יחד.',
        'case_label': 'META QUEST CLASSROOM', 'case_meta': 'כיתת מציאות מדומה · הטכניון',
        'case_title': 'כיתה שלמה. תחת שליטה אחת.',
        'case_copy': 'עד 12 משקפי Meta Quest 3, עם טאבלטים למדריכים, מאפשרים לעקוב אחר הקבוצות ולתמוך בלומדים. הייעוץ וההקמה כללו בחירת חומרה, תכנון החלל, הגדרות, בדיקות ומסירה.',
        'case_link': '/work/meta-quest-classroom/',
        'case_alt': 'כיתת מציאות מדומה בטכניון עם לומדים במשקפי Meta Quest',
        'case_facts': [('עד 12', 'משקפיים עם טאבלטים'), ('הפעלה מרוכזת', 'כלים לצוות ההדרכה')],
        'solutions_title': ['ידע הוא התחלה.', 'הביצוע הוא המבחן.'],
        'solutions_intro': 'בוחרים את סביבת התרגול לפי המשימה: VR, AR, מציאות משולבת, מחשב או מובייל.',
        'solutions': [('בטיחות', 'לתרגל בלי לעצור את העבודה.', 'תרחישים של תפעול, נהלים וקבלת החלטות, בלי להשבית קו או לחשוף ציוד לתרגול מסוכן.'), ('מיומנות', 'לעבור מידיעה להתנסות.', 'חזרה על רצף פעולות, עם משוב שמבהיר מה עבד ומה כדאי לנסות אחרת.'), ('הדרכה', 'לראות מי צריך עוד תרגול.', 'מעקב אחר התקדמות וטעויות לפי מדדי ההדרכה, כדי למקד את התמיכה במקומות הנכונים.')],
        'steps': [('מגדירים', 'ממפים את המשימה, המשתמשים ומדדי הביצוע.', 'תרחיש ומדדי הצלחה'), ('מתנסים', 'בודקים תרגול ראשון עם החומרה והמשתמשים.', 'פיילוט שאפשר להפעיל'), ('מפתחים', 'מחברים תרחישים, משוב וכלים למדריך.', 'מערכת הדרכה עובדת'), ('מטמיעים', 'בודקים בתנאי השטח ומדריכים את הצוות.', 'מסירה והכשרת מדריכים')],
        'faqs': [('האם כל סימולציית הדרכה דורשת משקפי VR?', 'לא. בוחרים את הפלטפורמה לפי הפעולות שצריך לתרגל, תנאי השטח והמשתמשים. לעיתים מחשב, מובייל או AR מתאימים יותר.'), ('איך בודקים שהתרגול מועיל?', 'מגדירים מראש מדדים כגון ביצוע רצף פעולות, טעויות, זמן ביצוע או הבנת תהליך. בודקים אותם בפיילוט עם משתמשים ומחליטים אילו תרחישים להרחיב.'), ('מה משפיע על המחיר ולוח הזמנים?', 'מספר התרחישים, מורכבות התלת-ממד, החומרה, כלי המדריך והאינטגרציות. בשלב האפיון מגדירים את היקף הפיתוח, הציוד וההטמעה.')],
        'contact_title': ['איזה רגע צריך לתרגל', 'לפני שפוגשים אותו בשטח?'],
        'contact_lead': 'ספרו מי לומד, מה עליו לבצע ומה קשה לתרגל היום. נמקד יחד תרחיש ראשון.',
        'consultation': ['בחירת תרחיש בעל ערך להדרכה', 'התאמת הפלטפורמה והציוד', 'כיוון לפיילוט ולמדדי ההצלחה'],
    },
    'interactive-3d': {
        'headline': ['לא רק לראות.', 'להבין דרך פעולה.'],
        'lead': 'פיתוח תוכנה אינטראקטיבית בתלת-ממד למוצרים, מידע ותהליכים מורכבים. מחברים קוד, גרפיקה וממשק לכלי שאנשים יכולים לחקור ולהפעיל.',
        'model': 'robi_opt.glb', 'model_label': 'ROBI · INTERACTIVE 3D',
        'model_alt': 'רובי, המדריך הווירטואלי שפיתחנו - גררו כדי לסובב',
        'proof': ['תלת-ממד בזמן אמת', 'קוד ועיצוב יחד', 'פרויקטים בטכניון'],
        'work_title': ['מידע מורכב.', 'חוויה שמזמינה לחקור.'],
        'work_intro': 'לומדת האנזים שפותחה בטכניון מחברת המחשה מדעית, אינטראקציות ידיים והדרכה.',
        'case_label': 'INTERACTIVE SCIENCE', 'case_meta': 'לומדת האנזים · הטכניון',
        'case_title': 'המודל זז. ההבנה מתקדמת.',
        'case_copy': 'מולקולות מופיעות על השולחן האמיתי. מסובבים, מגדילים ובוחנים ריאקציה בקצב אישי, עם רובי כמדריך בעברית ובאנגלית. החישוב, התלת-ממד והממשק עובדים כחוויה אחת.',
        'case_link': '/work/enzymatic-lab-ar/', 'video': True,
        'case_alt': 'מודלים מולקולריים ורובי בלומדת האנזים במציאות משולבת',
        'case_facts': [('אינטראקציה בידיים', 'ללא שלטים'), ('עברית ואנגלית', 'בהנחיית רובי')],
        'solutions_title': ['לתת למידע עומק.', 'ולתת לאנשים שליטה.'],
        'solutions_intro': 'הדמיה טובה מסבירה. תוכנה אינטראקטיבית מאפשרת למשתמש גם לבחון, לבחור ולפעול.',
        'solutions': [('חקירה', 'לראות קשרים שקשה להסביר.', 'מודלים הנדסיים ומידע מורכב בתצוגה שאפשר לסובב, לפרק ולחקור.'), ('מוצר', 'להבין מוצר לפני הבחירה.', 'קונפיגורטורים וכלי הדגמה שמציגים מבנה, אפשרויות ואופן פעולה בצורה מוחשית.'), ('עבודה', 'להפוך תלת-ממד לכלי מקצועי.', 'ממשק שמחבר נתונים, חישובים ואינטראקציות למשימה של המשתמש.')],
        'steps': [('ממקדים', 'מגדירים מה המשתמש צריך להבין או לבצע.', 'פעולה מרכזית ברורה'), ('מדגימים', 'בונים אינטראקציה ראשונה על חומרת היעד.', 'אב-טיפוס להתנסות'), ('מחברים', 'מפתחים קוד, גרפיקה וממשק כמערכת אחת.', 'מוצר אינטראקטיבי'), ('מלטשים', 'בודקים שימושיות, ביצועים ומסירה לצוות.', 'מערכת מוכנה לשימוש')],
        'faqs': [('במה תוכנה אינטראקטיבית שונה מסרטון הדמיה?', 'בסרטון הצופה מקבל מסלול שנקבע מראש. בתוכנה הוא יכול לשנות את נקודת המבט, לבחור אפשרויות ולהפעיל את המודל לפי המשימה שלו.'), ('אפשר להשתמש במודלים או בנתונים שכבר יש לנו?', 'כן, בהתאם לפורמט, איכות הקבצים והרשאות השימוש. בודקים מה אפשר לשלב ומה צריך להתאים לביצועים, לאינטראקציות ולחומרת היעד.'), ('לאילו פלטפורמות אפשר לפתח?', 'מחשב, Web, מובייל ומשקפי XR. הבחירה תלויה בהיקף המודל, סוג האינטראקציה וסביבת השימוש, ונעשית כחלק מהאפיון.')],
        'contact_title': ['יש משהו שקשה להסביר?', 'בואו נהפוך אותו לחוויה.'],
        'contact_lead': 'ספרו מה תרצו שהמשתמש יבין, יבחר או יבצע. גם מודל ראשוני או רעיון מספיקים להתחלה.',
        'consultation': ['הגדרת האינטראקציה המרכזית', 'התאמת המודל והפלטפורמה', 'צעד ראשון להדגמה עובדת'],
    },
    'research-software': {
        'headline': ['מהחישוב שבקוד.', 'לתובנה שאפשר לחקור.'],
        'lead': 'פיתוח תוכנה למחקר והנדסה שמחבר מודלים, נתונים ותלת-ממד. כלי עבודה שנבנה סביב השאלה המחקרית שלכם.',
        'model': 'caffeine2_opt.glb', 'model_label': 'MOLECULAR VISUALIZATION',
        'model_alt': 'מודל מולקולרי בתלת-ממד - גררו כדי לחקור את המבנה',
        'proof': ['חישוב ותצוגה יחד', 'ניסיון במחקר בטכניון', 'כלים לעבודה מתמשכת'],
        'work_title': ['החישוב פוגש את המודל.', 'החוקר מקבל כלי.'],
        'work_intro': 'LiveMol פותח בטכניון כדי לחבר חישוב מדעי וחקירה מולקולרית בסביבת עבודה חזותית.',
        'case_label': 'LIVEMOL', 'case_meta': 'כלי מחקר חזותי · הטכניון',
        'case_title': 'לחקור את המולקולה. בתוך העבודה עצמה.',
        'case_copy': 'מערכת שמחברת חישובים ותצוגת מולקולות אינטראקטיבית. החוקר יכול לעבור מנתונים למבנה חזותי ולחקור אותו באותה סביבת עבודה.',
        'case_link': '/work/livemol-research-tool/',
        'case_alt': 'ממשק LiveMol לחקירה מולקולרית ולחישוב מדעי',
        'case_facts': [('חישוב מדעי', 'מחובר לתצוגה'), ('חקירה אינטראקטיבית', 'בסביבה אחת')],
        'solutions_title': ['פחות מעבר בין כלים.', 'יותר מקום למחקר.'],
        'solutions_intro': 'מתכננים את המערכת סביב הנתונים, הפרוטוקול והדרך שבה הצוות עובד.',
        'solutions': [('תובנות', 'לראות את מה שהטבלה מסתירה.', 'כלים חזותיים לחקירת מבנים, להשוואת תוצאות ולהבנת קשרים מרחביים.'), ('ניסוי', 'לדעת מה השתנה בין הרצות.', 'ממשקים להגדרת פרמטרים, הפעלת תרחישים ואיסוף נתונים לפי הפרוטוקול שסוכם.'), ('המחשה', 'להסביר גם למי שלא כתב את הקוד.', 'תצוגות אינטראקטיביות שמאפשרות לחוקרים, לשותפים ולבעלי עניין לבחון את המודל יחד.')],
        'steps': [('ממפים', 'מבינים את השאלה, הנתונים וכלי העבודה הקיימים.', 'דרישות מדעיות וטכניות'), ('בודקים', 'מחברים חישוב או מאגר אחד לממשק ראשוני.', 'הוכחת היתכנות'), ('מפתחים', 'בונים את החישוב, התצוגה וזרימת העבודה.', 'כלי עבודה למחקר'), ('מאמתים', 'משווים לתוצאות ייחוס ומתעדים את השימוש.', 'מסירה ובדיקות מוסכמות')],
        'faqs': [('אפשר לחבר קוד מחקרי קיים לממשק חדש?', 'בודקים את שפת הקוד, התלויות, פורמטי הנתונים ודרישות הביצועים. לפי הממצאים מגדירים חיבור מתאים בין החישוב לממשק.'), ('איך שומרים על נאמנות למודל המדעי?', 'מגדירים עם הצוות המחקרי תוצאות ייחוס, תרחישי בדיקה ומגבלות ידועות. בודקים את החישובים והתצוגה מול הקריטריונים שסוכמו.'), ('האם הכלי מתאים גם להדגמה ולהוראה?', 'אפשר לתכנן מצבי חקירה והדגמה שונים, בהתאם לקהל ולצרכים. ההיקף, רמת הפירוט וההרשאות מוגדרים באפיון.')],
        'contact_title': ['איזו שאלה המחקר שלכם', 'צריך לעזור לראות?'],
        'contact_lead': 'ספרו על המודל, הנתונים והשלב שבו כלי העבודה הקיימים מגבילים אתכם.',
        'consultation': ['מיפוי החישוב והמידע הקיים', 'כיוון לממשק ולסביבת העבודה', 'ניסוי ראשון שיבדוק היתכנות'],
    },
    'medical-prototypes': {
        'headline': ['מרעיון רפואי מורכב.', 'למשהו שאפשר לבחון.'],
        'lead': 'פיתוח אבות-טיפוס רפואיים שמשלבים תוכנה, מידע ותלת-ממד. בודקים את זרימת העבודה עם אנשי מקצוע לפני שמרחיבים את המוצר.',
        'proof': ['ניסיון המייסדת ב-Philips', 'המחשה תלת-ממדית', 'אב-טיפוס להתנסות'],
        'work_title': ['להבין את המרחב.', 'לתכנן את האינטראקציה.'],
        'work_intro': 'ניסיון אישי של המייסדת בפיתוח מערכת CODEX EPD ב-Philips.',
        'case_label': 'CODEX EPD · PHILIPS', 'case_meta': 'מניסיון המייסדת · לפני הקמת Red Crown',
        'case_title': 'מידע אנטומי. בממשק שאפשר לעבוד איתו.',
        'case_copy': 'עבודה על מערכת רפואית תלת-ממדית מורכבת ב-Philips, המחברת מידע אנטומי והמחשה אינטראקטיבית. הניסיון הזה מביא לפרויקט שלכם הבנה של החיבור בין תוכנה, מרחב וזרימת עבודה מקצועית.',
        'case_alt': 'ממשק CODEX EPD מתוך ניסיון הפיתוח של המייסדת ב-Philips',
        'case_facts': [('תלת-ממד רפואי', 'מידע וממשק יחד'), ('ניסיון המייסדת', 'בפיתוח ב-Philips')],
        'solutions_title': ['לפני שמפתחים הכול.', 'בודקים את הרגע החשוב.'],
        'solutions_intro': 'אב-טיפוס ממוקד נותן לצוותי רפואה, מוצר והנדסה בסיס משותף לבחינת הרעיון.',
        'solutions': [('התנסות', 'לבחון זרימת עבודה אמיתית.', 'התרחיש המרכזי הופך לאב-טיפוס פעיל שאפשר להציג ולקבל עליו משוב מקצועי.'), ('המחשה', 'לתת למידע הרפואי עומק.', 'חיבור נתונים, אנטומיה ותלת-ממד כדי לבחון כיצד המשתמש מבין ופועל במרחב.'), ('תיאום', 'להפוך דיון להחלטות מוצר.', 'התנסות משותפת שמציפה מגבלות, שאלות וסדרי עדיפויות לפני פיתוח מערכת מלאה.')],
        'steps': [('מגדירים', 'ממקדים את המשתמש, התרחיש ושאלת הבדיקה.', 'היקף אב-טיפוס'), ('מדגימים', 'בונים את האינטראקציה או ההמחשה המרכזית.', 'גרסה למשוב מקצועי'), ('מחדדים', 'משלבים ממצאים ומחברים את רכיבי התוכנה.', 'אב-טיפוס פונקציונלי'), ('מוסרים', 'מתעדים יכולות, מגבלות והחלטות להמשך.', 'בסיס לפיתוח הבא')],
        'faqs': [('מה כולל אב-טיפוס רפואי?', 'תרחיש שימוש מוגדר, ממשק ורכיבי תוכנה או תלת-ממד הדרושים כדי לבחון אותו. ההיקף נקבע לפי השאלה שרוצים לבדוק עם אנשי המקצוע.'), ('האם אב-טיפוס הוא מוצר מאושר לשימוש קליני?', 'לא. מטרת אב-טיפוס היא בחינה והדגמה של הרעיון. דרישות למוצר קליני, אימות, אבטחת מידע ורגולציה מוגדרות בנפרד עם הגורמים המקצועיים המתאימים.'), ('אפשר להתחיל עם מידע לדוגמה?', 'כן. אפשר להגדיר אב-טיפוס שפועל עם נתוני דוגמה מתאימים. צורכי המידע והחיבור למערכות נבחנים כחלק מאפיון הפרויקט.')],
        'contact_title': ['יש רעיון שצריך', 'להפוך להתנסות?'],
        'contact_lead': 'ספרו איזו פעולה אנשי המקצוע צריכים לבצע ומה תרצו לבדוק באב-הטיפוס הראשון.',
        'consultation': ['מיקוד התרחיש וזרימת העבודה', 'בחירת רכיבי ההמחשה והתוכנה', 'הגדרת תוצרים ומגבלות לאב-הטיפוס'],
    },
    'startup-mvp-poc': {
        'headline': ['מהרעיון שבמצגת.', 'למוצר שאפשר לנסות.'],
        'lead': 'פיתוח MVP ו-POC לסטארטאפים. בונים את הליבה שתאפשר להוכיח היתכנות, להדגים ערך ולקבל משוב ממשתמשים.',
        'proof': ['POC לבדיקת היתכנות', 'MVP למשוב אמיתי', 'תכנית להמשך הפיתוח'],
        'work_title': ['רעיון מורכב.', 'מוצר שעובד בידיים.'],
        'work_intro': 'LiveMol, שפותח בטכניון, מדגים חיבור של חישוב, תלת-ממד וחוויית משתמש לכלי עובד.',
        'case_label': 'LIVEMOL', 'case_meta': 'מוצר תוכנה חזותי · הטכניון',
        'case_title': 'מחישוב מדעי לחוויה אינטראקטיבית.',
        'case_copy': 'רעיון לכלי מחקר הפך למערכת שבה חישובים ותצוגת מולקולות פועלים יחד. זו דוגמה לניסיון בבניית מוצר תוכנה מורכב, מהמודל ועד הממשק שהמשתמש מפעיל.',
        'case_link': '/work/livemol-research-tool/',
        'case_alt': 'LiveMol, כלי תוכנה אינטראקטיבי שפותח בטכניון',
        'case_facts': [('מוצר עובד', 'קוד, חישוב ותלת-ממד'), ('חוויה אחת', 'מהמודל לממשק')],
        'solutions_title': ['לבנות פחות בהתחלה.', 'ללמוד יותר מהגרסה הראשונה.'],
        'solutions_intro': 'היקף הפיתוח נגזר מההחלטה הבאה שלכם: האם הטכנולוגיה אפשרית, האם יש ערך למשתמש, ומה נכון להרחיב.',
        'solutions': [('POC', 'להוכיח שאפשר.', 'בודקים את הסיכון הטכנולוגי או האינטראקציה המרכזית באמצעות הוכחת היתכנות ממוקדת.'), ('MVP', 'לבדוק שאנשים צריכים את זה.', 'גרסה ראשונה שאפשר להפעיל, להדגים ללקוחות ולקבל עליה משוב ממשי.'), ('המשך', 'לבנות בסיס לצעד הבא.', 'קוד, תיעוד ותכנית פיתוח שמבהירים מה כבר נבדק ומה עדיין צריך להוכיח.')],
        'steps': [('ממקדים', 'מגדירים למי המוצר מיועד ומה צריך להוכיח.', 'השאלה העסקית והטכנית'), ('מתכננים', 'בוחרים את המינימום שייתן תשובה מועילה.', 'היקף POC או MVP'), ('בונים', 'מפתחים את התרחיש ומציגים גרסאות ביניים.', 'מוצר ראשון לבדיקה'), ('לומדים', 'אוספים ממצאים ומסמנים את הצעד הבא.', 'מסירה ותכנית המשך')],
        'faqs': [('מה ההבדל בין POC ל-MVP?', 'POC בודק אם רכיב טכנולוגי או רעיון מסוים ישימים. MVP הוא מוצר מצומצם שאפשר לתת למשתמשים כדי לבחון ערך ושימוש. בוחרים לפי השאלה שצריך לענות עליה עכשיו.'), ('צריך להגיע עם אפיון מלא?', 'לא. אפשר להתחיל מרעיון, משתמש יעד ושאלה שרוצים לבדוק. בשיחה הראשונית ממקדים את הכיוון, ובהמשך מגדירים היקף ותוצרים לפיתוח.'), ('מה מקבלים בסוף הפיתוח?', 'את הגרסה והתוצרים שסוכמו באפיון, עם מסירה ותיעוד הדרושים לשימוש ולהמשך עבודה. היקף הקוד, התיעוד והתמיכה מוגדרים מראש בהסכם הפרויקט.')],
        'contact_title': ['מה צריך לעבוד', 'כדי שתוכלו להתקדם?'],
        'contact_lead': 'ספרו מה תרצו להוכיח ולמי. נמקד יחד את הגרסה שתיתן לכם את התשובה החשובה הבאה.',
        'consultation': ['בחירה בין POC ל-MVP', 'מיקוד התרחיש והיקף הגרסה', 'תכנית לצעד הראשון ולבדיקתו'],
    },
}

ICONS = [
    '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><path d="M24 3v8M24 37v8M3 24h8M37 24h8"/>',
    '<path d="m24 5 16 9v20l-16 9-16-9V14zM8 14l16 9 16-9M24 23v20"/>',
    '<path d="M7 39h34M10 34l9-10 7 6 12-17"/><circle cx="19" cy="24" r="2"/><circle cx="26" cy="30" r="2"/><circle cx="38" cy="13" r="2"/>',
    '<rect x="5" y="7" width="38" height="29" rx="4"/><path d="m15 21 6 6 12-13M17 42h14M24 36v6"/>',
]


def e(value):
    return escape(str(value), quote=True)


def heading(lines):
    return f'{e(lines[0])}<br><span>{e(lines[1])}</span>'


def icon(index):
    return f'<svg viewBox="0 0 48 48" aria-hidden="true">{ICONS[index]}</svg>'


def extract(pattern, source):
    result = re.search(pattern, source, re.S)
    if not result:
        raise ValueError(f'Shared VR layout changed: {pattern}')
    return result.group(0)


def render(page, pages):
    data = CONTENT[page['slug']]
    source = (ROOT / 'tools/templates/vr-development.html').read_text(encoding='utf-8')
    template = Template((ROOT / 'tools/templates/service-landing.html').read_text(encoding='utf-8'))
    slug, title = page['slug'], page['title']
    url = f'https://redcrowninteractive.com/he/{slug}/'
    image = page['image'].split('?')[0]
    description = data['lead']
    faq_schema = {'@context': 'https://schema.org', '@type': 'FAQPage', 'inLanguage': 'he', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in data['faqs']]}
    schemas = [
        {'@context': 'https://schema.org', '@type': 'Service', 'name': title, 'description': description, 'url': url,
         'provider': {'@type': 'Organization', 'name': 'Red Crown Interactive', 'url': 'https://redcrowninteractive.com/'}, 'areaServed': 'IL'},
        faq_schema,
        {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Red Crown Interactive', 'item': 'https://redcrowninteractive.com/he/'},
            {'@type': 'ListItem', 'position': 2, 'name': title, 'item': url}]}]
    structured_data = ''.join('<script type="application/ld+json">' + json.dumps(s, ensure_ascii=False).replace('<', '\\u003c') + '</script>' for s in schemas)
    header = extract(r'<header\b.*?</header>', source)
    atmosphere = extract(r'<div class="hero-atmosphere".*?</div>(?=<div class="container hero-layout">)', source)
    experience = extract(r'<section class="experience\b.*?</section>', source)
    expertise = extract(r'<section class="section container expertise".*?</section>', source)
    form = extract(r'<form class="contact-form".*?</form>', source).replace('vr-development', slug)
    form = form.replace('name="project" value="XR"', 'name="project" value="Open to recommendation"')
    footer = extract(r'<footer\b.*?</footer>', source)
    if data.get('model') != 'meta_quest_3_opt.glb':
        footer = re.sub(r'<p class="model-attribution">.*?</p>', '', footer, flags=re.S)
    footer = footer.replace('פיתוח VR, AR ותלת-ממד אינטראקטיבי.', 'תוכנה, תלת-ממד וחוויות אינטראקטיביות.')
    wa = extract(r'<a class="whatsapp-float".*?</a>', source)
    wa_url = 'https://wa.me/972585760550?text=' + quote(f'שלום, אשמח לייעוץ בנושא {title}')
    wa = re.sub(r'href="[^"]+"', f'href="{e(wa_url)}"', wa, count=1)
    if data.get('model'):
        exposure = '0.45' if slug == 'research-software' else '1.1'
        orbit = '15deg 82deg 105%' if slug == 'interactive-3d' else '-25deg 78deg 105%'
        stage = f'''<div class="headset-stage service-stage"><div class="halo" aria-hidden="true"></div><div class="orbit" aria-hidden="true"></div>
        <div class="headset-fallback"><img src="{e(image)}" width="1200" height="900" alt="{e(data['case_alt'])}"><p>{e(data['case_meta'])}</p></div>
        <model-viewer inert aria-hidden="true" src="/assets/models/{e(data['model'])}" alt="{e(data['model_alt'])}" camera-controls auto-rotate rotation-per-second="12deg" auto-rotate-delay="1400" disable-zoom interaction-prompt="none" shadow-intensity="0.6" exposure="{exposure}" camera-orbit="{orbit}" touch-action="pan-y"><span slot="progress-bar" hidden aria-hidden="true"></span></model-viewer>
        <div class="headset-load-state" role="status" aria-live="polite"><span class="headset-load-message">תצוגה מתוך העבודה שלנו</span><button class="headset-retry" type="button" hidden>נסו לטעון שוב</button></div>
        <span class="stage-caption" hidden><i></i>{e(data['model_label'])}<span>גררו. גלו זווית חדשה.</span></span></div>'''
    else:
        roadmap = ''
        if slug == 'startup-mvp-poc':
            roadmap = '<ol class="product-roadmap" aria-label="מרעיון לגרסה ראשונה"><li><span>01</span>מיקוד</li><li><span>02</span>הוכחה</li><li><span>03</span>מוצר</li></ol>'
        stage = f'''<figure class="product-stage"><div class="halo" aria-hidden="true"></div><div class="product-screen"><div class="product-screen-heading"><span>{e(data['case_label'])}</span><i aria-hidden="true"></i></div><img src="{e(image)}" width="1200" height="900" alt="{e(data['case_alt'])}">{roadmap}</div><figcaption>{e(data['case_meta'])}</figcaption></figure>'''
    media = f'<img src="{e(image)}" width="1200" height="900" alt="{e(data["case_alt"])}" loading="lazy">'
    if data.get('video'):
        media += '''<button class="demo-play" type="button" aria-label="צפייה בהדגמה של לומדת האנזים" aria-controls="enzyme-demo"><span class="demo-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M8 5v14l11-7z"/></svg></span></button><video id="enzyme-demo" class="demo-video" controls playsinline preload="none" poster="/assets/work-ar-enzymatic.jpg" data-src="/assets/enzymatic-lab-demo-v13.mp4" aria-label="הדגמת לומדת האנזים במציאות משולבת" hidden></video>'''
    elif data.get('case_link'):
        media = f'<a href="{e(data["case_link"])}">{media}<span class="project-open" aria-hidden="true">↖</span></a>'
    case_link = f'<a class="project-link" href="{e(data["case_link"])}">למקרה הבוחן המלא <b>←</b></a>' if data.get('case_link') else ''
    case_facts = ''.join(f'<li><b>{e(a)}</b>{e(b)}</li>' for a, b in data['case_facts'])
    solutions = ''.join(f'<article><span class="solution-number">{i+1:02d} / {e(label)}</span>{icon(i)}<h3>{e(h)}</h3><p>{e(p)}</p></article>' for i, (label, h, p) in enumerate(data['solutions']))
    steps = ''.join(f'<article><div class="process-station"><span class="process-icon">{icon(i)}</span><span class="process-number">{i+1:02d}</span></div><h3>{e(h)}</h3><p>{e(p)}</p><span class="process-output">תוצר: {e(output)}</span></article>' for i, (h, p, output) in enumerate(data['steps']))
    faqs = ''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in data['faqs'])
    related = ''.join(f'<a href="/he/{e(other["slug"])}/"><span>{e(other["title"])}</span><b aria-hidden="true">←</b></a>' for other in pages if other['slug'] != slug)
    values = dict(slug=e(slug), title=e(title), description=e(description), url=e(url), structured_data=structured_data,
        header=header, atmosphere=atmosphere, experience=experience, expertise=expertise, form=form, footer=footer, whatsapp=wa,
        headline=heading(data['headline']), lead=e(data['lead']), stage=stage,
        proof=''.join(f'<span>{e(item)}</span>' for item in data['proof']),
        work_title=heading(data['work_title']), work_intro=e(data['work_intro']), case_media=media,
        case_label=e(data['case_label']), case_meta=e(data['case_meta']), case_title=e(data['case_title']),
        case_copy=e(data['case_copy']), case_facts=case_facts, case_link=case_link,
        solutions_title=heading(data['solutions_title']), solutions_intro=e(data['solutions_intro']), solutions=solutions, steps=steps,
        faqs=faqs, related=related, contact_title=heading(data['contact_title']), contact_lead=e(data['contact_lead']),
        consultation=''.join(f'<li>{e(item)}</li>' for item in data['consultation']), wa_url=e(wa_url),
        model_script='<script type="module" src="/vendor/model-viewer.min.js"></script>' if data.get('model') else '')
    return template.substitute(values)
