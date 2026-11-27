import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BackIcon, CloseIcon, FocusIcon, MarksIcon } from '../../components/Icons.jsx';
import AaMenu from '../../components/AaMenu.jsx';
import { DOC_FORMATS, loadDoc } from '../../lib/docs.js';
import { newId } from '../../lib/data.js';
import { quick, soft } from '../../lib/motion.js';
import { openFrom } from '../../lib/openFrom.js';
import { SIZE_MAX, SIZE_MIN } from '../../lib/reading.js';
import { KIND_NAMES, cleanText, lastColor, rememberColor } from './marks.js';
import { headingBefore, paintSection, rangeToParts, sortDocMarks } from './docMarks.js';
import { MarkPopover, MarksPanel, SelectionTools } from './MarkUI.jsx';
import { DictPop } from './Dictionary.jsx';
import { selectWords } from '../../lib/findText.js';
import { lab } from '../../lib/space.js';
import { isDefinable } from '../../lib/dictionary.js';
import { touchUI, useTouchSelection } from '../../lib/touchSelect.js';
import { enterFull, exitFull } from '../../lib/fullscreen.js';

const narrow = () => window.innerWidth < 760;

const PANEL = 300;
const hasPin = (m) => m.kind === 'comment' || !!m.note?.trim();
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// A book, Word document, text or HTML file, full screen, in your reading font.
// Remembers where you stopped, and you can highlight, underline and comment like in PDFs.
export default function DocReader({ card, from, at, atSection, atText, quoted, onQuote, onWord, reading, onReading, onProgress, onMarks, onOpenLink, onExport, onClose }) {
  const [doc, setDoc] = useState(null);
  const [failed, setFailed] = useState(null);
  const [panel, setPanel] = useState(() => (!narrow() && (card.marks?.length || 0) > 0 ? 'marks' : null)); // 'toc' | 'marks' | null
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [here, setHere] = useState({ label: '', percent: Math.round((card.progress || 0) * 100), tocIndex: -1 });
  const [color, setColor] = useState(lastColor);
  const [pending, setPending] = useState(null); // selected words waiting for a choice
  const [define, setDefine] = useState(null); // a word you asked the meaning of: { text, pos }
  const wordPick = !!pending && isDefinable(pending.text);
  const openDefine = () => {
    const sel = window.getSelection();
    if (!pending || !sel?.rangeCount) return;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setDefine({ text: pending.text.trim(), pos: { x: r.left + r.width / 2, y: r.top, y2: r.bottom }, at: Date.now() });
    sel.removeAllRanges(); // the phone's own Copy bar and handles go away, so they don't cover the meaning
  };
  const [openId, setOpenId] = useState(null);
  const [focusNote, setFocusNote] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const [undo, setUndo] = useState(null);
  const [, relayout] = useState(0);
  const scroller = useRef(null);
  const page = useRef(null);
  const anchor = useRef(card.pos || { s: 0, f: 0 });
  const progress = useRef(card.progress || 0);

  const marks = card.marks || [];
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const sorted = sortDocMarks(marks);
  const pinNumbers = new Map(sorted.filter(hasPin).map((m, i) => [m.id, i + 1]));
  const openMark = marks.find((m) => m.id === openId) || null;

  useEffect(() => {
    let alive = true;
    loadDoc(card.file)
      .then((d) => alive && setDoc(d))
      .catch((err) => alive && setFailed(err?.message === 'protected'
        ? 'This book is copy-protected (DRM), so it can only be read in the app it was bought from.'
        : "This file couldn't be opened. It may be damaged."));
    return () => { alive = false; };
  }, [card.file]);

  const sections = () => [...(page.current?.querySelectorAll(':scope > .doc-section') || [])];

  // ---- Keeping your place ----
  const restore = useCallback(() => {
    const box = scroller.current;
    const el = sections()[anchor.current.s];
    if (box && el) box.scrollTop = el.offsetTop + anchor.current.f * el.offsetHeight;
  }, []);
  useLayoutEffect(() => { if (doc) restore(); }, [doc, restore]);
  useEffect(() => {
    if (!doc || !page.current) return undefined;
    const ro = new ResizeObserver(() => { restore(); relayout((n) => n + 1); });
    ro.observe(page.current);
    return () => ro.disconnect();
  }, [doc, restore]);

  // ---- Drawing marks into the text (only chapters whose marks changed are redrawn) ----
  const painted = useRef(new Map());
  useLayoutEffect(() => {
    if (!doc) return;
    const els = sections();
    const bySection = new Map();
    for (const m of marks) {
      for (const part of m.parts || []) {
        if (!bySection.has(part.s)) bySection.set(part.s, []);
        bySection.get(part.s).push({ mark: m, part, pin: part === m.parts[m.parts.length - 1] ? pinNumbers.get(m.id) : null });
      }
    }
    const touched = new Set([...bySection.keys(), ...painted.current.keys()]);
    let changed = false;
    for (const s of touched) {
      const el = els[s];
      if (!el) continue;
      const items = bySection.get(s) || [];
      const sig = JSON.stringify(items.map(({ mark, part, pin }) => [mark.id, mark.kind, mark.color, part.start, part.end, pin]));
      if (painted.current.get(s) === sig) continue;
      paintSection(el, doc.sections[s].html, items);
      if (items.length) painted.current.set(s, sig); else painted.current.delete(s);
      changed = true;
    }
    if (changed) relayout((n) => n + 1); // place the mark's box now that its words are drawn
  }); // after every render; cheap when nothing changed

  // A brief glow on a mark you just made or jumped to (changes only its look, so your selection is never lost).
  useEffect(() => {
    if (!flashId) return undefined;
    const els = [...(page.current?.querySelectorAll(`[data-mark="${flashId}"]`) || [])];
    els.forEach((e) => e.classList.add('flash'));
    return () => els.forEach((e) => e.classList.remove('flash'));
  }, [flashId]);

  const tocTop = useCallback((t) => {
    const el = (t.anchor && document.getElementById(t.anchor)) || sections()[t.s];
    return el ? el.offsetTop : Infinity;
  }, []);

  const save = useCallback(() => onProgress({ pos: anchor.current, progress: progress.current }), [onProgress]);
  const saveTimer = useRef(null);

  const onScroll = () => {
    const box = scroller.current;
    const list = sections();
    if (!box || !list.length) return;
    const top = box.scrollTop;
    let s = 0;
    for (let i = 0; i < list.length; i += 1) { if (list[i].offsetTop <= top + 1) s = i; else break; }
    const el = list[s];
    const f = Math.max(0, Math.min(1, (top - el.offsetTop) / (el.offsetHeight || 1)));
    anchor.current = { s, f: Math.round(f * 10000) / 10000 };
    const atEnd = top + box.clientHeight >= box.scrollHeight - 4;
    progress.current = atEnd ? 1 : Math.min(1, (s + f) / list.length);
    const line = top + box.clientHeight * 0.25;
    let tocIndex = -1;
    (doc?.toc || []).forEach((t, i) => { if (tocTop(t) <= line) tocIndex = i; });
    const label = tocIndex >= 0 ? doc.toc[tocIndex].label : '';
    const percent = Math.round(progress.current * 100);
    setHere((h) => (h.label === label && h.percent === percent && h.tocIndex === tocIndex ? h : { label, percent, tocIndex }));
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 600);
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const close = useCallback(() => {
    clearTimeout(saveTimer.current);
    onClose({ pos: anchor.current, progress: progress.current });
  }, [onClose]);

  const scrollToTop = (top) => scroller.current?.scrollTo({ top: Math.max(0, top - 24), behavior: 'smooth' });
  const goSection = (d) => {
    const list = sections();
    const target = list[Math.max(0, Math.min(list.length - 1, anchor.current.s + d))];
    if (target) scrollToTop(target.offsetTop + 24);
  };

  // ---- Marks ----
  const updateMark = (id, patch) => onMarks(marksRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const flash = (id) => {
    setFlashId(id);
    setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1300);
  };
  const closePop = useCallback(() => {
    const m = marksRef.current.find((x) => x.id === openId);
    if (m && m.kind === 'comment' && !m.note?.trim()) onMarks(marksRef.current.filter((x) => x.id !== m.id));
    setOpenId(null);
    setFocusNote(false);
  }, [openId, onMarks]);
  const openPop = (m, focusIt = false) => {
    if (openId && openId !== m.id) closePop();
    setPending(null);
    setOpenId(m.id);
    setFocusNote(focusIt);
  };
  const addMark = (kind, colorId) => {
    if (!pending) return;
    rememberColor(colorId);
    setColor(colorId);
    const m = { id: newId(), kind, color: colorId, text: pending.text, note: '', parts: pending.parts, createdAt: Date.now() };
    onMarks([...marksRef.current, m]);
    window.getSelection()?.removeAllRanges();
    setPending(null);
    if (kind === 'comment') openPop(m, true); else flash(m.id);
  };
  const removeMark = (m) => {
    onMarks(marksRef.current.filter((x) => x.id !== m.id));
    setOpenId(null);
    setUndo(m);
  };
  const removeMarks = (ids) => { // several at once, from the Marks list
    const gone = marksRef.current.filter((x) => ids.includes(x.id));
    if (!gone.length) return;
    onMarks(marksRef.current.filter((x) => !ids.includes(x.id)));
    setOpenId(null);
    setUndo(gone.length === 1 ? gone[0] : gone);
  };
  useEffect(() => {
    if (!undo) return undefined;
    const t = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(t);
  }, [undo]);

  // Where things are, in the scrolling area's own coordinates (so the tools scroll with the text).
  const toContent = (r) => {
    const box = scroller.current.getBoundingClientRect();
    return { top: r.top - box.top + scroller.current.scrollTop, bottom: r.bottom - box.top + scroller.current.scrollTop, left: r.left - box.left, right: r.right - box.left };
  };
  const clampX = (x, half) => Math.max(half + 12, Math.min((scroller.current?.clientWidth || 0) - half - 12, x));
  const markBox = (id) => {
    const els = [...(page.current?.querySelectorAll(`[data-mark="${id}"]`) || [])];
    if (!els.length) return null;
    const rs = els.map((e) => toContent(e.getBoundingClientRect()));
    return { top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)), left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)) };
  };
  const toolPos = pending && scroller.current ? (() => {
    const b = pending.box;
    const above = b.top - 50;
    if (touchUI()) return { x: clampX((b.left + b.right) / 2, 170), y: b.bottom + 34 }; // below: the phone's own Copy bar is above
    return { x: clampX((b.left + b.right) / 2, 190), y: above < scroller.current.scrollTop + 8 ? b.bottom + 10 : above };
  })() : null;
  const popPos = openMark && scroller.current ? (() => {
    const b = markBox(openMark.id);
    return b ? { x: clampX((b.left + b.right) / 2, 196), y: b.bottom + 10 } : null;
  })() : null;

  const whereOf = (m) => {
    const p = m.parts?.[0];
    if (!p) return '';
    const label = headingBefore(sections()[p.s], p.start) || doc?.sections[p.s]?.label || (doc?.sections.length > 1 ? `Part ${p.s + 1}` : 'Start');
    return clip(label, 26);
  };

  const jumpTo = (m, instant = false) => {
    if (narrow() && !instant) setPanel(null);
    const el = page.current?.querySelector(`[data-mark="${m.id}"]`);
    if (!el) return false;
    const top = toContent(el.getBoundingClientRect()).top;
    scroller.current.scrollTo({ top: Math.max(0, top - scroller.current.clientHeight * 0.3), behavior: instant ? 'instant' : 'smooth' });
    if (instant) onScroll(); // remember the new place now, so a re-layout keeps it
    flash(m.id);
    openPop(m);
    return true;
  };

  // Opened from a quote card: go straight to that mark once its words are drawn.
  const openAt = useRef(at);
  useEffect(() => {
    if (!doc || !openAt.current) return undefined;
    const m = marksRef.current.find((x) => x.id === openAt.current);
    if (!m) { openAt.current = null; return undefined; }
    let tries = 0;
    let raf = 0;
    const go = () => {
      if (jumpTo(m, true) || tries++ > 30) { openAt.current = null; return; }
      raf = requestAnimationFrame(go);
    };
    raf = requestAnimationFrame(go);
    return () => cancelAnimationFrame(raf);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opened from search: straight to the chapter, with the words found there selected.
  const openSec = useRef(atSection != null ? { s: atSection, q: atText } : null);
  useEffect(() => {
    if (!doc || !openSec.current) return undefined;
    const { s, q } = openSec.current;
    openSec.current = null;
    const raf = requestAnimationFrame(() => {
      const el = sections()[s];
      if (!el) return;
      scroller.current.scrollTop = el.offsetTop;
      if (q) selectWords(el, q, scroller.current);
      onScroll(); // remember the new place
    });
    return () => cancelAnimationFrame(raf);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  const toLab = (m) => onQuote?.(m, whereOf(m));

  // Finished selecting words → the tools appear. A click on a mark → its box.
  const onMouseUp = (e) => {
    if (e.button !== 0 || e.target.closest?.('.mark-tools, .mark-pop')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !page.current?.contains(sel.anchorNode)) return;
      const range = sel.getRangeAt(0);
      const parts = rangeToParts(range, sections());
      const text = cleanText(sel.toString());
      if (!parts.length || !text) return;
      if (openId) closePop();
      setPending({ parts, text, box: toContent(range.getBoundingClientRect()) });
    }, 0);
  };

  useTouchSelection(scroller, () => onMouseUp({ button: 0, target: document.body }));

  const onClick = (e) => {
    const a = e.target.closest?.('a');
    if (a) {
      e.preventDefault();
      const href = a.getAttribute('href');
      if (!href) return;
      if (a.dataset.external) { onOpenLink(href); return; } // opens in Flow's own browser, on top of the book
      if (href.startsWith('#')) {
        const el = document.getElementById(href.slice(1));
        if (el) scrollToTop(toContent(el.getBoundingClientRect()).top);
      }
      return;
    }
    const hit = e.target.closest?.('mark[data-mark]');
    const sel = window.getSelection();
    if (hit && (!sel || sel.isCollapsed)) {
      const m = marksRef.current.find((x) => x.id === hit.dataset.mark);
      if (m) openPop(m);
    }
  };

  // The tools go away when the selection does.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPending(null);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  useEffect(() => {
    if (!openId) return undefined;
    const away = (e) => { if (!e.target.closest?.('.mark-pop, mark[data-mark], .marks-item, .marks-panel')) closePop(); };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [openId, closePop]);

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

  const togglePanel = (which) => setPanel((p) => (p === which ? null : which));

  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('.dict-pop')) return; // the meaning box closes first
      if (document.querySelector('.web-viewer.temp')) return; // a page opened from a link is on top: its keys first
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (openId) closePop();
        else if (pending) { window.getSelection()?.removeAllRanges(); setPending(null); }
        else if (menu) setMenu(false);
        else close();
        return;
      }
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) {
        if (e.key === 'Enter' && e.metaKey && openId) { e.preventDefault(); closePop(); }
        return;
      }
      if (e.metaKey && !e.altKey && !e.ctrlKey && ['=', '+', '-', '_'].includes(e.key)) {
        e.preventDefault();
        const d = e.key === '-' || e.key === '_' ? -1 : 1;
        onReading({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, (reading?.size || 19) + d)) });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (wordPick && k === 'd') { e.preventDefault(); openDefine(); }
      else if (pending && (k === 'h' || k === 'u' || k === 'c')) { e.preventDefault(); addMark({ h: 'highlight', u: 'underline', c: 'comment' }[k], color); }
      else if (openMark && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); removeMark(openMark); }
      else if (openMark && k === 'l' && onQuote) { e.preventDefault(); toLab(openMark); }
      else if (k === 'f') { e.preventDefault(); toggleFocus(); }
      else if (k === 't' && doc?.toc.length) { e.preventDefault(); togglePanel('toc'); }
      else if (k === 'm') { e.preventDefault(); togglePanel('marks'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goSection(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goSection(-1); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const body = useMemo(() => doc?.sections.map((sec, i) => (
    // eslint-disable-next-line react/no-danger -- cleaned by DOMPurify in lib/docs.js
    <section key={i} id={`s${i}`} className="doc-section" data-s={i} dangerouslySetInnerHTML={{ __html: sec.html }} />
  )), [doc]);

  const title = card.title || doc?.title || card.name;
  const author = card.author || doc?.author;
  const hasToc = (doc?.toc.length || 0) > 0;

  return createPortal(
    <motion.div
      className={`reader doc-reader${focus ? ' focus' : ''}`}
      data-overlay
      role="dialog"
      aria-modal="true"
      aria-label={title}
      {...openFrom(from)}
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
        <span className="reader-type">{card.source ? 'ARTICLE' : DOC_FORMATS[card.format] || 'DOC'}</span>
        <span className="reader-title">{title}{author && <span className="reader-author"> · {author}</span>}</span>
        <span style={{ flex: 1 }} />
        {here.label && <span className="doc-where" title={here.label}>{here.label}</span>}
        <span className="doc-percent">{here.percent}%</span>
        {hasToc && (
          <button type="button" className={`btn marks-toggle${panel === 'toc' ? ' on' : ''}`} aria-pressed={panel === 'toc'} title="Contents (T)" onClick={() => togglePanel('toc')}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg><span className="btn-label">Contents</span>
          </button>
        )}
        <button type="button" className={`btn marks-toggle${panel === 'marks' ? ' on' : ''}`} aria-pressed={panel === 'marks'} title="Marks (M)" onClick={() => togglePanel('marks')}>
          <MarksIcon /><span className="btn-label">Marks</span>{marks.length > 0 && <span className="marks-count">{marks.length}</span>}
        </button>
        <AaMenu reading={reading} onReading={onReading} open={menu} onOpenChange={setMenu} />
        <button type="button" className={`btn icon-only focus-btn${focus ? ' on' : ''}`} aria-pressed={focus} aria-label="Full screen" title={focus ? 'Show the bar (F)' : 'Full screen: hide this bar (F)'} onClick={toggleFocus}>
          <FocusIcon />
        </button>
      </header>

      <div className="reader-body">
        <div className="doc-scroll" ref={scroller} onScroll={onScroll} onClick={onClick} onMouseUp={onMouseUp}>
          {failed && <p className="reader-msg">{failed}</p>}
          {!failed && !doc && <p className="reader-msg">Opening…</p>}
          {doc && (
            <article className="doc-page" ref={page}>
              {body}
              <div className="doc-end" aria-hidden="true">· The end ·</div>
            </article>
          )}
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
                where={whereOf(openMark)}
                focusNote={focusNote}
                onLab={quoted?.has(openMark.id)}
                onToLab={onQuote ? toLab : undefined}
                onChange={(patch) => updateMark(openMark.id, patch)}
                onDelete={() => removeMark(openMark)}
              />
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false} mode="wait">
          {panel === 'marks' && (
            <MarksPanel key="marks" marks={sorted} pinNumbers={pinNumbers} whereOf={whereOf} title={`In this ${card.format === 'epub' ? 'book' : 'file'}`} quoted={quoted} onToLab={onQuote ? toLab : undefined} onJump={jumpTo} onDelete={removeMarks} onExport={onExport} onClose={() => setPanel(null)} />
          )}
          {panel === 'toc' && hasToc && (
            <motion.aside
              key="toc"
              className="marks-panel"
              aria-label="Contents"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: PANEL, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={soft}
            >
              <div className="marks-panel-in">
                <div className="marks-head">
                  <span>Contents · {doc.toc.length}</span>
                  <button type="button" className="icon-btn small" aria-label="Hide contents" title="Hide (T)" onClick={() => setPanel(null)}><CloseIcon /></button>
                </div>
                <ul className="marks-list toc-list">
                  {doc.toc.map((t, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        className={`toc-item${i === here.tocIndex ? ' on' : ''}`}
                        style={{ paddingLeft: 14 + Math.min(t.level, 3) * 16 }}
                        aria-current={i === here.tocIndex ? 'true' : undefined}
                        onClick={() => { scrollToTop(tocTop(t)); if (narrow()) setPanel(null); }}
                      >
                        {t.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.aside>
          )}
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
            <button type="button" onClick={() => { onMarks([...marksRef.current, ...(Array.isArray(undo) ? undo : [undo])]); setUndo(null); }}>Undo</button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
