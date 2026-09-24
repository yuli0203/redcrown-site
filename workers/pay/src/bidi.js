// Bidirectional text ordering for PDF lines: logical order in, visual order
// (left to right, as drawn) out.
//
// This follows the Unicode Bidirectional Algorithm (UAX #9) for one line with
// no explicit embeddings, which is what our documents contain (Hebrew, Latin,
// numbers, punctuation):
//   W1-W7  weak types: numbers take the direction of the text around them, so
//          "3D design" and "milestone 2" stay together in a Hebrew line;
//          separators inside numbers ("1,250.00", "23/09/2026") and currency
//          signs next to them ("₪4,640.00") join the number.
//   N0     paired brackets take the direction of the text inside them, so
//          "(Unity, Meta Quest 3)" keeps both brackets with the English.
//   N1-N2  other spaces and punctuation take the direction of their
//          neighbours when these agree, otherwise the line's.
//   I1-I2, L1, L2, L4  levels, trailing spaces, reordering, mirrored brackets.
//
// Our labels are bilingual, "עברית / English". A line containing " / " is
// treated as sections, each with its own direction (like HTML <bdi>), laid
// out in the line's direction: "תודה! / Thank you!" keeps each "!" with its
// own language instead of the English one jumping to the far end.

const RTL_LETTER = /[\u0590-\u05FF\u07C0-\u085F\uFB1D-\uFB4F]/;
const ARABIC_LETTER = /[\u0600-\u07BF\u0860-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const MARK = /\p{M}/u;
const LETTER = /\p{L}/u;
const DIGIT = /[0-9\u00B2\u00B3\u00B9\u2070-\u2079\u2080-\u2089]/;
const EUROPEAN_SEPARATOR = /[+\-\u2212\u207A\u207B\u208A\u208B\uFB29\uFE62\uFE63\uFF0B\uFF0D]/;
const EUROPEAN_TERMINATOR = /[#$%\u00A2-\u00A5\u00B0\u00B1\u066A\u09F2\u09F3\u2030-\u2034\u20A0-\u20CF\u212E\u2213\uFE5F\uFE69\uFE6A\uFF03-\uFF05\uFFE0\uFFE1\uFFE5\uFFE6]/;
const COMMON_SEPARATOR = /[,.\/:\u00A0\u060C\u202F\u2044\uFE50\uFE52\uFE55\uFF0C\uFF0E\uFF0F\uFF1A]/;
const WHITESPACE = /[ \t\u1680\u2000-\u200A\u2028\u205F\u3000\f]/;
const OPEN = { '(': ')', '[': ']', '{': '}', '\u00AB': '\u00BB', '\u2039': '\u203A', '\u2045': '\u2046', '\u207D': '\u207E', '\u208D': '\u208E', '\u2329': '\u232A', '\u3008': '\u3009', '\uFF08': '\uFF09', '\uFF3B': '\uFF3D', '\uFF5B': '\uFF5D' };
const CLOSE = Object.fromEntries(Object.entries(OPEN).map(([o, c]) => [c, o]));
const MIRROR = { ...OPEN, ...CLOSE, '<': '>', '>': '<', '\u2264': '\u2265', '\u2265': '\u2264' };

export const hasHebrew = text => RTL_LETTER.test(text) || ARABIC_LETTER.test(text);

const bidiClass = c => (
  RTL_LETTER.test(c) && !MARK.test(c) ? 'R'
  : ARABIC_LETTER.test(c) && !MARK.test(c) ? 'AL'
  : MARK.test(c) ? 'NSM'
  : DIGIT.test(c) ? 'EN'
  : LETTER.test(c) ? 'L'
  : EUROPEAN_SEPARATOR.test(c) ? 'ES'
  : EUROPEAN_TERMINATOR.test(c) || /\p{Sc}/u.test(c) ? 'ET'
  : COMMON_SEPARATOR.test(c) ? 'CS'
  : WHITESPACE.test(c) ? 'WS'
  : 'ON');

// Resolved embedding level of each character (0 = left-to-right, 1 = right-to-left, 2 = numbers or Latin in a right-to-left line).
function levels(chars, rtl) {
  const e = rtl ? 'R' : 'L';           // embedding direction = sos = eos
  const t = chars.map(bidiClass);
  const n = t.length;

  // W1: marks take the type of what they follow.
  for (let i = 0; i < n; i++) if (t[i] === 'NSM') t[i] = i ? (['WS', 'ON'].includes(t[i - 1]) ? 'ON' : t[i - 1]) : e;
  // W2 (no Arabic digits here), W3: AL -> R.
  for (let i = 0; i < n; i++) if (t[i] === 'AL') t[i] = 'R';
  // W4: one separator between two numbers joins them.
  for (let i = 1; i < n - 1; i++) {
    if ((t[i] === 'ES' || t[i] === 'CS') && t[i - 1] === 'EN' && t[i + 1] === 'EN') t[i] = 'EN';
  }
  // W5: terminators (currency, %, #) next to a number join it.
  for (let i = 0; i < n; i++) {
    if (t[i] !== 'ET') continue;
    let j = i;
    while (j < n && t[j] === 'ET') j++;
    if ((i > 0 && t[i - 1] === 'EN') || (j < n && t[j] === 'EN')) for (let k = i; k < j; k++) t[k] = 'EN';
    i = j - 1;
  }
  // W6: leftover separators and terminators are neutral.
  for (let i = 0; i < n; i++) if (['ES', 'ET', 'CS'].includes(t[i])) t[i] = 'ON';
  // W7: a number whose preceding strong text is Latin (or sos, in a left-to-right line) is L.
  let strong = e;
  for (let i = 0; i < n; i++) {
    if (t[i] === 'L' || t[i] === 'R') strong = t[i];
    else if (t[i] === 'EN' && strong === 'L') t[i] = 'L';
  }

  // N0: paired brackets (BD16), processed in order of their opening bracket.
  const pairs = [];
  const stack = [];
  for (let i = 0; i < n && stack.length <= 63; i++) {
    if (t[i] !== 'ON') continue;
    if (OPEN[chars[i]]) stack.push({ c: chars[i], i });
    else if (CLOSE[chars[i]]) {
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s].c === CLOSE[chars[i]]) { pairs.push([stack[s].i, i]); stack.length = s; break; }
      }
    }
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const dirOf = x => (x === 'L' ? 'L' : x === 'R' || x === 'EN' ? 'R' : null);
  for (const [o, c] of pairs) {
    let found = null;
    for (let k = o + 1; k < c; k++) {
      const d = dirOf(t[k]);
      if (d === e) { found = e; break; }
      if (d) found = d;
    }
    if (!found) continue;
    let dir = found;
    if (found !== e) {
      // Only strong text of the other direction inside: follow the context before.
      let before = e;
      for (let k = o - 1; k >= 0; k--) { const d = dirOf(t[k]); if (d) { before = d; break; } }
      dir = before === found ? found : e;
    }
    t[o] = t[c] = dir;
    // Marks right after a bracket follow it.
    for (const b of [o, c]) for (let k = b + 1; k < n && MARK.test(chars[k]); k++) t[k] = dir;
  }

  // N1/N2: runs of neutrals between the same direction take it (numbers count as R), otherwise e.
  for (let i = 0; i < n; i++) {
    if (t[i] !== 'WS' && t[i] !== 'ON') continue;
    let j = i;
    while (j < n && (t[j] === 'WS' || t[j] === 'ON')) j++;
    const before = i ? dirOf(t[i - 1]) : e;
    const after = j < n ? dirOf(t[j]) : e;
    const dir = before === after ? before : e;
    for (let k = i; k < j; k++) t[k] = dir;
    i = j - 1;
  }

  // I1/I2: levels.
  const base = rtl ? 1 : 0;
  const lv = t.map(x => (rtl ? (x === 'L' || x === 'EN' ? 2 : 1) : (x === 'R' ? 1 : x === 'EN' ? 2 : 0)));
  // L1: trailing whitespace goes back to the line's level.
  for (let i = n - 1; i >= 0 && WHITESPACE.test(chars[i]); i--) lv[i] = base;
  return lv;
}

