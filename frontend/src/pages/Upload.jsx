import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../api.js';
import { fmtBytes } from '../lib/format.js';

export default function Upload() {
  const nav = useNavigate();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null); // null = not started
  const [error, setError] = useState('');

  const pick = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) return setError('Choose a video file (MP4, MOV, WebM).');
    setError('');
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const video = await uploadVideo(
        { file, title: title.trim() || file.name, description: description.trim() },
        setProgress
      );
      nav(`/watch/${video.id}`);
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="narrow">
      <div className="page-head"><h1>Upload video</h1></div>

      <form onSubmit={submit}>
        <div
          className={`drop ${over ? 'is-over' : ''} ${file ? 'has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
        >
          <input ref={input} type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files[0])} />
          {file ? (
            <>
              <p className="drop-name">{file.name}</p>
              <p className="muted">{fmtBytes(file.size)}</p>
              {!uploading && (
                <button type="button" className="btn btn-ghost" onClick={() => input.current.click()}>
                  Choose a different file
                </button>
              )}
            </>
          ) : (
            <>
              <p className="drop-title">Drop a video here</p>
              <p className="muted">or</p>
              <button type="button" className="btn" onClick={() => input.current.click()}>Choose file</button>
            </>
          )}
        </div>

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} disabled={uploading} required />
        </label>
        <label className="field">
          <span>Description <em>(optional)</em></span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={uploading} />
        </label>

        {uploading && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${progress * 100}%` }} />
            <span>{progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Saving…'}</span>
          </div>
        )}
        {error && <p className="notice notice-error">{error}</p>}

        <div className="actions">
          <button className="btn btn-primary" disabled={!file || uploading}>
            {uploading ? 'Uploading…' : 'Upload video'}
          </button>
          <p className="muted small">Processing starts after upload and takes a few minutes, depending on length.</p>
        </div>
      </form>
    </div>
  );
}
