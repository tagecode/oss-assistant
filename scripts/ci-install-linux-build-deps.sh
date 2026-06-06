#!/usr/bin/env bash
set -euo pipefail

# electron-builder on Linux: deb + AppImage
# Ubuntu 24.04+ renamed some libs with a t64 suffix (64-bit time_t transition).

resolve_pkg() {
  local pkg="$1"
  if apt-cache show "$pkg" &>/dev/null; then
    echo "$pkg"
  elif apt-cache show "${pkg}t64" &>/dev/null; then
    echo "${pkg}t64"
  else
    echo "Package not found: $pkg (or ${pkg}t64)" >&2
    exit 1
  fi
}

PACKAGES=(
  libgtk-3-0
  libgbm1
  libnss3
  libatk1.0-0
  libatk-bridge2.0-0
  libcups2
  libdrm2
  libxkbcommon0
  libxcomposite1
  libxdamage1
  libxfixes3
  libxrandr2
  libasound2
  libfuse2
  fuse
  rpm
  libarchive-tools
)

sudo apt-get update

resolved=()
for pkg in "${PACKAGES[@]}"; do
  resolved+=("$(resolve_pkg "$pkg")")
done

sudo apt-get install -y "${resolved[@]}"
