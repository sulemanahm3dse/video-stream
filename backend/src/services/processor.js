import fsp from 'node:fs/promises';
import path from 'node:path';
import { query } from '../db.js';
import { config } from '../config.js';
import { keys } from '../utils/paths.js';
import { downloadToFile, uploadFile, uploadDir, deleteObject } from '../storage.js';
import { probe, generatePoster, generateStoryboard, generateHls } from './ffmpeg.js';

const log = (id, msg) => console.log(`[${new Date().toISOString()}] ${id.slice(0, 8)}  ${msg}`);

// Claim one queued video. Also re-claims jobs stuck in 'processing' whose worker
// died (no heartbeat for STALE_JOB_MINUTES). Safe with multiple workers.
export async function claimNext() {
  const { rows } = await query(`
    UPDATE videos
    SET status='processing', stage='Starting', progress=0,
        processing_started_at=NOW(), updated_at=NOW(), error_message=NULL
    WHERE id = (
      SELECT id FROM videos
      WHERE status='uploaded'
         OR (status='processing' AND updated_at < NOW() - make_interval(mins => $1))
      ORDER BY created_at LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, original_key`, [config.staleMinutes]);
  return rows[0] || null;
}

// Writes stage + percent to the DB (throttled), so the UI can show live progress.
function makeReporter(id) {
  let lastPct = -1, lastAt = 0, lastStage = '';
  return (stage, pct) => {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const now = Date.now();
    const stageChanged = stage !== lastStage;
    if (!stageChanged && (pct === lastPct || now - lastAt < 1500)) return;
    lastPct = pct; lastAt = now; lastStage = stage;
    if (stageChanged) log(id, `${stage} (${pct}%)`);
    query('UPDATE videos SET stage=$2, progress=$3, updated_at=NOW() WHERE id=$1', [id, stage, pct])
      .catch((e) => console.error('progress update failed:', e.message));
  };
}

// Stage budget: download 0-5, poster 5-8, storyboard 8-20, encode 20-95, upload 95-100
export async function processVideo({ id, original_key }) {
  const work = path.resolve(config.tmpDir, `job_${id}`);
  const input = path.join(work, 'original.mp4');
  const report = makeReporter(id);
  const started = Date.now();
  const heartbeat = setInterval(
    () => query('UPDATE videos SET updated_at=NOW() WHERE id=$1', [id]).catch(() => {}), 15000);

  await fsp.mkdir(work, { recursive: true });
  try {
    report('Downloading original', 0);
    await downloadToFile(original_key, input);

    report('Reading video info', 5);
    const info = await probe(input);
    log(id, `source ${info.width}x${info.height}, ${info.duration.toFixed(1)}s`);

    report('Creating thumbnail', 5);
    const posterFile = path.join(work, 'poster.jpg');
    await generatePoster(input, posterFile, info.duration);
    await uploadFile(posterFile, keys.poster(id));

    const sbDir = path.join(work, 'storyboard');
    report('Creating seek previews', 8);
    await generateStoryboard(input, sbDir, info.duration, (f) => report('Creating seek previews', 8 + f * 12));
    await uploadDir(sbDir, keys.storyboardDir(id));

    const hlsDir = path.join(work, 'hls');
    await generateHls(input, hlsDir, info, ({ index, total, name, fraction }) =>
      report(`Encoding ${name} (${index + 1} of ${total})`, 20 + ((index + fraction) / total) * 75));

    report('Uploading files', 95);
    await uploadDir(hlsDir, keys.hlsDir(id));

    if (config.deleteOriginal) await deleteObject(original_key);

    await query(`
      UPDATE videos SET status='ready', stage='Done', progress=100, duration=$2, poster_key=$3,
        storyboard_vtt_key=$4, hls_master_key=$5,
        original_key = CASE WHEN $6 THEN NULL ELSE original_key END,
        error_message=NULL, updated_at=NOW()
      WHERE id=$1`,
      [id, info.duration.toFixed(2), keys.poster(id), keys.storyboardVtt(id),
       keys.hlsMaster(id), config.deleteOriginal]);
    log(id, `READY in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  } catch (err) {
    log(id, `FAILED: ${err.message}`);
    await query(`UPDATE videos SET status='failed', stage='Failed', error_message=$2, updated_at=NOW() WHERE id=$1`,
      [id, err.message.slice(0, 2000)]);
  } finally {
    clearInterval(heartbeat);
    await fsp.rm(work, { recursive: true, force: true });
  }
}
