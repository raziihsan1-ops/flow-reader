import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import PdfReader from './rooms/discover/PdfReader.jsx';
import DocReader from './rooms/discover/DocReader.jsx';
import MediaViewer from './rooms/discover/MediaViewer.jsx';
import { DOC_FORMATS } from './lib/docs.js';
import { formatTime } from './lib/media.js';
import { READING_DEFAULT, applyReading } from './lib/reading.js';
import { ACCEPT, addFile, addYouTube, indexPdf } from './lib/add.js';
import { makeDemo } from './lib/demo.js';
import { forgetIndex, loadIndex, searchAll } from './lib/search.js';
import { makeSummary, shareFile, summaryName } from './lib/summary.js';
import { forgetUrl, keepSafe, loadLibrary, loadSettings, prepareFile, removeFile, saveLibrary, saveSettings } from './store.js';
import { cardBox } from './lib/openFrom.js';
import { isDefinable } from './lib/dictionary.js';
import { DictHead, Meanings, found, useLookUp } from './rooms/discover/Dictionary.jsx';
import { quick, soft } from './lib/motion.js';

// ---- Small pieces ----
const typeLabel = (it) => (it.type === 'pdf' ? 'PDF' : it.type === 'doc' ? DOC_FORMATS[it.format] || 'DOC' : it.type === 'youtube' ? 'YOUTUBE' : 'VIDEO');
const typeTone = (it) => (it.type === 'pdf' ? 'cyan' : it.type === 'doc' ? (it.format === 'epub' ? 'amber' : 'green') : 'crimson');
const FILTERS = [
  { id: 'all', name: 'All', test: () => true },
  { id: 'pdf', name: 'PDFs', test: (it) => it.type === 'pdf' },
  { id: 'book', name: 'Books', test: (it) => it.type === 'doc' && it.format === 'epub' },
  { id: 'doc', name: 'Documents', test: (it) => it.type === 'doc' && it.format !== 'epub' },
  { id: 'video', name: 'Videos', test: (it) => it.type === 'video' || it.type === 'youtube' },
];

export function progressOf(it) {
  if (it.type === 'pdf') {
    const p = it.pages ? Math.min(1, (it.page || 1) / it.pages) : 0;
    return { f: it.openedAt ? p : 0, text: it.pages ? `${it.openedAt ? it.page || 1 : 0} of ${it.pages} page${it.pages === 1 ? '' : 's'} · ${Math.round((it.openedAt ? p : 0) * 100)}%` : '' };
  }
  if (it.type === 'doc') return { f: it.progress || 0, text: `${Math.round((it.progress || 0) * 100)}% read` };
  const d = it.duration || 0;
  if (!d) return { f: 0, text: it.pos ? `${formatTime(it.pos)} watched` : 'Not started' };
  return { f: Math.min(1, (it.pos || 0) / d), text: `${formatTime(it.pos || 0)} of ${formatTime(d)}` };
}
const countsOf = (it) => {
  const v = it.type === 'video' || it.type === 'youtube';
  const n = v ? (it.tnotes || []).length : (it.marks || []).length;
  if (!n) return '';
  return v ? `${n} time note${n === 1 ? '' : 's'}` : `${n} mark${n === 1 ? '' : 's'}`;
};

const Icon = {
  plus: <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /></svg>,
  search: <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  sun: <svg viewBox="0 0 24 24" width="19" height="19"><circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" fill="none" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  moon: <svg viewBox="0 0 24 24" width="19" height="19"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" /></svg>,
  more: <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="5.5" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="18.5" cy="12" r="1.7" fill="currentColor" /></svg>,
  close: <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  file: <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 3h7l5 5v13H7z M14 3v5h5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>,
  yt: <svg viewBox="0 0 24 24" width="22" height="22"><rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" /></svg>,
  check: <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  menu: <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>,
  play: <svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>,
};

function Cover({ it }) {
  const video = it.type === 'video' || it.type === 'youtube';
  return (
    <div className={`fr-cover tone-${typeTone(it)}${video ? ' wide' : ''}`}>
      {it.cover ? <img src={it.cover} alt="" loading="lazy" draggable={false} /> : (
        <div className="fr-cover-text">
          <span>{it.title}</span>
          {it.preview && <p>{it.preview.slice(0, 160)}</p>}
        </div>
      )}
      {video && <span className="fr-play">{Icon.play}</span>}
      {video && it.duration > 0 && <span className="fr-dur">{formatTime(it.duration)}</span>}
      {it.demo && <span className="fr-demo-tag">DEMO</span>}
    </div>
  );
}

