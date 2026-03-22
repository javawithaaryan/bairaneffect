import { spawn } from 'child_process';

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, {
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

function slideshowChainDuration(numSlides) {
  const perImage = 1.5;
  const fade = 0.4;
  if (numSlides <= 0) return 0;
  if (numSlides === 1) return perImage;
  return numSlides * perImage - (numSlides - 1) * fade;
}

function expandImagePaths(imagePaths, minDurationSeconds) {
  const expanded = [];
  if (!imagePaths.length) return expanded;
  do {
    expanded.push(...imagePaths);
  } while (slideshowChainDuration(expanded.length) < minDurationSeconds);
  return expanded;
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

    const perImage = 1.5;
    const fadeDuration = 0.4;
    const expanded = expandImagePaths(imagePaths, minDurationSeconds);
    const out = toPosix(outputPath);

    (async () => {
      try {
        if (expanded.length === 1) {
          await runFfmpeg([
            '-y',
            '-loop',
            '1',
            '-t',
            String(minDurationSeconds),
            '-i',
            toPosix(expanded[0]),
            '-vf',
            'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p',
            '-an',
            '-c:v',
            'libx264',
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

        const args = ['-y'];
        const hold = perImage + fadeDuration;
        expanded.forEach((img) => {
          args.push('-loop', '1', '-t', String(hold), '-i', toPosix(img));
        });

        let fc = '';
        for (let i = 0; i < expanded.length; i += 1) {
          fc += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p[s${i}];`;
        }

        let prev = '[s0]';
        let offset = perImage - fadeDuration;
        for (let i = 1; i < expanded.length; i += 1) {
          const label = i === expanded.length - 1 ? '[vraw]' : `[x${i}]`;
          fc += `${prev}[s${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}${label};`;
          prev = label;
          offset += perImage - fadeDuration;
        }

        fc += `[vraw]trim=duration=${minDurationSeconds},setpts=PTS-STARTPTS,format=yuv420p[vout]`;

        args.push(
          '-filter_complex',
          fc,
          '-map',
          '[vout]',
          '-an',
          '-c:v',
          'libx264',
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
