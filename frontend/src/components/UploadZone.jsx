import { useEffect, useState, useRef, useCallback } from 'react';
import VirtualImageGrid from './VirtualImageGrid';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadZone({ onSubmit }) {
  const [videoFile, setVideoFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoPrev, setVideoPrev] = useState(null);
  const videoRef = useRef();
  const imagesRef = useRef();
  const MAX_IMAGES = 100;

  const setVideo = useCallback((file) => {
    if (!file) return;
    setVideoFile(file);
    if (videoPrev) URL.revokeObjectURL(videoPrev);
    setVideoPrev(URL.createObjectURL(file));
  }, [videoPrev]);

  useEffect(() => () => {
    if (videoPrev) URL.revokeObjectURL(videoPrev);
  }, [videoPrev]);

  function appendImages(newFiles) {
    setImageFiles((prev) => {
      const merged = [...prev, ...newFiles];
      return merged.slice(0, MAX_IMAGES);
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files];
    const video = files.find(f => f.type.startsWith('video/'));
    const images = files.filter(f => f.type.startsWith('image/'));
    if (video) setVideo(video);
    if (images.length) appendImages(images);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!videoFile) return;
    setLoading(true);
    await onSubmit({ videoFile, imageFiles });
    setLoading(false);
  }

  function removeImage(idx) {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <form className="upload-zone" onSubmit={handleSubmit} noValidate>
      {/* ── Video Drop Area ── */}
      <div
        id="video-drop-zone"
        className={`drop-area ${dragging ? 'dragging' : ''} ${videoFile ? 'has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => videoRef.current.click()}
        role="button"
        aria-label="Drop video file here or click to select"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && videoRef.current.click()}
      >
        <input
          ref={videoRef}
          id="video-file-input"
          type="file"
          accept="video/*"
          hidden
          onChange={e => setVideo(e.target.files[0])}
        />

        {videoFile ? (
          <div className="file-info">
            {videoPrev && (
              <video
                src={videoPrev}
                className="video-thumb"
                muted
                playsInline
                onMouseEnter={e => e.target.play()}
                onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
              />
            )}
            <div className="file-meta">
              <span className="file-name">📽 {videoFile.name}</span>
              <span className="file-size">{formatSize(videoFile.size)}</span>
              <span className="file-change">Click to change</span>
            </div>
          </div>
        ) : (
          <div className="drop-placeholder">
            <div className="drop-icon-wrap">
              <span className="drop-icon">↓</span>
            </div>
            <p>Drop your video here</p>
            <small>MP4 · MOV · AVI · WebM — up to 200 MB</small>
          </div>
        )}
      </div>

      {/* ── Slideshow Images (optional) ── */}
      <div className="images-section">
        <div className="images-header">
          <label htmlFor="images-file-input">
            Slideshow Images <span className="optional">optional</span>
          </label>
          <button
            type="button"
            id="add-images-btn"
            className="btn-outline btn-sm"
            onClick={() => imagesRef.current.click()}
          >
            + Add Images
          </button>
          <input
            ref={imagesRef}
            id="images-file-input"
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={e => appendImages([...e.target.files])}
          />
        </div>

        {imageFiles.length > 0 && (
          <VirtualImageGrid files={imageFiles} onRemove={removeImage} />
        )}

        {imageFiles.length === 0 && (
          <p className="images-hint">
            Add background images to create a freeze-frame slideshow behind your sticker.
          </p>
        )}
        {imageFiles.length > 0 && <p className="images-hint">Selected {imageFiles.length} / {MAX_IMAGES} images.</p>}
      </div>

      {/* ── Submit ── */}
      <button
        id="process-btn"
        type="submit"
        className="btn-primary btn-full"
        disabled={!videoFile || loading}
      >
        {loading ? (
          <span className="btn-loading"><span className="spinner" />Uploading…</span>
        ) : (
          'Process Video →'
        )}
      </button>
    </form>
  );
}