// A card. Press and hold one (or right-click) to start picking several; while picking, a tap picks or unpicks.
function Card({ it, onOpen, onMore, picking, picked, onPick }) {
  const p = progressOf(it);
  const counts = countsOf(it);
  return (
    <div className={`fr-card${picking ? ' picking' : ''}${picked ? ' picked' : ''}`} data-card={it.id}>
      <button type="button" className="fr-card-open" aria-pressed={picking ? picked : undefined} onClick={() => (picking ? onPick(it) : onOpen(it))} onContextMenu={(e) => { e.preventDefault(); navigator.vibrate?.(15); onPick(it, true); }}>
        <Cover it={it} />
        <div className="fr-card-info">
          <span className={`fr-type tone-${typeTone(it)}`}>{typeLabel(it)}</span>
          <span className="fr-title">{it.title}</span>
          {(it.author || it.channel) && <span className="fr-by">{it.author || it.channel}</span>}
          <span className="fr-bar"><i style={{ width: `${p.f * 100}%` }} /></span>
          <span className="fr-meta">{p.text}{counts && <b> · {counts}</b>}</span>
        </div>
      </button>
      {picking
        ? <span className="fr-pick" aria-hidden="true">{picked && Icon.check}</span>
        : <button type="button" className="fr-more" aria-label={`More for ${it.title}`} onClick={() => onMore(it)}>{Icon.more}</button>}
    </div>
  );
}

function RecentCard({ it, onOpen }) {
  const p = progressOf(it);
  return (
    <button type="button" className="fr-recent" data-card={it.id} onClick={() => onOpen(it)}>
      <Cover it={it} />
      <span className="fr-recent-info">
        <span className={`fr-type tone-${typeTone(it)}`}>{typeLabel(it)}</span>
        <span className="fr-title">{it.title}</span>
        <span className="fr-bar"><i style={{ width: `${p.f * 100}%` }} /></span>
        <span className="fr-meta">{p.text}</span>
      </span>
    </button>
  );
}

const Snip = ({ s }) => (s ? <span className="fr-snip">{s.before}<mark>{s.hit}</mark>{s.after}</span> : null);

// One word typed in search: its meaning in English, Malayalam and Arabic, above the other results.
function DefineCard({ word }) {
  const res = useLookUp(word);
  if (!found(res)) return null;
  return (
    <section className="fr-group">
      <h3>Meaning</h3>
      <div className="fr-define"><DictHead res={res} word={word} /><Meanings res={res} limit={4} /></div>
    </section>
  );
}

function Results({ res, query, onGo }) {
  if (!res) return null;
  const word = query.trim();
  const define = isDefinable(word) ? <DefineCard key={word} word={word} /> : null;
  if (!res.count) return <div className="fr-results">{define}<p className="fr-empty-small">Not found in your files, marks or notes.</p></div>;
  const group = (title, list, row) => list.length > 0 && (
    <section className="fr-group">
      <h3>{title} <span>{list.length}</span></h3>
      <ul>{list.map(row)}</ul>
    </section>
  );
  const head = (it, where) => (
    <span className="fr-row-head"><span className={`fr-type tone-${typeTone(it)}`}>{typeLabel(it)}</span><span className="fr-row-title">{it.title}</span>{where && <span className="fr-row-where">{where}</span>}</span>
  );
  return (
    <div className="fr-results">
      {define}
      {group('Files', res.files, (r) => (
        <li key={`f${r.item.id}`}><button type="button" className="fr-row" onClick={() => onGo(r.item, {})}>{head(r.item)}<span className="fr-row-sub">{progressOf(r.item).text}</span></button></li>
      ))}
      {group('Inside files', res.inside, (r, i) => (
        <li key={`i${i}`}><button type="button" className="fr-row" onClick={() => onGo(r.item, r.item.type === 'pdf' ? { atPage: r.at, atText: r.q } : { atSection: r.at, atText: r.q })}>{head(r.item, r.where)}<Snip s={r.snip} />{r.more && <span className="fr-row-sub">+{r.more} more in this file</span>}</button></li>
      ))}
      {group('Marks & comments', res.marks, (r) => (
        <li key={`m${r.mark.id}`}><button type="button" className="fr-row" onClick={() => onGo(r.item, { at: r.mark.id })}>{head(r.item, r.where)}{r.snip ? <Snip s={r.snip} /> : <span className="fr-snip">{r.mark.text.slice(0, 120)}</span>}{r.note && <span className="fr-row-note">Comment: <Snip s={r.note} /></span>}</button></li>
      ))}
      {group('Time notes', res.notes, (r) => (
        <li key={`n${r.note.id}`}><button type="button" className="fr-row" onClick={() => onGo(r.item, { at: r.note.t })}>{head(r.item, r.where)}<Snip s={r.snip} /></button></li>
      ))}
    </div>
  );
}

