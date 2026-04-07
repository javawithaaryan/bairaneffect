import ffmpeg from 'fluent-ffmpeg';

export function addBorder(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const inPath = inputPath.replace(/\\/g, '/');
    const outPath = outputPath.replace(/\\/g, '/');
    ffmpeg(inPath)
      .videoFilters([
        // Keep clean cutout, smooth harsh edges slightly (no visible border).
        'format=rgba',
        'unsharp=3:3:0.4:3:3:0.0'
      ])
      .outputOptions(['-frames:v', '1'])
      .output(outPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Cutout polish failed: ${err.message}`)))
      .run();
  });
}
