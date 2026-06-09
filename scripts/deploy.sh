#!/usr/bin/env bash
# One-command deploy WITHOUT a registry or CI:
#   build images locally -> ship the image tar over SSH -> load & (re)start on the server.
#
# Usage:
#   SERVER=user@your-server ./scripts/deploy.sh
# Optional env:
#   REMOTE_DIR=/srv/deviation   # where files land on the server (default /srv/deviation)
#   PLATFORM=linux/amd64        # server CPU arch (default amd64; use linux/arm64 for ARM servers)
set -euo pipefail

SERVER="${SERVER:?set SERVER=user@host, e.g. SERVER=root@1.2.3.4}"
REMOTE_DIR="${REMOTE_DIR:-/srv/deviation}"
PLATFORM="${PLATFORM:-linux/amd64}"
SSH_PORT="${SSH_PORT:-22}"   # BandwagonHost & many VPSs use a custom SSH port
TARBALL="deviation-images.tar.gz"

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found (needed for ANTHROPIC_API_KEY on the server)." >&2
  exit 1
fi

echo "==> [1/4] Building images for $PLATFORM (this matches the server's CPU arch)"
# buildx builds for the server's architecture even from an Apple-Silicon Mac.
docker buildx build --platform "$PLATFORM" -f apps/web/Dockerfile      -t deviation-web:latest      --load .
docker buildx build --platform "$PLATFORM" -f apps/realtime/Dockerfile -t deviation-realtime:latest --load .

echo "==> [2/4] Saving both images to $TARBALL (shared base layers are stored once)"
docker save deviation-web:latest deviation-realtime:latest | gzip > "$TARBALL"

echo "==> [3/4] Copying image + compose + env to $SERVER:$REMOTE_DIR"
ssh -p "$SSH_PORT" "$SERVER" "mkdir -p '$REMOTE_DIR'"
scp -P "$SSH_PORT" "$TARBALL" docker-compose.yml .env "$SERVER:$REMOTE_DIR/"

echo "==> [4/4] Loading image and (re)starting containers on the server"
ssh -p "$SSH_PORT" "$SERVER" "cd '$REMOTE_DIR' && gunzip -c '$TARBALL' | docker load && docker compose up -d && docker image prune -f"

rm -f "$TARBALL"
echo "==> Done. web :7242, realtime :7243 (put them behind nginx — see nginx.example.conf)."
