#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# dev.sh — start the IMS app in local development mode (Mac)
#
# Starts:
#   1. FastAPI backend   on http://localhost:8000
#   2. RAG API (optional) on http://localhost:8001  if ../rag_model/venv exists, else ims_app/venv
#   3. Vite dev server   on http://localhost:5173  (proxies /api → :8000, /rag-api → :8001)
#
# For PVTsim thermo engine: also run start_bridge.ps1 on the Windows VM.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMS_DIR="$(dirname "$SCRIPT_DIR")"  # parent IMS/ directory

# Load .env so PVTSIM_BRIDGE_URL etc. are available to the backend
if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# ── 1. Backend ────────────────────────────────────────────────────────────────
echo "Starting FastAPI backend on :8000 …"
cd "$SCRIPT_DIR"

# Activate the project venv so uvicorn/fastapi are available
if [[ -f "$SCRIPT_DIR/venv/bin/activate" ]]; then
    source "$SCRIPT_DIR/venv/bin/activate"
else
    echo "WARNING: no venv found at $SCRIPT_DIR/venv — uvicorn may not be on PATH"
    echo "  Run: python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt"
fi

# Make the sibling thermo library importable
export THERMO_PATH="$IMS_DIR/thermo"
export PYTHONPATH="$IMS_DIR/thermo:${PYTHONPATH:-}"

uvicorn backend.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir backend &
BACKEND_PID=$!
echo "  backend PID: $BACKEND_PID"

# ── 2. RAG (document assistant) — same port Vite proxies as /rag-api ─────────
RAG_DIR="$IMS_DIR/rag_model"
RAG_PID=""
RAG_UVICORN=""
if [[ -x "$RAG_DIR/venv/bin/uvicorn" ]]; then
  RAG_UVICORN="$RAG_DIR/venv/bin/uvicorn"
elif [[ -x "$SCRIPT_DIR/venv/bin/uvicorn" ]]; then
  RAG_UVICORN="$SCRIPT_DIR/venv/bin/uvicorn"
fi

if [[ -n "$RAG_UVICORN" && -d "$RAG_DIR" ]]; then
  echo "Starting RAG API on :8001 (Assistant tab) …"
  if [[ "$RAG_UVICORN" == "$SCRIPT_DIR/venv/bin/uvicorn" ]]; then
    echo "  (ims_app venv — ensure RAG deps are installed: pip install -r \"$RAG_DIR/requirements.txt\")"
  fi
  (cd "$RAG_DIR" && "$RAG_UVICORN" src.api:app \
    --host 0.0.0.0 --port 8001 --reload --reload-dir src) &
  RAG_PID=$!
  echo "  rag API PID: $RAG_PID"
elif [[ -d "$RAG_DIR" ]]; then
  echo "NOTE: No uvicorn in rag_model/ or ims_app/venv — Assistant needs RAG on :8001 (see README)."
fi

# ── 3. Frontend ───────────────────────────────────────────────────────────────
echo "Starting Vite dev server on :5173 …"
cd "$SCRIPT_DIR"
npm run dev &
FRONTEND_PID=$!
echo "  frontend PID: $FRONTEND_PID"

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo "Shutting down…"
    kill "$BACKEND_PID"  2>/dev/null || true
    if [[ -n "${RAG_PID:-}" ]]; then
        kill "$RAG_PID" 2>/dev/null || true
    fi
    kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "App running at http://localhost:5173"
echo "API docs at   http://localhost:8000/docs"
if [[ -n "${RAG_PID:-}" ]]; then
    echo "RAG docs at   http://localhost:8001/docs"
fi
echo ""
echo "Press Ctrl+C to stop."
wait
