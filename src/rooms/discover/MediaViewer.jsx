import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BackIcon, TimeNoteIcon } from '../../components/Icons.jsx';
import { newId } from '../../lib/data.js';
import { NoteStrip, NoteUndo, TimeNotesPanel, sortNotes } from './TimeNotes.jsx';
import { fileUrl } from '../../lib/pdf.js';
import { openFrom } from '../../lib/openFrom.js';
import { MEDIA_LABEL, claimAudio, formatTime, youTubeWatch } from '../../lib/media.js';
import { lab } from '../../lib/space.js';
import { Waveform } from './MediaThumb.jsx';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function SpeedButton({ el, speed, setSpeed }) {
  const next = () => {
    const s = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(s);
    if (el.current) el.current.playbackRate = s;
  };
  return <button type="button" className="btn speed-btn" title="Playback speed" onClick={next}>{speed}×</button>;
}

// ---- Picture: fit to the screen; zoom with pinch, ⌘+ / ⌘− or double-click; drag to look around ----
function ImageView({ card, api, slot }) {
  const stage = useRef(null);
  const [view, setView] = useState({ zoom: null, x: 0, y: 0 }); // zoom null = fit to screen
  const [natural, setNatural] = useState(card.px || null);
  const fitScale = () => {
    const s = stage.current;
    if (!s || !natural) return 1;
    return Math.min(1, (s.clientWidth - 80) / natural[0], (s.clientHeight - 80) / natural[1]);
  };
  const scale = view.zoom ?? fitScale();
  const zoomTo = (z, cx, cy) => setView((v) => {
    const cur = v.zoom ?? fitScale();
    const next = Math.max(0.05, Math.min(8, z));
    const s = stage.current.getBoundingClientRect();
    const px = (cx ?? s.left + s.width / 2) - s.left - s.width / 2;
    const py = (cy ?? s.top + s.height / 2) - s.top - s.height / 2;
    const k = next / cur;
    return { zoom: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
  });
  const fit = () => setView({ zoom: null, x: 0, y: 0 });

  api.current = {
    key: (e) => {
      if (['=', '+'].includes(e.key)) { e.preventDefault(); zoomTo(scale * 1.25); return true; }
      if (['-', '_'].includes(e.key)) { e.preventDefault(); zoomTo(scale / 1.25); return true; }
      if (e.key === '0' && e.metaKey) { e.preventDefault(); fit(); return true; }
      return false;
    },
  };
  const tools = (
      <div className="reader-zoom" role="group" aria-label="Zoom">
        <button type="button" className="hud-btn" aria-label="Zoom out" onClick={() => zoomTo(scale / 1.25)}>−</button>
        <span className="hud-zoom">{Math.round(scale * 100)}%</span>
        <button type="button" className="hud-btn" aria-label="Zoom in" onClick={() => zoomTo(scale * 1.25)}>+</button>
        <span className="hud-sep" />
        <button type="button" className="hud-text" onClick={fit}>Fit</button>
        <button type="button" className="hud-text" onClick={() => zoomTo(1)}>100%</button>
      </div>
  );

  useEffect(() => {
    const el = stage.current;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey) zoomTo(scale * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else setView((v) => ({ zoom: v.zoom ?? fitScale(), x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onDown = (e) => {
    if (e.button !== 0) return;
    const sx = e.clientX; const sy = e.clientY; const start = view;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.classList.add('grabbing');
    const move = (ev) => setView({ zoom: start.zoom ?? fitScale(), x: start.x + ev.clientX - sx, y: start.y + ev.clientY - sy });
    const up = () => { el.classList.remove('grabbing'); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  return (
    <>
    {slot && createPortal(tools, slot)}
    <div
      ref={stage}
      className="media-stage image"
      onPointerDown={onDown}
      onDoubleClick={(e) => (view.zoom && Math.abs(scale - 1) < 0.01 ? fit() : zoomTo(1, e.clientX, e.clientY))}
    >
      <img
        src={fileUrl(card.file)}
        alt={card.name}
        draggable={false}
        onLoad={(e) => setNatural([e.currentTarget.naturalWidth, e.currentTarget.naturalHeight])}
        style={natural ? { width: natural[0] * scale, height: natural[1] * scale, transform: `translate(${view.x}px, ${view.y}px)` } : { maxWidth: '90%', maxHeight: '90%' }}
      />
    </div>
    </>
  );
}

// ---- Video: plays from where you stopped ----
function VideoView({ card, at, api, slot, onPos }) {
  const video = useRef(null);
  const [speed, setSpeed] = useState(1);
  api.current = {
    key: (e) => {
      const v = video.current;
      if (!v || e.metaKey) return false;
      if (e.key === ' ' && e.target !== v) { e.preventDefault(); if (v.paused) { claimAudio(v); v.play(); } else v.pause(); return true; }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target !== v) { e.preventDefault(); v.currentTime += e.key === 'ArrowRight' ? 5 : -5; return true; }
      return false;
    },
    pos: () => video.current?.currentTime || 0,
    duration: () => video.current?.duration || card.duration || 0,
    playing: () => !!video.current && !video.current.paused,
    pause: () => video.current?.pause(),
    play: () => { const v = video.current; if (v) { claimAudio(v); v.play().catch(() => {}); } },
    seek: (t) => { const v = video.current; if (v) { v.currentTime = t; claimAudio(v); v.play().catch(() => {}); } },
  };
  useEffect(() => {
    const t = setInterval(() => { const v = video.current; if (v && !v.paused) onPos(v.currentTime); }, 5000);
    return () => clearInterval(t);
  }, [onPos]);
  return (
    <div className="media-stage">
      {slot && createPortal(<SpeedButton el={video} speed={speed} setSpeed={setSpeed} />, slot)}
      <video
        ref={video}
        src={fileUrl(card.file)}
        controls
        autoPlay
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (at != null) v.currentTime = Math.min(at, Math.max(0, v.duration - 0.2)); // opened from a time note
          else if (card.pos && card.pos < v.duration - 3) v.currentTime = card.pos;
          claimAudio(v);
        }}
        onPause={(e) => onPos(e.currentTarget.currentTime)}
        onEnded={() => onPos(0)}
      />
    </div>
  );
}

// ---- Sound: a big waveform to jump around in ----
function AudioView({ card, at, notes, api, slot, onPos, onJump }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(card.pos || 0);
  const [speed, setSpeed] = useState(1);
  const duration = card.duration || audio.current?.duration || 0;
  const toggle = () => { const a = audio.current; if (a.paused) { claimAudio(a); a.play().catch(() => {}); } else a.pause(); };
  const skip = (d) => { const a = audio.current; a.currentTime = Math.max(0, Math.min((a.duration || 0) - 0.1, a.currentTime + d)); setTime(a.currentTime); };
  api.current = {
    key: (e) => {
      if (e.metaKey) return false;
      if (e.key === ' ') { e.preventDefault(); toggle(); return true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); skip(10); return true; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10); return true; }
      return false;
    },
    pos: () => audio.current?.currentTime || 0,
    duration: () => audio.current?.duration || card.duration || 0,
    playing: () => !!audio.current && !audio.current.paused,
    pause: () => audio.current?.pause(),
    play: () => { const a = audio.current; if (a) { claimAudio(a); a.play().catch(() => {}); } },
    seek: (t) => { const a = audio.current; if (a) { a.currentTime = t; setTime(t); claimAudio(a); a.play().catch(() => {}); } },
  };
  return (
    <div className="media-stage audio">
      {slot && createPortal(<SpeedButton el={audio} speed={speed} setSpeed={setSpeed} />, slot)}
      <audio
        ref={audio}
        src={fileUrl(card.file)}
        autoPlay
        onLoadedMetadata={(e) => {
          const a = e.currentTarget;
          if (at != null) { a.currentTime = Math.min(at, Math.max(0, a.duration - 0.1)); setTime(a.currentTime); } // opened from a time note
          else if (card.pos && card.pos < a.duration - 1) { a.currentTime = card.pos; }
          claimAudio(a);
        }}
        onPlay={() => setPlaying(true)}
        onPause={(e) => { setPlaying(false); onPos(e.currentTarget.currentTime); }}
        onEnded={() => onPos(0)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      />
      <div className="audio-big">
        <div className="audio-title">{card.title || card.name}</div>
        <div className="wave-wrap">
          <Waveform className="big" peaks={card.peaks} progress={duration ? time / duration : 0} onSeek={(f) => { const a = audio.current; if (a.duration) { a.currentTime = f * a.duration; setTime(a.currentTime); } }} />
          {duration > 0 && sortNotes(notes).map((n) => (
            <button key={n.id} type="button" className="tn-dot on-wave" style={{ left: `${Math.min(100, (n.t / duration) * 100)}%` }} aria-label={`${formatTime(n.t)} ${n.text}`} onClick={() => onJump(n)}>
              <span className="tn-tip"><b>{formatTime(n.t)}</b>{n.text}</span>
            </button>
          ))}
        </div>
        <div className="audio-controls">
          <span className="audio-time">{formatTime(time)}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" aria-label="Back 10 seconds" onClick={() => skip(-10)}>−10s</button>
          <button type="button" className={`audio-play big${playing ? ' on' : ''}`} aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
            {playing
              ? <svg viewBox="0 0 24 24" width="26" height="26"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
              : <svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
          </button>
          <button type="button" className="btn" aria-label="Forward 10 seconds" onClick={() => skip(10)}>+10s</button>
          <span style={{ flex: 1 }} />
          <span className="audio-time dim">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ---- YouTube: YouTube's own official player, starting where you stopped ----
function YouTubeView({ card, at, api, slot, onPos, onOpenLink }) {
  const frame = useRef(null);
  const time = useRef(at ?? card.pos ?? 0);
  const info = useRef({ duration: card.duration || 0, state: -1 });
  const send = (func, args = []) => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  // Worked out once when it opens: the saved time keeps changing while you watch, and a new address would reload the player.
  const [src] = useState(() => {
    const start = Math.floor(at != null ? at : card.pos > 2 ? card.pos : card.start || 0);
    return `https://www.youtube-nocookie.com/embed/${card.yt}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${start ? `&start=${start}` : ''}`;
  });

  // The player reports its time through messages; ask it to, and keep the latest.
  useEffect(() => {
    const onMsg = (e) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const t = d?.info?.currentTime;
        if (typeof t === 'number') time.current = t;
        if (typeof d?.info?.duration === 'number' && d.info.duration > 0) info.current.duration = d.info.duration;
        if (typeof d?.info?.playerState === 'number') info.current.state = d.info.playerState;
      } catch { /* not a player message */ }
    };
    window.addEventListener('message', onMsg);
    const listen = setInterval(() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'), 1000);
    const save = setInterval(() => onPos(time.current), 5000);
    return () => { window.removeEventListener('message', onMsg); clearInterval(listen); clearInterval(save); };
  }, [onPos]);

  api.current = {
    key: () => false,
    pos: () => time.current,
    duration: () => info.current.duration,
    playing: () => info.current.state === 1,
    pause: () => { send('pauseVideo'); info.current.state = 2; },
    play: () => send('playVideo'),
    seek: (t) => { send('seekTo', [t, true]); send('playVideo'); time.current = t; },
  };
  return (
    <div className="media-stage">
      {slot && createPortal(<button type="button" className="btn" onClick={() => { document.querySelector('.media-viewer iframe')?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); onOpenLink(youTubeWatch(card.yt, time.current)); }}><span className="long-label">Open on </span>YouTube</button>, slot)}
      <div className="yt-frame">
        <iframe
          ref={frame}
          src={src}
          title={card.title || 'YouTube video'}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}

const VIEWS = { image: ImageView, video: VideoView, audio: AudioView, youtube: YouTubeView };

// Full screen for a picture, sound, video or YouTube card.
export default function MediaViewer({ card, from, at, quoted, onQuote, onNotes, onPos, onOpenLink, onExport, onClose }) {
  const api = useRef({}); // what the inner view offers: its keys and its current time
  const [slot, setSlot] = useState(null); // where the inner view puts its buttons, in the header
  const onPosRef = useRef(onPos);
  onPosRef.current = onPos;
  const savePos = useCallback((pos) => onPosRef.current({ pos }), []);
  const close = useCallback(() => {
    const pos = api.current?.pos?.();
    const d = api.current?.duration?.();
    onClose(typeof pos === 'number' ? { pos, ...(d > 0 && Number.isFinite(d) ? { duration: d } : {}) } : {});
  }, [onClose]);

  // ---- Time notes (not for pictures) ----
  const timed = card.type !== 'image';
  const notes = card.tnotes || [];
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const cameFor = at != null ? notes.find((n) => Math.abs(n.t - at) < 0.05) : null;
  const [panel, setPanel] = useState(() => timed && ((window.innerWidth >= 760 && notes.length > 0) || at != null));
  const [draft, setDraft] = useState(null); // { t, wasPlaying }: a note being written
  const draftRef = useRef(null);
  draftRef.current = draft;
  const [removed, setRemoved] = useState(null);
  const [now, setNow] = useState(at ?? card.pos ?? 0);
  const [duration, setDuration] = useState(card.duration || 0);
  useEffect(() => {
    if (!timed) return undefined;
    const t = setInterval(() => {
      setNow(api.current?.pos?.() || 0);
      const d = api.current?.duration?.();
      if (d && Number.isFinite(d)) setDuration(d);
    }, 250);
    return () => clearInterval(t);
  }, [timed]);
  useEffect(() => {
    if (!removed) return undefined;
    const t = setTimeout(() => setRemoved(null), 5000);
    return () => clearTimeout(t);
  }, [removed]);

  const startNote = useCallback(() => {
    if (draftRef.current) return;
    const t = Math.round((api.current?.pos?.() || 0) * 10) / 10;
    const wasPlaying = !!api.current?.playing?.();
    api.current?.pause?.();
    setPanel(true);
    setDraft({ t, wasPlaying });
  }, []);
  const endDraft = (text) => {
    const d = draftRef.current;
    setDraft(null);
    if (!d) return;
    if (text) onNotes([...notesRef.current, { id: newId(), t: d.t, text, createdAt: Date.now() }]);
    if (d.wasPlaying) api.current?.play?.();
  };
  const jump = (n) => api.current?.seek?.(n.t);
  const removeNote = (n) => { onNotes(notesRef.current.filter((x) => x.id !== n.id)); setRemoved(n); };

  useEffect(() => {
    const onKey = (e) => {
      if (document.querySelector('.dict-pop')) return; // the meaning box closes first
      if (document.querySelector('.web-viewer.temp')) return; // a page opened from a link is on top: its keys first
      if (e.key === 'Escape' && e.target.closest?.('.tn-panel')) return; // Esc while writing a time note cancels just the note
      if (e.key === 'Escape') {
        if (document.fullscreenElement) return; // Esc first leaves the video's own full screen
        e.preventDefault(); e.stopPropagation(); close(); return;
      }
      if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      if (timed && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'n') { e.preventDefault(); startNote(); return; }
        if (k === 'm') { e.preventDefault(); setPanel((p) => !p); return; }
      }
      api.current?.key?.(e);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [close, timed, startNote]);

  const View = VIEWS[card.type];
  return createPortal(
    <motion.div
      className={`reader media-viewer kind-${card.type}`}
      data-overlay
      role="dialog"
      aria-modal="true"
      aria-label={card.title || card.name}
      {...openFrom(from)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onDragOver={(e) => e.stopPropagation()}
      onDrop={(e) => e.stopPropagation()}
    >
      <div className="room-accent" style={{ background: 'var(--cyan)' }} />
      <header className="reader-top drag">
        <button type="button" className="btn" aria-label="Back to library" onClick={close}><BackIcon /><span className="back-label"> Library</span></button>
        <span className="reader-type">{MEDIA_LABEL[card.type]}</span>
        <span className="reader-title">{card.title || card.name}{card.channel && <span className="reader-author"> · {card.channel}</span>}</span>
        <span style={{ flex: 1 }} />
        <div className="media-tools" ref={setSlot} />
        {timed && (
          <>
            <button type="button" className="btn" title="Note at this second (N)" onClick={startNote}><TimeNoteIcon /> Note</button>
            <button type="button" className={`btn marks-toggle${panel ? ' on' : ''}`} title="Time notes (M)" aria-pressed={panel} onClick={() => setPanel((p) => !p)}>
              Notes {notes.length > 0 && <span className="marks-count">{notes.length}</span>}
            </button>
          </>
        )}
      </header>
      <div className="reader-body">
        <div className="media-col">
          <View card={card} at={at} notes={notes} api={api} slot={slot} onPos={savePos} onOpenLink={onOpenLink} onJump={jump} />
          {timed && card.type !== 'audio' && <NoteStrip notes={notes} now={now} duration={duration} draft={draft} onJump={jump} />}
        </div>
        <AnimatePresence initial={false}>
          {timed && panel && (
            <TimeNotesPanel
              key="tn"
              notes={notes}
              draft={draft}
              now={now}
              focusId={cameFor?.id}
              quoted={quoted}
              onJump={jump}
              onSaveDraft={endDraft}
              onCancelDraft={() => endDraft('')}
              onEdit={(id, text) => onNotes(notesRef.current.map((n) => (n.id === id ? { ...n, text } : n)))}
              onDelete={removeNote}
              onToLab={onQuote ? (n) => onQuote(n) : undefined}
              onExport={onExport}
              onClose={() => setPanel(false)}
            />
          )}
        </AnimatePresence>
        <NoteUndo removed={removed} onUndo={() => { if (removed) onNotes([...notesRef.current, removed]); setRemoved(null); }} />
      </div>
    </motion.div>,
    document.body,
  );
}
