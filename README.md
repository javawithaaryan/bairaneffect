# 🎬 Bairan Effect Studio

> **Freeze. Cut. Compose.** — A full-stack video effect tool that applies the Bairan Effect pipeline to any video.

The Bairan Effect:
1. Extracts the **last frame** of your video
2. **Removes its background** using remove.bg AI
3. Adds a **sticker-style border** (white + black outline)
4. Optionally composes a **background image slideshow**
5. **Overlays the sticker** floating over the final composed video

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + CSS (no Tailwind — vanilla custom properties) |
| Backend | Node.js + Express (ESM) |
| Video processing | FFmpeg via `fluent-ffmpeg` |
| Background removal | [remove.bg](https://www.remove.bg/api) REST API |
| File handling | `multer` for uploads |

---

## Project Structure

```
bairan-effect-studio/
├── backend/
│   ├── server.js               # Express entry point
│   ├── routes/process.js       # Upload + job dispatch
│   ├── pipeline/
│   │   ├── index.js            # Pipeline orchestrator
│   │   ├── step1-extract-frame.js
│   │   ├── step2-remove-background.js
│   │   ├── step3-add-border.js
│   │   ├── step4-compose-video.js
│   │   └── create-slideshow.js
│   ├── uploads/                # Temp input storage (auto-created)
│   ├── output/                 # Temp output storage (auto-created)
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css           # Full design system
│   │   └── components/
│   │       ├── UploadZone.jsx
│   │       ├── ProgressTracker.jsx
│   │       └── VideoPreview.jsx
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Node.js** 18+
- **FFmpeg** installed and on your system PATH
  - Windows: download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
- A **remove.bg API key** — get one free at [remove.bg/api](https://www.remove.bg/api) (50 free calls/month)

---

## Setup & Running

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and paste your REMOVE_BG_API_KEY
npm install
npm run dev       # runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev       # runs on http://localhost:5173
```

The frontend Vite dev server proxies `/api` and `/download` to the backend automatically.

---

## Environment Variables

### `backend/.env`
```
REMOVE_BG_API_KEY=your_remove_bg_key_here
PORT=3001
```

### `frontend/.env` (optional, for custom backend URL)
```
VITE_API_URL=https://your-backend.railway.app
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/process` | Upload video + images, start processing job |
| `GET` | `/api/status/:jobId` | Poll job progress |
| `GET` | `/download/:filename` | Download processed video |
| `GET` | `/health` | Health check |

---

## Deployment

### Backend → Railway (recommended — has FFmpeg + long request timeouts)

1. Push `backend/` to GitHub
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set env var: `REMOVE_BG_API_KEY=...`
4. Copy the Railway URL

### Frontend → Vercel

1. Push `frontend/` to GitHub  
2. [vercel.com](https://vercel.com) → Import Project
3. Set env var: `VITE_API_URL=https://your-backend.railway.app`
4. Deploy

> **Note:** Vercel/Netlify Functions have a 10s timeout — too short for video processing. Always use Railway, Render, or a VPS for the backend.

---

## Notes

- The in-memory job store (`jobs` object in `routes/process.js`) is ephemeral — jobs are lost on server restart. For production, swap with **Redis + Bull**.
- Output files accumulate in `backend/output/`. Add a cron job or S3 bucket for cleanup in production.
- Only the first 3 seconds of the original video are used for the intro in the full composition mode.
