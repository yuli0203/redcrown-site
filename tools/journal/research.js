#!/usr/bin/env node
/*
 * Competitive keyword research for the journal.
 *
 * This is the step that decides what is worth writing. It searches the live
 * Hebrew results for the studio's themes, reads who already ranks and what
 * they say, and returns the gaps this studio can answer better - not a list of
 * keywords guessed from a model's memory.
 *
 *   node tools/journal/research.js              refresh the queue
 *   node tools/journal/research.js --themes 5   widen the sweep
 *   node tools/journal/research.js --dry-run    print the plan, write nothing
 */
'use strict';
const fs = require('fs');
const path = require('path');
const posts = require('./lib/posts.js');
const claude = require('./lib/claude.js');

const QUEUE = path.join(__dirname, 'keywords.json');
const cfg = posts.config();
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};
const dryRun = argv.includes('--dry-run');
const themeCount = Math.max(1, Number(flag('themes', 3)));

const readQueue = () => (fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')) : []);

/* Rotate through the themes so consecutive runs do not research the same
   corner of the market, and skip whatever the queue already covers. */
function themesForThisRun(queue) {
  const themes = cfg.brandDna.keyThemes;
  const covered = new Set(queue.map(entry => entry.theme));
  const fresh = themes.filter(theme => !covered.has(theme));
  const pool = fresh.length ? fresh : themes;
  const offset = queue.length % pool.length;
  return Array.from({ length: Math.min(themeCount, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['keywords'],
  properties: {
    keywords: {
      type: 'array', minItems: 3, maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['keyword', 'theme', 'intent', 'difficulty', 'opportunityScore', 'rationale',
          'competitors', 'gaps', 'questions', 'suggestedTitle', 'suggestedSlug', 'secondaryKeywords'],
        properties: {
          keyword: { type: 'string', description: 'The Hebrew search query to target.' },
          theme: { type: 'string' },
          intent: { type: 'string', enum: ['informational', 'commercial', 'transactional'] },
          difficulty: { type: 'string', enum: ['low', 'medium', 'high'] },
          opportunityScore: { type: 'integer', minimum: 1, maximum: 10 },
          rationale: { type: 'string', description: 'Why this query is winnable for this studio, in Hebrew.' },
          competitors: {
            type: 'array', maxItems: 5,
            items: {
              type: 'object', additionalProperties: false,
              required: ['domain', 'angle'],
              properties: {
                domain: { type: 'string' },
                title: { type: 'string' },
                angle: { type: 'string', description: 'What the ranking page actually covers.' },
              },
            },
          },
          gaps: { type: 'array', maxItems: 6, items: { type: 'string' }, description: 'What the ranking pages leave out.' },
          questions: { type: 'array', maxItems: 8, items: { type: 'string' }, description: 'Real questions searchers ask, in Hebrew.' },
          suggestedTitle: { type: 'string' },
          suggestedSlug: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
          secondaryKeywords: { type: 'array', maxItems: 6, items: { type: 'string' } },
        },
      },
    },
  },
};

async function main() {
  const queue = readQueue();
  const existing = posts.all();
  const themes = themesForThisRun(queue);

  const brand = cfg.brandDna;
  const context = [
    `העסק: ${brand.businessType}`,
    `קהל היעד: ${brand.targetAudience}`,
    `אזור השירות: ${brand.serviceArea}`,
    `נושאים אסורים: ${brand.topicsToAvoid}`,
    `שוק: ${cfg.seo.market}, שפת חיפוש: ${cfg.seo.searchLanguage}`,
    cfg.seo.competitors.length ? `מתחרים לבדיקה: ${cfg.seo.competitors.join(', ')}` : '',
    existing.length ? `מאמרים שכבר פורסמו (אל תציע נושא חופף): ${existing.map(p => `${p.title} [${p.keyword || ''}]`).join(' | ')}` : '',
    queue.length ? `מילות מפתח שכבר בתור: ${queue.map(entry => entry.keyword).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  console.log(`[journal] researching ${themes.length} themes against live results…`);
  const findings = await claude.explore({
    model: cfg.models.research,
    effort: cfg.models.effort,
    search: 14,
    system: 'את/ה אנליסט/ית SEO שעובד/ת בשוק הישראלי. את/ה מחפש/ת בגוגל בעברית, קורא/ת את התוצאות המדורגות בפועל, ומדווח/ת רק על מה שראית בהן. אל תמציא/י נתוני נפח חיפוש מדויקים - אם אין נתון, אמור/י זאת והערך/י לפי מה שהתוצאות מראות.',
    prompt: [context,
      '',
      `בדוק/י את הנושאים הבאים, אחד אחד: ${themes.map(t => `"${t}"`).join(', ')}`,
      '',
      'לכל נושא:',
      '1. נסח/י 3-5 שאילתות חיפוש בעברית שקהל היעד באמת מקליד, כולל שאילתות מסחריות ("חברת פיתוח...", "מחיר", "איך לבחור") ושאילתות מקצועיות.',
      '2. חפש/י אותן בפועל. דווח/י מי מדורג בעשירייה הראשונה, איזה סוג עמוד זה (ספק, בלוג, פורום, יצרן), ומה הזווית שלו.',
      '3. זהה/י את הפער: מה השאילתה מבקשת שהתוצאות הקיימות לא נותנות (למשל: אין מספרים, אין תהליך, אין התייחסות לרגולציה, הכול באנגלית, הכול שיווקי).',
      '4. אסוף/י שאלות אמיתיות מתוך People Also Ask ומתוך התוצאות.',
      '5. אמור/י במפורש אם השאילתה לא שווה כתיבה (נשלטת על ידי יצרנים, כוונה לא מתאימה, נפח אפסי).',
      '',
      'סיים/י בסיכום קצר: אילו שאילתות הן ההזדמנות הטובה ביותר לסטודיו הזה ולמה.',
    ].join('\n'),
  });

  console.log('[journal] structuring the findings…');
  const plan = await claude.structured({
    model: cfg.models.research,
    effort: cfg.models.effort,
    label: 'keyword plan',
    schema: SCHEMA,
    system: 'המר/י ממצאי מחקר SEO לתוכנית מילות מפתח. אל תוסיף/י שאילתות שלא נבדקו בממצאים. opportunityScore גבוה רק כאשר יש פער אמיתי שהסטודיו יכול למלא בידע שלו.',
    prompt: `${context}\n\nהממצאים מהחיפוש החי:\n\n${findings.text}`,
  });

  const known = new Set([
    ...queue.map(entry => entry.keyword),
    ...existing.map(post => post.keyword).filter(Boolean),
  ]);
  const usedSlugs = new Set(existing.map(post => post.slug));
  const added = plan.keywords
    .filter(entry => !known.has(entry.keyword))
    .filter(entry => !usedSlugs.has(entry.suggestedSlug))
    .filter(entry => entry.opportunityScore >= cfg.seo.minOpportunityScore)
    .map(entry => ({ ...entry, status: 'queued', addedAt: new Date().toISOString() }));

  const next = [...queue, ...added]
    .sort((a, b) => (a.status === b.status ? b.opportunityScore - a.opportunityScore : a.status === 'queued' ? -1 : 1));

  console.log(`[journal] ${added.length} new keywords (queue: ${next.filter(e => e.status === 'queued').length} open)`);
  for (const entry of added) {
    console.log(`  ${entry.opportunityScore}/10  ${entry.keyword}  →  ${entry.suggestedTitle}`);
    if (entry.gaps.length) console.log(`         פער: ${entry.gaps[0]}`);
  }
  const rejected = plan.keywords.filter(entry => entry.opportunityScore < cfg.seo.minOpportunityScore);
  if (rejected.length) console.log(`[journal] skipped ${rejected.length} below the opportunity threshold (${cfg.seo.minOpportunityScore})`);

  if (dryRun) return;
  fs.writeFileSync(QUEUE, JSON.stringify(next, null, 2) + '\n');
  console.log(`[journal] wrote ${path.relative(process.cwd(), QUEUE)}`);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] research failed:', error.message); process.exit(1); });
}
module.exports = { SCHEMA };
