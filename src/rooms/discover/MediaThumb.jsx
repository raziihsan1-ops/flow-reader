import { useEffect, useRef, useState } from 'react';
import { fileUrl } from '../../lib/pdf.js';
import { audioPeaks, claimAudio, formatTime, onOtherAudio, youTubeInfo, youTubeThumb } from '../../lib/media.js';

const HEAD = 33; // card header height (px), used to size a card to its picture

// A waveform drawn as bars; the part already played is lit.
export function Waveform({ peaks, progress = 0, onSeek, className = '' }) {
  const ref = useRef(null);
  const seek = (e) => {
    if (!onSeek) return;
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  const bars = peaks?.length ? peaks : Array.from({ length: 70 }, () => 0.08);
  const n = bars.length;
  return (
    <div ref={ref} className={`wave ${onSeek ? 'seekable' : ''} ${className}`} onClick={seek} role={onSeek ? 'slider' : undefined} aria-label={onSeek ? 'Position' : undefined} aria-valuenow={Math.round(progress * 100)}>
      <svg viewBox={`0 0 ${n * 3} 100`} preserveAspectRatio="none" aria-hidden="true">
        {bars.map((p, i) => {
          const h = Math.max(4, p * 96);
          return <rect key={i} x={i * 3} y={50 - h / 2} width={1.9} height={h} rx={0.9} className={i / n < progress ? 'on' : ''} />;
        })}
      </svg>
    </div>
  );
}

function ImageBody({ card, onMeta }) {
  const [failed, setFailed] = useState(false);
  const onLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (!w || !h) return;
    if (!card.ratio || card.fit) onMeta(card.id, { ratio: h / w, px: [w, h], fit: false, ...(card.fit ? { h: Math.round(card.w * (h / w)) + HEAD } : {}) });
  };
  if (failed) return <div className="media-body"><span className="pdf-thumb-msg">This picture couldn't be opened</span></div>;
  return (
    <div className="media-body image">
      <img src={fileUrl(card.file)} alt="" draggable={false} onLoad={onLoad} onError={() => setFailed(true)} />
    </div>
  );
}

const PLAY = <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>;
const PAUSE = <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>;
const SMALL_PLAY = <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>;
const EXPAND = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>;
const STOP = <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;
const stop = (e) => e.stopPropagation(); // controls on a card must never start a drag or a double-click

// A video card: shows a frame; ▶ plays it right here in the card, with a small bar (pause, time, seek, full screen).
function VideoBody({ card, onMeta, onOpen }) {
  const ref = useRef(null);
  const meta = useRef(onMeta);
  meta.current = onMeta;
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [time, setTime] = useState(card.pos || 0);
  const onMetaLoaded = () => {
    const v = ref.current;
    if (!v) return;
    if (!started) v.currentTime = Math.min(card.pos || 1, (v.duration || 2) / 2); // a frame from where you were (or near the start)
    const patch = {};
    if (!card.duration) patch.duration = v.duration;
    if (v.videoWidth && (!card.ratio || card.fit)) {
      patch.ratio = v.videoHeight / v.videoWidth;
      if (card.fit) { patch.h = Math.round(card.w * patch.ratio) + HEAD + 30; patch.fit = false; }
    }
    if (Object.keys(patch).length) onMeta(card.id, patch);
  };
  // Another sound or video starts (or this card opens full screen): stop here and remember the exact second.
  useEffect(() => onOtherAudio(ref.current, () => {
    const v = ref.current;
    if (v && !v.paused) { v.pause(); meta.current(card.id, { pos: v.currentTime }); }
  }), [card.id]);
  useEffect(() => () => {
    const v = ref.current;
    if (v && !v.paused) { v.pause(); meta.current(card.id, { pos: v.currentTime }); }
  }, [card.id]);

  const toggle = (e) => {
    stop(e);
    const v = ref.current;
    if (v.paused) {
      if (!started) {
        setStarted(true);
        v.currentTime = card.pos && card.pos < (v.duration || Infinity) - 2 ? card.pos : 0;
      }
      v.muted = false;
      claimAudio(v);
      v.play().catch(() => {});
    } else v.pause();
  };
  const seek = (e) => {
    stop(e);
    const v = ref.current;
    const r = e.currentTarget.getBoundingClientRect();
    if (v.duration) { v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration; setTime(v.currentTime); }
  };
  const full = (e) => {
    stop(e);
    const v = ref.current;
    if (v && started) { v.pause(); meta.current(card.id, { pos: v.currentTime }); }
    onOpen(card);
  };
  const duration = card.duration || ref.current?.duration || 0;
  if (failed) return <div className="media-body"><span className="pdf-thumb-msg">This video can't be played here</span></div>;
  return (
    <div className={`media-body video${started ? ' started' : ''}${playing ? ' playing' : ''}`}>
      <video
        ref={ref}
        src={fileUrl(card.file)}
        preload="metadata"
        muted
        playsInline
        onLoadedMetadata={onMetaLoaded}
        onError={() => setFailed(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); meta.current(card.id, { pos: ref.current.currentTime }); }}
        onEnded={() => meta.current(card.id, { pos: 0 })}
        onTimeUpdate={() => setTime(ref.current.currentTime)}
      />
      {!playing && (
        <button type="button" className="play-badge" aria-label="Play here" title="Play here (double-click the card for full screen)" onPointerDown={stop} onDoubleClick={stop} onClick={toggle}>{PLAY}</button>
      )}
      {started && (
        <div className="mini-bar" onPointerDown={stop} onDoubleClick={stop}>
          <button type="button" className="mini-btn" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? PAUSE : SMALL_PLAY}</button>
          <span className="mini-time">{formatTime(time)}</span>
          <div className="mini-track" role="slider" aria-label="Position" aria-valuenow={Math.round(duration ? (time / duration) * 100 : 0)} onClick={seek}>
            <i style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
          </div>
          <span className="mini-time dim">{formatTime(duration)}</span>
          <button type="button" className="mini-btn" aria-label="Full screen" title="Full screen" onClick={full}>{EXPAND}</button>
        </div>
      )}
    </div>
  );
}

