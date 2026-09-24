#!/usr/bin/env node
/*
 * Draft the next article and save it as a post record.
 *
 * The brief is not "write about X". It is the keyword entry research produced:
 * who ranks today, what their pages leave out, and which questions searchers
 * actually ask. The article is written against that gap, in the studio's voice,
 * under the rules in config.json.
 *
 *   node tools/journal/write.js                      write the top queued keyword
 *   node tools/journal/write.js --keyword "…"        write a specific one
 *   node tools/journal/write.js --count 2            write more than one
 *   node tools/journal/write.js --dry-run            print, save nothing
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

const paragraphs = { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } };

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'metaTitle', 'description', 'excerpt', 'slug', 'keyword',
    'secondaryKeywords', 'intro', 'sections', 'faq', 'internalLinks'],
  properties: {
    title: { type: 'string', description: 'כותרת H1 בעברית, עד 60 תווים, שמכילה את מילת המפתח.' },
    metaTitle: { type: 'string', description: 'כותרת תגית title, עד 60 תווים כולל שם המותג.' },
    description: { type: 'string', description: 'תיאור מטא עד 155 תווים.' },
    excerpt: { type: 'string', description: 'תקציר לכרטיס ברשימת המאמרים, 140-180 תווים.' },
    slug: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', description: 'נתיב באנגלית בלבד.' },
    keyword: { type: 'string' },
    secondaryKeywords: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'string' } },
    intro: paragraphs,
    sections: {
      type: 'array', minItems: 4, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['heading', 'paragraphs'],
        properties: {
          heading: { type: 'string' },
          paragraphs,
          list: {
            type: 'object', additionalProperties: false,
            required: ['type', 'items'],
            properties: {
              type: { type: 'string', enum: ['ul', 'ol'] },
              items: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
            },
          },
          after: { type: 'array', maxItems: 3, items: { type: 'string' } },
        },
      },
    },
    faq: {
      type: 'array', minItems: 3, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['q', 'a'],
        properties: { q: { type: 'string' }, a: { type: 'string' } },
      },
    },
    internalLinks: {
      type: 'array', minItems: 2, maxItems: 4,
      items: {
        type: 'object', additionalProperties: false,
        required: ['href', 'label'],
        properties: { href: { type: 'string' }, label: { type: 'string' } },
      },
    },
  },
};

function systemPrompt(existing) {
  const brand = cfg.brandDna;
  return [
    'את/ה כותב/ת התוכן של סטודיו הפיתוח Red Crown Interactive. את/ה כותב/ת מאמר אחד לבלוג בעברית.',
    '',
    `העסק: ${brand.businessType}`,
    `קול המותג: ${brand.brandVoiceAndTone}`,
    `קהל היעד: ${brand.targetAudience}`,
    `אזור שירות: ${brand.serviceArea}`,
    '',
    'כללים שאסור להפר:',
    `- נושאים אסורים: ${brand.topicsToAvoid}`,
    '- אל תמציא/י לקוחות, מספרים, אחוזי שיפור, ציטוטים או מקרי בוחן.',
    '- אל תבטיח/י דירוג, ROI, מחיר או לוח זמנים.',
    '- אל תשווה/י למתחרים בשמם.',
    '- כתוב/כתבי רק מה שנכון גם אם הקורא הוא מהנדס/ת שמכיר/ה את התחום.',
    '',
    'דרישות מבניות:',
    `- ${cfg.content.wordsMin}-${cfg.content.wordsMax} מילים בסך הכול.`,
    `- ${cfg.content.sectionsMin}-${cfg.content.sectionsMax} כותרות H2 שמתארות החלטה ("מתי לבחור…", "מה לבקש…"), לא נושא כללי.`,
    '- פסקה ראשונה: מצב מוכר מהשטח, ואז מילת המפתח בצורתה המדויקת.',
    '- מילת המפתח חייבת להופיע ב-title, בפסקה הראשונה ובכותרת H2 אחת - ולא יותר מזה.',
    `- ${cfg.content.faqMin}-${cfg.content.faqMax} שאלות נפוצות, עם תשובות של 2-4 משפטים.`,
    '- רשימה אחת לכל היותר במאמר, רק אם היא באמת מוסיפה.',
    `- title עד ${cfg.seo.titleMaxChars} תווים, description עד ${cfg.seo.descriptionMaxChars} תווים.`,
    '- slug באנגלית, מילים מופרדות במקפים, קצר ותיאורי.',
    '',
    'קישורים פנימיים:',
    `- בחר/י ${cfg.content.internalLinksMin}-${cfg.content.internalLinksMax} קישורים מתוך הרשימה המאושרת בלבד: ${cfg.content.internalLinkTargets.map(t => `${t.href} (${t.label})`).join(', ')}`,
    '- מותר לשלב קישור בתוך פסקה בתחביר [טקסט](/נתיב/), רק לנתיבים מהרשימה. אין קישורים חיצוניים.',
    '',
    existing.length ? `מאמרים שכבר קיימים - אל תחזור/תחזרי על התוכן שלהם, מותר לקשר אליהם רק דרך הרשימה המאושרת:\n${existing.map(p => `- ${p.title} (${p.keyword || ''})`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

function brief(entry) {
  return [
    `מילת המפתח: ${entry.keyword}`,
    entry.intent ? `כוונת חיפוש: ${entry.intent}` : '',
    entry.suggestedTitle ? `כותרת מוצעת מהמחקר: ${entry.suggestedTitle}` : '',
    entry.suggestedSlug ? `slug מוצע: ${entry.suggestedSlug}` : '',
    (entry.secondaryKeywords || []).length ? `מילות משנה: ${entry.secondaryKeywords.join(', ')}` : '',
    (entry.competitors || []).length
      ? `מי מדורג היום ומה הזווית שלו:\n${entry.competitors.map(c => `- ${c.domain}: ${c.angle}`).join('\n')}` : '',
    (entry.gaps || []).length
      ? `הפער שצריך למלא (זו הסיבה שהמאמר הזה נכתב):\n${entry.gaps.map(g => `- ${g}`).join('\n')}` : '',
    (entry.questions || []).length
      ? `שאלות שהמחפשים שואלים בפועל - ענה/עני עליהן בגוף המאמר או בשאלות הנפוצות:\n${entry.questions.map(q => `- ${q}`).join('\n')}` : '',
    entry.rationale ? `למה זו הזדמנות: ${entry.rationale}` : '',
    '',
    'כתוב/כתבי את המאמר כך שהוא עונה על הפער הזה טוב יותר מהעמודים המדורגים - לא ארוך יותר, מדויק יותר.',
  ].filter(Boolean).join('\n');
}

/* Cheap, deterministic gates before anything reaches the site. */
function inspect(post) {
  const problems = [];
  const words = posts.wordCount(post);
  const body = [...post.intro, ...post.sections.flatMap(s => [s.heading, ...(s.paragraphs || [])])].join(' ');
  if (post.metaTitle.length > cfg.seo.titleMaxChars + 20) problems.push(`metaTitle is ${post.metaTitle.length} chars`);
  if (post.title.length > cfg.seo.titleMaxChars) problems.push(`title is ${post.title.length} chars (max ${cfg.seo.titleMaxChars})`);
  if (post.description.length > cfg.seo.descriptionMaxChars) problems.push(`description is ${post.description.length} chars (max ${cfg.seo.descriptionMaxChars})`);
  if (words < cfg.content.wordsMin) problems.push(`only ${words} words (min ${cfg.content.wordsMin})`);
  if (words > cfg.content.wordsMax * 1.2) problems.push(`${words} words (max ${cfg.content.wordsMax})`);
  if (!post.title.includes(post.keyword.split(' ')[0])) problems.push('the keyword is missing from the title');
  if (!body.includes(post.keyword)) problems.push('the exact keyword never appears in the body');
  const allowed = new Set(cfg.content.internalLinkTargets.map(target => target.href));
  for (const link of post.internalLinks) {
    if (!allowed.has(link.href)) problems.push(`internal link ${link.href} is not in the approved list`);
  }
  for (const match of body.match(/\]\(([^)]+)\)/g) || []) {
    const href = match.slice(2, -1);
    if (!allowed.has(href)) problems.push(`inline link ${href} is not in the approved list`);
  }
  return { words, problems };
}

