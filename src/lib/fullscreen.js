import { Capacitor } from '@capacitor/core';

// Full screen for reading, with nothing else on screen.
// - Android app: the phone's status bar (time, battery) is hidden too.
// - Browsers that allow it (Android Chrome, iPad Safari, computers): the browser's own bars go away.
// - iPhone: Apple doesn't let websites go truly full screen; added to the Home Screen it already has no
//   Safari bars, and the reader's own bar hides.
const native = () => Capacitor.isNativePlatform();
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement;

export async function enterFull() {
  if (native()) {
    try { const { StatusBar } = await import('@capacitor/status-bar'); await StatusBar.hide(); } catch { /* fine */ }
    return;
  }
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* not allowed here (iPhone): the reader still hides its own bar */ }
}

export async function exitFull() {
  if (native()) {
    try { const { StatusBar } = await import('@capacitor/status-bar'); await StatusBar.show(); } catch { /* fine */ }
    return;
  }
  try {
    if (!fsElement()) return;
    if (document.exitFullscreen) await document.exitFullscreen();
    else document.webkitExitFullscreen?.();
  } catch { /* already out */ }
}
