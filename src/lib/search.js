import { getText } from '../store.js';
import { formatTime } from './media.js';

// Search everything, like Flow: file names, the words inside every file, your marks and comments,
// and video time notes. Results come in groups; each one opens right at its spot.

const cache = new Map(); // file → [{ at, text }]
export async function loadIndex(items) {
  await Promise.all(items.filter((i) => i.file && (i.type === 'pdf' || i.type === 'doc') && !cache.has(i.file)).map(async (i) => {
    cache.set(i.file, (await getText(i.file)) || []);
  }));
}
export const forgetIndex = (file) => cache.delete(file);

const norm = (s) => String(s || '').toLowerCase();
// A short piece of text around the found words: { before, hit, after }
function snippet(text, i, len, room = 54) {
  const a = Math.max(0, i - room);
  const b = Math.min(text.length, i + len + room);
  return {
    before: (a > 0 ? '…' : '') + text.slice(a, i).replace(/\s+/g, ' ').trimStart(),
    hit: text.slice(i, i + len),
    after: text.slice(i + len, b).replace(/\s+/g, ' ').trimEnd() + (b < text.length ? '…' : ''),
  };
}
const whereOfMark = (item, m) => (item.type === 'pdf' ? `P. ${m.rects?.[0]?.p ?? ''}` : m.parts?.[0] ? `Part ${m.parts[0].s + 1}` : '');

export function searchAll(items, query) {
  const q = norm(query).trim();
  if (q.length < 2) return null;
  const files = []; const inside = []; const marks = []; const notes = [];
  for (const item of items) {
    const hay = norm(`${item.title} ${item.name} ${item.author || ''} ${item.channel || ''}`);
    if (hay.includes(q)) files.push({ item });

    // words inside the file: up to 3 places per file
    const pages = cache.get(item.file);
    if (pages?.length) {
      let found = 0; let total = 0;
      for (const p of pages) {
        const low = norm(p.text);
        let i = low.indexOf(q);
        while (i >= 0) {
          total += 1;
          if (found < 3) {
            inside.push({ item, at: p.at, q: p.text.substr(i, q.length), snip: snippet(p.text, i, q.length), where: item.type === 'pdf' ? `Page ${p.at}` : (p.label ? (p.label.length > 22 ? `${p.label.slice(0, 21)}…` : p.label) : `Part ${p.at + 1}`) });
            found += 1;
          }
          i = low.indexOf(q, i + q.length);
        }
      }
      if (total > found && found) inside[inside.length - 1].more = total - found;
    }

    for (const m of item.marks || []) {
      const inText = norm(m.text).indexOf(q);
      const inNote = norm(m.note).indexOf(q);
      if (inText < 0 && inNote < 0) continue;
      marks.push({ item, mark: m, where: whereOfMark(item, m), snip: inText >= 0 ? snippet(m.text, inText, q.length, 70) : null, note: inNote >= 0 ? snippet(m.note, inNote, q.length, 70) : null });
    }
    for (const n of item.tnotes || []) {
      const i = norm(n.text).indexOf(q);
      if (i >= 0) notes.push({ item, note: n, where: formatTime(n.t), snip: snippet(n.text, i, q.length, 70) });
    }
  }
  return { files, inside, marks, notes, count: files.length + inside.length + marks.length + notes.length };
}