async function writeOne(entry, existing) {
  console.log(`[journal] writing "${entry.keyword}"…`);
  const draft = await claude.structured({
    model: cfg.models.write,
    effort: cfg.models.effort,
    label: 'article',
    schema: SCHEMA,
    system: systemPrompt(existing),
    prompt: brief(entry),
  });

  const post = {
    ...draft,
    isoDate: new Date().toISOString(),
    source: 'journal',
    research: {
      opportunityScore: entry.opportunityScore || null,
      gaps: entry.gaps || [],
      competitors: (entry.competitors || []).map(c => c.domain),
    },
  };
  if (existing.some(other => other.slug === post.slug)) post.slug = `${post.slug}-${new Date().getFullYear()}`;

  posts.validate(post);
  const { words, problems } = inspect(post);
  console.log(`[journal] ${words} words, ${post.sections.length} sections, ${post.faq.length} FAQ`);
  if (problems.length) {
    console.warn('[journal] the draft breaks its own rules:');
    for (const problem of problems) console.warn('  - ' + problem);
    if (!argv.includes('--force')) throw new Error('Draft rejected. Re-run, or pass --force to keep it anyway.');
  }
  if (dryRun) {
    console.log(JSON.stringify(post, null, 2));
    return post;
  }
  posts.save(post);
  console.log(`[journal] saved tools/journal/posts/${post.slug}.json`);
  return post;
}

async function main() {
  const existing = posts.all();
  const queue = fs.existsSync(QUEUE) ? JSON.parse(fs.readFileSync(QUEUE, 'utf8')) : [];
  const wanted = flag('keyword', null);
  const count = Math.max(1, Number(flag('count', cfg.schedule.articlesPerRun)));

  let chosen;
  if (wanted) {
    chosen = queue.filter(entry => entry.keyword === wanted);
    if (!chosen.length) chosen = [{ keyword: wanted, status: 'queued' }];
  } else {
    chosen = queue.filter(entry => entry.status === 'queued').slice(0, count);
  }
  if (!chosen.length) {
    console.error('[journal] the keyword queue is empty. Run: node tools/journal/research.js');
    process.exit(1);
  }

  const written = [];
  for (const entry of chosen) {
    const post = await writeOne(entry, [...existing, ...written]);
    written.push(post);
    entry.status = 'used';
    entry.usedBy = post.slug;
    entry.usedAt = post.isoDate;
  }
  if (!dryRun && fs.existsSync(QUEUE)) fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n');
  console.log(`[journal] done. Next: node tools/journal/build.js`);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] write failed:', error.message); process.exit(1); });
}
module.exports = { SCHEMA, inspect };
