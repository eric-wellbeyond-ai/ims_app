#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# prod.sh — build and run the IMS app via Docker (Mac)
#
# The container serves the built React frontend + FastAPI from one port:
#   http://localhost:7432
#
# Use this when you want to share the app on the local network or test a
# production build. For hot-reload development, use dev.sh instead.
#
# For PVTsim thermo engine: also run start_bridge.ps1 on the Windows VM.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMS_DIR="$(dirname "$SCRIPT_DIR")"

cd "$IMS_DIR"

echo "Building and starting Docker container…"
echo "  Context: $IMS_DIR"
echo "  Port:    http://localhost:7432"
echo ""

docker compose -f ims_app/docker-compose.yml up --build "$@"
