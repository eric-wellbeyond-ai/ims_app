export interface PVTConfig {
  oil_shrinkage: number;
  flash_factor: number;
  bsw: number;
}

export interface WaterCutSample {
  timestamp: string;
  value: number;
}

export interface AnalysisRequest {
  pvt: PVTConfig;
  test_start: string;
  test_end: string;
  water_cut_samples: WaterCutSample[];
  sheet_name?: string;
}

export interface PhaseResult {
  phase: string;
  unit: string;
  mpfm_mean: number;
  sep_ref_mean: number;
  mean_abs_deviation: number;
  mean_rel_deviation: number;
  std_rel_deviation: number;
  se_rel_deviation: number;
  ci95_rel_lower: number;
  ci95_rel_upper: number;
  n_samples: number;
  acceptance_limit: number | null;
  within_acceptance: boolean | null;
}

export interface AnalysisResponse {
  comparison: PhaseResult[];
  deviations: Record<string, number | string | null>[];
  timeseries: Record<string, number | string | null>[];
  pvt: PVTConfig;
  test_start: string;
  test_end: string;
  n_samples: number;
  session_id: string;
}
