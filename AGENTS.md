# AGENTS.md

## Cursor Cloud specific instructions

### Overview

MPFM (Multi-Phase Flow Meter) Validation app — an oil & gas tool for validating MPFM readings against separator reference measurements. Co-located React frontend + Python FastAPI backend (not a monorepo).

### Services

| Service | Port | Start command |
|---------|------|---------------|
| FastAPI backend | 8000 | `python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| Vite dev server | 5173 | `npm run dev` (or `npx vite --host 0.0.0.0 --port 5173`) |

Both must run for local development. Vite proxies `/api` requests to the backend (configured in `vite.config.ts`).

### Key caveats

- Use `python3`, not `python` — the VM does not have a `python` alias.
- Python packages install to `~/.local` via `pip install --user`. The `~/.local/bin` directory may not be on PATH; use `python3 -m uvicorn` to start the backend.
- SQLite database auto-creates at `data/cases.db` on first backend startup — no migration step needed.
- All API endpoints require Azure AD JWT auth (`backend/auth.py`). Without a valid Azure AD tenant, API calls return 401/403. The frontend shows a "Sign in with Microsoft" gate.
- ESLint has 1 pre-existing error and 1 warning (not blocking).

### Standard commands

- **Lint**: `npm run lint` (ESLint on `src/`)
- **Type check**: `npx tsc -b`
- **Build**: `npm run build` (runs tsc + vite build)
- **Backend deps**: `pip install -r backend/requirements.txt`
- **Frontend deps**: `npm install`
