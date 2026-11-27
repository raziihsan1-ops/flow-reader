import { useEffect, useRef } from 'react';

// On a phone you choose words by pressing on them and dragging the little handles. There's no
// "mouse up" at the end, so: when a finger started the selection, wait until it stops changing,
// then show the highlight / underline / comment tools.
export const touchUI = () => window.matchMedia?.('(pointer: coarse)').matches;

export function useTouchSelection(scroller, onDone) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let byFinger = false;
    let t = 0;
    const down = (e) => { if (scroller.current?.contains(e.target)) byFinger = e.pointerType !== 'mouse'; };
    const onSel = () => {
      clearTimeout(t);
      if (!byFinger) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !scroller.current?.contains(sel.anchorNode)) return;
      t = setTimeout(() => done.current(), 420);
    };
    window.addEventListener('pointerdown', down, true);
    document.addEventListener('selectionchange', onSel);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', down, true); document.removeEventListener('selectionchange', onSel); };
  }, [scroller]);
}
