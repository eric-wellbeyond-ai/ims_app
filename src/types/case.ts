import type { AnalysisRequest, FluidConfig, ShrinkageSource } from "./analysis";

/** Summary row returned by GET /api/cases */
export interface CaseSummary {
  id: number;
  name: string;
  created_at: string;
  file_name: string | null;
}

/** Full case returned by GET /api/cases/{id} and GET /api/cases/latest */
export interface SavedCase {
  id: number;
  name: string;
  created_at: string;
  config: Omit<AnalysisRequest, "pvt_uncertainties" | "channel_uncertainties"> &
    Partial<Pick<AnalysisRequest, "pvt_uncertainties" | "channel_uncertainties">> & {
      fluid_config?: FluidConfig;
      shrinkage_source?: ShrinkageSource;
      flash_factor_source?: ShrinkageSource;
      calculated_flash_factor?: number | null;
    };
  file_name: string | null;
  file_path: string | null;
  has_file: boolean;
}
