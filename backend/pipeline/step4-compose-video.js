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
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-4000) || `ffmpeg exited with code ${code}`));
    });
  });
}

function unlinkQuiet(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

export function composeVideo(videoPath, stickerPath, middlePath, outputPath) {
  return new Promise((resolve, reject) => {
    (async () => {
      const video    = toPosix(videoPath);
      const sticker  = toPosix(stickerPath);
      const outFinal = toPosix(outputPath);
      const base     = outFinal.replace(/\.mp4$/i, '');
      const introMp4  = `${base}-pass1-intro.mp4`;
      const freezePng = `${base}-pass1-freeze.png`;
      const freezeMp4 = `${base}-pass1-freeze.mp4`;
      const tailMp4   = `${base}-pass1-tail.mp4`;
      const bgMp4     = `${base}-pass1-bg.mp4`;

      const hasMiddle = Boolean(middlePath && fs.existsSync(middlePath));
      const slide     = hasMiddle ? toPosix(middlePath) : null;

      const cleanupPass1 = () => {
        [introMp4, freezePng, freezeMp4, tailMp4, bgMp4].forEach(unlinkQuiet);
      };

      try {
        // ── probe duration ───────────────────────────────────────────────
        const duration = await new Promise((res, rej) => {
          const child = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            video
          ], { stdio: ['ignore', 'pipe', 'pipe'] });
          let out = '', err = '';
          child.stdout.on('data', d => out += d);
          child.stderr.on('data', d => err += d);
          child.on('error', rej);
          child.on('close', code => {
            if (code !== 0) return rej(new Error(err.trim() || 'ffprobe failed'));
            const d = parseFloat(out.trim());
            if (!Number.isFinite(d) || d <= 0) return rej(new Error('ffprobe returned invalid duration'));
            res(d);
          });
        });

        const introLen     = Math.min(3, duration);
        const tailLen      = Math.max(0, duration - introLen);
        const stickerStart = introLen;
        const animWindow   = Math.min(0.65, Math.max(0.001, duration - stickerStart));
        const freezeWindow = 0.3;

        const vfScale = 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p';

        // ── PASS 1: build background ─────────────────────────────────────
        if (hasMiddle && tailLen >= 0.5) {
          const trans = 1.0;

          // intro clip (first 3s of original video)
          await runFfmpeg(['-y', '-i', video,
            '-vf', `trim=duration=${introLen},setpts=PTS-STARTPTS,${vfScale}`,
            '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart', introMp4]);

          // extract last frame of intro as PNG
          await runFfmpeg(['-y', '-sseof', '-0.05', '-i', introMp4,
            '-vf', vfScale, '-frames:v', '1', freezePng]);

          // Build a cinematic freeze plate with quick pulse + subtle blur.
          await runFfmpeg(['-y', '-loop', '1', '-i', freezePng,
            '-t', String(trans + freezeWindow),
            '-vf', `fps=30,` +
              `eq=brightness='if(lt(t,0.12),0.24,0)':saturation='if(lt(t,0.18),1.5,1)',` +
              `boxblur='if(lt(t,0.3),2,0)':1,` +
              `scale=iw*'1+0.018*max(0,1-t/0.4)':ih*'1+0.018*max(0,1-t/0.4)',` +
              `crop=1080:1920,format=yuv420p`,
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart', freezeMp4]);

          // Center-opening reveal from freeze -> slideshow.
          await runFfmpeg(['-y', '-i', freezeMp4, '-i', slide,
            '-filter_complex',
              `[1:v]fps=30,format=yuv420p[sl];` +
              `[0:v][sl]xfade=transition=horzopen:duration=${trans}:offset=${freezeWindow},` +
              `tmix=frames=2:weights='1 1',format=yuv420p[xf];` +
              `[xf]trim=duration=${tailLen},setpts=PTS-STARTPTS[vtail]`,
            '-map', '[vtail]', '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart', tailMp4]);

          // concat intro + tail into full background
          await runFfmpeg(['-y', '-i', introMp4, '-i', tailMp4,
            '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0,format=yuv420p[v]',
            '-map', '[v]', '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart',
            '-t', String(duration), bgMp4]);

        } else if (hasMiddle && tailLen > 0) {
          await runFfmpeg(['-y', '-i', video,
            '-vf', `trim=duration=${introLen},setpts=PTS-STARTPTS,${vfScale}`,
            '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart', introMp4]);

          await runFfmpeg(['-y', '-i', introMp4, '-i', slide,
            '-filter_complex',
              `[1:v]trim=duration=${tailLen},setpts=PTS-STARTPTS,${vfScale}[sl];` +
              `[0:v][sl]concat=n=2:v=1:a=0,format=yuv420p[v]`,
            '-map', '[v]', '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart',
            '-t', String(duration), bgMp4]);

        } else {
          // no slideshow — scaled original only
          await runFfmpeg(['-y', '-i', video,
            '-vf', vfScale, '-an',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
            '-r', '30', '-movflags', '+faststart',
            '-t', String(duration), bgMp4]);
        }

        // ── PASS 2: sticker overlay ──────────────────────────────────────
        // 680px wide — fills ~63% of 1080px frame
        // Background visible on both sides (~200px each side)
        // Slide-up animation + soft drop shadow
        const stickerW = 680;

        const yBase = `H-h+90+2*sin(2.2*(t-${stickerStart}))`;
        const yMain = `if(between(t\\,${stickerStart}\\,${stickerStart + animWindow})\\,` +
          `H-(h-90)*((t-${stickerStart})/${animWindow})\\,${yBase})`;
        const ySh = `if(between(t\\,${stickerStart}\\,${stickerStart + animWindow})\\,` +
          `H-(h-90)*((t-${stickerStart})/${animWindow})+22\\,${yBase}+22)`;

        const fcPass2 =
          `[1:v]scale='if(lt(t,${stickerStart + animWindow}),${stickerW}*(0.92+0.08*min(1,(t-${stickerStart})/${animWindow})),${stickerW})':-1,setsar=1,format=rgba[stk];` +
          `[stk]split=2[im][shsrc];` +
          `[shsrc]geq=r=0:g=0:b=0:a='0.35*alpha(X,Y)',boxblur=10:3[sh];` +
          `[0:v][sh]overlay=x='(W-w)/2+16':y='${ySh}':enable='between(t\\,${stickerStart}\\,999)'[t0];` +
          `[t0][im]overlay=x='(W-w)/2':y='${yMain}':enable='between(t\\,${stickerStart}\\,999)'[outv]`;

        await runFfmpeg([
          '-y',
          '-i', bgMp4,
          '-loop', '1', '-i', sticker,
          '-i', video,
          '-filter_complex', fcPass2,
          '-map', '[outv]',
          '-map', '2:a?',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '19',
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
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}