// A sound card: its waveform, and a play button right on the card.
function AudioBody({ card, selected, onMeta }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(card.pos || 0);

  useEffect(() => {
    if (card.peaks !== undefined) return undefined;
    let alive = true;
    audioPeaks(card.file).then((r) => alive && onMeta(card.id, { peaks: r.peaks, duration: r.duration || card.duration || null })).catch(() => alive && onMeta(card.id, { peaks: null }));
    return () => { alive = false; };
  }, [card.file]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = useRef(onMeta);
  meta.current = onMeta;
  useEffect(() => onOtherAudio(audio.current, () => {
    const a = audio.current;
    if (a && !a.paused) { a.pause(); meta.current(card.id, { pos: a.currentTime }); }
  }), [card.id]);
  useEffect(() => () => {
    const a = audio.current;
    if (a && !a.paused) { a.pause(); onMeta(card.id, { pos: a.currentTime }); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (e) => {
    e.stopPropagation();
    const a = audio.current;
    if (a.paused) {
      if (a.currentTime < 0.5 && card.pos && card.pos < (card.duration || Infinity) - 1) a.currentTime = card.pos;
      claimAudio(a);
      a.play().catch(() => {});
    } else a.pause();
  };
  const duration = card.duration || audio.current?.duration || 0;
  return (
    <div className="media-body audio">
      <audio
        ref={audio}
        src={fileUrl(card.file)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); onMeta(card.id, { pos: audio.current.currentTime }); }}
        onEnded={() => onMeta(card.id, { pos: 0 })}
        onTimeUpdate={() => setTime(audio.current.currentTime)}
        onLoadedMetadata={() => { if (!card.duration && audio.current.duration) onMeta(card.id, { duration: audio.current.duration }); }}
      />
      <button
        type="button"
        className={`audio-play${playing ? ' on' : ''}`}
        aria-label={playing ? 'Pause' : 'Play'}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={toggle}
      >
        {playing
          ? <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
      </button>
      <div
        className="audio-wave-wrap"
        // Once the card is selected, a click on the waveform jumps there (otherwise it just selects / drags the card).
        onPointerDown={(e) => { if (selected) e.stopPropagation(); }}
      >
        <Waveform
          peaks={card.peaks}
          progress={duration ? time / duration : 0}
          onSeek={selected ? (f) => { const a = audio.current; if (duration) { a.currentTime = f * duration; setTime(a.currentTime); onMeta(card.id, { pos: a.currentTime }); } } : null}
        />
        <span className="audio-time">{formatTime(time)} <i>/ {formatTime(duration)}</i></span>
      </div>
    </div>
  );
}

// A YouTube card: ▶ plays it right here in the card (YouTube's own player); ✕ stops, ⤢ goes full screen.
function YouTubeBody({ card, onMeta, onOpen }) {
  const frame = useRef(null);
  const meta = useRef(onMeta);
  meta.current = onMeta;
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState(null); // fixed when ▶ is pressed: if it changed later, the player would reload and start playing again
  const time = useRef(card.pos || 0);

  useEffect(() => {
    if (card.title) return undefined;
    let alive = true;
    youTubeInfo(card.yt).then((info) => { if (alive && info) onMeta(card.id, { title: info.title, channel: info.channel }); });
    return () => { alive = false; };
  }, [card.yt]); // eslint-disable-line react-hooks/exhaustive-deps

  // While playing: keep the player's time (it reports it in messages), and stop if something else starts.
  useEffect(() => {
    if (!playing) return undefined;
    const onMsg = (e) => {
      if (e.source !== frame.current?.contentWindow) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (typeof d?.info?.currentTime === 'number') time.current = d.info.currentTime;
      } catch { /* not a player message */ }
    };
    window.addEventListener('message', onMsg);
    const listen = setInterval(() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: card.id, channel: 'widget' }), '*'), 1000);
    const off = onOtherAudio(frame.current, () => { meta.current(card.id, { pos: time.current }); setPlaying(false); });
    return () => { window.removeEventListener('message', onMsg); clearInterval(listen); off(); };
  }, [playing, card.id]);

  const play = (e) => {
    stop(e);
    time.current = card.pos > 2 ? card.pos : card.start || 0;
    const from = Math.floor(time.current);
    setSrc(`https://www.youtube-nocookie.com/embed/${card.yt}?autoplay=1&rel=0&playsinline=1&enablejsapi=1${from ? `&start=${from}` : ''}`);
    claimAudio(null);
    setPlaying(true);
  };
  const end = (e) => { stop(e); meta.current(card.id, { pos: time.current }); setPlaying(false); };
  const full = (e) => { stop(e); meta.current(card.id, { pos: time.current }); setPlaying(false); onOpen(card); };

  return (
    <div className={`media-body video yt${playing ? ' playing' : ''}`}>
      {playing ? (
        <>
          <iframe
            ref={frame}
            src={src}
            title={card.title || 'YouTube video'}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <div className="yt-card-tools" onPointerDown={stop} onDoubleClick={stop}>
            <button type="button" className="mini-btn" aria-label="Full screen" title="Full screen" onClick={full}>{EXPAND}</button>
            <button type="button" className="mini-btn" aria-label="Stop" title="Stop" onClick={end}>{STOP}</button>
          </div>
        </>
      ) : (
        <>
          <img src={youTubeThumb(card.yt)} alt="" draggable={false} />
          <button type="button" className="play-badge" aria-label="Play here" title="Play here (double-click the card for full screen)" onPointerDown={stop} onDoubleClick={stop} onClick={play}>{PLAY}</button>
        </>
      )}
    </div>
  );
}

export default function MediaThumb({ card, selected, onMeta, onOpen }) {
  if (card.type === 'image') return <ImageBody card={card} onMeta={onMeta} />;
  if (card.type === 'video') return <VideoBody card={card} onMeta={onMeta} onOpen={onOpen} />;
  if (card.type === 'audio') return <AudioBody card={card} selected={selected} onMeta={onMeta} />;
  return <YouTubeBody card={card} onMeta={onMeta} onOpen={onOpen} />;
}

// What the card's bottom line says.
export function mediaFoot(card) {
  if (card.type === 'image') return [card.px ? `${card.px[0]} × ${card.px[1]}` : 'Picture', 'Double-click to view'];
  if (card.type === 'audio') return null; // the audio card shows its own time
  const n = card.tnotes?.length || 0;
  const notes = n ? `${n} time note${n === 1 ? '' : 's'}` : null;
  if (card.type === 'video') return [card.duration ? (card.pos > 2 ? `${formatTime(card.pos)} / ${formatTime(card.duration)}` : formatTime(card.duration)) : 'Video', notes || '▶ here · double-click: full screen'];
  return [card.channel || 'YouTube', notes || (card.pos > 2 ? `From ${formatTime(card.pos)}` : '▶ here · double-click: full screen')];
}
