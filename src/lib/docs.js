import JSZip from 'jszip';
import DOMPurify from 'dompurify';
import mammoth from 'mammoth/mammoth.browser.js';
import { marked } from 'marked';
import { fileUrl } from './pdf.js';

// Books (EPUB), Word documents (.docx) and text/Markdown files, turned into clean pages of text
// that Flow shows in your own reading font. The book's own styling and anything that could run
// code are removed; pictures, headings, lists, quotes, tables and links are kept.
//
// A loaded document: { format, title, author, cover, sections: [{ html, label }], toc: [{ label, s, anchor, level }], preview }

export const DOC_FORMATS = { epub: 'EPUB', docx: 'WORD', txt: 'TEXT', md: 'MD', html: 'HTML' };
export const formatOf = (file) => (file.split('.').pop() || '').toLowerCase();

const CLEAN = {
  FORBID_TAGS: ['style', 'link', 'script', 'iframe', 'frame', 'form', 'input', 'button', 'select', 'textarea', 'object', 'embed', 'audio', 'video', 'meta', 'base'],
  FORBID_ATTR: ['style', 'class', 'srcset', 'onclick'],
  RETURN_DOM_FRAGMENT: true,
};
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, div, td, th, dd, dt, figcaption';

export const textOf = (html) => {
  const d = document.createElement('div');
  // A space after every line/paragraph, so words from different lines don't run together.
  d.innerHTML = html.replace(/<\/(p|h[1-6]|li|div|blockquote|tr|td|th|dt|dd|figcaption)>/gi, '$& ').replace(/<br\s*\/?>/gi, ' ');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
};
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const serialize = (frag) => {
  const d = document.createElement('div');
  d.append(frag);
  return d.innerHTML;
};

// Paths inside a book are relative to the chapter file they're written in.
function resolvePath(base, href) {
  const parts = (base ? `${base}/${href}` : href).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

// Ids get a section prefix so two chapters can't clash ("note1" in chapter 3 → "s3-note1").
// Headings get ids too, so a contents list can point at them.
function finishSection(frag, s, { resolveLink, resolveImage }) {
  frag.querySelectorAll('[id]').forEach((el) => { el.id = `s${s}-${el.id}`; });
  frag.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^https?:\/\//i.test(href)) { a.dataset.external = '1'; a.setAttribute('title', href); return; }
    const target = resolveLink ? resolveLink(href) : (href.startsWith('#') ? `#s${s}-${href.slice(1)}` : null);
    if (target) a.setAttribute('href', target); else a.removeAttribute('href');
  });
  if (resolveImage) {
    frag.querySelectorAll('img[src]').forEach((img) => {
      const url = resolveImage(img.getAttribute('src'));
      if (url) img.setAttribute('src', url); else img.remove();
    });
    frag.querySelectorAll('image').forEach((img) => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');
      const url = href && resolveImage(href);
      if (url) { img.setAttribute('href', url); img.removeAttribute('xlink:href'); } else img.remove();
    });
  }
  let h = 0;
  frag.querySelectorAll('h1, h2, h3').forEach((el) => { if (!el.id) el.id = `s${s}-h${h++}`; });
  // Arabic (and other right-to-left) paragraphs read right-to-left automatically.
  frag.querySelectorAll(BLOCKS).forEach((el) => el.setAttribute('dir', 'auto'));
  return serialize(frag);
}

function headingsToc(sections) {
  const toc = [];
  sections.forEach((sec, s) => {
    const d = document.createElement('div');
    d.innerHTML = sec.html;
    d.querySelectorAll('h1, h2, h3').forEach((el) => {
      const label = el.textContent.replace(/\s+/g, ' ').trim();
      if (label) toc.push({ label, s, anchor: el.id, level: Number(el.tagName[1]) - 1 });
    });
  });
  return toc;
}

function previewOf(sections) {
  const texts = sections.map((x) => textOf(x.html));
  return (texts.find((t) => t.length > 200) || texts.join(' ')).slice(0, 700);
}

