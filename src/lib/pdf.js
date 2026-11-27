import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// The reader's fonts, character maps and decoders ship with Flow, so PDFs open with no internet.
const data = new URL('./pdfjs/', document.baseURI).href;

// Flow Reader keeps files on the phone (see store.js); a file is ready once it has been opened.
import { urlOf } from '../store.js';
export const fileUrl = (file) => urlOf(file);

// Each PDF is opened once per window and shared by its card and the reader.
const open = new Map();

export function loadPdf(file) {
  if (!open.has(file)) {
    const task = pdfjs.getDocument({
      url: fileUrl(file),
      cMapUrl: `${data}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${data}standard_fonts/`,
      wasmUrl: `${data}wasm/`,
      iccUrl: `${data}iccs/`,
    }).promise;
    task.catch(() => open.delete(file));
    open.set(file, task);
  }
  return open.get(file);
}

// Draw one page into a canvas at a given on-screen width, sharp on Retina screens.
// Returns the render task (it can be cancelled) and the page's height at that width.
export async function renderPage(doc, pageNumber, canvas, cssWidth, sharpness = 1) {
  const page = await doc.getPage(pageNumber);
  const unit = page.getViewport({ scale: 1 });
  const scale = cssWidth / unit.width;
  let dpr = (window.devicePixelRatio || 1) * sharpness;
  // Phones can't hold huge pictures: keep each page under ~10 million dots (zoomed in, it gets a little softer).
  const area = unit.width * unit.height * scale * scale;
  if (area * dpr * dpr > 10e6) dpr = Math.max(1, Math.sqrt(10e6 / area));
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${viewport.height / dpr}px`;
  const task = page.render({ canvas, viewport });
  return { task, height: viewport.height / dpr };
}

// Height-to-width shape of a page, for laying out pages before they're drawn.
export async function pageRatio(doc, pageNumber) {
  const page = await doc.getPage(pageNumber);
  const v = page.getViewport({ scale: 1 });
  return v.height / v.width;
}

// Lay invisible, selectable text over a drawn page (same spot as the printed words),
// so you can select, copy and mark it. Returns something with cancel().
export async function renderText(doc, pageNumber, container, cssWidth) {
  const page = await doc.getPage(pageNumber);
  const unit = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: cssWidth / unit.width });
  container.replaceChildren();
  container.style.setProperty('--scale-factor', viewport.scale);
  container.style.setProperty('--total-scale-factor', viewport.scale);
  const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container, viewport });
  const done = layer.render().then(() => {
    // Dragging past the last word shouldn't jump the selection to the end of the page.
    const end = document.createElement('div');
    end.className = 'endOfContent';
    container.append(end);
  });
  return { cancel: () => layer.cancel(), done };
}

// The PDF's own list of chapters (its "outline"), flattened, with the page each one starts on.
export async function pdfOutline(doc) {
  const out = [];
  const walk = async (items, level) => {
    for (const it of items || []) {
      let page = null;
      try {
        const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
        if (Array.isArray(dest) && dest[0]) page = typeof dest[0] === 'number' ? dest[0] + 1 : (await doc.getPageIndex(dest[0])) + 1;
      } catch { /* a broken link in the outline */ }
      if (page && it.title?.trim()) out.push({ label: it.title.trim(), page, level });
      if (it.items?.length) await walk(it.items, level + 1);
    }
  };
  try { await walk(await doc.getOutline(), 0); } catch { /* no outline */ }
  return out;
}

// Every page's words, for searching inside the PDF (worked out once, when the file is added).
export async function pdfPagesText(doc) {
  const pages = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    try {
      const page = await doc.getPage(n);
      const tc = await page.getTextContent();
      pages.push(tc.items.map((i) => i.str + (i.hasEOL ? '\n' : '')).join('').replace(/[ \t]+/g, ' '));
    } catch { pages.push(''); }
  }
  return pages;
}