// L2 and L4: reverse runs from the highest level down, mirror brackets in right-to-left text.
function reorder(chars, lv) {
  const out = chars.map((c, i) => (lv[i] % 2 ? MIRROR[c] || c : c));
  const idx = out.map((_, i) => i);
  const max = Math.max(...lv);
  const minOdd = Math.min(...lv.filter(l => l % 2), Infinity);
  for (let level = max; level >= minOdd && level > 0; level--) {
    for (let i = 0; i < idx.length; i++) {
      if (lv[idx[i]] < level) continue;
      let j = i;
      while (j < idx.length && lv[idx[j]] >= level) j++;
      idx.splice(i, j - i, ...idx.slice(i, j).reverse());
      i = j - 1;
    }
  }
  return idx.map(i => out[i]).join('');
}

// Direction of a piece of text from its first strong letter (like dir="auto").
const autoRtl = (chars, fallback) => {
  for (const c of chars) {
    const k = bidiClass(c);
    if (k === 'R' || k === 'AL') return true;
    if (k === 'L') return false;
  }
  return fallback;
};

const visualLine = (chars, rtl) => (chars.length ? reorder(chars, levels(chars, rtl)) : '');

// Logical string -> visual string for left-to-right glyph drawing.
export function visual(text, base = hasHebrew(text) ? 'rtl' : 'ltr') {
  const s = String(text ?? '');
  if (!s) return '';
  const rtl = base === 'rtl';
  const sections = s.split(' / ');
  if (sections.length === 1) return visualLine([...s], rtl);
  // Bilingual "a / b": each section in its own direction, sections in the line's.
  const parts = sections.map(sec => visualLine([...sec], autoRtl([...sec], rtl)));
  return (rtl ? parts.reverse() : parts).join(' / ');
}
