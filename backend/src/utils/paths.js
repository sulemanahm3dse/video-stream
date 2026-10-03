// Single source of truth for the S3 layout.
export const keys = {
  original: (id) => `videos/${id}/original/original.mp4`,
  poster: (id) => `videos/${id}/thumbnail/poster.jpg`,
  storyboardDir: (id) => `videos/${id}/storyboard`,
  storyboardVtt: (id) => `videos/${id}/storyboard/storyboard.vtt`,
  hlsDir: (id) => `videos/${id}/hls`,
  hlsMaster: (id) => `videos/${id}/hls/master.m3u8`,
};
