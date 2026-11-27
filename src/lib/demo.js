import { addFile } from './add.js';
import { loadPdf } from './pdf.js';
import { loadDoc } from './docs.js';
import { youTubeThumb } from './media.js';

// The demo: the sample files, already read and marked, so every feature has something to show —
// highlights in each colour, an underline, comments (one in Malayalam), Contents, reading progress,
// a video and a YouTube link with time notes, and words to Define in three languages.
// Every demo item has demo: true (shown with a DEMO tag) and goes away when the demo is turned off.

const FILES = [
  ['flow-reader-guide.pdf', 'application/pdf'],
  ['reading-well.epub', 'application/epub+zip'],
  ['study-notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['reading-plan.md', 'text/markdown'],
  ['sample-video.mp4', 'video/mp4'],
];
const MIN = 60 * 1000;
let n = 0;
const id = () => `demo-${Date.now().toString(36)}-${(n += 1)}`;

// A PDF mark over some words on a page (found in the page's own text, one line).
async function pdfMark(doc, page, words, kind, color, note = '') {
  const p = await doc.getPage(page);
  const vp = p.getViewport({ scale: 1 });
  const tc = await p.getTextContent();
  for (const item of tc.items) {
    const at = item.str.indexOf(words);
    if (at < 0) continue;
    const [, , , d, e, f] = item.transform;
    const fs = Math.abs(d) || item.height;
    const x0 = e + (item.width * at) / item.str.length;
    const w = (item.width * words.length) / item.str.length;
    const top = vp.viewBox[3] - f - fs * 0.82;
    return { id: id(), kind, color, text: words, note, createdAt: Date.now() - 50 * MIN, rects: [{ p: page, x: x0 / vp.width, y: top / vp.height, w: w / vp.width, h: (fs * 1.1) / vp.height }] };
  }
  return null;
}

// A book/document mark: the words' place in the chapter's text.
function docMark(doc, words, kind, color, note = '') {
  for (let s = 0; s < doc.sections.length; s += 1) {
    const div = document.createElement('div');
    div.innerHTML = doc.sections[s].html;
    const start = div.textContent.indexOf(words);
    if (start >= 0) return { id: id(), kind, color, text: words, note, createdAt: Date.now() - 40 * MIN, parts: [{ s, start, end: start + words.length }] };
  }
  return null;
}

export async function makeDemo(onStep) {
  const out = [];
  for (const [name, type] of FILES) {
    onStep?.(name);
    const blob = await (await fetch(`./samples/${name}`)).blob();
    out.push(await addFile(new File([blob], name, { type })));
  }
  const [pdf, book, word, plan, video] = out;
  const now = Date.now();

  // The guide (PDF): one mark of each kind, read up to page 3
  const pd = await loadPdf(pdf.file);
  pdf.marks = (await Promise.all([
    pdfMark(pd, 1, 'Nothing is uploaded anywhere', 'highlight', 'amber'),
    pdfMark(pd, 2, 'One highlight per page', 'underline', 'cyan'),
    pdfMark(pd, 3, 'tap more marks, then tap Delete', 'comment', 'green', 'Try it: in Marks, press and hold a mark, then tap others.'),
    pdfMark(pd, 4, 'words inside every file', 'highlight', 'rose', 'തിരയൽ എല്ലാ ഫയലുകളിലും നോക്കും — search looks inside every file.'),
  ])).filter(Boolean);
  Object.assign(pdf, { page: 3, openedAt: now - 2 * MIN });

  // The book (EPUB): read almost half, three marks
  const bd = await loadDoc(book.file);
  book.marks = [
    docMark(bd, 'Speed is not the goal.', 'highlight', 'amber'),
    docMark(bd, 'that is the one to highlight', 'comment', 'cyan', 'A good rule: if it stops you, mark it.'),
    docMark(bd, 'read only what you marked', 'underline', 'green'),
  ].filter(Boolean);
  Object.assign(book, { progress: 0.46, pos: { s: 1, f: 0.35 }, openedAt: now - 1 * MIN });

  // Study notes (Word): one highlight with a comment
  const wd = await loadDoc(word.file);
  word.marks = [docMark(wd, 'Trying to recall an answer strengthens memory more than reading it again.', 'highlight', 'green', 'Use this before exams.')].filter(Boolean);
  Object.assign(word, { progress: 0.3, pos: { s: 0, f: 0.3 }, openedAt: now - 30 * MIN });

  // Reading plan (Markdown): an underline
  const md = await loadDoc(plan.file);
  plan.marks = [docMark(md, 'One chapter with full attention is better than three with half.', 'underline', 'rose')].filter(Boolean);
  Object.assign(plan, { title: 'A week of reading', openedAt: 0 });

  // The video: time notes along it
  Object.assign(video, {
    title: 'The monsoon crossing',
    pos: 7,
    openedAt: now - 10 * MIN,
    tnotes: [
      { id: id(), t: 2, text: 'The dhow leaves the Arabian coast.', createdAt: now - 12 * MIN },
      { id: id(), t: 6, text: 'The south-west monsoon fills the sail.', createdAt: now - 12 * MIN },
      { id: id(), t: 12, text: 'Crossing the open sea towards Kerala.', createdAt: now - 11 * MIN },
      { id: id(), t: 17, text: 'Landfall on the Malabar coast.', createdAt: now - 11 * MIN },
    ],
  });

  // A YouTube link (it plays when there's internet)
  const yt = {
    id: id(), type: 'youtube', yt: 'jNQXAC9IVRw', start: 0, file: '', name: 'https://youtu.be/jNQXAC9IVRw',
    title: 'Me at the zoo', channel: 'jawed', cover: youTubeThumb('jNQXAC9IVRw'),
    addedAt: now, openedAt: 0, marks: [], pos: 0, duration: 19,
    tnotes: [
      { id: id(), t: 1, text: 'The first video ever put on YouTube (2005).', createdAt: now - 5 * MIN },
      { id: id(), t: 7, text: 'The elephants behind him.', createdAt: now - 5 * MIN },
    ],
  };

  return [pdf, book, word, plan, video, yt].map((it) => ({ ...it, demo: true }));
}
