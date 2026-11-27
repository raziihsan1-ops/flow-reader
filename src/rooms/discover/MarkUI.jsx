import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, CloseIcon, CommentIcon, DictIcon, ToLabIcon, TrashIcon, UnderlineIcon } from '../../components/Icons.jsx';
import { ago } from '../../lib/data.js';
import { quick, soft } from '../../lib/motion.js';
import { lab } from '../../lib/space.js';
import { COLORS, KIND_NAMES, colorOf, rememberColor } from './marks.js';

// Highlight / underline / comment tools, shared by the PDF reader and the book & document reader.
const PANEL = 300;

// The little bar that appears over selected text.
export function SelectionTools({ pos, color, onPick, onDefine }) {
  return (
    <motion.div
      className="mark-tools"
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, y: 4, x: '-50%' }}
      animate={{ opacity: 1, y: 0, x: '-50%' }}
      exit={{ opacity: 0, y: 4, x: '-50%' }}
      transition={quick}
      onMouseDown={(e) => e.preventDefault()} // keep the text selected while clicking here
    >
      {COLORS.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`mark-dot${c.id === color ? ' on' : ''}`}
          style={{ '--wash': c.wash, '--ink': c.ink }}
          title={`Highlight ${c.name.toLowerCase()}${c.id === color ? ' (H)' : ''}`}
          aria-label={`Highlight ${c.name.toLowerCase()}`}
          onClick={() => onPick('highlight', c.id)}
        />
      ))}
      <span className="hud-sep" />
      <button type="button" className="mark-tool" title="Underline (U)" onClick={() => onPick('underline', color)}><UnderlineIcon /> Underline</button>
      <button type="button" className="mark-tool" title="Comment (C)" onClick={() => onPick('comment', color)}><CommentIcon /> Comment</button>
      {onDefine && (
        <>
          <span className="hud-sep" />
          <button type="button" className="mark-tool" title="Meaning of this word (D)" onClick={onDefine}><DictIcon /> Define</button>
        </>
      )}
    </motion.div>
  );
}

// Click a mark to change its colour or style, write a comment on it, or remove it.
export function MarkPopover({ mark, pos, where, focusNote, onLab, onToLab, onChange, onDelete }) {
  const noteRef = useRef(null);
  useEffect(() => {
    if (focusNote) noteRef.current?.focus();
  }, [focusNote, mark.id]);
  return (
    <motion.div
      className="mark-pop"
      role="dialog"
      aria-label={`${KIND_NAMES[mark.kind]}, ${where}`}
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, y: -4, x: '-50%', scale: 0.98 }}
      animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
      exit={{ opacity: 0, y: -4, x: '-50%', scale: 0.98 }}
      transition={quick}
    >
      <div className="mark-pop-top">
        <div className="seg" role="group" aria-label="Style">
          {['highlight', 'underline', 'comment'].map((k) => (
            <button key={k} type="button" className={mark.kind === k ? 'on' : ''} aria-pressed={mark.kind === k} onClick={() => onChange({ kind: k })}>
              {KIND_NAMES[k]}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {onToLab && (
          <button
            type="button"
            className={`to-lab${onLab ? ' done' : ''}`}
            title={onLab ? `Already on the ${lab()} — click to see it there` : `Put on the ${lab()} as a quote card that remembers where it came from (L)`}
            onClick={() => onToLab(mark)}
          >
            {onLab ? <><CheckIcon size={13} /> On {lab()}</> : <><ToLabIcon size={14} /> Put on {lab()}</>}
          </button>
        )}
        <button type="button" className="icon-btn small" aria-label="Remove mark" title="Remove (⌫)" onClick={onDelete}><TrashIcon /></button>
      </div>
      <div className="mark-pop-colors" role="group" aria-label="Colour">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`mark-dot${c.id === mark.color ? ' on' : ''}`}
            style={{ '--wash': c.wash, '--ink': c.ink }}
            aria-label={c.name}
            aria-pressed={c.id === mark.color}
            onClick={() => { rememberColor(c.id); onChange({ color: c.id }); }}
          />
        ))}
        <span className="mark-pop-meta">{where} · {ago(mark.createdAt)}</span>
      </div>
      <blockquote className="mark-quote">{mark.text}</blockquote>
      <textarea
        ref={noteRef}
        className="mark-note"
        rows={3}
        placeholder="Add a comment…"
        aria-label="Comment"
        value={mark.note || ''}
        onChange={(e) => onChange({ note: e.target.value })}
      />
    </motion.div>
  );
}

