# IMS App

MPFM validation tool — React + FastAPI.

## Running the app

### Mac — development (hot-reload)

```bash
./dev.sh
```

Starts:
- FastAPI backend on `http://localhost:8000`
- Vite dev server on `http://localhost:5173` (proxies `/api` → `:8000`)

Open `http://localhost:5173` in your browser.

### Mac — production / network sharing (Docker)

```bash
./prod.sh
```

Builds and starts a Docker container serving the bundled frontend + API at `http://localhost:7432`. Use this to share the app on the local network.

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
