CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS videos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title               VARCHAR(255) NOT NULL,
    description         TEXT,

    -- uploaded -> processing -> ready | failed
    status              VARCHAR(20) NOT NULL DEFAULT 'uploaded',

    duration            DECIMAL(10,2),          -- seconds

    -- S3 keys
    original_key        TEXT,                   -- can be deleted after processing
    poster_key          TEXT,
    storyboard_vtt_key  TEXT,
    hls_master_key      TEXT,                   -- nullable: unknown until processing finishes

    error_message       TEXT,

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

-- progress tracking (added later; safe on existing tables)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS progress SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
