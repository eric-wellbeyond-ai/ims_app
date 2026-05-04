/**
 * Base URL for the RAG FastAPI service (document Q&A + optional Wolfram).
 *
 * - Dev (default): `/rag-api` — Vite proxies to `http://localhost:8001` (see vite.config.ts).
 * - Override: set `VITE_RAG_API_URL` (e.g. `http://localhost:8001` or a deployed host).
 *   The RAG server must allow your UI origin (see `IMS_RAG_CORS_ORIGINS` in rag_model).
 */
export function getRagApiBase(): string {
  const env = import.meta.env.VITE_RAG_API_URL as string | undefined;
  if (env?.trim()) {
    return env.replace(/\/$/, "");
  }
  return "/rag-api";
}

/** Extra hint when Vite’s /rag-api proxy cannot reach localhost:8001 */
export function ragHttpErrorHint(status: number): string {
  if (status === 502 || status === 503 || status === 504) {
    return " Usually nothing is listening on port 8001. Start the RAG API: `cd rag_model && uvicorn src.api:app --reload --port 8001` (with that project’s Python env), or run `./dev.sh` from `ims_app/` — it starts RAG automatically if `rag_model/venv` exists.";
  }
  if (status === 500) {
    return " If you use the default `/rag-api` dev proxy, this often means the RAG process on port 8001 is not running.";
  }
  return "";
}
