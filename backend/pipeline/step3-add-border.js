import ffmpeg from 'fluent-ffmpeg';

export function addBorder(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const inPath = inputPath.replace(/\\/g, '/');
    const outPath = outputPath.replace(/\\/g, '/');
    ffmpeg(inPath)
      .outputOptions(['-frames:v', '1'])
      .output(outPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`Border failed: ${err.message}`)))
      .run();
  });
}
