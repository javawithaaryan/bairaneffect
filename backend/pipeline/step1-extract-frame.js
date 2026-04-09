import ffmpeg from 'fluent-ffmpeg';

const SCALE_CROP =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

/**
 * Returns video duration in seconds (ffprobe).
 */
export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      const duration = parseFloat(meta.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }
      resolve(duration);
    });
  });
}

/**
 * Extracts a frame at (duration - 0.1s) as 1080x1920 PNG.
 */
export function extractLastFrame(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));

      const duration = parseFloat(meta.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }

      const seekTime = Math.max(0, duration - 0.1);

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
