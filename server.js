const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 8080; // Cloud defaults to 8080 (Fly/Render can override)

app.use(cors());

app.get("/health", (req, res) => res.json({ ok: true }));

function youtubeURLFromParams(req) {
  const v = (req.query.v || "").toString().trim();
  const url = (req.query.url || "").toString().trim();
  if (url) return url;
  if (!v) return null;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(v)}`;
}

function spawnChecked(cmd, args, opts) {
  const p = spawn(cmd, args, opts);
  p.on("error", (err) => console.error("Spawn error:", err));
  return p;
}

function sendAttachment(res, filename) {
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
}

// Stream MP3 using yt-dlp -> ffmpeg pipeline (no temp files)
app.get("/download", async (req, res) => {
  const type = (req.query.type || "mp3").toLowerCase();
  const url = youtubeURLFromParams(req);
  if (!url) return res.status(400).json({ ok:false, error: "Missing v or url" });

  if (type === "mp3") {
    res.setHeader("Content-Type", "audio/mpeg");
    sendAttachment(res, "audio.mp3");

    const ytdlp = spawnChecked("yt-dlp", ["-f", "bestaudio/best", "-o", "-", url], { stdio: ["ignore", "pipe", "inherit"] });
    const ffmpeg = spawnChecked("ffmpeg", ["-i", "pipe:0", "-vn", "-acodec", "libmp3lame", "-b:a", "192k", "-f", "mp3", "pipe:1"], { stdio: ["pipe", "pipe", "inherit"] });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    ffmpeg.on("close", () => res.end());
    return;
  }

  if (type === "mp4") {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ytx-"));
    const fname = crypto.randomBytes(6).toString("hex") + ".mp4";
    const outPath = path.join(tmpDir, fname);

    const args = [
      "-f", "bv*[ext=mp4][height<=720]+ba[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", outPath,
      url
    ];
    const proc = spawnChecked("yt-dlp", args, { stdio: ["ignore", "inherit", "inherit"] });

    proc.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outPath)) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        return res.status(500).json({ ok:false, error:"Failed to prepare MP4" });
      }
      res.setHeader("Content-Type", "video/mp4");
      sendAttachment(res, "video.mp4");
      const stream = fs.createReadStream(outPath);
      stream.pipe(res);
      stream.on("close", () => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      });
      stream.on("error", () => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      });
    });
    return;
  }

  return res.status(400).json({ ok:false, error: "Unknown type; use mp3 or mp4" });
});

app.listen(PORT, () => console.log(`ytx-downloader-server running on port ${PORT}`));
