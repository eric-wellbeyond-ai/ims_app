from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PVTConfig(BaseModel):
    oil_shrinkage: float = Field(..., gt=0, le=2, description="Oil shrinkage factor")
    flash_factor: float = Field(..., ge=0, description="Flash factor in scf/stb")
    bsw: float = Field(..., ge=0, le=1, description="BS&W fraction 0-1")


class WaterCutSample(BaseModel):
    timestamp: datetime
    value: float


class AnalysisRequest(BaseModel):
    pvt: PVTConfig
    test_start: datetime
    test_end: datetime
    water_cut_samples: list[WaterCutSample] = []
    sheet_name: str = "MPFM VALIDATION DATA"


class PhaseResult(BaseModel):
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
    n_samples: int
    acceptance_limit: Optional[float] = None
    within_acceptance: Optional[bool] = None


class AnalysisResponse(BaseModel):
    comparison: list[PhaseResult]
    deviations: list[dict]
    timeseries: list[dict]
    pvt: PVTConfig
    test_start: str
    test_end: str
    n_samples: int
    session_id: str
