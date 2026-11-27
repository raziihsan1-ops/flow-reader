// Find some words inside an element, select them (so they stand out, ready to highlight) and scroll them into view.
export function selectWords(root, q, scroller) {
  if (!root || !q) return false;
  const want = q.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.data.toLowerCase().indexOf(want);
    if (i < 0) continue;
    const range = document.createRange();
    range.setStart(n, i);
    range.setEnd(n, i + want.length);
    const box = range.getBoundingClientRect();
    if (!box.width && !box.height) continue;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (scroller) {
      const s = scroller.getBoundingClientRect();
      scroller.scrollTop += box.top - s.top - scroller.clientHeight * 0.35;
    }
    return true;
  }
  return false;
}