// ---------- EPUB ----------
async function readEpub(buf) {
  const zip = await JSZip.loadAsync(buf);
  const read = (p) => zip.file(p)?.async('string');
  const xml = (text, type = 'application/xml') => new DOMParser().parseFromString(text, type);

  const enc = await read('META-INF/encryption.xml');
  if (enc && /adobe|apple|fairplay/i.test(enc) && !/obfuscation/i.test(enc)) throw new Error('protected');

  const container = xml(await read('META-INF/container.xml'));
  const opfPath = container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!opfPath) throw new Error('not a book');
  const opf = xml(await read(opfPath));
  const base = dirOf(opfPath);
  const first = (tag) => opf.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || '';

  const manifest = new Map();
  for (const it of opf.getElementsByTagNameNS('*', 'item')) {
    manifest.set(it.getAttribute('id'), {
      path: resolvePath(base, decodeURIComponent(it.getAttribute('href') || '')),
      type: it.getAttribute('media-type') || '',
      props: it.getAttribute('properties') || '',
    });
  }
  const spineEl = opf.getElementsByTagNameNS('*', 'spine')[0];
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')]
    .map((r) => manifest.get(r.getAttribute('idref')))
    .filter((m) => m && /html|xml/.test(m.type));
  const sectionOf = new Map(spine.map((m, i) => [m.path, i]));

  // Pictures come out of the book as private in-memory links.
  const blobs = new Map();
  const imagePaths = new Set([...manifest.values()].filter((m) => m.type.startsWith('image/')).map((m) => m.path));
  for (const p of imagePaths) {
    const f = zip.file(p);
    if (f) blobs.set(p, URL.createObjectURL(new Blob([await f.async('uint8array')], { type: [...manifest.values()].find((m) => m.path === p)?.type })));
  }

  // Cover: marked in the book's list, or named "cover".
  const coverId = [...opf.getElementsByTagNameNS('*', 'meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content');
  const coverItem = [...manifest.values()].find((m) => m.props.includes('cover-image'))
    || manifest.get(coverId)
    || [...manifest.entries()].find(([id, m]) => /cover/i.test(id) && m.type.startsWith('image/'))?.[1];
  const cover = coverItem ? blobs.get(coverItem.path) || null : null;

  const sections = [];
  for (let s = 0; s < spine.length; s += 1) {
    const item = spine[s];
    const raw = await read(item.path);
    if (!raw) continue;
    let doc = xml(raw, 'application/xhtml+xml');
    if (doc.getElementsByTagName('parsererror').length) doc = xml(raw, 'text/html');
    const body = doc.getElementsByTagName('body')[0];
    if (!body) continue;
    const here = dirOf(item.path);
    const frag = DOMPurify.sanitize(body.innerHTML, CLEAN);
    const html = finishSection(frag, sections.length, {
      resolveLink: (href) => {
        if (href.startsWith('#')) return `#s${sections.length}-${href.slice(1)}`;
        const [file, anchor] = href.split('#');
        const target = sectionOf.get(resolvePath(here, decodeURIComponent(file)));
        if (target == null) return null;
        return anchor ? `#s${target}-${anchor}` : `#s${target}`;
      },
      resolveImage: (src) => blobs.get(resolvePath(here, decodeURIComponent(src.split('#')[0]))),
    });
    sections.push({ html, label: '' });
  }

  // Contents: the book's own list (EPUB 3 "nav", or the older "toc.ncx").
  const toc = [];
  const pointTo = (href, fromDir) => {
    const [file, anchor] = (href || '').split('#');
    const s = sectionOf.get(resolvePath(fromDir, decodeURIComponent(file)));
    return s == null ? null : { s, anchor: anchor ? `s${s}-${anchor}` : null };
  };
  const nav = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'));
  if (nav) {
    const ndoc = xml(await read(nav.path), 'application/xhtml+xml');
    const tocNav = [...ndoc.getElementsByTagName('nav')].find((n) => /toc/.test(n.getAttribute('epub:type') || n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') || '')) || ndoc.getElementsByTagName('nav')[0];
    const walk = (ol, level) => {
      for (const li of ol?.children || []) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        const a = li.getElementsByTagName('a')[0];
        const at = a && pointTo(a.getAttribute('href'), dirOf(nav.path));
        if (at) toc.push({ label: a.textContent.replace(/\s+/g, ' ').trim(), ...at, level });
        const sub = [...li.children].find((c) => c.tagName.toLowerCase() === 'ol');
        if (sub) walk(sub, level + 1);
      }
    };
    walk(tocNav?.getElementsByTagName('ol')[0], 0);
  }
  if (!toc.length) {
    const ncxItem = manifest.get(spineEl?.getAttribute('toc')) || [...manifest.values()].find((m) => m.type.includes('dtbncx'));
    const ncxText = ncxItem && await read(ncxItem.path);
    if (ncxText) {
      const ncx = xml(ncxText);
      const walk = (parent, level) => {
        for (const np of parent.children) {
          if (np.localName !== 'navPoint') continue;
          const label = np.getElementsByTagNameNS('*', 'text')[0]?.textContent?.trim();
          const at = pointTo(np.getElementsByTagNameNS('*', 'content')[0]?.getAttribute('src'), dirOf(ncxItem.path));
          if (label && at) toc.push({ label, ...at, level });
          walk(np, level + 1);
        }
      };
      const map = ncx.getElementsByTagNameNS('*', 'navMap')[0];
      if (map) walk(map, 0);
    }
  }
  for (const t of toc) if (!sections[t.s]?.label) sections[t.s].label = t.label;

  return { format: 'epub', title: first('title'), author: first('creator'), cover, sections, toc: toc.length ? toc : headingsToc(sections), preview: previewOf(sections) };
}

// ---------- Word, text, Markdown ----------
// Many Word files make headings by just typing a short line in bold (not Word's Heading style).
// Treat those as headings, so they show up in Contents.
function boldLinesToHeadings(frag) {
  frag.querySelectorAll('p').forEach((p) => {
    const only = p.children.length === 1 && p.firstElementChild;
    const text = p.textContent.trim();
    if (p.closest('table, li, blockquote')) return; // bold words in tables and lists stay as they are
    if (!only || !/^(strong|b)$/i.test(only.tagName) || only.textContent.trim() !== text) return;
    if (!text || text.length > 80 || /[.,;:]$/.test(text)) return;
    const h = document.createElement('h2');
    h.textContent = text;
    p.replaceWith(h);
  });
  return frag;
}

async function readDocx(buf) {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf }, {
    styleMap: ["p[style-name='Title'] => h1.doc-title:fresh", "p[style-name='Subtitle'] => h2:fresh"],
  });
  const sections = [{ html: finishSection(boldLinesToHeadings(DOMPurify.sanitize(value, CLEAN)), 0, {}), label: '' }];
  return { format: 'docx', title: '', author: '', cover: null, sections, toc: headingsToc(sections), preview: previewOf(sections) };
}

