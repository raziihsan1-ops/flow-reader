import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BackIcon, CloseIcon, FocusIcon, MarksIcon } from '../../components/Icons.jsx';
import { loadPdf, pageRatio, pdfOutline, renderPage, renderText } from '../../lib/pdf.js';
import { touchUI, useTouchSelection } from '../../lib/touchSelect.js';
import { enterFull, exitFull } from '../../lib/fullscreen.js';
import { soft } from '../../lib/motion.js';
import { newId } from '../../lib/data.js';
import { quick } from '../../lib/motion.js';
import { openFrom } from '../../lib/openFrom.js';
import { KIND_NAMES, cleanText, colorOf, lastColor, markAt, rememberColor, selectionToRects, sortMarks } from './marks.js';
import { MarkPopover, MarksPanel, SelectionTools } from './MarkUI.jsx';
import { DictPop } from './Dictionary.jsx';
import { selectWords } from '../../lib/findText.js';
import { lab } from '../../lib/space.js';
import { isDefinable } from '../../lib/dictionary.js';

const GAP = 24;
const PANEL = 300;
const narrow = () => window.innerWidth < 760; // a phone: the lists slide up over the page instead of sitting beside it
// Tablets (under ~1100 wide) keep only a thin border round the page; bigger screens a wider one.
const fitWidth = (panel) => (narrow() ? window.innerWidth - 16 : Math.max(320, Math.min(980, window.innerWidth - (window.innerWidth < 1100 ? 56 : 200) - (panel ? PANEL : 0))));
const maxWidth = () => (narrow() ? window.innerWidth * 4 : 2400);
const pct = (f) => `${f * 100}%`;
const hasPin = (m) => m.kind === 'comment' || !!m.note?.trim();

// One mark piece (one line of one mark), drawn on top of the printed page.
function MarkRect({ mark, rect, flash }) {
  const c = colorOf(mark.color);
  const box = { left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) };
  const cls = `mark mark-${mark.kind}${flash ? ' flash' : ''}`;
  if (mark.kind === 'underline') return <div className={cls} style={{ ...box, '--ink': c.ink }} />;
  return <div className={cls} style={{ ...box, '--wash': c.wash, '--ink': c.ink }} />;
}

