# Video Platform (HLS chunking, Node.js)

Upload → S3/MinIO → worker (FFmpeg) → poster + storyboard + HLS (360p/480p/720p/1080p) → play via hls.js.

## Structure
```
video-platform/
├── docker-compose.yml        Postgres + MinIO
├── sql/schema.sql            videos table
├── public/index.html         tiny upload + player UI
└── src/
    ├── server.js             Express API (+ static UI)
    ├── worker.js             polling worker (run separately)
    ├── config.js             env + rendition ladder
    ├── db.js                 pg pool
    ├── storage.js            S3 helpers
    ├── routes/videos.js      upload/list/get + /media proxy
    ├── services/ffmpeg.js    probe, poster, storyboard, HLS
    ├── services/processor.js job pipeline (status updates)
    └── utils/{paths,initDb}.js
```

## Run
Requires Node 18+, Docker, and `ffmpeg`/`ffprobe` on PATH.
```bash
docker compose up -d
npm install
npm run db:init      # creates tables + bucket
npm start            # terminal 1: API on :3000
npm run worker       # terminal 2: processor
```
Open http://localhost:3000, upload a video, wait for `ready`, press play.

## API
- `POST /api/videos`  multipart `file`, `title`, `description`
- `GET  /api/videos`, `GET /api/videos/:id`
- `GET  /media/videos/{id}/hls/master.m3u8` (+ segments, poster, storyboard)

## Notes
- `hls_master_key` is nullable (the spec had NOT NULL, but it's unknown until processing finishes).
- `/media` blocks `original/` so only processed files are public.
- Set `DELETE_ORIGINAL_AFTER_PROCESSING=true` to drop the source after success.
- Production: serve `/media` via CDN/presigned URLs and add auth.

## FFmpeg on Fedora
Fedora's default `ffmpeg-free` has no `libx264`. The worker falls back to `libopenh264`
(works, but larger files / lower quality). For best results install the full build:
```bash
sudo dnf install https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
sudo dnf swap ffmpeg-free ffmpeg --allowerasing
ffmpeg -encoders | grep 264     # should list libx264
```
