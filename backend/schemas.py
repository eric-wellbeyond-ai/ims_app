from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PVTConfig(BaseModel):
    oil_shrinkage: float = Field(..., gt=0, le=2, description="Oil shrinkage factor")
    flash_factor: float = Field(..., ge=0, description="Flash factor in scf/stb")
    bsw: float = Field(..., ge=0, le=1, description="BS&W fraction 0-1")


class PVTUncertainties(BaseModel):
    oil_shrinkage_pct: float = Field(default=0.0, ge=0.0, description="Relative uncertainty on oil shrinkage (%)")
    flash_factor_pct: float  = Field(default=0.0, ge=0.0, description="Relative uncertainty on flash factor (%)")
    bsw_pct: float           = Field(default=0.0, ge=0.0, description="Relative uncertainty on BS&W (%)")


class ChannelUncertainties(BaseModel):
    sep_liquid_pct: float = Field(default=0.0, ge=0.0, description="Relative uncertainty on sep total liquid (%)")
    sep_gas_pct:    float = Field(default=0.0, ge=0.0, description="Relative uncertainty on sep gas (%)")
    mpfm_oil_pct:   float = Field(default=0.0, ge=0.0, description="Relative uncertainty on MPFM oil channels (%)")
    mpfm_gas_pct:   float = Field(default=0.0, ge=0.0, description="Relative uncertainty on MPFM gas channels (%)")
    mpfm_water_pct: float = Field(default=0.0, ge=0.0, description="Relative uncertainty on MPFM water channels (%)")


class WaterCutSample(BaseModel):
    timestamp: datetime
    value: float


class AnalysisRequest(BaseModel):
    pvt: PVTConfig
    test_start: datetime
    test_end: datetime
    water_cut_samples: list[WaterCutSample] = []
    sheet_name: str = "MPFM VALIDATION DATA"
    pvt_uncertainties:     PVTUncertainties     = Field(default_factory=lambda: PVTUncertainties())
    channel_uncertainties: ChannelUncertainties = Field(default_factory=lambda: ChannelUncertainties())


class PhaseResult(BaseModel):
    model_config = {"extra": "ignore"}

    phase: str
    unit: str
    mpfm_mean: float
    sep_ref_mean: float
    mean_abs_deviation: float
    mean_rel_deviation: float
    std_rel_deviation: float
    se_rel_deviation: float
    ci95_rel_lower: float
    ci95_rel_upper: float
    z_statistic: float
    p_value: float
    n_samples: int
    acceptance_limit: Optional[float] = None
    within_acceptance: Optional[bool] = None
    sigma_mpfm_mean: Optional[float] = None
    sigma_sep_mean:  Optional[float] = None
    sigma_rel_dev:   Optional[float] = None


class AnalysisResponse(BaseModel):
    comparison: list[PhaseResult]
    deviations: list[dict]
    timeseries: list[dict]
    sigma_ts: list[dict] = []
    pvt: PVTConfig
    test_start: str
    test_end: str
    n_samples: int
    session_id: str
