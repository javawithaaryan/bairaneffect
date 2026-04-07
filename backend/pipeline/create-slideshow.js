import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(stderr.slice(-4000) || `ffmpeg exited with code ${code}`)
        );
      }
    });
  });
}

function slideshowChainDuration(numSlides, perImage, fade) {
  if (numSlides <= 0) return 0;
  if (numSlides === 1) return perImage;
  return numSlides * perImage - (numSlides - 1) * fade;
}

function buildSequencedPaths(imagePaths, minDurationSeconds, perImage, fade, maxSlides = 100) {
  if (!imagePaths.length) return [];
  const targetSlides = Math.min(
    maxSlides,
    Math.max(imagePaths.length, Math.ceil((minDurationSeconds - fade) / Math.max(0.1, perImage - fade)))
  );
  const out = [];
  for (let i = 0; i < targetSlides; i += 1) out.push(imagePaths[i % imagePaths.length]);
  return out;
}

/**
 * 1080x1920 @ 30fps, 1.5s per image, 0.4s xfade; loops images to reach min duration.
 * @param {string[]} imagePaths
 * @param {string} outputPath
 * @param {{ minDurationSeconds: number }} options
 */
export function createSlideshow(imagePaths, outputPath, options = {}) {
  const minDurationSeconds = Math.max(
    0.5,
    Number(options.minDurationSeconds) || 10
  );

  return new Promise((resolve, reject) => {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) {
      return reject(new Error('No images provided'));
    }

    const sourceCount = imagePaths.length;
    const perImage = sourceCount > 70 ? 1.2 : sourceCount > 35 ? 1.3 : 1.4;
    const fadeDuration = sourceCount > 70 ? 0.3 : 0.4;
    const sequenced = buildSequencedPaths(imagePaths, minDurationSeconds, perImage, fadeDuration, 100);
    const out = toPosix(outputPath);

    (async () => {
      try {
        if (sequenced.length === 1) {
          await runFfmpeg([
            '-y',
            '-loop',
            '1',
            '-t',
            String(minDurationSeconds),
            '-i',
            toPosix(sequenced[0]),
            '-vf',
            'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p',
            '-an',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '20',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            out
          ]);
          return resolve();
        }

        const args = ['-y', '-threads', String(Math.max(2, Number(process.env.FFMPEG_THREADS) || 4))];
        const hold = perImage + fadeDuration;
        sequenced.forEach((img) => {
          args.push('-loop', '1', '-t', String(hold), '-i', toPosix(img));
        });

        let fc = '';
        for (let i = 0; i < sequenced.length; i += 1) {
          fc += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[s${i}];`;
        }

        let prev = '[s0]';
        let offset = perImage - fadeDuration;
        for (let i = 1; i < sequenced.length; i += 1) {
          const label = i === sequenced.length - 1 ? '[vraw]' : `[x${i}]`;
          fc += `${prev}[s${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}${label};`;
          prev = label;
          offset += perImage - fadeDuration;
        }

        const chainDuration = slideshowChainDuration(sequenced.length, perImage, fadeDuration);
        fc += `[vraw]trim=duration=${Math.min(chainDuration, minDurationSeconds + 1.5)},setpts=PTS-STARTPTS,format=yuv420p[vout]`;

        args.push(
          '-filter_complex',
          fc,
          '-map',
          '[vout]',
          '-an',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-r',
          '30',
          '-movflags',
          '+faststart',
          out
        );

        await runFfmpeg(args);
        resolve();
      } catch (e) {
        reject(new Error(`Slideshow failed: ${e.message}`));
      }
    })();
  });
}
