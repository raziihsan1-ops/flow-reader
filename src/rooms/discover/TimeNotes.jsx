import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, CloseIcon, ToLabIcon, TrashIcon } from '../../components/Icons.jsx';
import { formatTime } from '../../lib/media.js';
import { lab } from '../../lib/space.js';
import { quick, soft } from '../../lib/motion.js';

// Time notes: a note pinned to a second of a video or sound. Saved on the card as
//   tnotes: [{ id, t (seconds), text, createdAt }]

export const sortNotes = (notes) => [...notes].sort((a, b) => a.t - b.t);

// The note you're "in" right now: the last one at or before the playhead (within a minute).
export function currentNote(notes, now) {
  let hit = null;
  for (const n of sortNotes(notes)) { if (n.t <= now + 0.25) hit = n; else break; }
  return hit && now - hit.t < 60 ? hit : null;
}

// A box you write in. Enter saves, Shift+Enter is a new line, Esc cancels.
function NoteInput({ initial = '', placeholder, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const ref = useRef(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useLayoutEffect(() => { // grow with the text
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [text]);
  const finish = (save) => {
    if (done.current) return;
    done.current = true;
    if (save) onSave(text.trim()); else onCancel();
  };
  return (
    <textarea
      ref={ref}
      className="tn-input"
      rows={1}
      value={text}
      placeholder={placeholder}
      aria-label="Time note"
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
      }}
      onBlur={() => finish(true)}
    />
  );
}

export function TimeNotesPanel({ notes, draft, now, focusId, quoted, onJump, onSaveDraft, onCancelDraft, onEdit, onDelete, onToLab, onExport, onClose }) {
  const [editId, setEditId] = useState(null);
  const list = sortNotes(notes);
  const live = currentNote(notes, now);
  const listRef = useRef(null);

  // Keep the note being written (or the one you came for) in view.
  useEffect(() => {
    const id = draft ? 'draft' : focusId;
    if (!id) return;
    listRef.current?.querySelector(`[data-tn="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [draft, focusId]);

  const rows = [...list.map((n) => ({ n })), ...(draft ? [{ draft }] : [])].sort((a, b) => (a.n?.t ?? a.draft.t) - (b.n?.t ?? b.draft.t));

  return (
    <motion.aside
      className="marks-panel tn-panel"
      aria-label="Time notes"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 300, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={soft}
    >
      <div className="marks-panel-in">
        <div className="marks-head">
          <span>Time notes · {notes.length}</span>
          {onExport && notes.length > 0 && <button type="button" className="marks-export" onClick={onExport}>Export PDF</button>}
          <button type="button" className="icon-btn small" aria-label="Hide time notes" title="Hide (M)" onClick={onClose}><CloseIcon /></button>
        </div>
        {rows.length === 0 ? (
          <p className="marks-empty">Tap <b>Note</b> while it plays to write something at that second. It pauses while you write.</p>
        ) : (
          <ul className="marks-list tn-list" ref={listRef}>
            {rows.map(({ n, draft: d }) => (d ? (
              <motion.li key="draft" data-tn="draft" className="tn-item writing" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={quick}>
                <span className="tn-time static">{formatTime(d.t)}</span>
                <NoteInput placeholder="What's happening here?" onSave={onSaveDraft} onCancel={onCancelDraft} />
                <span className="tn-hint">Enter to save · Esc to cancel</span>
              </motion.li>
            ) : (
              <li key={n.id} data-tn={n.id} className={`tn-item${live?.id === n.id ? ' now' : ''}${focusId === n.id ? ' came' : ''}`}>
                <button type="button" className="tn-time" title="Play from here" onClick={() => onJump(n)}>{formatTime(n.t)}</button>
                {editId === n.id ? (
                  <NoteInput
                    initial={n.text}
                    onSave={(text) => { setEditId(null); if (text) onEdit(n.id, text); else onDelete(n); }}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <button type="button" className="tn-text" title="Click to edit" onClick={() => setEditId(n.id)}>{n.text}</button>
                )}
                <span className="tn-actions">
                  {onToLab && <button
                    type="button"
                    className={`marks-to-lab static${quoted?.has(n.id) ? ' done' : ''}`}
                    aria-label={quoted?.has(n.id) ? `On the ${lab()}` : `Put on the ${lab()}`}
                    title={quoted?.has(n.id) ? `On the ${lab()} — click to see it there` : `Put on the ${lab()} as a card that opens here`}
                    onClick={() => onToLab(n)}
                  >
                    {quoted?.has(n.id) ? <CheckIcon size={12} /> : <ToLabIcon size={13} />}
                  </button>}
                  <button type="button" className="marks-to-lab static" aria-label="Remove note" title="Remove" onClick={() => onDelete(n)}><TrashIcon size={13} /></button>
                </span>
              </li>
            )))}
          </ul>
        )}
      </div>
    </motion.aside>
  );
}

// A slim timeline under the video: where the notes are, and where you are. Click a dot to go there.
export function NoteStrip({ notes, now, duration, draft, onJump }) {
  if (!duration || (!notes.length && !draft)) return null;
  const at = (t) => `${Math.max(0, Math.min(100, (t / duration) * 100))}%`;
  return (
    <div className="tn-strip" aria-label="Time notes on the timeline">
      <div className="tn-track">
        <span className="tn-played" style={{ width: at(now) }} />
        {sortNotes(notes).map((n) => (
          <button
            key={n.id}
            type="button"
            className="tn-dot"
            style={{ left: at(n.t) }}
            aria-label={`${formatTime(n.t)} ${n.text}`}
            onClick={() => onJump(n)}
          >
            <span className="tn-tip"><b>{formatTime(n.t)}</b>{n.text}</span>
          </button>
        ))}
        {draft && <span className="tn-dot draft" style={{ left: at(draft.t) }} />}
      </div>
    </div>
  );
}

// "Note removed · Undo", for a few seconds.
export function NoteUndo({ removed, onUndo }) {
  return (
    <AnimatePresence>
      {removed && (
        <motion.div className="toast toast-action tn-undo" role="status" initial={{ opacity: 0, y: 10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }} transition={quick}>
          Time note removed
          <button type="button" onClick={onUndo}>Undo</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