// A short message at the bottom: gone after 4 seconds at most, or swipe it down to close it now.
function Toast({ toast, onGone }) {
  const gone = useRef(false);
  const box = useRef(null);
  const drag = useRef(null);
  const done = useCallback(() => { if (!gone.current) { gone.current = true; onGone(toast); } }, [onGone, toast]);
  useEffect(() => { const t = setTimeout(done, Math.min(toast.ms || 3200, 4000)); return () => clearTimeout(t); }, [done, toast.ms]);
  const move = (y) => { if (box.current) box.current.style.transform = y ? `translateY(${y}px)` : ''; };
  const down = (e) => {
    if (e.target.closest('button')) return;
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moving = (e) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    move(drag.current.dy);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.dy > 28) done(); else move(0);
  };
  return (
    <motion.div className="fr-toast-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={quick}>
      <div ref={box} className="fr-toast" role="status" onPointerDown={down} onPointerMove={moving} onPointerUp={up} onPointerCancel={up}>
        <span className="fr-toast-grip" aria-hidden="true" />
        {toast.text}{toast.undo && <button type="button" onClick={toast.undo}>Undo</button>}
      </div>
    </motion.div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <motion.div className="fr-sheet-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={quick} onClick={onClose}>
      <motion.div className="fr-sheet" role="dialog" aria-label={title} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={soft} onClick={(e) => e.stopPropagation()}>
        <div className="fr-sheet-head"><b>{title}</b><button type="button" className="fr-icon-btn" aria-label="Close" onClick={onClose}>{Icon.close}</button></div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ---- The app ----
export default function App() {
  const [items, setItems] = useState(null);
  const [settings, setSettings] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [res, setRes] = useState(null);
  const [sheet, setSheet] = useState(null); // 'add' | { menu: item } | { rename: item } | { remove: item }
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(null); // what's being added
  const [toast, setToast] = useState(null);
  const [open, setOpen] = useState(null); // { id, from, at, atPage, atSection, atText }
  const [picked, setPicked] = useState(null); // ids picked for removing several at once (null = not picking)
  const picker = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    Promise.all([loadLibrary(), loadSettings()]).then(([lib, s]) => {
      setItems(lib);
      setSettings({ theme: window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark', reading: READING_DEFAULT, ...s });
    });
  }, []);
  useEffect(() => {
    if (!settings) return;
    document.documentElement.dataset.theme = settings.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#F3F4F6' : '#0B0D10');
    applyReading(settings.reading);
    try { localStorage.setItem('fr-theme', JSON.stringify(settings.theme)); } catch { /* fine */ }
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: settings.theme === 'light' ? Style.Light : Style.Dark }).catch(() => {});
        StatusBar.setBackgroundColor({ color: settings.theme === 'light' ? '#F3F4F6' : '#0B0D10' }).catch(() => {});
      }).catch(() => {});
    }
  }, [settings]);
  const changeSettings = useCallback((patch) => setSettings((s) => { const n = { ...s, ...patch }; saveSettings(n); return n; }), []);

  const say = (text, ms = 3200) => setToast({ text, ms, at: Date.now() });
  const toastRef = useRef(null);
  toastRef.current = toast;
  const toastGone = useCallback((t) => { t.onGone?.(); setToast((x) => (x === t ? null : x)); }, []);

  const commit = useCallback((fn) => setItems((prev) => { const next = fn(prev); saveLibrary(next); return next; }), []);
  const update = useCallback((id, patch) => commit((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it))), [commit]);

  // ---- Search ----
  useEffect(() => {
    if (!items || query.trim().length < 2) { setRes(null); return undefined; }
    let alive = true;
    const t = setTimeout(async () => { await loadIndex(items); if (alive) setRes(searchAll(items, query)); }, 160);
    return () => { alive = false; clearTimeout(t); };
  }, [query, items]);

  // ---- Adding ----
  const addFiles = async (list) => {
    setSheet(null);
    keepSafe();
    let added = 0;
    for (const f of list) {
      setBusy(f.name);
      try {
        const it = await addFile(f);
        commit((prev) => [it, ...prev]);
        added += 1;
        if (it.type === 'pdf') indexPdf(it).then((ok) => { forgetIndex(it.file); if (!ok) update(it.id, { noText: true }); }).catch(() => {});
      } catch (e) { say(e.message || `Couldn't add “${f.name}”.`, 5000); }
    }
    setBusy(null);
    if (added) say(added === 1 ? 'Added to your library' : `${added} files added`);
  };
  const addLink = async () => {
    const l = link.trim();
    if (!l) return;
    setBusy('YouTube video');
    try {
      const it = await addYouTube(l);
      commit((prev) => [it, ...prev]);
      setLink(''); setSheet(null);
      say('Video added');
    } catch (e) { say(e.message, 4000); }
    setBusy(null);
  };

  // ---- The demo: the sample files already read and marked (every feature in use) ----
  const demoOn = items?.some((it) => it.demo);
  const startDemo = async () => {
    setSheet(null); setFilter('all');
    keepSafe();
    setBusy('the demo');
    try {
      const list = await makeDemo((name) => setBusy(`the demo · ${name}`));
      commit((prev) => [...list, ...prev.filter((x) => !x.demo)]);
      list.filter((it) => it.type === 'pdf').forEach((it) => indexPdf(it).then(() => forgetIndex(it.file)).catch(() => {}));
      say('Demo added · look for the DEMO tag');
    } catch (e) { say(`Couldn't load the demo (${e.message || 'error'})`, 4000); }
    setBusy(null);
  };
  const stopDemo = () => {
    setSheet(null);
    const gone = itemsRef.current.filter((it) => it.demo);
    commit((prev) => prev.filter((it) => !it.demo));
    gone.forEach((it) => { if (it.file) { removeFile(it.file); forgetUrl(it.file); forgetIndex(it.file); } });
    say('Demo removed');
  };

  // ---- Opening ----
  const openItem = async (it, where = {}) => {
    try {
      if (it.file) await prepareFile(it.file);
    } catch { say("This file is missing from the phone's storage.", 4000); return; }
    update(it.id, { openedAt: Date.now() });
    setOpen({ id: it.id, from: where.fromSearch ? null : cardBox(it.id), ...where });
  };
  const current = open && items?.find((x) => x.id === open.id);
  const close = (patch) => {
    if (current && patch) update(current.id, patch);
    setOpen(null);
  };

  // ---- Summary PDF ----
  const exportSummary = async (it) => {
    setSheet(null);
    const n = it.type === 'video' || it.type === 'youtube' ? (it.tnotes || []).length : (it.marks || []).length;
    if (!n) { say(it.type === 'video' || it.type === 'youtube' ? 'Add a time note first' : 'Mark something first, then export'); return; }
    say('Making the summary PDF…', 8000);
    try {
      const blob = await makeSummary(it, settings.reading);
      const how = await shareFile(blob, summaryName(it), `${it.title} — marks`);
      say(how === 'downloaded' ? 'Summary PDF saved to Downloads' : how === 'shared' ? 'Summary ready' : 'Summary not sent');
    } catch (e) { say(`Couldn't make the PDF (${e.message || 'error'})`, 5000); }
  };
  const exportOpen = () => { const it = itemsRef.current?.find((x) => x.id === open?.id); if (it) exportSummary(it); };

  // ---- Removing one or several (Undo for 4 seconds; the files are deleted when the message goes) ----
  const remove = (list) => {
    setSheet(null); setPicked(null);
    const before = itemsRef.current;
    const ids = new Set(list.map((it) => it.id));
    commit((prev) => prev.filter((x) => !ids.has(x.id)));
    let undone = false; let deleted = false;
    toastRef.current?.onGone?.(); // a removal still waiting: finish it now
    setToast({
      text: list.length === 1 ? `Removed “${list[0].title.slice(0, 36)}”` : `Removed ${list.length} files`,
      ms: 4000,
      at: Date.now(),
      undo: () => {
        undone = true;
        commit((prev) => { const keep = new Set(prev.map((x) => x.id)); return before.filter((x) => ids.has(x.id) || keep.has(x.id)).map((x) => prev.find((y) => y.id === x.id) || x); });
        setToast(null);
      },
      onGone: () => { if (deleted) return; deleted = true; if (!undone) list.forEach((it) => { if (it.file) { removeFile(it.file); forgetUrl(it.file); forgetIndex(it.file); } }); },
    });
  };
  const pick = (it, start) => setPicked((p) => {
    if (!p) return start ? [it.id] : p;
    return p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id];
  });
  const pickedItems = (items || []).filter((it) => picked?.includes(it.id));

  // ---- Phone back button: close what's on top first ----
  const stateRef = useRef({});
  stateRef.current = { open, sheet, query, picked };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    let handle;
    import('@capacitor/app').then(({ App: CapApp }) => {
      handle = CapApp.addListener('backButton', () => {
        const s = stateRef.current;
        if (s.open) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        else if (s.sheet) setSheet(null);
        else if (s.picked) setPicked(null);
        else if (s.query) setQuery('');
        else CapApp.exitApp();
      });
    });
    return () => { handle?.then?.((h) => h.remove()); };
  }, []);

  const shown = useMemo(() => (items || []).filter(FILTERS.find((f) => f.id === filter).test), [items, filter]);
  // The Recent row always starts at its first (latest) card.
  const recentRow = useRef(null);
  const recentKey = (items || []).filter((it) => it.openedAt).sort((a, b) => b.openedAt - a.openedAt).slice(0, 10).map((it) => it.id).join('|');
  useEffect(() => { if (!open && recentRow.current) recentRow.current.scrollLeft = 0; }, [recentKey, open]);
  const recent = useMemo(() => (items || []).filter((it) => it.openedAt).sort((a, b) => b.openedAt - a.openedAt).slice(0, 10), [items]);

  if (!items || !settings) return <div className="fr-loading" />;
  const light = settings.theme === 'light';

  return (
    <div className="fr-app">
      {picked ? (
        <header className="fr-top fr-pickbar">
          <button type="button" className="fr-icon-btn" aria-label="Stop picking" onClick={() => setPicked(null)}>{Icon.close}</button>
          <b>{picked.length} selected</b>
          <span style={{ flex: 1 }} />
          <button type="button" className="fr-text-btn" onClick={() => setPicked(picked.length === shown.length ? [] : shown.map((it) => it.id))}>{picked.length === shown.length ? 'None' : 'All'}</button>
          <button type="button" className="fr-add danger" disabled={!picked.length} onClick={() => setSheet({ remove: pickedItems })}>Remove</button>
        </header>
      ) : (
      <header className="fr-top">
        <div className="fr-brand"><img className="fr-logo" src="./icons/icon-192.png" alt="" /><b>Flow</b> Reader</div>
        <span style={{ flex: 1 }} />
        <button type="button" className="fr-icon-btn" aria-label={light ? 'Dark mode' : 'Light mode'} onClick={() => changeSettings({ theme: light ? 'dark' : 'light' })}>{light ? Icon.moon : Icon.sun}</button>
        <button type="button" className="fr-icon-btn" aria-label="More" onClick={() => setSheet('more')}>{Icon.menu}</button>
        <button type="button" className="fr-add" onClick={() => setSheet('add')}>{Icon.plus} Add</button>
      </header>
      )}

      <div className="fr-search">
        {Icon.search}
        <input type="search" value={query} placeholder="Search, or define a word" aria-label="Search everything" onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
        {query && <button type="button" className="fr-icon-btn small" aria-label="Clear search" onClick={() => setQuery('')}>{Icon.close}</button>}
      </div>

      {res ? <Results res={res} query={query} onGo={(it, where) => openItem(it, { ...where, fromSearch: true })} /> : (
        <main>
          {items.length === 0 ? (
            <div className="fr-welcome">
              <div className="fr-welcome-art" aria-hidden="true"><i /><i /><i /></div>
              <h1>Your reading, in one place</h1>
              <p>Add PDFs, books (EPUB), Word documents, text files and videos from your phone — or a YouTube link. Highlight, underline, comment, and keep time notes on videos.</p>
              <button type="button" className="fr-add big" onClick={() => setSheet('add')}>{Icon.plus} Add your first file</button>
              <button type="button" className="fr-link" onClick={startDemo}>or try the demo first (every feature, ready to explore)</button>
            </div>
          ) : (
            <>
              {recent.length > 0 && filter === 'all' && (
                <section className="fr-section">
                  <h2>Recent</h2>
                  <div className="fr-recent-row" ref={recentRow}>{recent.map((it) => <RecentCard key={it.id} it={it} onOpen={openItem} />)}</div>
                </section>
              )}
              <section className="fr-section">
                <div className="fr-chips" role="tablist" aria-label="Show">
                  {FILTERS.map((f) => {
                    const n = items.filter(f.test).length;
                    if (f.id !== 'all' && !n) return null;
                    return <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={`fr-chip${filter === f.id ? ' on' : ''}`} onClick={() => setFilter(f.id)}>{f.name}<span>{n}</span></button>;
                  })}
                </div>
                {!picked && items.length > 1 && <p className="fr-hint">Press and hold a file to pick several</p>}
                <div className="fr-grid">
                  {shown.map((it) => <Card key={it.id} it={it} onOpen={openItem} onMore={(x) => setSheet({ menu: x })} picking={!!picked} picked={!!picked?.includes(it.id)} onPick={pick} />)}
                </div>
              </section>
            </>
          )}
        </main>
      )}

      <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { const l = [...e.target.files]; e.target.value = ''; if (l.length) addFiles(l); }} />

      <AnimatePresence>
        {sheet === 'add' && (
          <Sheet key="add" title="Add to your library" onClose={() => setSheet(null)}>
            <button type="button" className="fr-sheet-big" onClick={() => picker.current?.click()}>
              {Icon.file}<span><b>Files from this phone</b><small>PDF · EPUB · Word · Text · Markdown · Video</small></span>
            </button>
            <form className="fr-sheet-link" onSubmit={(e) => { e.preventDefault(); addLink(); }}>
              <label htmlFor="yt">{Icon.yt}<span><b>YouTube link</b><small>Paste a video's link to keep time notes on it</small></span></label>
              <div className="fr-link-row">
                <input id="yt" type="url" inputMode="url" placeholder="https://youtu.be/…" value={link} onChange={(e) => setLink(e.target.value)} />
                <button type="submit" className="fr-add" disabled={!link.trim()}>Add</button>
              </div>
            </form>
          </Sheet>
        )}
        {sheet?.menu && (
          <Sheet key="menu" title={sheet.menu.title} onClose={() => setSheet(null)}>
            <div className="fr-menu">
              <button type="button" onClick={() => { const it = sheet.menu; setSheet(null); openItem(it); }}>Open</button>
              <button type="button" onClick={() => exportSummary(sheet.menu)}>Marks summary PDF<small>{countsOf(sheet.menu) || 'Nothing marked yet'}</small></button>
              <button type="button" onClick={() => setSheet({ rename: sheet.menu })}>Rename</button>
              <button type="button" className="danger" onClick={() => setSheet({ remove: [sheet.menu] })}>Remove from library</button>
            </div>
          </Sheet>
        )}
        {sheet?.rename && (
          <Sheet key="rename" title="Rename" onClose={() => setSheet(null)}>
            <form className="fr-rename" onSubmit={(e) => { e.preventDefault(); const v = e.currentTarget.elements.t.value.trim(); if (v) update(sheet.rename.id, { title: v }); setSheet(null); }}>
              <input name="t" defaultValue={sheet.rename.title} autoFocus aria-label="New name" />
              <button type="submit" className="fr-add">Save</button>
            </form>
          </Sheet>
        )}
        {sheet?.remove && (
          <Sheet key="remove" title={sheet.remove.length === 1 ? 'Remove from library?' : `Remove ${sheet.remove.length} files?`} onClose={() => setSheet(null)}>
            <p className="fr-sheet-text">
              {sheet.remove.length === 1 ? `“${sheet.remove[0].title}”` : sheet.remove.map((it) => it.title).slice(0, 4).join(', ') + (sheet.remove.length > 4 ? ` and ${sheet.remove.length - 4} more` : '')}
              {' '}and {sheet.remove.length === 1 ? 'its' : 'their'} marks, comments and notes will be removed from Flow Reader. The original files on your phone stay where they are.
            </p>
            <div className="fr-menu">
              <button type="button" className="danger" onClick={() => remove(sheet.remove)}>Remove</button>
              <button type="button" onClick={() => setSheet(null)}>Keep {sheet.remove.length === 1 ? 'it' : 'them'}</button>
            </div>
          </Sheet>
        )}
        {sheet === 'more' && (
          <Sheet key="more" title="Flow Reader" onClose={() => setSheet(null)}>
            <div className="fr-menu">
              {items.length > 0 && <button type="button" onClick={() => { setSheet(null); setPicked([]); }}>Select files<small>Pick several to remove them together</small></button>}
              <button type="button" className="fr-switch-row" role="switch" aria-checked={!!demoOn} onClick={() => (demoOn ? stopDemo() : startDemo())}>
                <span>Demo files<small>{demoOn ? 'On · sample files with marks, comments and notes (tagged DEMO)' : 'Off · turn on to see every feature in use'}</small></span>
                <i className={`fr-switch${demoOn ? ' on' : ''}`} />
              </button>
              <button type="button" className="fr-switch-row" role="switch" aria-checked={light} onClick={() => changeSettings({ theme: light ? 'dark' : 'light' })}>
                <span>Light mode<small>{light ? 'On' : 'Off · dark mode'}</small></span>
                <i className={`fr-switch${light ? ' on' : ''}`} />
              </button>
            </div>
            <p className="fr-sheet-foot">Everything stays on this phone. Dictionary: WordNet · Olam · Wiktionary.</p>
          </Sheet>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {current?.type === 'pdf' && (
          <PdfReader
            key={current.id}
            card={{ ...current, name: current.title }}
            from={open.from}
            at={open.at}
            atPage={open.atPage}
            atText={open.atText}
            onPage={(page) => update(current.id, { page })}
            onMarks={(marks) => update(current.id, { marks })}
            onExport={exportOpen}
            onClose={(page) => close({ page })}
          />
        )}
        {current?.type === 'doc' && (
          <DocReader
            key={current.id}
            card={current}
            from={open.from}
            at={open.at}
            atSection={open.atSection}
            atText={open.atText}
            reading={settings.reading}
            onReading={(patch) => changeSettings({ reading: { ...settings.reading, ...patch } })}
            onProgress={({ pos, progress }) => update(current.id, { pos, progress })}
            onMarks={(marks) => update(current.id, { marks })}
            onExport={exportOpen}
            onOpenLink={(href) => window.open(href, '_blank', 'noopener')}
            onClose={(p) => close(p)}
          />
        )}
        {(current?.type === 'video' || current?.type === 'youtube') && (
          <MediaViewer
            key={current.id}
            card={current}
            from={open.from}
            at={typeof open.at === 'number' ? open.at : undefined}
            onNotes={(tnotes) => update(current.id, { tnotes })}
            onPos={({ pos }) => update(current.id, { pos })}
            onExport={exportOpen}
            onOpenLink={(href) => window.open(href, '_blank', 'noopener')}
            onClose={(p) => close(p?.pos != null ? { pos: p.pos, ...(p.duration ? { duration: p.duration } : {}) } : null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {busy && <motion.div key="busy" className="fr-toast-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={quick}><div className="fr-toast"><span className="fr-spin" /> Adding {busy.length > 34 ? `${busy.slice(0, 33)}…` : busy}</div></motion.div>}
        {!busy && toast && <Toast key={toast.at} toast={toast} onGone={toastGone} />}
      </AnimatePresence>
    </div>
  );
}
