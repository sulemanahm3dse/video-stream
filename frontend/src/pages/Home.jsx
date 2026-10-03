import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listVideos } from '../api.js';
import VideoCard from '../components/VideoCard.jsx';

export default function Home() {
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let timer;
    const load = async () => {
      try {
        const data = await listVideos();
        if (!alive) return;
        setVideos(data);
        setError('');
        // keep refreshing while anything is still being processed
        if (data.some((v) => v.status === 'uploaded' || v.status === 'processing')) {
          timer = setTimeout(load, 4000);
        }
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  if (error) return <p className="notice notice-error">Can't load videos: {error}</p>;
  if (!videos) return <p className="muted">Loading library…</p>;

  return (
    <>
      <div className="page-head">
        <h1>Library</h1>
        <p className="muted">{videos.length} {videos.length === 1 ? 'video' : 'videos'}</p>
      </div>

      {videos.length === 0 ? (
        <div className="empty">
          <p>No videos yet. Upload one and it will appear here once it's processed.</p>
          <Link to="/upload" className="btn btn-primary">Upload video</Link>
        </div>
      ) : (
        <div className="grid">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </>
  );
}
