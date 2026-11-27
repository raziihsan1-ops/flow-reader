import { newId } from './data.js';
import { loadPdf, pdfPagesText, renderPage } from './pdf.js';
import { DOC_FORMATS, loadDoc, textOf } from './docs.js';
import { parseYouTube, youTubeInfo, youTubeThumb } from './media.js';
import { prepareFile, putFile, putText } from '../store.js';

// Adding things to the library: a file from the phone, or a YouTube link.
// Each becomes one item: { id, type: 'pdf' | 'doc' | 'video' | 'youtube', file, name, title, cover, … }

const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', '3gp', 'mkv'];
export const ACCEPT = '.pdf,.epub,.docx,.txt,.md,.markdown,application/pdf,application/epub+zip,text/plain,text/markdown,video/*,.mp4,.m4v,.mov,.webm,.3gp,.mkv';

export function kindOf(name) {
  let ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'markdown') ext = 'md';
  if (ext === 'pdf') return { type: 'pdf', ext };
  if (DOC_FORMATS[ext] && ext !== 'html') return { type: 'doc', ext, format: ext };
  if (VIDEO_EXT.includes(ext)) return { type: 'video', ext };
  return null;
}
const bare = (name) => { const t = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(); return t ? t[0].toUpperCase() + t.slice(1) : name; };

// A small picture for the card (a JPEG, kept inside the library list).
const shrink = (source, w, h, max = 420) => {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.78);
};
const imageThumb = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => { try { resolve(shrink(img, img.naturalWidth, img.naturalHeight)); } catch { resolve(null); } };
  img.onerror = () => resolve(null);
  img.src = url;
});
function videoInfo(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    let done = false; let tries = 0;
    const finish = (r) => { if (!done) { done = true; v.removeAttribute('src'); v.load(); resolve(r); } };
    const duration = () => (Number.isFinite(v.duration) ? v.duration : 0);
    // The picture must really be there: phones sometimes hand over a black frame right after jumping.
    const dark = (c) => {
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let sum = 0; let n = 0;
        for (let k = 0; k < d.length; k += 4 * 97) { sum += d[k] + d[k + 1] + d[k + 2]; n += 1; }
        return sum / (n * 3) < 10;
      } catch { return false; }
    };
    const grab = () => {
      try {
        if (!v.videoWidth) return null;
        const k = Math.min(1, 520 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        return dark(c) ? null : c.toDataURL('image/jpeg', 0.78);
      } catch { return null; }
    };
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.onloadedmetadata = () => { v.currentTime = Math.min(2, duration() / 10); };
    v.onseeked = () => setTimeout(() => {
      const cover = grab();
      tries += 1;
      if (!cover && tries < 3 && duration()) { v.currentTime = Math.min(duration() - 0.1, (duration() * (tries + 1)) / 6); return; }
      finish({ duration: duration(), cover, px: [v.videoWidth, v.videoHeight] });
    }, 250);
    v.onerror = () => finish({ duration: 0, cover: null });
    setTimeout(() => finish({ duration: duration(), cover: grab() }), 12000);
    v.src = url;
  });
}

// One file from the phone → a library item (or an error message).
export async function addFile(f) {
  const k = kindOf(f.name);
  if (!k) throw new Error(`“${f.name}” isn't a PDF, book, document or video.`);
  const id = newId();
  const file = `${id}.${k.ext}`;
  await putFile(file, f);
  const url = await prepareFile(file);
  const item = { id, type: k.type, file, name: f.name, title: bare(f.name), size: f.size, addedAt: Date.now(), openedAt: 0, marks: [], tnotes: [] };
  if (k.type === 'pdf') {
    const doc = await loadPdf(file).catch(() => null);
    if (!doc) throw new Error(`“${f.name}” couldn't be opened. It may be damaged or password-protected.`);
    item.pages = doc.numPages;
    item.page = 1;
    try {
      const m = await doc.getMetadata();
      const t = m?.info?.Title?.trim();
      if (t && t.length > 3 && !/^(untitled|microsoft word|document)/i.test(t)) item.title = t;
      if (m?.info?.Author?.trim()) item.author = m.info.Author.trim();
    } catch { /* no details */ }
    try {
      const c = document.createElement('canvas');
      const r = await renderPage(doc, 1, c, 300, 1 / (window.devicePixelRatio || 1));
      await r.task.promise;
      item.cover = shrink(c, c.width, c.height);
    } catch { /* no picture */ }
  } else if (k.type === 'doc') {
    item.format = k.format;
    const d = await loadDoc(file).catch((e) => { throw new Error(e?.message === 'protected' ? `“${f.name}” is copy-protected (DRM), so it can only be read in the app it was bought from.` : `“${f.name}” couldn't be opened.`); });
    if (d.title) item.title = d.title;
    if (d.author) item.author = d.author;
    if (d.cover) item.cover = await imageThumb(d.cover);
    item.sections = d.sections.length;
    item.preview = d.preview || '';
    item.progress = 0;
    putText(file, d.sections.map((s, i) => ({ at: i, label: s.label || d.toc.find((t) => t.s === i)?.label || '', text: textOf(s.html) })));
  } else {
    const v = await videoInfo(url);
    item.duration = v.duration;
    item.cover = v.cover;
    item.pos = 0;
  }
  return item;
}

// For PDFs the words are read after the card appears (a long PDF takes a few seconds).
export async function indexPdf(item) {
  const doc = await loadPdf(item.file);
  const pages = await pdfPagesText(doc);
  await putText(item.file, pages.map((text, i) => ({ at: i + 1, text })));
  return pages.some((p) => p.trim().length > 20);
}

// A YouTube link → an item (its title comes from YouTube when there's internet).
export async function addYouTube(link) {
  const yt = parseYouTube(link);
  if (!yt) throw new Error("That doesn't look like a YouTube link.");
  const info = await youTubeInfo(yt.id);
  return {
    id: newId(), type: 'youtube', yt: yt.id, start: yt.start, file: '', name: link.trim(),
    title: info?.title || 'YouTube video', channel: info?.channel || '', cover: youTubeThumb(yt.id),
    addedAt: Date.now(), openedAt: 0, marks: [], tnotes: [], pos: 0, duration: 0,
  };
}
