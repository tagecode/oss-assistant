#!/usr/bin/env bash
set -euo pipefail

# electron-builder on Linux: deb + AppImage
# Ubuntu 24.04+ renamed some libs with a t64 suffix (64-bit time_t transition).
# Virtual packages (e.g. libasound2) appear in apt-cache show but cannot be installed.

has_install_candidate() {
  local pkg="$1"
  local candidate
  candidate=$(apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ {print $2; exit}')
  [[ -n "$candidate" && "$candidate" != "(none)" ]]
}

resolve_pkg() {
  local pkg="$1"
  # Prefer t64 on Ubuntu 24.04+ where legacy names are often virtual-only.
  if has_install_candidate "${pkg}t64"; then
    echo "${pkg}t64"
  elif has_install_candidate "$pkg"; then
    echo "$pkg"
  else
    echo "No install candidate for: $pkg (tried ${pkg}t64 and $pkg)" >&2
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

echo "Installing: ${resolved[*]}"
sudo apt-get install -y "${resolved[@]}"
