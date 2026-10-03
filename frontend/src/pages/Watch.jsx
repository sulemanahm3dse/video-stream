import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getVideo, mediaUrl } from '../api.js';
import { timeAgo } from '../lib/format.js';
import Player from '../components/Player.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let timer;
    setVideo(null);
    setError('');
    const load = async () => {
      try {
        const v = await getVideo(id);
        if (!alive) return;
        setVideo(v);
        if (v.status === 'uploaded' || v.status === 'processing') timer = setTimeout(load, 3000);
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [id]);

  if (error) return <p className="notice notice-error">{error} <Link to="/">Back to the library</Link></p>;
  if (!video) return <p className="muted">Loading…</p>;

  return (
    <article className="watch">
      {video.status === 'ready' ? (
        <Player
          key={video.id}
          src={mediaUrl(video.hlsUrl)}
          poster={mediaUrl(video.posterUrl)}
          storyboard={mediaUrl(video.storyboardUrl)}
        />
      ) : video.status === 'failed' ? (
        <div className="stage stage-failed">
          <h2>Processing failed</h2>
          <p>{video.error || 'The video could not be converted.'}</p>
          <Link to="/upload" className="btn">Upload again</Link>
        </div>
      ) : (
        <div className="stage">
          <h2>{video.status === 'uploaded' ? 'Waiting in the queue' : 'Processing your video'}</h2>
          <p>Creating the thumbnail, the seek-bar previews and each quality level. This page updates when it's ready.</p>
          <div className="indeterminate" aria-hidden="true" />
        </div>
      )}

      <h1 className="watch-title">{video.title}</h1>
      <p className="card-meta">
        <StatusBadge status={video.status} />
        <span>Uploaded {timeAgo(video.createdAt)}</span>
      </p>
      {video.description && <p className="watch-desc">{video.description}</p>}
    </article>
  );
}
