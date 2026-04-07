import ffmpeg from 'fluent-ffmpeg';

const SCALE_CROP =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

/**
 * Returns video duration in seconds (ffprobe).
 */
export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) {
        return reject(new Error(`Video metadata extraction failed (ffprobe). FFmpeg binary not found or inaccessible: ${err.message}`));
      }
      const duration = parseFloat(meta.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }
      resolve(duration);
    });
  });
}

/**
 * Extracts a frame (duration - 1s) as 1080x1920 PNG to avoid motion blur.
 */
export function extractLastFrame(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) {
        return reject(new Error(`Video metadata extraction failed (ffprobe). FFmpeg binary not found or inaccessible: ${err.message}`));
      }

      const duration = parseFloat(meta.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }

      const seekTime = Math.max(0, duration - 1.0);

      const inPath = videoPath.replace(/\\/g, '/');
      const outPath = outputPath.replace(/\\/g, '/');

      ffmpeg(inPath)
        .seekInput(seekTime)
        .outputOptions(['-frames:v', '1'])
        .videoFilters([SCALE_CROP])
        .output(outPath)
        .on('end', () => resolve())
        .on('error', (e) =>
          reject(new Error(`Frame extraction failed: ${e.message}`))
        )
        .run();
    });
  });
}
