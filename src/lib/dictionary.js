// Define a word, offline, in three languages: English, Malayalam and Arabic.
// The word lists ship inside the app (public/dict, made by tools/make-dict.cjs from Flow's dictionary):
//   en/<letter> → { word: [[partOfSpeech, meaning, [synonyms]], …] }   English meanings (Wordset, from WordNet)
//   ml/<letter> → { word: [[partOfSpeech, malayalam], …] }            Malayalam meanings (Olam)
//   ea/<letter> → { word: [[arabic, partOfSpeech, gloss], …] }        Arabic words for an English word (Wiktionary)
//   ar/x<hex>   → { arabic: [[partOfSpeech, english, voweled], …] }   English meanings of Arabic words (Wiktionary)
//   mr/m<hex>   → { malayalam: [[partOfSpeech, english], …] }        English words for a Malayalam word (Olam, turned around)
// Whatever language the word is in, you get all three where the lists allow.

const cache = new Map();
function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`./dict/${name}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => { cache.delete(name); return {}; }));
  }
  return cache.get(name);
}
const letter = (w) => { const c = w[0]; return c >= 'a' && c <= 'z' ? c : '_'; };

// ---- Telling the languages apart ----
export const isArabic = (s) => /[؀-ۿ]/.test(s || '');
export const isMalayalam = (s) => /[ഀ-ൿ]/.test(s || '');
export const isEnglishWord = (s) => /^[A-Za-z][A-Za-z'’-]{0,30}$/.test((s || '').trim());
export const isArabicWord = (s) => /^[ء-يً-ٰٟٱ-ۓـ]{2,30}$/.test((s || '').trim());
export const isMalayalamWord = (s) => /^[ഀ-ൿ​-‍]{2,40}$/.test((s || '').trim());
export const isDefinable = (s) => isEnglishWord(s) || isArabicWord(s) || isMalayalamWord(s);
export const langOf = (s) => (isArabic(s) ? 'ar' : isMalayalam(s) ? 'ml' : 'en');

const plainArabic = (s) => (s || '').normalize('NFC')
  .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
  .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^ء-ي ]/g, '').trim();

// ---- English ----
// A word as it appears in a sentence → the forms a dictionary lists ("running" → run, "studies" → study).
export function wordForms(raw) {
  const w = (raw || '').toLowerCase().replace(/[’']s$/, '').replace(/[^a-z\- ']/g, '').trim();
  if (!w) return [];
  const out = [w];
  const add = (x) => { if (x && x.length > 1 && !out.includes(x)) out.push(x); };
  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) { add(w.slice(0, -2)); add(w.slice(0, -1)); if (/(.)\1ed$/.test(w)) add(w.slice(0, -3)); }
  if (w.endsWith('ing')) { add(w.slice(0, -3)); add(`${w.slice(0, -3)}e`); if (/(.)\1ing$/.test(w)) add(w.slice(0, -4)); }
  if (w.endsWith('er')) { add(w.slice(0, -2)); add(w.slice(0, -1)); }
  if (w.endsWith('est')) { add(w.slice(0, -3)); add(w.slice(0, -2)); }
  if (w.endsWith('ier')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('iest')) add(`${w.slice(0, -4)}y`);
  if (w.endsWith('ly')) { add(w.slice(0, -2)); if (w.endsWith('ily')) add(`${w.slice(0, -3)}y`); }
  if (w.endsWith('ness')) add(w.slice(0, -4));
  return out;
}

async function english(raw) {
  const forms = wordForms(raw);
  if (!forms.length) return null;
  const [en, ml, ea] = await Promise.all([load(`en/${letter(forms[0])}`), load(`ml/${letter(forms[0])}`), load(`ea/${letter(forms[0])}`)]);
  for (const f of forms) {
    if (en[f] || ml[f] || ea[f]) return { word: f, en: en[f] || [], ml: ml[f] || [], ar: ea[f] || [] };
  }
  return { word: forms[0], en: [], ml: [], ar: [] };
}

// Malayalam and Arabic for a few English words (used when the word itself is Arabic or Malayalam).
async function throughEnglish(words) {
  const ml = []; const ar = [];
  for (const w of words.slice(0, 4)) {
    const r = await english(w);
    if (!r) continue;
    for (const m of r.ml) if (ml.length < 8 && !ml.some((x) => x[1] === m[1])) ml.push(m);
    for (const a of r.ar) if (ar.length < 6 && !ar.some((x) => x[0] === a[0])) ar.push(a);
  }
  return { ml, ar };
}
// The plain English word inside a gloss: "to pray, to invoke God" → pray
const headWords = (glosses) => [...new Set(glosses.flatMap((g) => String(g).split(/[,;]/))
  .map((g) => g.replace(/\(.*?\)/g, '').trim().toLowerCase()
    .replace(/^to\s+/, '').replace(/^(be|have|become|get|feel|show|a|an|the)\s+/, '').trim())
  .filter((g) => /^[a-z][a-z-]{1,24}$/.test(g)))];

// ---- Arabic ----
const AR_PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', 'س'];
const AR_SUFFIXES = ['كما', 'هما', 'تما', 'ونه', 'ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'كن', 'نا', 'تم', 'وا', 'ه', 'ك', 'ي'];
const arBucket = (p) => `x${(p.charCodeAt(0) - 0x0600).toString(16).padStart(2, '0')}`;
async function arEntry(p) {
  if (!p) return null;
  const d = await load(`ar/${arBucket(p)}`);
  let v = d[p];
  if (typeof v === 'string') { // a plural or other form: its main word
    const main = v.slice(1);
    v = (await load(`ar/${arBucket(main)}`))[main];
    return Array.isArray(v) ? { key: main, list: v } : null;
  }
  return Array.isArray(v) ? { key: p, list: v } : null;
}
async function arabic(asked) {
  const p = plainArabic(asked).replace(/\s/g, '');
  const tries = [p];
  for (const pre of AR_PREFIXES) if (p.startsWith(pre) && p.length - pre.length >= 2) tries.push(p.slice(pre.length));
  for (const t of [...tries]) for (const suf of AR_SUFFIXES) if (t.endsWith(suf) && t.length - suf.length >= 2) tries.push(t.slice(0, -suf.length));
  for (const t of [...tries]) if (t.endsWith('ه')) tries.push(t.slice(0, -1));
  const nounish = /^(و|ف|ب|ك|ل)?ال/.test(p) || /(ين|ون|ات)$/.test(p);
  for (const t of tries) {
    const hit = await arEntry(t);
    if (!hit) continue;
    const list = nounish ? [...hit.list].sort((a, b) => (a[0] === 'verb') - (b[0] === 'verb')) : hit.list;
    const en = list.map(([pos, gloss, canon]) => [pos, gloss, [], canon]);
    const top = list.slice(0, 2);
    let { ml } = await throughEnglish(headWords(top.map((x) => x[1])));
    // Keep the Malayalam that is the same kind of word ("to be patient" → patient, the adjective, not a sick patient)
    const kinds = new Set(top.map((x) => x[0]));
    if (top.some((x) => /^to be /i.test(x[1]))) kinds.add('adjective');
    const same = ml.filter((m) => kinds.has(m[0]));
    if (same.length) ml = same;
    return { word: list[0][2] || t, en, ml, ar: [], via: 'en' };
  }
  return { word: asked, en: [], ml: [], ar: [] };
}

// ---- Malayalam ----
const mlBucket = (w) => `m${(w.codePointAt(0) - 0x0D00).toString(16).padStart(2, '0')}`;
// Common endings in running text: പുസ്തകത്തിന്റെ, ക്ഷമയോടെ, വീട്ടിൽ …
const ML_ENDINGS = ['ത്തിന്റെ', 'ത്തിനു', 'ത്തിന്', 'ത്തിൽ', 'ത്തെ', 'ത്തോടെ', 'ിന്റെ', 'ന്റെ', 'യുടെ', 'ുടെ', 'യോടെ', 'ോടെ', 'യിൽ', 'ിൽ', 'ൽ', 'ിലെ', 'ലെ', 'യിലെ', 'യെ', 'ിനെ', 'നെ', 'െ', 'ിന്', 'ന്', 'ക്ക്', 'യ്ക്ക്', 'ും', 'യും', 'ോ', 'യോ', 'ാണ്', 'ാകുന്നു', 'ങ്ങൾ', 'കൾ', 'ുകൾ'];
async function malayalam(asked) {
  const w = asked.replace(/[​-‍]/g, '').trim();
  const d = await load(`mr/${mlBucket(w)}`);
  const tries = [w];
  for (const e of ML_ENDINGS) if (w.endsWith(e) && w.length - e.length >= 2) { const base = w.slice(0, -e.length); tries.push(base, `${base}ം`, `${base}്`); }
  let key = tries.find((t) => d[t]);
  if (!key) { // the longest listed word the selected word starts with
    key = Object.keys(d).filter((k) => k.length >= 3 && w.startsWith(k)).sort((a, b) => b.length - a.length)[0];
  }
  if (!key) return { word: w, en: [], ml: [], ar: [], mlWords: [] };
  const words = d[key].map((x) => x[1]);
  // English meanings of the first plain English word, plus Arabic words for it
  let en = []; let ar = [];
  for (const e of words.slice(0, 3)) {
    const r = await english(e);
    if (r?.en.length && !en.length) en = r.en.slice(0, 4).map((m) => [m[0], m[1], [], null, e]);
    for (const a of r?.ar || []) if (ar.length < 6 && !ar.some((x) => x[0] === a[0])) ar.push(a);
  }
  return { word: key, en, ml: [], ar, mlWords: words.slice(0, 10), via: 'ml' };
}

// Look a word up, whatever its language: { word, asked, lang, en, ml, ar, mlWords }
export async function lookUp(raw) {
  const asked = (raw || '').trim();
  if (!asked) return null;
  const lang = langOf(asked);
  const r = lang === 'ar' ? await arabic(asked) : lang === 'ml' ? await malayalam(asked) : await english(asked);
  return r && { ...r, asked, lang };
}

// Meanings grouped by part of speech, in the order they first appear.
export function byPart(list) {
  const out = [];
  for (const item of list) {
    const pos = item[0] || 'other';
    let g = out.find((x) => x.pos === pos);
    if (!g) { g = { pos, items: [] }; out.push(g); }
    g.items.push(item);
  }
  return out;
}
