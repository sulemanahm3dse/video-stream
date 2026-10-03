import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { parseStoryboard, cueAt } from '../lib/vtt.js';
import { fmtTime } from '../lib/format.js';

export default function Player({ src, poster, storyboard }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const hlsRef = useRef(null);
  const idleTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState([]);
  const [selected, setSelected] = useState(-1); // -1 = auto
  const [playingHeight, setPlayingHeight] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cues, setCues] = useState([]);
  const [hover, setHover] = useState(null); // { x, width, time }
  const [dragging, setDragging] = useState(false);
  const [idle, setIdle] = useState(false);

  /* ---- attach HLS ---- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) =>
        setLevels(data.levels.map((l, i) => ({ index: i, height: l.height })).sort((a, b) => b.height - a.height)));
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setPlayingHeight(hls.levels[d.level]?.height ?? null));
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = src; // Safari
  }, [src]);

  /* ---- storyboard ---- */
  useEffect(() => {
    if (!storyboard) return;
    let cancelled = false;
    fetch(storyboard)
      .then((r) => (r.ok ? r.text() : ''))
      .then((t) => !cancelled && t && setCues(parseStoryboard(t, storyboard)))
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storyboard]);

  /* ---- actions ---- */
  const toggle = useCallback(() => {
    const v = videoRef.current;
    v.paused ? v.play() : v.pause();
  }, []);
  const seekBy = useCallback((d) => {
    const v = videoRef.current;
    v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || 0);
  }, []);
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    v.muted = !v.muted;
  }, []);
  const toggleFullscreen = useCallback(() => {
    document.fullscreenElement ? document.exitFullscreen() : wrapRef.current.requestFullscreen?.();
  }, []);
  const chooseQuality = (index) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setSelected(index);
    setMenuOpen(false);
  };

  /* ---- keyboard ---- */
  const onKeyDown = (e) => {
    if (e.target.tagName === 'BUTTON' && e.key === ' ') return;
    if (e.target.tagName === 'INPUT') return;
    const map = {
      ' ': toggle, k: toggle,
      ArrowLeft: () => seekBy(-5), ArrowRight: () => seekBy(5),
      j: () => seekBy(-10), l: () => seekBy(10),
      m: toggleMute, f: toggleFullscreen,
    };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  };

  /* ---- scrubber ---- */
  const timeFromEvent = (e) => {
    const r = barRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - r.left), r.width);
    return { x, width: r.width, time: (x / r.width) * duration };
  };
  const onBarMove = (e) => {
    const p = timeFromEvent(e);
    setHover(p);
    if (dragging) videoRef.current.currentTime = p.time;
  };
  const onBarDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    videoRef.current.currentTime = timeFromEvent(e).time;
  };

  /* ---- hide controls when idle ---- */
  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2500);
  };
  useEffect(() => () => clearTimeout(idleTimer.current), []);

  const pct = duration ? (current / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const cue = hover && cues.length ? cueAt(cues, hover.time) : null;
  const hideControls = playing && idle && !menuOpen && !dragging;

  return (
    <div
      ref={wrapRef}
      className={`player ${hideControls ? 'is-idle' : ''}`}
      onMouseMove={wake}
      onMouseLeave={() => playing && setIdle(true)}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        onClick={toggle}
        onPlay={() => { setPlaying(true); wake(); }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
      />

      {!playing && (
        <button className="player-bigplay" onClick={toggle} aria-label="Play video">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>
      )}

      <div className="player-controls">
        <div
          ref={barRef}
          className="scrub"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={() => setDragging(false)}
          onPointerLeave={() => !dragging && setHover(null)}
        >
          <div className="scrub-track">
            <div className="scrub-buffer" style={{ width: `${bufPct}%` }} />
            <div className="scrub-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="scrub-knob" style={{ left: `${pct}%` }} />

          {hover && (
            <div
              className="scrub-preview"
              style={{ left: Math.min(Math.max(hover.x, 90), Math.max(90, hover.width - 90)) }}
            >
              {cue && (
                <div
                  className="scrub-frame"
                  style={{
                    width: cue.w, height: cue.h,
                    backgroundImage: `url(${cue.url})`,
                    backgroundPosition: `-${cue.x}px -${cue.y}px`,
                  }}
                />
              )}
              <span>{fmtTime(hover.time)}</span>
            </div>
          )}
        </div>

        <div className="player-row">
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3z" />
              {!muted && volume > 0 && <path d="M16 8a5 5 0 0 1 0 8l-1.2-1.6a3 3 0 0 0 0-4.8z" />}
            </svg>
          </button>
          <input
            className="vol"
            type="range" min="0" max="1" step="0.05"
            value={muted ? 0 : volume}
            aria-label="Volume"
            onChange={(e) => {
              const v = videoRef.current;
              v.volume = +e.target.value;
              v.muted = +e.target.value === 0;
            }}
          />

          <span className="time">{fmtTime(current)} / {fmtTime(duration)}</span>
          <span className="spacer" />

          {levels.length > 0 && (
            <div className="quality">
              <button onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen}>
                {selected === -1
                  ? `Auto${playingHeight ? ` (${playingHeight}p)` : ''}`
                  : `${levels.find((l) => l.index === selected)?.height}p`}
              </button>
              {menuOpen && (
                <ul className="quality-menu" role="menu">
                  <li>
                    <button role="menuitemradio" aria-checked={selected === -1} onClick={() => chooseQuality(-1)}>Auto</button>
                  </li>
                  {levels.map((l) => (
                    <li key={l.index}>
                      <button role="menuitemradio" aria-checked={selected === l.index} onClick={() => chooseQuality(l.index)}>{l.height}p</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M5 5h5v2H7v3H5zm9 0h5v5h-2V7h-3zM5 14h2v3h3v2H5zm12 0h2v5h-5v-2h3z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
