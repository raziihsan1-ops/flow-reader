import { createStore, del, get, set } from 'idb-keyval';

// Everything Flow Reader keeps lives on this phone, in the browser's own database (IndexedDB):
//  - files:   each added PDF, book, document or video, as it was
//  - library: the list of items with their place, marks and time notes
//  - text:    the words of every page or chapter, so search can look inside files
// Nothing is sent anywhere.
const files = createStore('flow-reader-files', 'files');
const meta = createStore('flow-reader-meta', 'meta');
const words = createStore('flow-reader-text', 'text');

export const putFile = (id, blob) => set(id, blob, files);
export const getFile = (id) => get(id, files);
export const removeFile = (id) => Promise.all([del(id, files), del(id, words)]);

// The readers ask for a file by name and expect an address they can load (like Flow's local files).
// A file is turned into an address once, when it is opened.
const urls = new Map();
export async function prepareFile(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getFile(id);
  if (!blob) throw new Error('missing');
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}
export const urlOf = (id) => urls.get(id) || '';
export function forgetUrl(id) {
  const u = urls.get(id);
  if (u) URL.revokeObjectURL(u);
  urls.delete(id);
}

export const loadLibrary = async () => (await get('library', meta)) || [];
let saving = Promise.resolve();
export const saveLibrary = (items) => { saving = saving.then(() => set('library', items, meta)); return saving; };

export const loadSettings = async () => (await get('settings', meta)) || {};
export const saveSettings = (s) => set('settings', s, meta);

// Searchable words: [{ at: page number (PDF) or chapter index (books), text }]
export const putText = (id, list) => set(id, list, words);
export const getText = (id) => get(id, words);

// Ask the phone to keep this data even when space runs low (it may say no; that's fine).
export const keepSafe = () => navigator.storage?.persist?.().catch(() => false);
