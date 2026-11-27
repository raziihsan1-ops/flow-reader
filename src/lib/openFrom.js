import { ease } from './motion.js';

// A full-screen view that grows out of the card it came from, and shrinks back into it.
// `from` is the card's box on screen when it was opened (or null to simply fade).
const insetOf = (r) => `inset(${r.top}px ${window.innerWidth - r.right}px ${window.innerHeight - r.bottom}px ${r.left}px round 10px)`;
const FULL = 'inset(0px 0px 0px 0px round 0px)';

export function openFrom(from) {
  if (!from) {
    return { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.99 }, transition: { duration: 0.4, ease } };
  }
  return {
    initial: { clipPath: insetOf(from), opacity: 0.4 },
    animate: { clipPath: FULL, opacity: 1 },
    exit: { clipPath: insetOf(from), opacity: 0, transition: { duration: 0.38, ease, opacity: { duration: 0.38, ease: [0.6, 0, 0.8, 0.4] } } },
    transition: { duration: 0.5, ease, opacity: { duration: 0.22 } },
  };
}

export function cardBox(id) {
  const el = document.querySelector(`[data-card="${id}"]`);
  const r = el?.getBoundingClientRect();
  if (!r || r.width < 4) return null;
  return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
}
