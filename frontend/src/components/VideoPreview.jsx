export default function VideoPreview({ outputUrl, onReset }) {
  return (
    <div className="video-preview">
      <div className="preview-badge">✨ Ready</div>
      <h2>Your video is ready!</h2>

      <div className="preview-player-wrap">
        <video
          id="output-video-player"
          src={outputUrl}
          controls
          autoPlay
          loop
          playsInline
          className="preview-player"
        />
        <div className="preview-scanlines" aria-hidden="true" />
      </div>

      <div className="action-row">
        <a
          id="download-btn"
          href={outputUrl}
          download="bairan-effect-output.mp4"
          className="btn-primary"
        >
          ⬇ Download MP4
        </a>
        <button
          id="process-another-btn"
          className="btn-outline"
          onClick={onReset}
        >
          Process Another →
        </button>
      </div>

      <p className="preview-caption">
        Right-click the video to save, or use the Download button above.
      </p>
    </div>
  );
}
