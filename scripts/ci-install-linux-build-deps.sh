#!/usr/bin/env bash
set -euo pipefail

# electron-builder on Linux: deb + AppImage
sudo apt-get update
sudo apt-get install -y \
  libgtk-3-0 \
  libgbm1 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libasound2 \
  libfuse2 \
  fuse \
  rpm \
  libarchive-tools
