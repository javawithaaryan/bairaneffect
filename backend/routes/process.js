import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { runPipeline } from '../pipeline/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const OUTPUT_DIR = path.join(__dirname, '../output');
const MAX_CONCURRENT_JOBS = Math.max(1, Number(process.env.PIPELINE_CONCURRENCY || 2));
const JOB_TTL_MS = 1000 * 60 * 30;
const OUTPUT_TTL_MS = 1000 * 60 * 60 * 6;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
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

const jobs = new Map();
const queue = [];
let activeJobs = 0;

function unlinkQuiet(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}

function cleanupUploads(videoFile, imageFiles) {
  unlinkQuiet(videoFile?.path);
  imageFiles.forEach((f) => unlinkQuiet(f.path));
}

function setJob(jobId, update) {
  const previous = jobs.get(jobId) || {};
  jobs.set(jobId, { ...previous, ...update, updatedAt: Date.now() });
}

function runNext() {
  if (activeJobs >= MAX_CONCURRENT_JOBS) return;
  const item = queue.shift();
  if (!item) return;
  activeJobs += 1;
  item.run().finally(() => {
    activeJobs -= 1;
    runNext();
  });
}

function enqueue(jobId, task) {
  queue.push({ jobId, run: task });
  setImmediate(runNext);
}

function pruneJobsAndOutputs() {
  const now = Date.now();

  for (const [id, job] of jobs.entries()) {
    if (now - (job.updatedAt || now) > JOB_TTL_MS) jobs.delete(id);
  }

  try {
    for (const name of fs.readdirSync(OUTPUT_DIR)) {
      const p = path.join(OUTPUT_DIR, name);
      const stat = fs.statSync(p);
      if (!stat.isFile()) continue;
      if (now - stat.mtimeMs > OUTPUT_TTL_MS) unlinkQuiet(p);
    }
  } catch (_) {}
}

setInterval(pruneJobsAndOutputs, 1000 * 60 * 10).unref();

router.post('/process', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'images', maxCount: 100 }
]), async (req, res) => {
  const jobId = uuidv4();
  const videoFile = req.files?.['video']?.[0];
  const imageFiles = req.files?.['images'] || [];

  if (!videoFile) return res.status(400).json({ error: 'Video file required' });

  setJob(jobId, {
    status: 'queued',
    progress: 2,
    step: 'Queued',
    queuePosition: queue.length + 1
  });

  res.json({ jobId });

  enqueue(jobId, async () => {
    setJob(jobId, { status: 'processing', step: 'Starting pipeline', progress: 5, queuePosition: 0 });
    try {
      const outputPath = await runPipeline({
        jobId,
        videoPath: videoFile.path,
        imagePaths: imageFiles.map((f) => f.path),
        onProgress: (step, progress) => {
          setJob(jobId, { status: 'processing', step, progress, queuePosition: 0 });
        }
      });

      setJob(jobId, {
        status: 'done',
        progress: 100,
        step: 'Done',
        queuePosition: 0,
        outputUrl: `/download/${path.basename(outputPath)}`
      });
      console.log(`✅ Job ${jobId} complete: ${outputPath}`);
    } catch (err) {
      console.error(`❌ Job ${jobId} failed:`, err.message);
      setJob(jobId, {
        status: 'error',
        step: 'Failed',
        progress: 0,
        queuePosition: 0,
        error: err.message
      });
    } finally {
      cleanupUploads(videoFile, imageFiles);
    }
  });
});

router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'queued' && job.queuePosition !== 0) {
    const idx = queue.findIndex((item) => item.jobId === req.params.jobId);
    if (idx >= 0) job.queuePosition = idx + 1;
  }
  res.json(job);
});

export default router;
