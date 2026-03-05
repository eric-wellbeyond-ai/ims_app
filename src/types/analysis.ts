export type AggregationMode = "sum" | "by_difference";

// ---------------------------------------------------------------------------
// Fluid composition
// ---------------------------------------------------------------------------

export interface FluidComponent {
  key: string;
  zi: number;
}

export type ThermoEngine = "ims_thermo" | "pvtsim";

export interface FluidConfig {
  components: FluidComponent[];
  P_sep_bar: number;           // separator pressure in bar (converted to Pa for the API)
  T_sep_c: number;             // separator temperature in °C (converted to K for the API)
  thermoEngine?: ThermoEngine; // undefined treated as "ims_thermo"
  pvtsimDbPath?: string;       // Windows path to .nfdb file (pvtsim engine only)
  pvtsimFluidNumber?: number;  // 1-based fluid index in database (pvtsim engine only)
}

export interface ComponentInfo {
  key: string;
  name: string;
  Mw: number;
  Tc: number;
  Pc: number;
}

export type ShrinkageSource = "manual" | "calculated";

export function defaultFluidConfig(): FluidConfig {
  return {
    components: [],
    P_sep_bar: 10.0,
    T_sep_c: 50.0,
    thermoEngine: "ims_thermo",
    pvtsimFluidNumber: 1,
  };
}



export interface MeterAggregationConfig {
  mode: AggregationMode;
  meter_ids: string[];
}

export function defaultMeterAggregation(): MeterAggregationConfig {
  return { mode: "sum", meter_ids: ["mpfm1", "mpfm2", "mpfm3"] };
}

export interface PVTConfig {
  oil_shrinkage: number;
  flash_factor: number;
  bsw: number;
}

export interface PVTUncertainties {
  oil_shrinkage_pct: number;
  flash_factor_pct: number;
  bsw_pct: number;
}

export interface ChannelUncertainties {
  sep_liquid_pct: number;
  sep_gas_pct: number;
  mpfm_oil_pct: number;
  mpfm_gas_pct: number;
  mpfm_water_pct: number;
}

export function defaultPVTUncertainties(): PVTUncertainties {
  return { oil_shrinkage_pct: 5, flash_factor_pct: 5, bsw_pct: 5 };
}

export function defaultChannelUncertainties(): ChannelUncertainties {
  return {
    sep_liquid_pct: 5,
    sep_gas_pct: 5,
    mpfm_oil_pct: 5,
    mpfm_gas_pct: 5,
    mpfm_water_pct: 5,
  };
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
  pvt_uncertainties?: PVTUncertainties;
  channel_uncertainties?: ChannelUncertainties;
  aggregation?: MeterAggregationConfig;
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
  z_statistic: number;
  p_value: number;
  n_samples: number;
  acceptance_limit: number | null;
  within_acceptance: boolean | null;
  sigma_mpfm_mean: number | null;
  sigma_sep_mean: number | null;
  sigma_rel_dev: number | null;
}

export interface AnalysisResponse {
  comparison: PhaseResult[];
  deviations: Record<string, number | string | null>[];
  timeseries: Record<string, number | string | null>[];
  sigma_ts: Record<string, number | string | null>[];
  pvt: PVTConfig;
  test_start: string;
  test_end: string;
  n_samples: number;
  session_id: string;
}
