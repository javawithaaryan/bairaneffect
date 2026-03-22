# 🎬 Bairan Effect Studio

> Freeze. Cut. Compose.

Upload a video, get back a cinematic effect — freeze frame, background removed, sticker floating over a slideshow of your photos.

---

## What it does

1. Plays your video for the first 3 seconds
2. Freezes on the last frame and bursts open a slideshow behind it
3. Your cutout (background removed) floats as a sticker over everything

---

## Stack

- **Frontend** — React 18 + Vite
- **Backend** — Node.js + Express
- **Video** — FFmpeg
- **Background removal** — remove.bg API

---

## Run locally

You need Node.js 18+ and FFmpeg installed.

**Backend**
```bash
cd backend
cp .env.
# add your REMOVE_BG_API_KEY in .env
npm install
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`
---

## Get a remove.bg API key

Free at [remove.bg/api](https://www.remove.bg/api) — 50 calls/month.
