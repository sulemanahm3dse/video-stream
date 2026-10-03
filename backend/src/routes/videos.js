import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { query } from '../db.js';
import { keys } from '../utils/paths.js';
import { uploadFile, getObject } from '../storage.js';

const router = Router();

await fsp.mkdir(config.tmpDir, { recursive: true });
const upload = multer({
  dest: path.resolve(config.tmpDir, 'uploads'),
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }, // 5 GB
  fileFilter: (_req, file, cb) =>
    cb(file.mimetype.startsWith('video/') ? null : new Error('Only video files allowed'), true),
});

const publicShape = (v) => ({
  id: v.id,
  title: v.title,
  description: v.description,
  status: v.status,
  duration: v.duration ? Number(v.duration) : null,
  error: v.error_message,
  stage: v.stage,
  progress: v.progress ?? 0,
  processingStartedAt: v.processing_started_at,
  createdAt: v.created_at,
  ...(v.status === 'ready' && {
    posterUrl: `/media/${v.poster_key}`,
    storyboardUrl: `/media/${v.storyboard_vtt_key}`,
    hlsUrl: `/media/${v.hls_master_key}`,
  }),
});

// POST /api/videos  (multipart: file, title, description)
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const title = (req.body.title || req.file.originalname).slice(0, 255);
    const id = crypto.randomUUID();
    const key = keys.original(id);

    await uploadFile(req.file.path, key);
    await fsp.rm(req.file.path, { force: true });

    const { rows } = await query(
      `INSERT INTO videos (id, title, description, status, stage, original_key)
       VALUES ($1,$2,$3,'uploaded','Queued',$4) RETURNING *`,
      [id, title, req.body.description || null, key]);
    res.status(201).json(publicShape(rows[0]));
  } catch (e) { next(e); }
});

// GET /api/videos
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM videos ORDER BY created_at DESC LIMIT 100');
    res.json(rows.map(publicShape));
  } catch (e) { next(e); }
});

// GET /api/videos/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM videos WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(publicShape(rows[0]));
  } catch (e) { next(e); }
});

// POST /api/videos/:id/retry  (re-queue a failed or stuck video)
router.post('/:id/retry', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE videos SET status='uploaded', stage='Queued', progress=0, error_message=NULL, updated_at=NOW()
       WHERE id=$1 AND status IN ('failed','processing') AND original_key IS NOT NULL RETURNING *`,
      [req.params.id]);
    if (!rows[0]) return res.status(409).json({ error: 'Video cannot be retried (not failed, or original was deleted).' });
    res.json(publicShape(rows[0]));
  } catch (e) { next(e); }
});

// GET /media/<s3-key>  -> proxies playlists, segments, images from S3 (same-origin, no CORS pain)
export const mediaRouter = Router();
mediaRouter.get('/*', async (req, res) => {
  const key = req.params[0];
  if (!key.startsWith('videos/') || key.includes('..') || key.includes('/original/'))
    return res.status(403).end();
  try {
    const obj = await getObject(key, req.headers.range);
    res.status(req.headers.range ? 206 : 200);
    res.set({
      'Content-Type': obj.ContentType,
      'Content-Length': obj.ContentLength,
      ...(obj.ContentRange && { 'Content-Range': obj.ContentRange }),
      'Accept-Ranges': 'bytes',
      'Cache-Control': key.endsWith('.m3u8') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    obj.Body.pipe(res);
  } catch {
    res.status(404).end();
  }
});

export default router;
