# Cloud deployment (no localhost)
Deploy the ad-free yt-dlp + ffmpeg downloader to your own cloud URL.

## Option A — Google Cloud Run (Quick)
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ytx-downloader
gcloud run deploy ytx-downloader   --image gcr.io/YOUR_PROJECT_ID/ytx-downloader   --platform managed --allow-unauthenticated --memory 1Gi --region asia-southeast1   --port 8080
# Note the HTTPS URL returned, e.g. https://ytx-downloader-xxxxx-uc.a.run.app
```

## Option B — Fly.io (Free allowances)
```bash
# Install: https://fly.io/docs/hands-on/install-flyctl/
flyctl auth signup
flyctl launch --no-deploy  # generates app name from fly.toml or prompt
flyctl deploy
# App URL looks like: https://ytx-downloader.fly.dev
```

## Option C — Render (Free tier)
- Connect this repo to Render, pick **Docker** environment, and the `render.yaml` will provision a free web service.
- URL like: https://ytx-downloader.onrender.com

## Option D — Railway
- Create New Project → Deploy from GitHub → Dockerfile auto-build → set service to **web** (port 8080).

## Test
```
curl -I "https://YOUR-URL/download?v=dQw4w9WgXcQ&type=mp3"
curl -I "https://YOUR-URL/download?v=dQw4w9WgXcQ&type=mp4"
```

Then set your extension **Downloader Endpoint** to that URL.
