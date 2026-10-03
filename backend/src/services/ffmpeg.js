import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config, RENDITIONS } from '../config.js';

/**
 * Runs a binary. For ffmpeg, pass { duration, onProgress } to get a 0..1
 * fraction by reading `-progress pipe:1` output.
 */
function run(bin, args, { duration, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const finalArgs = onProgress ? ['-progress', 'pipe:1', '-nostats', ...args] : args;
    const p = spawn(bin, finalArgs);
    let stdout = '', stderr = '', pending = '';

    p.stdout.on('data', (d) => {
      if (!onProgress) { stdout += d; return; }
      pending += d;
      const lines = pending.split('\n');
      pending = lines.pop();
      for (const line of lines) {
        const m = line.match(/^out_time_us=(\d+)/);
        if (m && duration > 0) onProgress(Math.min(1, Number(m[1]) / 1e6 / duration));
      }
    });
    p.stderr.on('data', (d) => (stderr = (stderr + d).slice(-8000)));
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${bin} exited ${code}\n${stderr.trim().split('\n').slice(-6).join('\n')}`));
      onProgress?.(1);
      resolve(stdout);
    });
  });
}

let encoderPromise;
/** Picks an available H.264 encoder: libx264 (best) or libopenh264 (Fedora's ffmpeg-free). */
export function detectEncoder() {
  encoderPromise ??= run(config.ffmpeg.path, ['-hide_banner', '-encoders']).then((out) => {
    if (/\blibx264\b/.test(out)) return 'libx264';
    if (/\blibopenh264\b/.test(out)) return 'libopenh264';
    throw new Error(
      'No H.264 encoder found in FFmpeg. Install the full build (Fedora: sudo dnf swap ffmpeg-free ffmpeg --allowerasing) ' +
      'or Ubuntu/Debian: sudo apt install ffmpeg.');
  });
  return encoderPromise;
}

export async function probe(input) {
  const out = await run(config.ffmpeg.probePath, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=duration',
    '-of', 'json', input,
  ]);
  const j = JSON.parse(out);
  return {
    width: j.streams[0].width,
    height: j.streams[0].height,
    duration: Number(j.format.duration),
  };
}

export async function generatePoster(input, outFile, duration) {
  const at = Math.max(0, duration * 0.1).toFixed(2);
  await run(config.ffmpeg.path, [
    '-y', '-ss', at, '-i', input, '-frames:v', '1',
    '-vf', 'scale=1280:-2', '-q:v', '3', outFile,
  ]);
}

// Sprite sheets (10x10 grid of 160x90 thumbs) + WebVTT pointing into them.
export async function generateStoryboard(input, outDir, duration, onProgress) {
  const { storyboardInterval: step } = config.ffmpeg;
  const W = 160, H = 90, COLS = 10, ROWS = 10, PER_SHEET = COLS * ROWS;

  await fsp.mkdir(outDir, { recursive: true });
  await run(config.ffmpeg.path, [
    '-y', '-i', input,
    '-vf', `fps=1/${step},scale=${W}:${H},tile=${COLS}x${ROWS}`,
    '-q:v', '5', path.join(outDir, 'sprite_%d.jpg'),
  ], { duration, onProgress });

  // ffmpeg numbers from 1; rename to start from 0.
  const sheets = (await fsp.readdir(outDir)).filter((f) => f.startsWith('sprite_')).length;
  for (let i = 1; i <= sheets; i++)
    await fsp.rename(path.join(outDir, `sprite_${i}.jpg`), path.join(outDir, `sprite_${i - 1}.jpg.tmp`));
  for (let i = 0; i < sheets; i++)
    await fsp.rename(path.join(outDir, `sprite_${i}.jpg.tmp`), path.join(outDir, `sprite_${i}.jpg`));

  const ts = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = (s % 60).toFixed(3).padStart(6, '0');
    return `${h}:${m}:${sec}`;
  };

  const count = Math.ceil(duration / step);
  let vtt = 'WEBVTT\n\n';
  for (let i = 0; i < count; i++) {
    const sheet = Math.floor(i / PER_SHEET);
    const idx = i % PER_SHEET;
    vtt += `${ts(i * step)} --> ${ts(Math.min((i + 1) * step, duration))}\n`;
    vtt += `sprite_${sheet}.jpg#xywh=${(idx % COLS) * W},${Math.floor(idx / COLS) * H},${W},${H}\n\n`;
  }
  await fsp.writeFile(path.join(outDir, 'storyboard.vtt'), vtt);
}

/**
 * onProgress({ index, total, name, fraction }) fires while each rendition encodes.
 */
export async function generateHls(input, outDir, source, onProgress) {
  await fsp.mkdir(outDir, { recursive: true });

  let ladder = RENDITIONS.filter((r) => r.height <= source.height);
  if (ladder.length === 0) ladder = [RENDITIONS[0]];

  const encoder = await detectEncoder();
  console.log(`using video encoder: ${encoder}`);

  for (const [index, r] of ladder.entries()) {
    const dir = path.join(outDir, r.name);
    await fsp.mkdir(dir, { recursive: true });
    const report = (fraction) => onProgress?.({ index, total: ladder.length, name: r.name, fraction });
    report(0);

    await run(config.ffmpeg.path, [
      '-y', '-i', input,
      '-vf', `scale=-2:${r.height}`,
      ...(encoder === 'libx264'
        ? ['-c:v', 'libx264', '-preset', config.ffmpeg.preset, '-crf', '23',
           '-threads', String(config.ffmpeg.threads),
           '-maxrate', r.videoBitrate, '-bufsize', `${parseInt(r.videoBitrate) * 2}k`]
        // libopenh264 has no CRF/preset: use a target bitrate instead
        : ['-c:v', 'libopenh264', '-b:v', r.videoBitrate, '-pix_fmt', 'yuv420p']),
      '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
      '-c:a', 'aac', '-b:a', r.audioBitrate, '-ac', '2',
      '-f', 'hls',
      '-hls_time', String(config.ffmpeg.segmentSeconds),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(dir, 'segment_%03d.ts'),
      path.join(dir, 'playlist.m3u8'),
    ], { duration: source.duration, onProgress: report });
  }

  let master = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const r of ladder) {
    const width = Math.round((source.width / source.height) * r.height / 2) * 2;
    master += `#EXT-X-STREAM-INF:BANDWIDTH=${r.bandwidth},RESOLUTION=${width}x${r.height}\n${r.name}/playlist.m3u8\n`;
  }
  await fsp.writeFile(path.join(outDir, 'master.m3u8'), master);
  return ladder.map((r) => r.name);
}
