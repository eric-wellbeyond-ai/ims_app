import type { AnalysisRequest, AnalysisResponse } from "../types/analysis";

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function postAnalysis(
  file: File,
  config: AnalysisRequest,
  fetchFn: FetchFn = fetch,
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("config", JSON.stringify(config));

  const res = await fetchFn("/api/analyze", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(err.detail || "Analysis failed");
  }

  return res.json();
}

export function getExportUrl(sessionId: string): string {
  return `/api/export/${sessionId}`;
}
