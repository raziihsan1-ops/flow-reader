import { fileUrl } from './pdf.js';

// Pictures, sound and video: which kind a stored file is, YouTube links, waveforms and times.

const KIND_BY_EXT = {
  jpg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image', bmp: 'image', svg: 'image',
  mp3: 'audio', m4a: 'audio', aac: 'audio', wav: 'audio', ogg: 'audio', opus: 'audio', flac: 'audio',
  mp4: 'video', m4v: 'video', mov: 'video', webm: 'video',
};
export const mediaKindOf = (file) => KIND_BY_EXT[(file.split('.').pop() || '').toLowerCase()] || null;
export const MEDIA_LABEL = { image: 'IMAGE', audio: 'AUDIO', video: 'VIDEO', youtube: 'YOUTUBE' };

export function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// Any normal YouTube link → its video id (and start time, if the link has one).
export function parseYouTube(text) {
  let url;
  try { url = new URL(String(text).trim()); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      if (m) [, id] = m;
    }
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
  const tm = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  const start = tm ? (Number(tm[1] || 0) * 3600 + Number(tm[2] || 0) * 60 + Number(tm[3] || 0)) : 0;
  return { id, start };
}
export const youTubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youTubeWatch = (id, t = 0) => `https://www.youtube.com/watch?v=${id}${t > 1 ? `&t=${Math.floor(t)}s` : ''}`;

// The video's title and channel, from YouTube's public "oEmbed" service (no account, no key).
export async function youTubeInfo(id) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youTubeWatch(id))}`);
    if (!res.ok) return null;
    const j = await res.json();
    return { title: j.title || '', channel: j.author_name || '' };
  } catch {
    return null;
  }
}

// A waveform: how loud each slice of a sound file is (0–1), worked out once and saved on the card.
// Very long files (over ~80 MB) are skipped; their card shows a plain line instead.
export async function audioPeaks(file, count = 140) {
  const res = await fetch(fileUrl(file));
  const size = Number(res.headers.get('content-length') || 0);
  if (size > 80 * 1024 * 1024) return { peaks: null, duration: null };
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await res.arrayBuffer());
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / count));
    const peaks = [];
    for (let i = 0; i < count; i += 1) {
      let max = 0;
      for (let j = i * step, end = Math.min(data.length, j + step); j < end; j += 16) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.001);
    return { peaks: peaks.map((p) => Math.round((p / top) * 100) / 100), duration: audio.duration };
  } finally {
    ctx.close();
  }
}

// Only one sound plays at a time: starting one pauses the others.
export function claimAudio(el) {
  window.dispatchEvent(new CustomEvent('flow-audio', { detail: el }));
}
export function onOtherAudio(el, pause) {
  const fn = (e) => { if (e.detail !== el) pause(); };
  window.addEventListener('flow-audio', fn);
  return () => window.removeEventListener('flow-audio', fn);
}
