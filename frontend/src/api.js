const BASE = import.meta.env.VITE_API_URL || '';

/** Turn a backend path like /media/... into a full URL. */
export const mediaUrl = (path) => (path ? `${BASE}${path}` : null);

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const listVideos = () => fetch(`${BASE}/api/videos`).then(json);
export const getVideo = (id) => fetch(`${BASE}/api/videos/${id}`).then(json);

/** Upload with progress. onProgress receives 0..1. */
export function uploadVideo({ file, title, description }, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title);
    if (description) fd.append('description', description);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}/api/videos`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      xhr.status >= 200 && xhr.status < 300
        ? resolve(body)
        : reject(new Error(body.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error. Check that the API is running.'));
    xhr.send(fd);
  });
}
