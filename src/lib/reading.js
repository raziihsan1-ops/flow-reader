// Reading look, like a book app: text size, font and line spacing.
// One setting for all of Flow, changed from the Aa menu or Settings → Reading.
export const READING_DEFAULT = { size: 19, font: 'serif', spacing: 'normal' };
export const SIZE_MIN = 14;
export const SIZE_MAX = 32;

export const FONTS = [
  { id: 'serif', name: 'Serif', css: "'IBM Plex Serif', 'Amiri', Georgia, serif" },
  { id: 'sans', name: 'Sans', css: "'IBM Plex Sans', 'Amiri', system-ui, sans-serif" },
  { id: 'mono', name: 'Mono', css: "'IBM Plex Mono', 'Amiri', ui-monospace, monospace" },
];
export const SPACINGS = [
  { id: 'compact', name: 'Compact', value: 1.45 },
  { id: 'normal', name: 'Normal', value: 1.7 },
  { id: 'relaxed', name: 'Relaxed', value: 2 },
];

// Shared as CSS variables on the page, so every reading surface follows them.
export function applyReading(reading = READING_DEFAULT) {
  const r = { ...READING_DEFAULT, ...reading };
  const root = document.documentElement.style;
  root.setProperty('--read-size', `${r.size}px`);
  root.setProperty('--read-font', (FONTS.find((f) => f.id === r.font) || FONTS[0]).css);
  root.setProperty('--read-leading', String((SPACINGS.find((s) => s.id === r.spacing) || SPACINGS[1]).value));
}
