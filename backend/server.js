import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import processRouter from './routes/process.js';

config();
console.log("API key loaded:", !!process.env.REMOVE_BG_API_KEY);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Static file serving for output downloads
app.use('/download', express.static(path.join(__dirname, 'output')));

// Ensure temp dirs exist
['uploads', 'output'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

app.use('/api', processRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🎬 Bairan Effect Server running on port ${PORT}`));
