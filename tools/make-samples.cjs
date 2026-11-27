// Sample files that ship inside Flow Reader ("Try the samples" on the welcome screen), written for the app.
// Run: node tools/make-samples.cjs
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { jsPDF } = require('jspdf');

const OUT = path.join(__dirname, '..', 'public', 'samples');
fs.mkdirSync(OUT, { recursive: true });

// ---- 1. A guide, as a PDF with chapters (so Contents has something to show) ----
const GUIDE = [
  ['Welcome to Flow Reader', [
    'Flow Reader keeps your PDFs, books, documents and videos in one place, on your phone. Nothing is uploaded anywhere: your files, marks and notes stay with you.',
    'Every file shows how far you have read. The Recent row at the top brings back what you opened last, right where you stopped.',
    'Try it now: press and hold on a word in this sentence, drag the handles to choose a few words, then pick a colour.',
  ]],
  ['Highlight, underline, comment', [
    'Choose words, then tap a colour to highlight them, Underline to underline, or Comment to write a note beside them.',
    'Tap a mark later to change its colour or style, add a comment, or remove it. A small number in the margin shows where a comment is.',
    'Good readers mark less than they think. One highlight per page is often enough to remember the page.',
  ]],
  ['The Marks list', [
    'The Marks button lists everything you marked in this file, in order. Tap one to jump to it.',
    'To remove several at once, press and hold a mark until it is picked, tap more marks, then tap Delete. Undo appears for a few seconds, just in case.',
  ]],
  ['Search everything', [
    'The search bar on the library looks everywhere: file names, the words inside every file, your marks and comments, and your video time notes.',
    'Results come in groups. Tap one and the file opens right at that spot, with the words chosen for you.',
  ]],
  ['Videos and time notes', [
    'Add a video from your phone, or paste a YouTube link. While it plays, tap Note to write something at that exact second. The video waits while you write.',
    'Your notes sit along the timeline. Tap one to jump back to that moment.',
  ]],
  ['Share a summary', [
    'Open Marks (or Notes on a video) and tap Export PDF. Flow Reader makes a clean summary of every highlight, underline and comment, with the page each one came from.',
    'Send it on WhatsApp, save it to Drive, or print it. That is the whole idea: read well, keep what matters, share it.',
  ]],
];
{
  const doc = new jsPDF({ unit: 'pt', format: 'a5' });
  const W = doc.internal.pageSize.getWidth();
  const M = 46;
  GUIDE.forEach(([title, paras], i) => {
    if (i) doc.addPage();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(26, 139, 208);
    doc.text(`CHAPTER ${i + 1}`, M, 64);
    doc.setFont('times', 'bold'); doc.setFontSize(22); doc.setTextColor(17, 20, 24);
    const tl = doc.splitTextToSize(title, W - 2 * M);
    doc.text(tl, M, 92);
    let y = 92 + tl.length * 26 + 14;
    doc.setFont('times', 'normal'); doc.setFontSize(12.5); doc.setTextColor(40, 44, 52);
    for (const p of paras) {
      const lines = doc.splitTextToSize(p, W - 2 * M);
      doc.text(lines, M, y, { lineHeightFactor: 1.5 });
      y += lines.length * 12.5 * 1.5 + 12;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 155, 165);
    doc.text(`Flow Reader guide · ${i + 1}`, M, doc.internal.pageSize.getHeight() - 30);
    doc.outline.add(null, title, { pageNumber: i + 1 });
  });
  doc.setProperties({ title: 'Flow Reader — a short guide', author: 'Flow Reader' });
  fs.writeFileSync(path.join(OUT, 'flow-reader-guide.pdf'), Buffer.from(doc.output('arraybuffer')));
}

