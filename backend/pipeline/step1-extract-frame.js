import ffmpeg from 'fluent-ffmpeg';

const SCALE_CROP =
  'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920';

/**
 * Returns video duration in seconds using ffprobe
 */
export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) {
        return reject(
          new Error(
            `Video metadata extraction failed (ffprobe): ${err.message}`
          )
        );
      }

      const duration = parseFloat(meta?.format?.duration);

      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }

      resolve(duration);
    });
  });
}

/**
 * Extract a cleaner frame for remove.bg
 * Uses 1.5s before end to avoid blur / fade frames
 */
export function extractLastFrame(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) {
        return reject(
          new Error(
            `Video metadata extraction failed (ffprobe): ${err.message}`
          )
        );
      }

      const duration = parseFloat(meta?.format?.duration);

      if (!Number.isFinite(duration) || duration <= 0) {
        return reject(new Error('Could not determine video duration'));
      }

      // Better stable frame for remove.bg
      const seekTime = Math.max(0.5, duration - 1.5);

      const inPath = videoPath.replace(/\\/g, '/');
      const outPath = outputPath.replace(/\\/g, '/');

      ffmpeg(inPath)
        .seekInput(seekTime)
        .outputOptions([
          '-frames:v',
          '1',
          '-q:v',
          '2'
        ])
        .videoFilters(SCALE_CROP)
        .output(outPath)
        .on('start', (cmd) => {
          console.log('Extracting frame:', cmd);
        })
        .on('end', () => {
          console.log(`Frame extracted at ${seekTime}s`);
          resolve();
        })
        .on('error', (e) => {
          reject(new Error(`Frame extraction failed: ${e.message}`));
        })
        .run();
    });
  });
}