function decodeText(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

async function readText(buf) {
  const text = decodeText(buf).replace(/\r\n?/g, '\n');
  const html = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escape(p).replace(/\n/g, '<br>')}</p>`).join('');
  const sections = [{ html: finishSection(DOMPurify.sanitize(html, CLEAN), 0, {}), label: '' }];
  return { format: 'txt', title: '', author: '', cover: null, sections, toc: [], preview: previewOf(sections) };
}

async function readMarkdown(buf) {
  const html = marked.parse(decodeText(buf), { async: false, gfm: true });
  const sections = [{ html: finishSection(DOMPurify.sanitize(html, CLEAN), 0, {}), label: '' }];
  return { format: 'md', title: '', author: '', cover: null, sections, toc: headingsToc(sections), preview: previewOf(sections) };
}

// A saved web page or HTML file, shown as a clean reading page: just the article if the page marks one,
// without menus, scripts, forms or the site's own styling. Pictures inside the file are kept; pictures
// that live on the internet are left out (Flow doesn't fetch from the web while you read).
async function readHtml(buf) {
  const page = new DOMParser().parseFromString(decodeText(buf), 'text/html');
  const source = page.querySelector('meta[name="flow-source"]')?.getAttribute('content') || '';
  const main = page.querySelector('article') || page.querySelector('main') || page.querySelector('[role="main"]') || page.body;
  if (!main) throw new Error('empty');
  // A page saved from Flow's browser: make its pictures and links point at the real website.
  if (source) {
    const abs = (u) => { try { const x = new URL(u, source); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
    main.querySelectorAll('img').forEach((img) => {
      const real = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('src') || '';
      const url = /^data:/i.test(real) ? real : abs(real);
      if (url) img.setAttribute('src', url); else img.remove();
    });
    main.querySelectorAll('a[href]').forEach((a2) => {
      const h = a2.getAttribute('href');
      if (h && !h.startsWith('#')) { const url = abs(h); if (url) a2.setAttribute('href', url); else a2.removeAttribute('href'); }
    });
  }
  main.querySelectorAll('nav, header, footer, aside, form, button, select, textarea, input, [role="navigation"], [aria-hidden="true"], noscript').forEach((el) => {
    if (el !== main) el.remove();
  });
  const frag = DOMPurify.sanitize(main.innerHTML, CLEAN);
  frag.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^data:image\//i.test(src) && !(source && /^https:\/\//i.test(src))) img.remove();
  });
  frag.querySelectorAll('svg image').forEach((img) => img.remove());
  const sections = [{ html: finishSection(frag, 0, {}), label: '' }];
  const title = (page.querySelector('title')?.textContent || page.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
  const author = page.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() || '';
  return { format: 'html', title, author, cover: null, sections, toc: headingsToc(sections), preview: previewOf(sections), source };
}

const READERS = { epub: readEpub, docx: readDocx, txt: readText, md: readMarkdown, html: readHtml };

// Each file is read once per window and shared by its card and the reader.
const open = new Map();
export function loadDoc(file) {
  if (!open.has(file)) {
    const task = (async () => {
      const read = READERS[formatOf(file)];
      if (!read) throw new Error('unknown');
      const res = await fetch(fileUrl(file));
      if (!res.ok) throw new Error('missing');
      return read(await res.arrayBuffer());
    })();
    task.catch(() => open.delete(file));
    open.set(file, task);
  }
  return open.get(file);
}
