import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLastFrame, getVideoDuration } from './step1-extract-frame.js';
import { removeBackground } from './step2-remove-background.js';
import { addBorder } from './step3-add-border.js';
import { composeVideo } from './step4-compose-video.js';
import { createSlideshow } from './create-slideshow.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../output');

function ts() {
  return new Date().toISOString();
}

function log(jobId, message) {
  console.log(`[${ts()}] [${jobId}] ${message}`);
}

function unlinkQuiet(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Deletes intermediate artifacts; keeps the final MP4.
 */
function cleanupIntermediates(paths) {
  for (const p of paths) {
    unlinkQuiet(p);
  }
}

export async function runPipeline({ jobId, videoPath, imagePaths, onProgress }) {
  const prefix = path.join(OUTPUT_DIR, jobId);
  const framePath = `${prefix}-frame.png`;
  const bgRemovedPath = `${prefix}-bg-removed.png`;
  const borderedPath = `${prefix}-bordered.png`;
  const slideshowPath = `${prefix}-slideshow.mp4`;
  const outputPath = `${prefix}-final.mp4`;

  const intermediates = [framePath, bgRemovedPath, borderedPath];

  try {
    log(jobId, 'Pipeline started');

    onProgress('Extracting last frame', 10);
    try {
      await extractLastFrame(videoPath, framePath);
    } catch (e) {
      throw new Error(`Step 1 (extract frame): ${e.message}`);
    }
    log(jobId, `Frame extracted → ${framePath}`);

    onProgress('Removing background', 30);
    try {
      await removeBackground(framePath, bgRemovedPath);
    } catch (e) {
      throw new Error(`Step 2 (remove.bg): ${e.message}`);
    }
    log(jobId, `Background removed → ${bgRemovedPath}`);

    onProgress('Adding sticker border', 55);
    try {
      await addBorder(bgRemovedPath, borderedPath);
    } catch (e) {
      throw new Error(`Step 3 (border): ${e.message}`);
    }
    log(jobId, `Border added → ${borderedPath}`);

    let duration;
    try {
      duration = await getVideoDuration(videoPath);
    } catch (e) {
      throw new Error(`Duration probe: ${e.message}`);
    }

    const introLen = Math.min(3, duration);
    const tailNeeded = Math.max(0, duration - introLen);
    const slideshowMin = Math.max(10, tailNeeded);

    let middlePath = null;
    if (imagePaths.length > 0) {
      onProgress('Creating image slideshow', 70);
      intermediates.push(slideshowPath);
      try {
        await createSlideshow(imagePaths, slideshowPath, {
          minDurationSeconds: slideshowMin
        });
      } catch (e) {
        throw new Error(`Slideshow: ${e.message}`);
      }
      middlePath = slideshowPath;
      log(jobId, `Slideshow created → ${slideshowPath} (min ${slideshowMin}s)`);
    }

    onProgress('Composing final video', 85);
    try {
      await composeVideo(videoPath, borderedPath, middlePath, outputPath);
    } catch (e) {
      throw new Error(`Step 4 (compose): ${e.message}`);
    }
    log(jobId, `Final video → ${outputPath}`);

    cleanupIntermediates(intermediates);
    onProgress('Done', 100);
    log(jobId, 'Pipeline complete; intermediates removed');

    return outputPath;
  } catch (err) {
    log(jobId, `FAILED: ${err.message}`);
    cleanupIntermediates(intermediates);
    throw err;
  }
}
