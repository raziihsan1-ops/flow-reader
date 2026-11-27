// Flow Reader's offline dictionary, made from Flow's (dict-data: Wordset/WordNet, Olam, Wiktionary).
// Copies it into public/dict, and adds mr/: Malayalam word → the English words it means (Olam, turned around),
// so a Malayalam word in a book can be defined too. Run: node tools/make-dict.cjs
const fs = require('fs');
const path = require('path');

const FROM = path.join(process.env.HOME, 'Projects/Flow/dict-data');
const TO = path.join(__dirname, '..', 'public', 'dict');
fs.rmSync(TO, { recursive: true, force: true });
fs.cpSync(FROM, TO, { recursive: true });

const rev = {};
const ML = /^[ഀ-ൿ‌‍]+$/;
for (const f of fs.readdirSync(path.join(FROM, 'ml'))) {
  const d = JSON.parse(fs.readFileSync(path.join(FROM, 'ml', f), 'utf8'));
  for (const [en, list] of Object.entries(d)) {
    for (const [pos, ml] of list) {
      for (const piece of String(ml).split(/[,;]/)) {
        const w = piece.replace(/[\u200B-\u200D]/g, '').trim();
        if (!w || !ML.test(w.replace(/ /g, '')) || w.split(' ').length > 2) continue;
        const b = `m${(w.codePointAt(0) - 0x0D00).toString(16).padStart(2, '0')}`;
        if (!/^m[0-7][0-9a-f]$/.test(b)) continue;
        rev[b] ??= {};
        const arr = (rev[b][w] ??= []);
        if (arr.length < 16 && !arr.some((x) => x[1] === en)) arr.push([pos || '', en]);
      }
    }
  }
}
fs.mkdirSync(path.join(TO, 'mr'));
let words = 0;
for (const [b, d] of Object.entries(rev)) {
  // shorter, plainer English words first
  for (const k of Object.keys(d)) d[k].sort((x, y) => x[1].split(' ').length - y[1].split(' ').length || x[1].length - y[1].length);
  words += Object.keys(d).length;
  fs.writeFileSync(path.join(TO, 'mr', `${b}.json`), JSON.stringify(d));
}
const meta = JSON.parse(fs.readFileSync(path.join(TO, 'meta.json'), 'utf8'));
meta.mrWords = words;
fs.writeFileSync(path.join(TO, 'meta.json'), JSON.stringify(meta));
console.log('dictionary copied; Malayalam words:', words, 'files:', Object.keys(rev).length);