export function MarksPanel({ marks, pinNumbers, whereOf, title = 'On this PDF', quoted, onToLab, onJump, onDelete, onExport, onClose }) {
  // Picking marks to delete: ⌘-click one to add it, ⇧-click for a range, or press on a mark and drag up or down
  // across the list to pick every mark you pass. ⌫ (or the bar) deletes them; ⌘Z-style Undo appears after.
  const [picked, setPicked] = useState([]);
  const anchor = useRef(null);
  const list = useRef(null);
  const ids = marks.map((m) => m.id);
  const key = ids.join('|');
  useEffect(() => { setPicked((p) => p.filter((id) => ids.includes(id))); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = (a, b) => { const i = ids.indexOf(a); const j = ids.indexOf(b); return i < 0 || j < 0 ? [b] : ids.slice(Math.min(i, j), Math.max(i, j) + 1); };
  const del = (which) => { if (!which.length || !onDelete) return; onDelete(which); setPicked([]); };
  useEffect(() => {
    if (!picked.length) return undefined;
    const key2 = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); del(picked); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPicked([]); }
    };
    window.addEventListener('keydown', key2, true);
    return () => window.removeEventListener('keydown', key2, true);
  }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  const touchPick = (m, e) => { // a finger: press and hold to pick; while picking, a tap adds or removes
    const sx = e.clientX; const sy = e.clientY; let held = false; let moved = false;
    const timer = setTimeout(() => { held = true; navigator.vibrate?.(15); setPicked((p) => (p.includes(m.id) ? p : [...p, m.id])); }, 450);
    const move = (ev) => { if (Math.abs(ev.clientY - sy) + Math.abs(ev.clientX - sx) > 10) { moved = true; clearTimeout(timer); } };
    const done = (ev) => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); window.removeEventListener('pointercancel', done);
      if (held || moved || ev.type === 'pointercancel') return;
      if (picked.length) setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id]));
      else onJump(m);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', done); window.addEventListener('pointercancel', done);
  };
  const onDown = (m, e) => {
    if (e.button !== 0 || e.target.closest('.marks-to-lab, .marks-x')) return;
    if (e.pointerType !== 'mouse') { touchPick(m, e); return; }
    const sx = e.clientX; const sy = e.clientY; let swept = false;
    const base = e.metaKey || e.shiftKey ? picked : [];
    const move = (ev) => {
      if (!swept && Math.abs(ev.clientY - sy) + Math.abs(ev.clientX - sx) < 6) return;
      swept = true;
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-mark]')?.dataset.mark;
      if (under) setPicked([...new Set([...base, ...range(m.id, under)])]);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      if (swept) { anchor.current = m.id; return; }
      if (ev.metaKey) { anchor.current = m.id; setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : [...p, m.id])); return; }
      if (ev.shiftKey && anchor.current) { setPicked([...new Set([...picked, ...range(anchor.current, m.id)])]); return; }
      setPicked([]); anchor.current = m.id; onJump(m);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  return (
    <motion.aside
      className="marks-panel"
      aria-label={title}
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: PANEL, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={soft}
    >
      <div className="marks-panel-in">
        <div className="marks-head">
          <span>{title} · {marks.length}</span>
          {onExport && marks.length > 0 && <button type="button" className="marks-export" onClick={onExport}>Export PDF</button>}
          <button type="button" className="icon-btn small" aria-label="Hide marks" title="Hide (M)" onClick={onClose}><CloseIcon /></button>
        </div>
        {marks.length === 0 ? (
          <p className="marks-empty">Select words on a page, then highlight, underline or comment.</p>
        ) : (
          <ul className={`marks-list${picked.length ? ' picking' : ''}`} ref={list}>
            {marks.map((m) => {
              const c = colorOf(m.color);
              const on = picked.includes(m.id);
              return (
                <li key={m.id} className={`marks-li${on ? ' picked' : ''}`} data-mark={m.id}>
                  <button type="button" className="marks-item" style={{ '--wash': c.wash, '--ink': c.ink }} onPointerDown={(e) => onDown(m, e)} onClick={(e) => { if (e.detail === 0) onJump(m); }} aria-pressed={on || undefined}>
                    <span className="marks-item-meta">
                      {whereOf(m)} · {KIND_NAMES[m.kind]}
                      {pinNumbers.has(m.id) && <i className="marks-num">{pinNumbers.get(m.id)}</i>}
                    </span>
                    <span className={`marks-item-quote k-${m.kind}`}>{m.text}</span>
                    {m.note?.trim() && <span className="marks-item-note">{m.note}</span>}
                  </button>
                  {onDelete && (
                    <button type="button" className="marks-x" aria-label={`Delete this ${KIND_NAMES[m.kind].toLowerCase()}`} title="Delete" onClick={() => del(on ? picked : [m.id])}>×</button>
                  )}
                  {onToLab && (
                    <button
                      type="button"
                      className={`marks-to-lab${quoted?.has(m.id) ? ' done' : ''}`}
                      aria-label={quoted?.has(m.id) ? `On the ${lab()}` : `Put on the ${lab()}`}
                      title={quoted?.has(m.id) ? `On the ${lab()}` : `Put on the ${lab()}`}
                      onClick={() => onToLab(m)}
                    >
                      {quoted?.has(m.id) ? <CheckIcon size={12} /> : <ToLabIcon size={13} />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <AnimatePresence>
          {picked.length > 0 && (
            <motion.div className="marks-pick-bar" role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={soft}>
              <b>{picked.length} selected</b>
              <button type="button" className="danger" onClick={() => del(picked)}>Delete</button>
              {picked.length < marks.length && <button type="button" onClick={() => setPicked(ids)}>All</button>}
              <button type="button" onClick={() => setPicked([])}>Clear</button>
            </motion.div>
          )}
        </AnimatePresence>
        {marks.length > 0 && !picked.length && <p className="marks-tip">{window.matchMedia?.('(pointer: coarse)').matches ? 'Press and hold a mark to pick several' : '⌘-click or drag across marks to pick several'}</p>}
      </div>
    </motion.aside>
  );
}

