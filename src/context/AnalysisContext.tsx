import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { AnalysisRequest, AnalysisResponse } from "../types/analysis";
import { postAnalysis } from "../api/analysisApi";

interface AnalysisState {
  result: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
}

interface AnalysisContextType extends AnalysisState {
  runAnalysis: (file: File, config: AnalysisRequest) => Promise<void>;
  clearResults: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalysisState>({
    result: null,
    loading: false,
    error: null,
  });

  const runAnalysis = useCallback(
    async (file: File, config: AnalysisRequest) => {
      setState({ result: null, loading: true, error: null });
      try {
        const result = await postAnalysis(file, config);
        setState({ result, loading: false, error: null });
      } catch (err) {
        setState({
          result: null,
          loading: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      }
    },
    []
  );

  const clearResults = useCallback(() => {
    setState({ result: null, loading: false, error: null });
  }, []);

  return (
    <AnalysisContext.Provider
      value={{ ...state, runAnalysis, clearResults }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextType {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return ctx;
}
