from enum import Enum

from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime


class AggregationMode(str, Enum):
    SUM           = "sum"
    BY_DIFFERENCE = "by_difference"


class MeterAggregationConfig(BaseModel):
    """Which meters to combine and how."""
    mode:      AggregationMode = AggregationMode.SUM
    meter_ids: list[str]       = Field(
        default_factory=lambda: ["mpfm1", "mpfm2", "mpfm3"]
    )


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

    @model_validator(mode="before")
    @classmethod
    def drop_invalid_water_cut_samples(cls, data):
        samples = data.get("water_cut_samples", [])
        data["water_cut_samples"] = [
            s for s in samples
            if isinstance(s, dict) and s.get("timestamp")
        ]
        return data
    pvt_uncertainties:     PVTUncertainties      = Field(default_factory=lambda: PVTUncertainties())
    channel_uncertainties: ChannelUncertainties = Field(default_factory=lambda: ChannelUncertainties())
    aggregation:           MeterAggregationConfig = Field(default_factory=MeterAggregationConfig)


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


# ---------------------------------------------------------------------------
# Fluid composition / shrink factor
# ---------------------------------------------------------------------------

class ComponentInfo(BaseModel):
    """Summary of a single component from the thermodynamic database."""
    key: str
    name: str
    Mw: float
    Tc: float
    Pc: float


class FluidComponent(BaseModel):
    """One component in a fluid composition specification."""
    key: str
    zi: float = Field(..., gt=0, description="Mole fraction (normalised internally)")


class ShrinkFactorRequest(BaseModel):
    """Request body for POST /api/fluid/shrink-factor."""
    components: list[FluidComponent]
    P_sep: float = Field(..., gt=0, description="Separator pressure [Pa]")
    T_sep: float = Field(..., gt=0, description="Separator temperature [K]")
    P_std: float = Field(default=101_325.0, gt=0, description="Standard pressure [Pa]")
    T_std: float = Field(default=288.15,    gt=0, description="Standard temperature [K]")


class ShrinkFactorResponse(BaseModel):
    """Response for POST /api/fluid/shrink-factor."""
    oil_shrinkage: float
    beta_sep: float
    beta_std: float
