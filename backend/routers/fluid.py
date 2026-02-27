"""
Fluid configuration endpoints.

GET  /api/fluid/components    – list all components available in the thermo database
POST /api/fluid/shrink-factor – calculate oil shrinkage factor from a fluid composition
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import get_current_user
from backend.schemas import ComponentInfo, ShrinkFactorRequest, ShrinkFactorResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fluid", tags=["fluid"])


def _get_service():
    """Lazy import so startup doesn't fail if thermo path is misconfigured."""
    try:
        from backend.services.shrink_factor_service import (
            calculate_shrink_factor,
            get_available_components,
        )
        return calculate_shrink_factor, get_available_components
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Thermodynamic module unavailable: {exc}",
        )


@router.get("/components", response_model=list[ComponentInfo])
def list_components(current_user: str = Depends(get_current_user)):
    """Return all components available in the thermodynamic database."""
    _, get_comps = _get_service()
    return get_comps()


@router.post("/shrink-factor", response_model=ShrinkFactorResponse)
def compute_shrink_factor(
    req: ShrinkFactorRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Calculate the oil shrinkage factor (Bo⁻¹) from a wellstream composition
    using a two-stage PT flash via the Peng-Robinson EOS.
    """
    if not req.components:
        raise HTTPException(status_code=422, detail="At least one component is required.")

    calc_sf, _ = _get_service()

    try:
        result = calc_sf(
            component_keys=[c.key for c in req.components],
            mole_fractions=[c.zi for c in req.components],
            P_sep=req.P_sep,
            T_sep=req.T_sep,
            P_std=req.P_std,
            T_std=req.T_std,
        )
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Unknown component key: {exc}")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Shrink factor calculation failed")
        raise HTTPException(status_code=500, detail=f"Calculation failed: {exc}")

    return ShrinkFactorResponse(**result)
