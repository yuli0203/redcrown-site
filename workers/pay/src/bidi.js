// Bidirectional text ordering for PDF lines (pdf-lib has no bidi support).
//
// A simplified Unicode Bidi Algorithm for a single line of Hebrew mixed with
// Latin text and numbers, which is all our documents contain:
// - Hebrew letters are right-to-left (R); Latin letters left-to-right (L).
// - Digits are European numbers (EN). Separators between digits ("1,250.00",
//   "23/09/2026") and currency or percent signs next to them join the number.
//   A number whose preceding strong letter is Latin becomes L (rule W7).
// - Spaces and punctuation take the direction of both neighbours when they
//   agree, numbers counting as R (rule N1), otherwise the line direction.
// - Right-to-left lines are laid out by reversing the order of runs, and the
//   characters of R runs (with mirrored brackets); L and EN runs keep their
//   character order, so numbers stay readable.

const HEBREW = /[֐-׿יִ-ﭏ]/;
const LATIN = /[A-Za-zÀ-ɏ]/;
const DIGIT = /[0-9]/;
const NUM_SEPARATOR = /[.,/:\-]/;
const NUM_AFFIX = /[$€£₪%#+]/;
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };

export const hasHebrew = text => HEBREW.test(text);

function classes(chars, baseDir) {
  const cls = chars.map(c => (HEBREW.test(c) ? 'R' : LATIN.test(c) ? 'L' : DIGIT.test(c) ? 'EN' : 'N'));
  // Separators between digits, and affixes touching a number, join it.
  for (let i = 1; i < cls.length - 1; i++) {
    if (cls[i] === 'N' && NUM_SEPARATOR.test(chars[i]) && cls[i - 1] === 'EN' && cls[i + 1] === 'EN') cls[i] = 'EN';
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < cls.length; i++) {
      if (cls[i] === 'N' && NUM_AFFIX.test(chars[i]) && (cls[i - 1] === 'EN' || cls[i + 1] === 'EN')) cls[i] = 'EN';
    }
  }
  // W7: a number after Latin text (or at the start of a left-to-right line) is L.
  let lastStrong = baseDir;
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] === 'L' || cls[i] === 'R') lastStrong = cls[i];
    else if (cls[i] === 'EN' && lastStrong === 'L') cls[i] = 'L';
  }
  // N1/N2: neutrals between two of the same direction take it (EN counts as R).
  const asDir = c => (c === 'EN' ? 'R' : c);
  const out = cls.slice();
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] !== 'N') continue;
    let j = i;
    while (j < cls.length && cls[j] === 'N') j++;
    const before = i > 0 ? asDir(out[i - 1]) : baseDir;
    const after = j < cls.length ? asDir(cls[j]) : baseDir;
    const dir = before === after ? before : baseDir;
    for (let k = i; k < j; k++) out[k] = dir;
    i = j - 1;
  }
  return out;
}

// Logical string -> visual string for left-to-right glyph drawing.
export function visual(text, base = hasHebrew(text) ? 'rtl' : 'ltr') {
  const chars = [...String(text ?? '')];
  if (!chars.length) return '';
  const baseDir = base === 'rtl' ? 'R' : 'L';
  const cls = classes(chars, baseDir);

  const runs = [];
  cls.forEach((c, i) => {
    const last = runs[runs.length - 1];
    if (last && last.type === c) last.chars.push(chars[i]);
    else runs.push({ type: c, chars: [chars[i]] });
  });
  const render = run => (run.type === 'R' ? run.chars.slice().reverse().map(c => MIRROR[c] || c) : run.chars).join('');

  if (baseDir === 'L') {
    // Left-to-right line: reverse each maximal right-to-left stretch (R and EN
    // runs), keeping EN runs' own order.
    const out = [];
    let stretch = [];
    const flush = () => { out.push(...stretch.reverse().map(render)); stretch = []; };
    for (const run of runs) {
      if (run.type === 'L') { flush(); out.push(render(run)); } else stretch.push(run);
    }
    flush();
    return out.join('');
  }
  return runs.slice().reverse().map(render).join('');
}
