// Parses the storyboard WebVTT produced by the backend:
//   00:00:10.000 --> 00:00:20.000
//   sprite_0.jpg#xywh=160,0,160,90
const toSec = (t) => {
  const p = t.trim().split(':').map(Number);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

export function parseStoryboard(text, vttUrl) {
  const base = vttUrl.slice(0, vttUrl.lastIndexOf('/') + 1);
  const cues = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i === -1 || !lines[i + 1]) continue;
    const [a, b] = lines[i].split('-->');
    const m = lines[i + 1].match(/^(.+)#xywh=(\d+),(\d+),(\d+),(\d+)/);
    if (!m) continue;
    cues.push({
      start: toSec(a), end: toSec(b),
      url: base + m[1], x: +m[2], y: +m[3], w: +m[4], h: +m[5],
    });
  }
  return cues;
}

export const cueAt = (cues, t) =>
  cues.find((c) => t >= c.start && t < c.end) || cues[cues.length - 1] || null;