// One page: an empty frame of the right size, drawn (picture + selectable text) only while it's near the screen.
function PageView({ doc, number, width, ratio, root, pieces, pins, flashId, onPin }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const textBox = useRef(null);
  const [near, setNear] = useState(false);
  const [height, setHeight] = useState(null);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { root: root.current, rootMargin: '1600px 0px' });
    io.observe(holder.current);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near || !canvas.current) return undefined;
    let task;
    let alive = true;
    renderPage(doc, number, canvas.current, width).then((r) => {
      if (!alive) { r.task.cancel(); return; }
      task = r.task;
      setHeight(r.height);
      task.promise.catch(() => {});
    }).catch(() => {});
    return () => { alive = false; task?.cancel(); };
  }, [near, doc, number, width]);

  useEffect(() => {
    if (!near || !textBox.current) return undefined;
    let layer;
    let alive = true;
    renderText(doc, number, textBox.current, width).then((l) => {
      if (!alive) { l.cancel(); return; }
      layer = l;
      l.done.catch(() => {});
    }).catch(() => {});
    return () => { alive = false; layer?.cancel(); };
  }, [near, doc, number, width]);

  // While dragging a selection, let it stretch smoothly over gaps between words.
  const startSelecting = () => {
    const el = textBox.current;
    if (!el) return;
    el.classList.add('selecting');
    const stop = () => { el.classList.remove('selecting'); window.removeEventListener('pointerup', stop); };
    window.addEventListener('pointerup', stop);
  };

  return (
    <div ref={holder} className="reader-page" data-page={number} style={{ width, height: height ?? width * ratio }}>
      {near && <canvas ref={canvas} />}
      <div className="marks-layer">
        {pieces.map(({ mark, rect }, i) => <MarkRect key={`${mark.id}-${i}`} mark={mark} rect={rect} flash={mark.id === flashId} />)}
      </div>
      {near && <div ref={textBox} className="textLayer" onPointerDown={startSelecting} />}
      {pins.map(({ mark, n, y }) => (
        <button
          key={mark.id}
          type="button"
          className="mark-pin"
          style={{ top: pct(y), '--ink': colorOf(mark.color).ink }}
          aria-label={`Comment ${n}`}
          onClick={() => onPin(mark)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function PdfReader({ card, from, at, atPage, atText, quoted, onQuote, onWord, onClose, onPage, onMarks, onExport }) {
  const [doc, setDoc] = useState(null);
  const [ratio, setRatio] = useState(1.3);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState(() => !narrow() && (card.marks?.length || 0) > 0);
  const [width, setWidth] = useState(() => fitWidth(!narrow() && (card.marks?.length || 0) > 0));
  const [toc, setToc] = useState(null); // the PDF's chapters, once read
  const [tocOpen, setTocOpen] = useState(false);
  const [current, setCurrent] = useState(card.page || 1);
  const [jump, setJump] = useState(String(card.page || 1));
  const [color, setColor] = useState(lastColor);
  const [pending, setPending] = useState(null); // selected text waiting for a choice
  const [define, setDefine] = useState(null); // a word you asked the meaning of: { text, pos }
  const wordPick = !!pending && isDefinable(pending.text);
  const openDefine = () => {
    const sel = window.getSelection();
    if (!pending || !sel?.rangeCount) return;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setDefine({ text: pending.text.trim(), pos: { x: r.left + r.width / 2, y: r.top, y2: r.bottom }, at: Date.now() });
    sel.removeAllRanges(); // the phone's own Copy bar and handles go away, so they don't cover the meaning
  };
  const [openId, setOpenId] = useState(null); // mark whose popover is open
  const [focusNote, setFocusNote] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [undo, setUndo] = useState(null);
  const [focus, setFocus] = useState(false); // hide the top bar for distraction-free reading
  const [focusHint, setFocusHint] = useState(false);
  const [, relayout] = useState(0);
  const scroller = useRef(null);
  const anchor = useRef({ page: card.page || 1, frac: 0 });
  const currentRef = useRef(current);
  currentRef.current = current;
  const pages = doc?.numPages || card.pages || 0;

  const marks = card.marks || [];
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const sorted = sortMarks(marks);
  const pinNumbers = new Map(sorted.filter(hasPin).map((m, i) => [m.id, i + 1]));
  const openMark = marks.find((m) => m.id === openId) || null;

  useEffect(() => {
    let alive = true;
    loadPdf(card.file)
      .then(async (d) => {
        const r = await pageRatio(d, 1);
        if (alive) { setRatio(r); setDoc(d); }
        const t = await pdfOutline(d);
        if (alive) setToc(t);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [card.file]);

  const pageEl = (n) => scroller.current?.querySelector(`[data-page="${n}"]`);

  // Open on the page you were reading, and keep your place when zooming.
  useLayoutEffect(() => {
    if (!doc) return;
    const el = pageEl(anchor.current.page);
    if (el) scroller.current.scrollTop = el.offsetTop - GAP + anchor.current.frac * el.offsetHeight;
    relayout((n) => n + 1); // re-place the toolbar / popover for the new page size
  }, [doc, width]);

  const close = useCallback(() => onClose(currentRef.current), [onClose]);

  // Which page you're on: the one covering the upper part of the screen.
  const onScroll = () => {
    const box = scroller.current;
    if (!box || !doc) return;
    const line = box.scrollTop + box.clientHeight * 0.3;
    let n = 1;
    for (const el of box.querySelectorAll('.reader-page')) {
      if (el.offsetTop <= line) n = Number(el.dataset.page); else break;
    }
    const el = pageEl(n);
    if (el) anchor.current = { page: n, frac: Math.max(0, (box.scrollTop + GAP - el.offsetTop) / el.offsetHeight) };
    if (n !== currentRef.current) { setCurrent(n); setJump(String(n)); }
  };

  useEffect(() => {
    const t = setTimeout(() => onPage(current), 600);
    return () => clearTimeout(t);
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (n) => {
    const target = Math.max(1, Math.min(pages, n));
    const el = pageEl(target);
    if (el) scroller.current.scrollTo({ top: el.offsetTop - GAP, behavior: 'smooth' });
    setJump(String(target));
  };

  const zoomTo = (w) => setWidth(Math.round(Math.max(Math.min(320, fitWidth(false)), Math.min(maxWidth(), w))));
  const widthRef = useRef(width);
  widthRef.current = width;

  // Pinch with two fingers to zoom (the page grows under your fingers, then is redrawn sharp).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    let pinch = null;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (e) => {
      if (e.touches.length !== 2) return;
      const b = el.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - b.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - b.top;
      pinch = { d: dist(e.touches), k: 1 };
      el.style.transformOrigin = `${cx}px ${cy}px`;
    };
    const move = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      pinch.k = Math.max(0.4, Math.min(4, dist(e.touches) / pinch.d));
      el.style.transform = `scale(${pinch.k})`;
    };
    const end = (e) => {
      if (!pinch || e.touches.length >= 2) return;
      const { k } = pinch;
      pinch = null;
      el.style.transform = '';
      if (Math.abs(k - 1) > 0.04) zoomTo(widthRef.current * k);
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', end); el.removeEventListener('touchcancel', end); };
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Marks ----
  const save = (next) => onMarks(next);
  const updateMark = (id, patch) => save(marksRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const flash = (id) => {
    setFlashId(id);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1300);
  };

  // Closing a fresh comment you never wrote anything in quietly removes it.
  const closePop = useCallback(() => {
    const m = marksRef.current.find((x) => x.id === openId);
    if (m && m.kind === 'comment' && !m.note?.trim()) onMarks(marksRef.current.filter((x) => x.id !== m.id));
    setOpenId(null);
    setFocusNote(false);
  }, [openId, onMarks]);

  const openPop = (m, focus = false) => {
    if (openId && openId !== m.id) closePop();
    setPending(null);
    setOpenId(m.id);
    setFocusNote(focus);
  };

  const addMark = (kind, colorId) => {
    if (!pending) return;
    rememberColor(colorId);
    setColor(colorId);
    const m = { id: newId(), kind, color: colorId, text: pending.text, note: '', rects: pending.rects, createdAt: Date.now() };
    save([...marksRef.current, m]);
    window.getSelection()?.removeAllRanges();
    setPending(null);
    if (kind === 'comment') openPop(m, true);
    else flash(m.id);
  };

  const removeMark = (m) => {
    save(marksRef.current.filter((x) => x.id !== m.id));
    setOpenId(null);
    setUndo(m);
  };
  const removeMarks = (ids) => { // several at once, from the Marks list
    const gone = marksRef.current.filter((x) => ids.includes(x.id));
    if (!gone.length) return;
    save(marksRef.current.filter((x) => !ids.includes(x.id)));
    setOpenId(null);
    setUndo(gone.length === 1 ? gone[0] : gone);
  };

  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  const jumpTo = (m, instant = false) => {
    if (narrow() && !instant) setPanel(false);
    const r = m.rects[0];
    const el = r && pageEl(r.p);
    if (!el) return;
    scroller.current.scrollTo({ top: el.offsetTop + r.y * el.offsetHeight - scroller.current.clientHeight * 0.3, behavior: instant ? 'instant' : 'smooth' });
    flash(m.id);
    openPop(m);
  };

  // Opened from a quote card: go straight to that mark (it glows, and its box opens).
  const openAt = useRef(at);
  useEffect(() => {
    if (!doc || !openAt.current) return undefined;
    const m = marksRef.current.find((x) => x.id === openAt.current);
    openAt.current = null;
    if (!m) return undefined;
    const raf = requestAnimationFrame(() => jumpTo(m, true));
    return () => cancelAnimationFrame(raf);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opened from search: straight to the page, with the words found there selected.
  const openPage = useRef(atPage ? { page: atPage, q: atText } : null);
  useEffect(() => {
    if (!doc || !openPage.current) return undefined;
    const { page, q } = openPage.current;
    openPage.current = null;
    const el = pageEl(page);
    if (el) scroller.current.scrollTop = el.offsetTop - GAP;
    if (!q) return undefined;
    let tries = 0;
    const t = setInterval(() => { // the page's words appear once it is drawn
      if (selectWords(pageEl(page)?.querySelector('.textLayer'), q, scroller.current) || (tries += 1) > 40) clearInterval(t);
    }, 150);
    return () => clearInterval(t);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const toLab = (m) => onQuote?.(m, `P. ${m.rects[0]?.p}`);

  // Where things sit, in the scrolling page area's own coordinates (so they scroll with the page).
  const boxOf = (rects) => {
    let top = Infinity; let bottom = -Infinity; let left = Infinity; let right = -Infinity;
    for (const r of rects) {
      const el = pageEl(r.p);
      if (!el) continue;
      const t = el.offsetTop + r.y * el.offsetHeight;
      const l = el.offsetLeft + r.x * el.offsetWidth;
      top = Math.min(top, t); bottom = Math.max(bottom, t + r.h * el.offsetHeight);
      left = Math.min(left, l); right = Math.max(right, l + r.w * el.offsetWidth);
    }
    return top === Infinity ? null : { top, bottom, left, right };
  };
  const clampX = (x, half) => {
    const box = scroller.current;
    return Math.max(half + 12, Math.min((box?.scrollWidth || 0) - half - 12, x));
  };
  const toolPos = (() => {
    if (!pending) return null;
    const b = boxOf(pending.rects);
    if (!b) return null;
    const box = scroller.current;
    const above = b.top - 50;
    // On a phone the system's own Copy / Share bar sits above the words, so ours goes below (past the handles).
    const y = touchUI() ? b.bottom + 34 : above < box.scrollTop + 8 ? b.bottom + 10 : above;
    return { x: clampX((b.left + b.right) / 2, touchUI() ? 170 : 190), y };
  })();
  const popPos = (() => {
    if (!openMark) return null;
    const b = boxOf(openMark.rects);
    if (!b) return null;
    return { x: clampX((b.left + b.right) / 2, 196), y: b.bottom + 10 };
  })();

  // Finished selecting text → show the toolbar. A plain click on a mark → open it.
  const onMouseUp = (e) => {
    if (e.button !== 0 || e.target.closest?.('.mark-tools, .mark-pop, .mark-pin')) return;
    const page = e.target.closest?.('.reader-page');
    const { clientX, clientY } = e;
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount && scroller.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rects = selectionToRects(range, [...scroller.current.querySelectorAll('.reader-page')]);
        const text = cleanText(sel.toString());
        if (rects.length && text) {
          if (openId) closePop();
          setPending({ rects, text });
          return;
        }
      }
      setPending(null);
      if (!page) return;
      const b = page.getBoundingClientRect();
      const hit = markAt(marksRef.current, Number(page.dataset.page), (clientX - b.left) / b.width, (clientY - b.top) / b.height);
      if (hit) openPop(hit);
    }, 0);
  };

  useTouchSelection(scroller, () => onMouseUp({ button: 0, target: document.body, clientX: 0, clientY: 0 }));

  // Show a hand over marks, so you know they can be clicked.
  const onMouseMove = (e) => {
    if (e.buttons) return;
    const page = e.target.closest?.('.reader-page');
    let over = false;
    if (page && marksRef.current.length) {
      const b = page.getBoundingClientRect();
      over = !!markAt(marksRef.current, Number(page.dataset.page), (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
    }
    scroller.current.classList.toggle('over-mark', over);
  };

  // If the selection goes away (click elsewhere, ⌘A in a box…), the toolbar goes too.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPending(null);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  // Clicking anywhere outside an open mark box closes it.
  useEffect(() => {
    if (!openId) return undefined;
    const away = (e) => {
      if (e.target.closest?.('.mark-pop, .mark-pin, .marks-item, .marks-panel')) return;
      closePop();
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [openId, closePop]);

  const togglePanel = () => {
    const next = !panel;
    setPanel(next);
    if (next) setTocOpen(false);
    // If the page was fitted to the window, keep it fitted with the panel in or out.
    if (Math.abs(width - fitWidth(panel)) < 2) setWidth(fitWidth(next));
  };

  const toggleFocus = () => setFocus((f) => {
    document.activeElement?.blur?.(); // the bar stays open while its button holds the focus
    if (!f) { setFocusHint(true); enterFull(); } else exitFull();
    return !f;
  });
  useEffect(() => () => { exitFull(); }, []); // leaving the reader always comes out of full screen
  useEffect(() => {
    if (!focusHint) return undefined;
    const t = setTimeout(() => setFocusHint(false), 2200);
    return () => clearTimeout(t);
  }, [focusHint]);

  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('.dict-pop')) return; // the meaning box closes first
      if (document.querySelector('.web-viewer.temp')) return; // a page opened from a link is on top: its keys first
      const typing = e.target.closest?.('input, textarea');
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (openId) closePop();
        else if (pending) { window.getSelection()?.removeAllRanges(); setPending(null); }
        else close();
        return;
      }
      if (typing) {
        if (e.key === 'Enter' && e.metaKey && openId) { e.preventDefault(); closePop(); }
        return;
      }
      if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomTo(width * 1.15); return; }
      if (e.metaKey && !e.ctrlKey && !e.altKey && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomTo(width / 1.15); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (wordPick && k === 'd') { e.preventDefault(); openDefine(); }
      else if (pending && (k === 'h' || k === 'u' || k === 'c')) {
        e.preventDefault();
        addMark({ h: 'highlight', u: 'underline', c: 'comment' }[k], color);
      } else if (openMark && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); removeMark(openMark); }
      else if (openMark && k === 'l' && onQuote) { e.preventDefault(); toLab(openMark); }
      else if (k === 'm') { e.preventDefault(); togglePanel(); }
      else if (k === 't' && toc?.length) { e.preventDefault(); setTocOpen((o) => !o); }
      else if (k === 'f') { e.preventDefault(); toggleFocus(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(width * 1.15); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(width / 1.15); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentRef.current + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentRef.current - 1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // What each page draws: its pieces of every mark, and the numbered comment pins in its margin.
  const piecesFor = (n) => marks.flatMap((m) => m.rects.filter((r) => r.p === n).map((rect) => ({ mark: m, rect })));
  const pinsFor = (n) => sorted
    .filter((m) => pinNumbers.has(m.id) && m.rects[0]?.p === n)
    .map((m) => ({ mark: m, n: pinNumbers.get(m.id), y: m.rects[0].y }));

  const percent = Math.round((width / fitWidth(panel)) * 100);

  return createPortal(
    <motion.div
      className={`reader pdf-reader${focus ? ' focus' : ''}`}
      data-overlay
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      {...openFrom(from)}
      // The reader floats above the lab; its clicks must never reach the lab underneath
      // (the lab would grab the pointer to start panning, and buttons here would never get the click).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onDragOver={(e) => e.stopPropagation()}
      onDrop={(e) => e.stopPropagation()}
    >
      <div className="room-accent" style={{ background: 'var(--cyan)' }} />
      {focus && <div className="reader-reveal" aria-hidden="true" />}
      {focus && <button type="button" className="focus-exit" aria-label="Leave full screen" onClick={toggleFocus}><svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></button>}
      <header className="reader-top drag">
        <button type="button" className="btn" aria-label="Back to library" onClick={close}><BackIcon /><span className="back-label"> Library</span></button>
        <span className="reader-type">PDF</span>
        <span className="reader-title">{card.name}</span>
        <span style={{ flex: 1 }} />
        {pages > 0 && (
          <form className="reader-pages" onSubmit={(e) => { e.preventDefault(); goTo(Number(jump) || 1); }}>
            <label htmlFor="reader-page">Page</label>
            <input id="reader-page" className="reader-page-input" inputMode="numeric" value={jump} onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))} />
            <span>/ {pages}</span>
          </form>
        )}
        <div className="reader-zoom" role="group" aria-label="Zoom">
          <button type="button" className="hud-btn" aria-label="Zoom out" onClick={() => zoomTo(width / 1.15)}>−</button>
          <span className="hud-zoom">{percent}%</span>
          <button type="button" className="hud-btn" aria-label="Zoom in" onClick={() => zoomTo(width * 1.15)}>+</button>
          <span className="hud-sep" />
          <button type="button" className="hud-text" onClick={() => zoomTo(fitWidth(panel))}>Fit</button>
        </div>
        {toc?.length > 0 && (
          <button type="button" className={`btn marks-toggle${tocOpen ? ' on' : ''}`} aria-pressed={tocOpen} title="Contents (T)" onClick={() => { setTocOpen((o) => !o); if (!tocOpen && panel) togglePanel(); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg><span className="btn-label">Contents</span>
          </button>
        )}
        <button type="button" className={`btn icon-only focus-btn${focus ? ' on' : ''}`} aria-pressed={focus} aria-label="Full screen" title={focus ? 'Show the bar (F)' : 'Full screen: hide this bar (F)'} onClick={toggleFocus}>
          <FocusIcon />
        </button>
        <button
          type="button"
          className={`btn marks-toggle${panel ? ' on' : ''}`}
          aria-pressed={panel}
          title="Marks (M)"
          onClick={togglePanel}
        >
          <MarksIcon /><span className="btn-label">Marks</span>{marks.length > 0 && <span className="marks-count">{marks.length}</span>}
        </button>
      </header>

      <div className="reader-body">
        <div className="reader-scroll" ref={scroller} onScroll={onScroll} onMouseUp={onMouseUp} onMouseMove={onMouseMove}>
          {failed && <p className="reader-msg">This PDF couldn't be opened. It may be damaged or password-protected.</p>}
          {!failed && !doc && <p className="reader-msg">Opening…</p>}
          {doc && Array.from({ length: doc.numPages }, (_, i) => (
            <PageView
              key={i + 1}
              doc={doc}
              number={i + 1}
              width={width}
              ratio={ratio}
              root={scroller}
              pieces={piecesFor(i + 1)}
              pins={pinsFor(i + 1)}
              flashId={flashId}
              onPin={(m) => openPop(m)}
            />
          ))}
          <AnimatePresence>
            {toolPos && <SelectionTools key="tools" pos={toolPos} color={color} onPick={addMark} onDefine={wordPick ? openDefine : undefined} />}
          </AnimatePresence>
          <AnimatePresence>
            {define && <DictPop key={define.at} word={define.text} pos={define.pos} onToLab={onWord} onClose={() => setDefine(null)} />}
          </AnimatePresence>
          <AnimatePresence>
            {openMark && popPos && (
              <MarkPopover
                key={openMark.id}
                mark={openMark}
                pos={popPos}
                where={`P. ${openMark.rects[0]?.p}`}
                focusNote={focusNote}
                onLab={quoted?.has(openMark.id)}
                onToLab={onQuote ? toLab : undefined}
                onChange={(patch) => updateMark(openMark.id, patch)}
                onDelete={() => removeMark(openMark)}
              />
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {tocOpen && toc?.length > 0 && (
            <motion.aside key="toc" className="marks-panel" aria-label="Contents" initial={{ width: 0, opacity: 0 }} animate={{ width: PANEL, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={soft}>
              <div className="marks-panel-in">
                <div className="marks-head">
                  <span>Contents · {toc.length}</span>
                  <button type="button" className="icon-btn small" aria-label="Hide contents" onClick={() => setTocOpen(false)}><CloseIcon /></button>
                </div>
                <ul className="marks-list toc-list">
                  {toc.map((t, i) => {
                    const on = t.page <= current && !(toc[i + 1] && toc[i + 1].page <= current);
                    return (
                      <li key={i}>
                        <button type="button" className={`toc-item${on ? ' on' : ''}`} style={{ paddingLeft: 14 + Math.min(t.level, 3) * 16 }} onClick={() => { goTo(t.page); if (narrow()) setTocOpen(false); }}>
                          <span className="toc-label">{t.label}</span><span className="toc-page">{t.page}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.aside>
          )}
          {panel && <MarksPanel marks={sorted} pinNumbers={pinNumbers} whereOf={(m) => `P. ${m.rects[0]?.p}`} quoted={quoted} onToLab={onQuote ? toLab : undefined} onJump={jumpTo} onDelete={removeMarks} onExport={onExport} onClose={togglePanel} />}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {focusHint && (
          <motion.div
            className="toast focus-hint"
            role="status"
            initial={{ opacity: 0, y: -8, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -8, x: '-50%' }}
            transition={quick}
          >
            {touchUI() ? 'Full screen · tap the button in the top corner to come back' : <>Focus mode · move to the top to see the bar · <span className="kbd">F</span> to bring it back</>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {undo && (
          <motion.div
            className="toast toast-action"
            role="status"
            initial={{ opacity: 0, y: 10, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 6, x: '-50%' }}
            transition={quick}
          >
            {Array.isArray(undo) ? `${undo.length} marks` : KIND_NAMES[undo.kind]} removed
            <button type="button" onClick={() => { save([...marksRef.current, ...(Array.isArray(undo) ? undo : [undo])]); setUndo(null); }}>Undo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
