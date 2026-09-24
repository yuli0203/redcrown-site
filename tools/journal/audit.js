#!/usr/bin/env node
/*
 * Audit every published article.
 *
 * The local pass is deterministic and free: lengths, keyword placement,
 * structure, internal links, duplication between articles. The --deep pass adds
 * a live comparison against what currently ranks for each keyword, which costs
 * an API call per article.
 *
 *   node tools/journal/audit.js            local checks, writes audit-report.md
 *   node tools/journal/audit.js --deep     also compare against the live results
 *   node tools/journal/audit.js --strict   exit non-zero when something is wrong
 */
'use strict';
const fs = require('fs');
const path = require('path');
const posts = require('./lib/posts.js');

const cfg = posts.config();
const argv = process.argv.slice(2);
const deep = argv.includes('--deep');
const strict = argv.includes('--strict');
const REPORT = path.join(__dirname, 'audit-report.md');
const ROOT = path.resolve(__dirname, '..', '..');

const bodyOf = post => [
  ...post.intro,
  ...post.sections.flatMap(s => [s.heading, ...(s.paragraphs || []), ...((s.list && s.list.items) || []), ...(s.after || [])]),
  ...(post.faq || []).flatMap(f => [f.q, f.a]),
].join('\n');

function occurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function checkPost(post, all) {
  const findings = [];
  const add = (level, message, fix) => findings.push({ level, message, fix });
  const body = bodyOf(post);
  const words = posts.wordCount(post);
  const keyword = post.keyword || '';

  if (!keyword) add('error', 'אין מילת מפתח מוגדרת', 'הוסיפו keyword לרשומה כדי שהאודיט והמחקר יוכלו לעקוב אחריה');
  if (post.title.length > cfg.seo.titleMaxChars) add('warn', `כותרת באורך ${post.title.length} תווים`, `קצרו אל מתחת ל-${cfg.seo.titleMaxChars}`);
  if ((post.metaTitle || '').length > 75) add('warn', `metaTitle באורך ${post.metaTitle.length} תווים`, 'גוגל יחתוך אותו בתוצאות');
  if (post.description.length > cfg.seo.descriptionMaxChars) add('warn', `תיאור מטא באורך ${post.description.length} תווים`, `קצרו אל מתחת ל-${cfg.seo.descriptionMaxChars}`);
  if (post.description.length < 110) add('info', `תיאור מטא קצר (${post.description.length} תווים)`, 'ניצול מלא של השורה בתוצאות החיפוש');
  if (post.excerpt.length > 200) add('info', `תקציר ארוך (${post.excerpt.length} תווים)`, 'הכרטיס ברשימה חותך אותו');

  if (keyword && !post.title.includes(keyword)) {
    const partial = keyword.split(' ').filter(word => post.title.includes(word)).length;
    add(partial >= 2 ? 'info' : 'warn', 'מילת המפתח אינה מופיעה במדויק בכותרת', 'שלבו את הצירוף המדויק אם הוא נשמע טבעי');
  }
  if (keyword && !post.intro.join(' ').includes(keyword)) add('warn', 'מילת המפתח אינה בפסקה הראשונה', 'שלבו אותה במשפט השני או השלישי');
  if (keyword && !post.sections.some(section => section.heading.includes(keyword))) {
    add('info', 'מילת המפתח אינה באף כותרת H2', 'כותרת אחת עם הצירוף המדויק עוזרת לרלוונטיות');
  }
  const density = keyword ? occurrences(body, keyword) / Math.max(1, words) : 0;
  if (density > 0.02) add('warn', `צפיפות מילת מפתח ${(density * 100).toFixed(1)}%`, 'הורידו חזרות; גוגל לא צריך אותן');

  if (words < cfg.content.wordsMin) add('warn', `${words} מילים בלבד`, `היעד הוא ${cfg.content.wordsMin}-${cfg.content.wordsMax}`);
  if (words > cfg.content.wordsMax * 1.3) add('info', `${words} מילים`, 'ארוך מהיעד - בדקו אם יש כפילות');
  if (post.sections.length < cfg.content.sectionsMin) add('warn', `${post.sections.length} כותרות H2 בלבד`, `היעד הוא ${cfg.content.sectionsMin}+`);
  if (!(post.faq || []).length) add('warn', 'אין שאלות נפוצות', 'FAQPage מזכה בתצוגה מורחבת בתוצאות ועונה על PAA');
  else if (post.faq.length < cfg.content.faqMin) add('info', `${post.faq.length} שאלות נפוצות`, `היעד הוא ${cfg.content.faqMin}+`);

  const links = post.internalLinks || [];
  if (links.length < cfg.content.internalLinksMin) add('warn', `${links.length} קישורים פנימיים`, `היעד הוא ${cfg.content.internalLinksMin}+`);
  const approved = new Set(cfg.content.internalLinkTargets.map(target => target.href));
  for (const link of links) {
    if (!approved.has(link.href)) add('info', `קישור פנימי לא ברשימה המאושרת: ${link.href}`, 'ודאו שהנתיב קיים');
    const target = path.join(ROOT, link.href.split('?')[0], 'index.html');
    if (!link.href.includes('?') && !fs.existsSync(target)) add('error', `קישור פנימי שבור: ${link.href}`, 'העמוד לא קיים בריפו');
  }
  for (const match of bodyOf(post).match(/\]\(([^)]+)\)/g) || []) {
    const href = match.slice(2, -1);
    if (href.startsWith('http')) add('warn', `קישור חיצוני בתוך הטקסט: ${href}`, 'המדיניות היא קישורים פנימיים בלבד');
  }

  if (Date.parse(post.isoDate) > Date.now() + 86400000) add('error', 'תאריך הפרסום בעתיד', 'תקנו את isoDate');
  if (!(post.secondaryKeywords || []).length) add('info', 'אין מילות משנה', 'מילות משנה עוזרות לכסות שאילתות קרובות');

  for (const other of all) {
    if (other.slug === post.slug) continue;
    if (other.keyword && keyword && other.keyword === keyword) {
      add('error', `אותה מילת מפתח כמו ${other.slug}`, 'קניבליזציה: אחד מהם צריך מיקוד אחר או מיזוג');
    }
    if (other.title === post.title) add('error', `כותרת זהה ל-${other.slug}`, 'שנו כותרת');
  }
  return findings;
}

