# ytx-downloader-render (no Docker)
For Render/Heroku-like Node buildpacks where `yt-dlp` isn't preinstalled.

## Deploy (Render)
1. Tạo repo mới trên GitHub, upload toàn bộ nội dung folder này.
2. Render → New Web Service → Connect repo → Build Command: (mặc định) → Start Command: `node server.js`
3. Render sẽ đặt PORT (vd: 10000); server bind `process.env.PORT` tự động.

## Requirements
- `ffmpeg` có sẵn trên Render (Debian image). Nếu thiếu, hãy chuyển sang bản Docker hoặc Cloud Run.

## Test
- `/health`
- `/download?v=<VIDEO_ID>&type=mp3`
- `/download?v=<VIDEO_ID>&type=mp4`
