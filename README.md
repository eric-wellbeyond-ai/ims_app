# IMS App

MPFM validation tool — React + FastAPI.

## Running the app

### Mac — development (hot-reload)

```bash
./dev.sh
```

Starts:
- FastAPI backend on `http://localhost:8000`
- RAG API on `http://localhost:8001` when `../rag_model/venv` or **`ims_app/venv`** has `uvicorn` and RAG dependencies are installed in that env
- Vite dev server on `http://localhost:5173` (proxies `/api` → `:8000`, `/rag-api` → `:8001`)

**Document assistant (RAG):** `./dev.sh` starts the RAG API on **8001** when either `../rag_model/venv` or **`ims_app/venv`** contains `uvicorn`. You can use **one venv** for both apps: from `ims_app/`, `source venv/bin/activate` then `pip install -r ../rag_model/requirements.txt` (adds pdfplumber, chromadb, mlx-lm, etc.). `rag_model/requirements.txt` uses mostly unpinned versions — if anything clashes with `backend/requirements.txt`, install the IMS backend file first, then the RAG file. Open **Assistant** in the sidebar (`/assistant`). Override the RAG URL with `VITE_RAG_API_URL` if needed.

Open `http://localhost:5173` in your browser.

### Mac — production / network sharing (Docker)

```bash
./prod.sh
```

Builds and starts a Docker container serving the bundled frontend + API at `http://localhost:7432`. Use this to share the app on the local network.

The **Assistant** (RAG) tab calls the RAG API separately. For production builds, set `VITE_RAG_API_URL` to the browser-reachable RAG base URL when you run `npm run build` (and configure `IMS_RAG_CORS_ORIGINS` on the RAG server). Local `./dev.sh` proxies `/rag-api` to port `8001` automatically.

### Windows VM — PVTsim bridge (only needed for PVTsim thermo engine)

```powershell
.\start_bridge.ps1
```

Located in `../thermo/pvtsim_bridge/`. Starts the PVTsim Nova HTTP bridge on port `9000`.

After starting it, run `ipconfig` on Windows to find the VM's IP address (look for the Parallels/Ethernet adapter), then update `.env` on the Mac:

```
PVTSIM_BRIDGE_URL=http://10.211.55.3:9000
```

## Ports at a glance

| Process | Port | Host |
|---|---|---|
| FastAPI backend (local dev) | `8000` | Mac |
| RAG API (`rag_model`, optional) | `8001` | Mac |
| Vite dev server | `5173` | Mac |
| Docker container (prod) | `7432` | Mac |
| PVTsim bridge | `9000` | Windows VM |

## Project layout

```
IMS/
├── ims_app/        # This repo — React frontend + FastAPI backend
│   ├── backend/    # FastAPI app
│   ├── src/        # React/TypeScript source
│   ├── dev.sh      # Start local dev servers
│   ├── prod.sh     # Build and run via Docker
│   └── .env        # PVTSIM_BRIDGE_URL and other config
└── thermo/         # Python thermodynamic library (Peng-Robinson EOS)
    └── pvtsim_bridge/
        └── start_bridge.ps1   # Windows: start PVTsim bridge server
```
