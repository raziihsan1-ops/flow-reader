// Highlights, underlines and comments on a PDF.
// A mark is saved on its card as:
//   { id, kind: 'highlight' | 'underline' | 'comment', color, text, note, createdAt,
//     rects: [{ p, x, y, w, h }] }   (p = page number; x, y, w, h = fractions of that page)
// Fractions keep marks in the right place at any zoom.

export const COLORS = [
  { id: 'amber', name: 'Yellow', wash: '#FFE35C', ink: '#D99A00' },
  { id: 'green', name: 'Green', wash: '#AEEBA4', ink: '#2E9E4F' },
  { id: 'cyan', name: 'Blue', wash: '#A3DCF7', ink: '#1A8BD0' },
  { id: 'rose', name: 'Pink', wash: '#F8B4CB', ink: '#D6336C' },
];
export const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[0];

export const KIND_NAMES = { highlight: 'Highlight', underline: 'Underline', comment: 'Comment' };

// Remember the last colour you used (just a convenience; fine if it's forgotten).
export function lastColor() {
  try { return localStorage.getItem('flow.markColor') || 'amber'; } catch { return 'amber'; }
}
export function rememberColor(id) {
  try { localStorage.setItem('flow.markColor', id); } catch { /* not important */ }
}

// Turn the browser's selection into one clean box per line, per page.
// The raw boxes overlap and repeat (each word piece, plus their parents), so they're merged.
export function selectionToRects(range, pageEls) {
  const raw = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
  if (!raw.length) return [];
  const heights = raw.map((r) => r.height).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)];
  const boxes = raw.filter((r) => r.height < typical * 2.6); // drop whole-block parent boxes

  const byPage = new Map();
  for (const r of boxes) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const el = pageEls.find((p) => {
      const b = p.getBoundingClientRect();
      return cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
    });
    if (!el) continue;
    const n = Number(el.dataset.page);
    if (!byPage.has(n)) byPage.set(n, { el, list: [] });
    byPage.get(n).list.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }

  const out = [];
  for (const [p, { el, list }] of [...byPage].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.t - b.t || a.l - b.l);
    const lines = [];
    for (const box of list) {
      const h = box.b - box.t;
      const line = lines.find((ln) => {
        const overlap = Math.min(ln.b, box.b) - Math.max(ln.t, box.t);
        const near = box.l <= ln.r + h * 1.6 && box.r >= ln.l - h * 1.6;
        return overlap > Math.min(ln.b - ln.t, h) * 0.5 && near;
      });
      if (line) {
        line.l = Math.min(line.l, box.l); line.r = Math.max(line.r, box.r);
        line.t = Math.min(line.t, box.t); line.b = Math.max(line.b, box.b);
      } else lines.push({ ...box });
    }
    const page = el.getBoundingClientRect();
    for (const ln of lines) {
      out.push({
        p,
        x: (ln.l - page.left) / page.width,
        y: (ln.t - page.top) / page.height,
        w: (ln.r - ln.l) / page.width,
        h: (ln.b - ln.t) / page.height,
      });
    }
  }
  return out;
}

// Reading order: by page, then top to bottom, then left to right.
export function sortMarks(marks) {
  const key = (m) => m.rects[0] || { p: 0, y: 0, x: 0 };
  return [...marks].sort((a, b) => {
    const ka = key(a); const kb = key(b);
    return ka.p - kb.p || ka.y - kb.y || ka.x - kb.x;
  });
}

// Which mark (if any) is under a point on a page (fractions of the page).
export function markAt(marks, page, fx, fy) {
  const padX = 0.004; const padY = 0.004;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const m = marks[i];
    if (m.rects.some((r) => r.p === page && fx >= r.x - padX && fx <= r.x + r.w + padX && fy >= r.y - padY && fy <= r.y + r.h + padY)) return m;
  }
  return null;
}

export const cleanText = (s) => s.replace(/\s+/g, ' ').trim();
