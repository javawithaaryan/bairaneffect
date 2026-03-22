import { spawn } from 'child_process';
import fs from 'fs';

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

function unlinkQuiet(p) {
  try {
    fs.unlinkSync(p);
  } catch (_) {
    /* ignore */
  }
}

/**
 * PASS 1: background (intro + optional reveal + slideshow, or full scaled video).
 * PASS 2: sticker overlay (~950px wide, bottom-centered, slide-up, soft shadow).
 *
 * Output: 1080x1920, 30fps, H.264, yuv420p. Scale/crop only — never pad.
 */
export function composeVideo(videoPath, stickerPath, middlePath, outputPath) {
  return new Promise((resolve, reject) => {
    (async () => {
      const video = toPosix(videoPath);
      const sticker = toPosix(stickerPath);
      const outFinal = toPosix(outputPath);
      const base = outFinal.replace(/\.mp4$/i, '');
      const introMp4 = `${base}-pass1-intro.mp4`;
      const freezePng = `${base}-pass1-freeze.png`;
      const freezeMp4 = `${base}-pass1-freeze.mp4`;
      const bgMp4 = `${base}-pass1-bg.mp4`;

      const hasMiddle = Boolean(middlePath && fs.existsSync(middlePath));
      const slide = hasMiddle ? toPosix(middlePath) : null;

      const tailMp4 = `${base}-pass1-tail.mp4`;

      const cleanupPass1 = () => {
        unlinkQuiet(introMp4);
        unlinkQuiet(freezePng);
        unlinkQuiet(freezeMp4);
        unlinkQuiet(tailMp4);
        unlinkQuiet(bgMp4);
      };

      try {
        // Duration probe via ffprobe (spawn, avoids extra import cycle)
        const probeArgs = [
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          video
        ];
        const probe = await new Promise((res, rej) => {
          const child = spawn('ffprobe', probeArgs, {
            stdio: ['ignore', 'pipe', 'pipe']
          });
          let out = '';
          let err = '';
          child.stdout.on('data', (d) => {
            out += d.toString();
          });
          child.stderr.on('data', (d) => {
            err += d.toString();
          });
          child.on('error', rej);
          child.on('close', (code) => {
            if (code !== 0) {
              rej(new Error(err.trim() || 'ffprobe failed'));
              return;
            }
            const d = parseFloat(out.trim());
            if (!Number.isFinite(d) || d <= 0) {
              rej(new Error('ffprobe returned invalid duration'));
              return;
            }
            res(d);
          });
        });

        const duration = probe;
        if (!Number.isFinite(duration) || duration <= 0) {
          throw new Error('Invalid video duration');
        }

        const introLen = Math.min(3, duration);
        const tailLen = Math.max(0, duration - introLen);
        const stickerStart = introLen;
        const animWindow = Math.min(
          0.5,
          Math.max(0.001, duration - stickerStart)
        );

        const vfScale =
          'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p';

        // —— PASS 1 ——
        if (hasMiddle && tailLen >= 0.5) {
          const trans = 0.8;

          await runFfmpeg([
            '-y',
            '-i',
            video,
            '-vf',
            `trim=duration=${introLen},setpts=PTS-STARTPTS,${vfScale}`,
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            introMp4
          ]);

          await runFfmpeg([
            '-y',
            '-sseof',
            '-0.05',
            '-i',
            introMp4,
            '-vf',
            vfScale,
            '-frames:v',
            '1',
            freezePng
          ]);

          await runFfmpeg([
            '-y',
            '-loop',
            '1',
            '-i',
            freezePng,
            '-t',
            String(trans),
            '-vf',
            'fps=30,format=yuv420p',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            freezeMp4
          ]);

          const fcTail =
            `[0:v][1:v]xfade=transition=circleopen:duration=${trans}:offset=0,format=yuv420p[xf];` +
            `[xf]trim=duration=${tailLen},setpts=PTS-STARTPTS[vtail]`;

          await runFfmpeg([
            '-y',
            '-i',
            freezeMp4,
            '-i',
            slide,
            '-filter_complex',
            fcTail,
            '-map',
            '[vtail]',
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            tailMp4
          ]);

          await runFfmpeg([
            '-y',
            '-i',
            introMp4,
            '-i',
            tailMp4,
            '-filter_complex',
            '[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]',
            '-map',
            '[v]',
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            '-t',
            String(duration),
            bgMp4
          ]);
        } else if (hasMiddle && tailLen > 0) {
          await runFfmpeg([
            '-y',
            '-i',
            video,
            '-vf',
            `trim=duration=${introLen},setpts=PTS-STARTPTS,${vfScale}`,
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            introMp4
          ]);

          const fcShort =
            `[1:v]trim=duration=${tailLen},setpts=PTS-STARTPTS,${vfScale}[sl];` +
            `[0:v][sl]concat=n=2:v=1:a=0,format=yuv420p[v]`;

          await runFfmpeg([
            '-y',
            '-i',
            introMp4,
            '-i',
            slide,
            '-filter_complex',
            fcShort,
            '-map',
            '[v]',
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            '-t',
            String(duration),
            bgMp4
          ]);
        } else if (hasMiddle) {
          await runFfmpeg([
            '-y',
            '-i',
            video,
            '-vf',
            `trim=duration=${duration},setpts=PTS-STARTPTS,${vfScale}`,
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            '-t',
            String(duration),
            bgMp4
          ]);
        } else {
          await runFfmpeg([
            '-y',
            '-i',
            video,
            '-vf',
            vfScale,
            '-an',
            '-c:v',
            'libx264',
            '-pix_fmt',
            'yuv420p',
            '-r',
            '30',
            '-movflags',
            '+faststart',
            '-t',
            String(duration),
            bgMp4
          ]);
        }

        const yMain = `if(between(t\\,${stickerStart}\\,${stickerStart + animWindow})\\,H-(h-120)*((t-${stickerStart})/${animWindow})\\,H-h+120)`;
        const ySh = `if(between(t\\,${stickerStart}\\,${stickerStart + animWindow})\\,H-(h-120)*((t-${stickerStart})/${animWindow})+18\\,H-h+120+18)`;

        const fcPass2 =
          `[1:v]scale=950:-1,setsar=1,format=rgba[stk];` +
          `[stk]split=2[im][shsrc];` +
          `[shsrc]geq=r=0:g=0:b=0:a='0.45*alpha(X,Y)',boxblur=3:1[sh];` +
          `[0:v][sh]overlay=x='(W-w)/2+14':y='${ySh}':enable='between(t\\,${stickerStart}\\,999)'[t0];` +
          `[t0][im]overlay=x='(W-w)/2':y='${yMain}':enable='between(t\\,${stickerStart}\\,999)'[outv]`;

        await runFfmpeg([
          '-y',
          '-i', bgMp4,
          '-loop', '1',
          '-i', sticker,
          '-i', video,
          '-filter_complex', fcPass2,
          '-map', '[outv]',
          '-map', '2:a?',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-movflags', '+faststart',
          '-shortest',
          '-t', String(duration),
          outFinal
        ]);

        cleanupPass1();
        resolve();
      } catch (e) {
        cleanupPass1();
        reject(
          e instanceof Error ? e : new Error(String(e))
        );
      }
    })();
  });
}
