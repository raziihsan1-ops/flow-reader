import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReadingControls from './ReadingControls.jsx';
import { quick } from '../lib/motion.js';

// The Aa button and its menu: text size, font and line spacing (shared by notes and books).
export default function AaMenu({ reading, onReading, open, onOpenChange }) {
  const [own, setOwn] = useState(false);
  const isOpen = open ?? own;
  const setOpen = onOpenChange ?? setOwn;
  const wrap = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [isOpen, setOpen]);

  return (
    <div className="aa-wrap" ref={wrap}>
      <button
        type="button"
        className={`btn aa-btn${isOpen ? ' on' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Text size and font"
        onClick={() => setOpen(!isOpen)}
      >
        <span className="aa-glyph"><span>A</span><span>a</span></span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="aa-menu"
            role="dialog"
            aria-label="Text size and font"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={quick}
          >
            <ReadingControls reading={reading} onChange={onReading} />
            <p className="aa-foot">Used for every book and document.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