async function deepReview(post) {
  const claude = require('./lib/claude.js');
  const review = await claude.explore({
    model: cfg.models.audit,
    effort: cfg.models.effort,
    search: 6,
    system: 'את/ה עורך/ת SEO. בדוק/בדקי מאמר קיים מול התוצאות שמדורגות היום בפועל. תן/תני עד חמש הערות ממוקדות, כל אחת עם פעולה מדויקת. אל תשבח/י, אל תסכם/י את המאמר, ואל תמציא/י נתוני נפח חיפוש.',
    prompt: [
      `מילת המפתח: ${post.keyword}`,
      `הכותרת: ${post.title}`,
      `התיאור: ${post.description}`,
      `הכותרות במאמר: ${post.sections.map(s => s.heading).join(' | ')}`,
      `שאלות נפוצות: ${(post.faq || []).map(f => f.q).join(' | ') || 'אין'}`,
      '',
      'חפש/י את מילת המפתח בגוגל בעברית, בדוק/בדקי מה מדורג, וענה/עני:',
      '1. האם הכוונה של המאמר תואמת את מה שגוגל מדרג לשאילתה הזו?',
      '2. אילו נושאים מופיעים אצל המדורגים ולא מכוסים כאן?',
      '3. מה בכותרת או בתיאור היה מגדיל הקלקה?',
      '4. איזו שאלה מ-People Also Ask חסרה?',
      '5. אם אין בעיה משמעותית, אמור/י זאת בשורה אחת.',
    ].join('\n'),
  });
  return review.text;
}

async function main() {
  const all = posts.all();
  if (!all.length) { console.log('[journal] no articles to audit.'); return; }

  const lines = ['# אודיט מאמרים - Red Crown Journal', '',
    `נבדקו ${all.length} מאמרים · ${new Date().toISOString().slice(0, 10)}`, ''];
  let errors = 0, warnings = 0;

  for (const post of all) {
    const findings = checkPost(post, all);
    errors += findings.filter(f => f.level === 'error').length;
    warnings += findings.filter(f => f.level === 'warn').length;
    lines.push(`## ${post.title}`, '',
      `\`/blog/${post.slug}/\` · ${post.isoDate.slice(0, 10)} · ${posts.wordCount(post)} מילים · מילת מפתח: ${post.keyword || '—'}`, '');
    if (!findings.length) lines.push('אין ממצאים.', '');
    for (const finding of findings) {
      const icon = { error: '🔴', warn: '🟡', info: '🔵' }[finding.level];
      lines.push(`- ${icon} **${finding.message}** — ${finding.fix}`);
    }
    if (findings.length) lines.push('');
    if (deep) {
      console.log(`[journal] deep review: ${post.slug}`);
      try {
        lines.push('### מול התוצאות החיות', '', await deepReview(post), '');
      } catch (error) {
        lines.push(`### מול התוצאות החיות`, '', `הבדיקה נכשלה: ${error.message}`, '');
      }
    }
  }

  lines.push('---', '', `סיכום: ${errors} שגיאות, ${warnings} אזהרות.`);
  const report = lines.join('\n') + '\n';
  fs.writeFileSync(REPORT, report);
  console.log(report);
  console.log(`[journal] wrote ${path.relative(ROOT, REPORT)}`);
  if (strict && errors) process.exit(1);
}

if (require.main === module) {
  main().catch(error => { console.error('[journal] audit failed:', error.message); process.exit(1); });
}
module.exports = { checkPost };
