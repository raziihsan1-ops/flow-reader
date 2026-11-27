import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CloseIcon } from '../../components/Icons.jsx';
import { quick } from '../../lib/motion.js';
import { byPart, lookUp } from '../../lib/dictionary.js';

// Define: a word's meaning in English, Malayalam and Arabic (offline).

export function useLookUp(word) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let alive = true;
    setRes(null);
    if (word) lookUp(word).then((r) => alive && setRes(r));
    return () => { alive = false; };
  }, [word]);
  return res;
}

const LANG_NAME = { en: 'English', ml: 'Malayalam', ar: 'Arabic' };
export const found = (res) => !!res && (res.en.length > 0 || res.ml.length > 0 || res.ar.length > 0 || res.mlWords?.length > 0);

export function Meanings({ res, limit = 99 }) {
  if (!res) return <p className="dict-empty">Looking it up…</p>;
  if (!found(res)) return <p className="dict-empty">“{res.asked}” isn’t in the dictionary.</p>;
  let shown = 0;
  const english = res.en.length > 0 && (
    <section className="dict-sec" key="en">
      <span className="eyebrow">English</span>
      {res.mlWords?.length > 0 && <p className="dict-words">{res.mlWords.slice(0, limit === 99 ? 10 : 5).join(' · ')}</p>}
      {byPart(res.en).map((g) => {
        if (shown >= limit) return null;
        const items = g.items.slice(0, Math.max(1, limit - shown));
        shown += items.length;
        return (
          <div key={g.pos} className="dict-group">
            <span className="dict-pos">{g.pos}</span>
            <ol>
              {items.map(([, def, syn, canon, from], i) => (
                <li key={i}>
                  {canon && canon !== res.word && <span className="dict-canon" lang="ar" dir="rtl">{canon}</span>}
                  {from && <b className="dict-from-word">{from}: </b>}
                  {def}{syn?.length > 0 && <span className="dict-syn"> · {syn.slice(0, 4).join(', ')}</span>}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
  const englishWordsOnly = !res.en.length && res.mlWords?.length > 0 && (
    <section className="dict-sec" key="en">
      <span className="eyebrow">English</span>
      <p className="dict-words">{res.mlWords.join(' · ')}</p>
    </section>
  );
  const malayalam = res.ml.length > 0 && (
    <section className="dict-sec" key="ml">
      <span className="eyebrow">Malayalam</span>
      {byPart(res.ml).sort((x, y) => { const parts = res.en.map((m) => m[0]); const ix = parts.indexOf(x.pos); const iy = parts.indexOf(y.pos); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy); }).map((g) => (
        <div key={g.pos} className="dict-group">
          {g.pos !== 'other' && <span className="dict-pos">{g.pos}</span>}
          <p className="dict-ml" lang="ml">{g.items.map((x) => x[1]).join(' · ')}</p>
        </div>
      ))}
    </section>
  );
  const arabic = res.ar.length > 0 && (
    <section className="dict-sec" key="ar">
      <span className="eyebrow">Arabic</span>
      <ul className="dict-ar">
        {res.ar.slice(0, limit === 99 ? 6 : 3).map(([w, pos, gloss]) => (
          <li key={w}>
            <span className="dict-ar-word" lang="ar" dir="rtl">{w}</span>
            <span className="dict-ar-about"><i>{pos}</i>{gloss ? ` · ${gloss}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  );
  // The word's own language is understood; the others follow.
  const order = res.lang === 'ml' ? [english || englishWordsOnly, arabic] : res.lang === 'ar' ? [english, malayalam] : [english, malayalam, arabic];
  return <div className="dict-meanings">{order}</div>;
}

export function DictHead({ res, word, big }) {
  const lang = res?.lang || 'en';
  return (
    <div className="dict-head">
      <span className={`dict-word${big ? ' big' : ''}${lang !== 'en' ? ` ${lang}` : ''}`} lang={lang} dir={lang === 'ar' ? 'rtl' : undefined}>{res?.word || word}</span>
      {res && res.word !== res.asked && res.word.toLowerCase() !== res.asked.toLowerCase() && <span className="dict-from">from “{res.asked}”</span>}
      <span className="dict-lang">{LANG_NAME[lang]}</span>
    </div>
  );
}

// The box over a word you selected while reading (a card at the bottom on a phone).
export function DictPop({ word, pos, onClose }) {
  const res = useLookUp(word);
  const ref = useRef(null);
  const [place, setPlace] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth; const h = el.offsetHeight;
    let x = pos.x - w / 2; let y = pos.y2 + 10;
    if (y + h > window.innerHeight - 16) y = Math.max(16, pos.y - h - 10);
    x = Math.max(16, Math.min(window.innerWidth - w - 16, x));
    setPlace({ x, y });
  }, [pos, res]);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    const away = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('.mark-tools')) onClose(); };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', away, true); };
  }, [onClose]);
  return createPortal(
    <motion.div
      ref={ref}
      className="dict-pop"
      role="dialog"
      aria-label={`Meaning of ${word}`}
      style={{ left: place?.x ?? -9999, top: place?.y ?? -9999 }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={quick}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div className="dict-top">
        <DictHead res={res} word={word} />
        <button type="button" className="icon-btn small" aria-label="Close" onClick={onClose}><CloseIcon /></button>
      </div>
      <div className="dict-scroll"><Meanings res={res} /></div>
      <p className="dict-credit">Offline · WordNet · Olam · Wiktionary</p>
    </motion.div>,
    document.body,
  );
}
