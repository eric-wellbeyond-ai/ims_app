# ── Stage 1: build the React frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app

COPY ims_app/package.json ims_app/package-lock.json* ./
RUN npm ci

COPY ims_app/index.html ims_app/vite.config.ts ims_app/tsconfig*.json ./
COPY ims_app/src/ ./src/
COPY ims_app/public/ ./public/

RUN npm run build          # outputs to /app/dist


# ── Stage 2: production Python image ──────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY ims_app/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY ims_app/backend/ ./backend/

# Copy the thermo thermodynamic library (sibling repo in the IMS/ workspace)
COPY thermo/ ./thermo/
ENV THERMO_PATH=/app/thermo
ENV PYTHONPATH=/app/thermo

# Copy built frontend (served by FastAPI as static files)
COPY --from=frontend /app/dist/ ./static/

# Persistent data lives on a Docker volume mounted at /app/data
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2"]
