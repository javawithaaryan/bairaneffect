import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { runPipeline } from '../pipeline/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, /video\//.test(file.mimetype));
    } else if (file.fieldname === 'images') {
      cb(null, /image\//.test(file.mimetype));
    } else {
      cb(null, true);
    }
  }
});

// In-memory job status store (use Redis in production)
const jobs = {};

router.post('/process', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 20 }
]), async (req, res) => {
  const jobId = uuidv4();
  const videoFile = req.files?.['video']?.[0];
  const imageFiles = req.files?.['images'] || [];

  if (!videoFile) return res.status(400).json({ error: 'Video file required' });

  jobs[jobId] = { status: 'queued', progress: 0, step: 'Queued' };

  res.json({ jobId });

  // Run pipeline async
  runPipeline({
    jobId,
    videoPath: videoFile.path,
    imagePaths: imageFiles.map(f => f.path),
    onProgress: (step, progress) => {
      jobs[jobId] = { status: 'processing', step, progress };
    }
  }).then(outputPath => {
    jobs[jobId] = {
      status: 'done',
      progress: 100,
      step: 'Done',
      outputUrl: `/download/${path.basename(outputPath)}`
    };
    console.log(`✅ Job ${jobId} complete: ${outputPath}`);
  }).catch(err => {
    console.error(`❌ Job ${jobId} failed:`, err.message);
    jobs[jobId] = { status: 'error', step: 'Failed', progress: 0, error: err.message };
    // cleanup uploaded files on error
    try { fs.unlinkSync(videoFile.path); } catch (_) {}
    imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) {} });
  });
});

router.get('/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

export default router;
