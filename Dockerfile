# Dockerfile for cloud deployment (ad-free)
FROM debian:stable-slim

# Install dependencies: curl, node, ffmpeg, python3, pip, yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg \
    ffmpeg \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (LTS) via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip (kept fresh)
RUN pip3 install --no-cache-dir yt-dlp

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