// ---- 2. A short book, as an EPUB ----
const BOOK = [
  ['Before you start', [
    'A book is a long conversation with someone who cannot hear your questions. Marking it is how you answer back.',
    'Before reading a chapter, look at its title for a moment and ask yourself what you expect to find. You will notice more when you have a question in mind.',
  ]],
  ['Reading slowly', [
    'Speed is not the goal. A page read slowly and remembered is worth more than ten pages read quickly and forgotten.',
    'When a sentence makes you stop, that is the one to highlight. When a sentence makes you disagree, that is the one to comment on.',
    'Try changing the text size and font with the Aa button at the top. A comfortable page is easier to stay with.',
    'Not sure what a word means? Press and hold it, then tap Define. It works in three languages: patience · ക്ഷമ · صبر',
  ]],
  ['After the last page', [
    'Open the Marks list and read only what you marked. In five minutes you will have the whole book again, in your own words.',
    'Then export the summary and keep it. Months later, it will bring the book back faster than reading it again.',
  ]],
];
async function epub() {
  const z = new JSZip();
  z.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  z.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  BOOK.forEach(([t, ps], i) => {
    z.file(`OEBPS/ch${i + 1}.xhtml`, `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(t)}</title></head><body><h1 id="c${i + 1}">${esc(t)}</h1>${ps.map((p) => `<p>${esc(p)}</p>`).join('')}</body></html>`);
  });
  z.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${BOOK.map(([t], i) => `<li><a href="ch${i + 1}.xhtml">${esc(t)}</a></li>`).join('')}</ol></nav></body></html>`);
  z.file('OEBPS/content.opf', `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">flow-reader-sample-reading-well</dc:identifier><dc:title>Reading Well</dc:title><dc:creator>Flow Reader</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">2026-11-27T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${BOOK.map((_, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${BOOK.map((_, i) => `<itemref idref="ch${i + 1}"/>`).join('')}</spine></package>`);
  fs.writeFileSync(path.join(OUT, 'reading-well.epub'), await z.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' }));
}

// ---- 3. Study notes, as a Word document ----
const NOTES = [
  ['h', 'Study notes: how memory works'],
  ['p', 'These notes are a sample Word document. Headings become the Contents list, and you can mark it like any book.'],
  ['h', 'Spaced repetition'],
  ['p', 'We remember more when we review something a little later, just as we are about to forget it. A short review after one day, then after a week, beats one long session.'],
  ['h', 'Testing yourself'],
  ['p', 'Trying to recall an answer strengthens memory more than reading it again. Close the book and say the main idea in your own words.'],
  ['h', 'Sleep'],
  ['p', 'Sleep is when the brain sorts the day. Studying late into the night often costs more than it gives.'],
];
async function docx() {
  const z = new JSZip();
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file('word/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style></w:styles>');
  const body = NOTES.map(([k, t]) => (k === 'h'
    ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${esc(t)}</w:t></w:r></w:p>`
    : `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`)).join('');
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  fs.writeFileSync(path.join(OUT, 'study-notes.docx'), await z.generateAsync({ type: 'nodebuffer' }));
}

// ---- 4. A reading plan, as Markdown (with Malayalam and Arabic words to Define) ----
const PLAN = `# A week of reading

## Monday · start small
Read for twenty minutes. Highlight one sentence that matters, and only one.

## Wednesday · words
Define any word you don't know. Press and hold it, then tap Define.
Try these: perseverance · വായന ഒരു യാത്രയാണ് · العلم نور

## Friday · look back
Open the Marks list. Read only what you marked, then export a summary PDF and send it to a friend.

## Every day
Keep the phone away while you read. One chapter with full attention is better than three with half.
`;

(async () => {
  fs.writeFileSync(path.join(OUT, 'reading-plan.md'), PLAN);
  await epub();
  await docx();
  fs.copyFileSync(path.join(process.env.HOME, 'Projects/Flow/demo/files/de5e0000-0000-4000-8000-000000000004.mp4'), path.join(OUT, 'sample-video.mp4'));
  console.log(fs.readdirSync(OUT).map((f) => `${f} ${fs.statSync(path.join(OUT, f)).size}`).join('\n'));
})();
