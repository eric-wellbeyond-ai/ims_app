import logging
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routers.analysis import router as analysis_router
from backend.routers.cases import router as cases_router
from backend.routers.fluid import router as fluid_router

app = FastAPI(title="MPFM Validation API")


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


# In production (Docker) the frontend is served by this same process, so
# CORS is not needed.  In local dev the Vite server is on :5173.
_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(analysis_router)
app.include_router(cases_router)
app.include_router(fluid_router)


@app.on_event("startup")
def on_startup():
    init_db()


# Serve the built React SPA for any path not matched by the API routers above.
# The "static" directory is created by the Docker build; it does not exist in
# local dev (where Vite handles the frontend), so we only mount when present.
_static = Path(__file__).parent.parent / "static"
if _static.exists():
    # Mount hashed Vite assets directly (JS/CSS bundles).
    _assets = _static / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    # Explicit SPA catch-all: any GET that didn't match an API route gets
    # index.html so React Router can handle client-side navigation on refresh.
    @app.get("/{full_path:path}", include_in_schema=False)
    async def _spa_fallback(full_path: str) -> FileResponse:
        candidate = _static / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_static / "index.html"))
