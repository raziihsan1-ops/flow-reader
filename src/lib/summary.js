import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { COLORS, KIND_NAMES, colorOf, sortMarks } from '../rooms/discover/marks.js';
import { sortDocMarks } from '../rooms/discover/docMarks.js';
import { formatTime } from './media.js';

// A tidy PDF of everything you marked in one file: each highlight, underline and comment, with
// where it is — or, for a video, every time note. Pages are drawn like a picture first, so
// Malayalam, Arabic and any other writing come out right, then put into an A4 PDF.

const W = 1240; const H = 1754; // A4 at 150 dots per inch
const M = 104; // margin
const SERIF = "'IBM Plex Serif', 'Noto Naskh Arabic', 'Noto Sans Malayalam', Georgia, serif";
const SANS = "'IBM Plex Sans', 'Noto Naskh Arabic', 'Noto Sans Malayalam', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const RTL = /[֐-ࣿיִ-ﻼ]/;
const TYPE = { pdf: 'PDF', doc: 'BOOK / DOCUMENT', video: 'VIDEO', youtube: 'YOUTUBE' };

function wrap(ctx, text, width) {
  const lines = [];
  for (const para of String(text || '').split(/\n+/)) {
    const words = para.split(/(\s+)/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line + w;
      if (ctx.measureText(test).width > width && line.trim()) { lines.push(line.trim()); line = w.trimStart(); }
      else line = test;
      while (ctx.measureText(line).width > width && line.length > 1) { // one very long word
        let cut = line.length - 1;
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > width) cut -= 1;
        lines.push(line.slice(0, cut)); line = line.slice(cut);
      }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

export async function makeSummary(item, reading) {
  await Promise.all([`500 30px ${SERIF}`, `400 20px ${SANS}`, `500 16px ${MONO}`, `italic 400 20px ${SANS}`].map((f) => document.fonts?.load(f).catch(() => {})));
  const isVideo = item.type === 'video' || item.type === 'youtube';
  const entries = isVideo
    ? [...(item.tnotes || [])].sort((a, b) => a.t - b.t).map((n) => ({ meta: formatTime(n.t), quote: n.text, note: '', color: COLORS[2] }))
    : (item.type === 'pdf' ? sortMarks(item.marks || []) : sortDocMarks(item.marks || [])).map((m) => ({
      meta: `${item.type === 'pdf' ? `PAGE ${m.rects?.[0]?.p ?? ''}` : (m.where || `PART ${(m.parts?.[0]?.s ?? 0) + 1}`)} · ${KIND_NAMES[m.kind].toUpperCase()}`,
      quote: m.text, note: m.note?.trim() || '', color: colorOf(m.color), kind: m.kind,
    }));

  const pages = [];
  let ctx; let y;
  const newPage = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    pages.push(c);
    y = M;
  };
  const text = (s, x, yy, font, color, maxW) => {
    ctx.font = font; ctx.fillStyle = color;
    const rtl = RTL.test(s);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = rtl ? 'right' : 'left';
    ctx.fillText(s, rtl ? x + maxW : x, yy);
    ctx.direction = 'ltr'; ctx.textAlign = 'left';
  };

  newPage();
  // Heading
  text('MARKS SUMMARY', M, y + 16, `500 17px ${MONO}`, '#1A8BD0', 600);
  y += 34;
  ctx.font = `500 46px ${SERIF}`;
  for (const line of wrap(ctx, item.title || item.name, W - 2 * M).slice(0, 3)) { y += 58; text(line, M, y, `500 46px ${SERIF}`, '#111418', W - 2 * M); }
  y += 40;
  const bits = [TYPE[item.type], item.author || item.channel, isVideo ? (item.duration ? formatTime(item.duration) : '') : item.pages ? `${item.pages} pages` : '',
    isVideo ? `${entries.length} time note${entries.length === 1 ? '' : 's'}` : `${entries.length} mark${entries.length === 1 ? '' : 's'}`,
    new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })].filter(Boolean);
  text(bits.join('  ·  '), M, y, `400 20px ${SANS}`, '#5B6472', W - 2 * M);
  if (!isVideo && entries.length) {
    const counts = ['highlight', 'underline', 'comment'].map((k) => [k, entries.filter((e) => e.kind === k).length]).filter(([, n]) => n);
    y += 34;
    text(counts.map(([k, n]) => `${n} ${KIND_NAMES[k].toLowerCase()}${n === 1 ? '' : 's'}`).join('  ·  '), M, y, `400 18px ${SANS}`, '#858C97', W - 2 * M);
  }
  y += 36;
  ctx.fillStyle = '#DCE0E6'; ctx.fillRect(M, y, W - 2 * M, 2);
  y += 54;

  if (!entries.length) text(isVideo ? 'No time notes yet.' : 'No marks yet.', M, y + 20, `400 22px ${SANS}`, '#858C97', W - 2 * M);

  const quoteFont = `400 ${Math.round((reading?.size || 19) * 1.25)}px ${SERIF}`;
  const QL = Math.round((reading?.size || 19) * 1.25 * 1.55);
  for (const e of entries) {
    ctx.font = quoteFont;
    const qLines = wrap(ctx, e.quote, W - 2 * M - 40);
    ctx.font = `italic 400 21px ${SANS}`;
    const nLines = e.note ? wrap(ctx, e.note, W - 2 * M - 64) : [];
    const height = 30 + qLines.length * QL + (nLines.length ? 22 + nLines.length * 32 + 12 : 0) + 44;
    if (y + Math.min(height, 400) > H - M) newPage();
    let top = y;
    text(e.meta, M + 40, y + 18, `500 16px ${MONO}`, e.color.ink, 800);
    y += 30;
    for (const line of qLines) {
      if (y + QL > H - M) { // very long quote: carry on to the next page
        ctx.fillStyle = e.kind === 'underline' ? e.color.ink : e.color.wash; ctx.fillRect(M, top, 8, y - top);
        newPage();
        top = y;
      }
      y += QL;
      text(line, M + 40, y - QL * 0.28, quoteFont, '#111418', W - 2 * M - 40);
    }
    ctx.fillStyle = e.kind === 'underline' ? e.color.ink : e.color.wash;
    ctx.fillRect(M, top, 8, y - top);
    if (nLines.length) {
      y += 22;
      const boxH = 40 + nLines.length * 32 + 14;
      if (y + boxH > H - M) newPage();
      ctx.fillStyle = '#F1F3F6';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(M + 40, y, W - 2 * M - 40, boxH, 14); else ctx.rect(M + 40, y, W - 2 * M - 40, boxH); ctx.fill();
      text('COMMENT', M + 64, y + 30, `500 14px ${MONO}`, '#858C97', 300);
      let ny = y + 40;
      for (const line of nLines) { ny += 32; text(line, M + 64, ny - 8, `italic 400 21px ${SANS}`, '#353C46', W - 2 * M - 64); }
      y += boxH;
    }
    y += 44;
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  pages.forEach((c, i) => {
    const g = c.getContext('2d');
    g.font = `400 15px ${SANS}`; g.fillStyle = '#A3A9B3'; g.textAlign = 'left';
    g.fillText('Made with Flow Reader', M, H - 56);
    g.textAlign = 'right';
    g.fillText(`${i + 1} / ${pages.length}`, W - M, H - 56);
    if (i) pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595.28, 841.89);
  });
  pdf.setProperties({ title: `${item.title} — marks`, creator: 'Flow Reader' });
  return pdf.output('blob');
}

export const summaryName = (item) => `${String(item.title || 'Marks').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60).trim()} — marks.pdf`;

const toBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

// Send the PDF on: the phone's share sheet (WhatsApp, Drive, Files…), or a download on a computer.
export async function shareFile(blob, name, title) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const r = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache });
    try { await Share.share({ title, url: r.uri, dialogTitle: 'Send the summary' }); } catch { return 'cancelled'; }
    return 'shared';
  }
  const file = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
