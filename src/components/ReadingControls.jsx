import { FONTS, READING_DEFAULT, SIZE_MAX, SIZE_MIN, SPACINGS } from '../lib/reading.js';

// Text size, font and line spacing. Used in the Aa menu and in Settings → Reading.
export default function ReadingControls({ reading, onChange }) {
  const r = { ...READING_DEFAULT, ...reading };
  const size = (d) => onChange({ size: Math.max(SIZE_MIN, Math.min(SIZE_MAX, r.size + d)) });
  return (
    <div className="reading-controls">
      <div className="rc-row">
        <span className="rc-label">Text size</span>
        <div className="rc-size" role="group" aria-label="Text size">
          <button type="button" aria-label="Smaller text" title="Smaller (⌘−)" disabled={r.size <= SIZE_MIN} onClick={() => size(-1)}>
            <span style={{ fontSize: 13 }}>A</span>
          </button>
          <span className="rc-value" aria-live="polite">{r.size}</span>
          <button type="button" aria-label="Bigger text" title="Bigger (⌘+)" disabled={r.size >= SIZE_MAX} onClick={() => size(1)}>
            <span style={{ fontSize: 19 }}>A</span>
          </button>
        </div>
      </div>
      <div className="rc-row">
        <span className="rc-label">Font</span>
        <div className="seg" role="group" aria-label="Font">
          {FONTS.map((f) => (
            <button key={f.id} type="button" className={r.font === f.id ? 'on' : ''} aria-pressed={r.font === f.id} style={{ fontFamily: f.css }} onClick={() => onChange({ font: f.id })}>
              {f.name}
            </button>
          ))}
        </div>
      </div>
      <div className="rc-row">
        <span className="rc-label">Line spacing</span>
        <div className="seg" role="group" aria-label="Line spacing">
          {SPACINGS.map((s) => (
            <button key={s.id} type="button" className={r.spacing === s.id ? 'on' : ''} aria-pressed={r.spacing === s.id} onClick={() => onChange({ spacing: s.id })}>
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
