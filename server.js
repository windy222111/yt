import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000; // Render typically binds here

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

let YTDLP_PATH = "yt-dlp"; // default to PATH if present

async function ensureYtDlp() {
  // Try PATH first
  const which = spawn("which", ["yt-dlp"]);
  let pathBuf = "";
  which.stdout.on("data", (d) => (pathBuf += d.toString()));
  const ok = await new Promise((resolve) => which.on("close", (code) => resolve(code === 0)));
  if (ok && pathBuf.trim()) {
    YTDLP_PATH = pathBuf.trim();
    return;
  }

  // Download static binary to tmp
  const dlURL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
  const outPath = path.join(os.tmpdir(), "yt-dlp");
  if (!fs.existsSync(outPath)) {
    console.log("Downloading yt-dlp binary...");
    const resp = await fetch(dlURL);
    if (!resp.ok) throw new Error("Failed to download yt-dlp");
    const fileStream = fs.createWriteStream(outPath, { mode: 0o755 });
    await new Promise((resolve, reject) => {
      resp.body.pipe(fileStream);
      resp.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    try { fs.chmodSync(outPath, 0o755); } catch {}
  }
  YTDLP_PATH = outPath;
}

await ensureYtDlp();

app.get("/download", async (req, res) => {
  const type = (req.query.type || "mp3").toLowerCase();
  const url = youtubeURLFromParams(req);
  if (!url) return res.status(400).json({ ok:false, error: "Missing v or url" });

  if (type === "mp3") {
    res.setHeader("Content-Type", "audio/mpeg");
    sendAttachment(res, "audio.mp3");

    const ytdlp = spawnChecked(YTDLP_PATH, ["-f", "bestaudio/best", "-o", "-", url], { stdio: ["ignore", "pipe", "inherit"] });
    const ffmpeg = spawnChecked("ffmpeg", ["-i", "pipe:0", "-vn", "-acodec", "libmp3lame", "-b:a", "192k", "-f", "mp3", "pipe:1"], { stdio: ["pipe", "pipe", "inherit"] });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    ffmpeg.on("close", (code) => {
      try { res.end(); } catch {}
    });
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
    const proc = spawnChecked(YTDLP_PATH, args, { stdio: ["ignore", "inherit", "inherit"] });

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
