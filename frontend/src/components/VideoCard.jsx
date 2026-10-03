import { Link } from 'react-router-dom';
import { mediaUrl } from '../api.js';
import { fmtTime, timeAgo } from '../lib/format.js';
import StatusBadge from './StatusBadge.jsx';

export default function VideoCard({ video }) {
  const ready = video.status === 'ready';
  return (
    <Link to={`/watch/${video.id}`} className="card">
      <div className="card-thumb">
        {ready ? (
          <img src={mediaUrl(video.posterUrl)} alt="" loading="lazy" />
        ) : (
          <div className={`card-placeholder ${video.status}`} aria-hidden="true" />
        )}
        {ready && video.duration != null && (
          <span className="card-duration">{fmtTime(video.duration)}</span>
        )}
      </div>
      <h3 className="card-title">{video.title}</h3>
      <p className="card-meta">
        {!ready && <StatusBadge status={video.status} />}
        <span>{timeAgo(video.createdAt)}</span>
      </p>
    </Link>
  );
}
