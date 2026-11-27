// Marks in books and documents. The text reflows (any font, any size), so a mark is saved as
// character positions inside a chapter: { parts: [{ s: chapter, start, end }] }, plus the words themselves.
import { colorOf } from './marks.js';

// How many characters of the chapter's text come before a point.
function offsetIn(sectionEl, node, offset) {
  const r = document.createRange();
  r.setStart(sectionEl, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

export function rangeToParts(range, sectionEls) {
  const parts = [];
  for (const el of sectionEls) {
    if (!range.intersectsNode(el)) continue;
    const s = Number(el.dataset.s);
    const start = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
    const end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : el.textContent.length;
    if (end > start) parts.push({ s, start, end });
  }
  return parts;
}

const NOT_INSIDE = /^(TABLE|TBODY|THEAD|TFOOT|TR|UL|OL|DL|COLGROUP)$/;

// Wrap characters [start, end) of a chapter in a <mark> (one per text piece it crosses).
function wrap(sectionEl, start, end, make) {
  const walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_TEXT);
  const hits = [];
  let pos = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.data.length;
    const a = Math.max(start, pos) - pos;
    const b = Math.min(end, pos + len) - pos;
    if (b > a && !NOT_INSIDE.test(n.parentNode.nodeName) && n.data.slice(a, b).trim()) hits.push([n, a, b]);
    pos += len;
    if (pos >= end) break;
  }
  const made = [];
  for (const [node, a, b] of hits) {
    let piece = node;
    if (b < piece.data.length) piece.splitText(b);
    if (a > 0) piece = piece.splitText(a);
    const m = make();
    piece.parentNode.insertBefore(m, piece);
    m.append(piece);
    made.push(m);
  }
  return made;
}

// Redraw one chapter with its marks: start from the clean chapter, then wrap each mark.
export function paintSection(sectionEl, html, items) {
  sectionEl.innerHTML = html;
  for (const { mark, part, pin } of items) {
    const c = colorOf(mark.color);
    const pieces = wrap(sectionEl, part.start, part.end, () => {
      const m = document.createElement('mark');
      m.className = `dm dm-${mark.kind}`;
      m.dataset.mark = mark.id;
      m.style.setProperty('--ink', c.ink);
      m.style.setProperty('--wash', c.wash);
      return m;
    });
    if (pin && pieces.length) pieces[pieces.length - 1].dataset.pin = pin;
  }
}

// The heading just before a mark, to say where it is ("Chapter 2 · Water").
export function headingBefore(sectionEl, start) {
  let label = '';
  for (const h of sectionEl?.querySelectorAll('h1, h2, h3') || []) {
    if (offsetIn(sectionEl, h, 0) <= start) label = h.textContent.replace(/\s+/g, ' ').trim(); else break;
  }
  return label;
}

export function sortDocMarks(marks) {
  const k = (m) => m.parts?.[0] || { s: 0, start: 0 };
  return [...marks].sort((a, b) => k(a).s - k(b).s || k(a).start - k(b).start);
}
