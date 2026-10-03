import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const bool = (v, d) => (v === undefined ? d : v === 'true');

export const config = {
  port: num(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL,
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
  },
  ffmpeg: {
    path: process.env.FFMPEG_PATH || 'ffmpeg',
    probePath: process.env.FFPROBE_PATH || 'ffprobe',
    segmentSeconds: num(process.env.HLS_SEGMENT_SECONDS, 6),
    preset: process.env.HLS_PRESET || 'veryfast', // ultrafast = much faster, bigger files
    threads: num(process.env.FFMPEG_THREADS, 0),     // 0 = use all cores
    storyboardInterval: num(process.env.STORYBOARD_INTERVAL_SECONDS, 10),
  },
  deleteOriginal: bool(process.env.DELETE_ORIGINAL_AFTER_PROCESSING, false),
  staleMinutes: num(process.env.STALE_JOB_MINUTES, 5), // re-queue 'processing' jobs with no heartbeat
  workerPollMs: num(process.env.WORKER_POLL_MS, 3000),
  tmpDir: process.env.TMP_DIR || './tmp',
};

// Quality ladder. Renditions taller than the source are skipped.
export const RENDITIONS = [
  { name: '360p',  height: 360,  videoBitrate: '800k',  audioBitrate: '96k',  bandwidth: 900000 },
  { name: '480p',  height: 480,  videoBitrate: '1400k', audioBitrate: '128k', bandwidth: 1600000 },
  { name: '720p',  height: 720,  videoBitrate: '2800k', audioBitrate: '128k', bandwidth: 3000000 },
  { name: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k', bandwidth: 5300000 },
];
