import { useState } from 'react';
import UploadZone from './components/UploadZone';
import ProgressTracker from './components/ProgressTracker';
import VideoPreview from './components/VideoPreview';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const DOWNLOAD_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [stage, setStage] = useState('upload'); // upload | processing | done
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [error, setError] = useState(null);

  async function handleSubmit({ videoFile, imageFiles }) {
    setError(null);
    const formData = new FormData();
    formData.append('video', videoFile);
    imageFiles.forEach(f => formData.append('images', f));

    try {
      const res = await fetch(`${API_BASE}/process`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setJobId(data.jobId);
      setStage('processing');
      pollStatus(data.jobId);
    } catch (err) {
      setError(err.message);
    }
  }

  function pollStatus(id) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/status/${id}`);
        const data = await res.json();
        setJobStatus(data);
        if (data.status === 'done') {
          clearInterval(interval);
          setStage('done');
        } else if (data.status === 'error') {
          clearInterval(interval);
          setError(data.error || 'Processing failed');
          setStage('upload');
        }
      } catch {
        clearInterval(interval);
        setError('Lost connection to server');
        setStage('upload');
      }
    }, 1500);
  }

  function handleReset() {
    setStage('upload');
    setJobId(null);
    setJobStatus(null);
    setError(null);
  }

  return (
    <div className="app-shell">
      {/* Film grain overlay */}
      <div className="film-grain" aria-hidden="true" />

      <header>
        <div className="logo-wrap">
          <span className="logo-clapboard">🎬</span>
          <h1 className="logo">BAIRAN<span className="logo-accent">EFFECT</span></h1>
        </div>
        <p className="tagline">Freeze · Cut · Compose</p>
        <p className="sub-tagline">Professional sticker video effects — powered by FFmpeg + remove.bg</p>
      </header>

      <main>
        {error && (
          <div className="error-bar" role="alert">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}

        {stage === 'upload' && <UploadZone onSubmit={handleSubmit} />}
        {stage === 'processing' && <ProgressTracker status={jobStatus} />}
        {stage === 'done' && jobStatus?.outputUrl && (
          <VideoPreview
            outputUrl={`${DOWNLOAD_BASE}${jobStatus.outputUrl}`}
            onReset={handleReset}
          />
        )}
      </main>

      <footer>
        <span>Powered by FFmpeg + remove.bg · Bairan Effect Studio 2026</span>
      </footer>
    </div>
  );
}
