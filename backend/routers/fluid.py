"""
Fluid configuration endpoints.

GET  /api/fluid/components  – list all components available in the thermo database
POST /api/fluid/pvt         – calculate oil shrinkage factor + flash factor from a fluid composition
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import get_current_user
from backend.schemas import ComponentInfo, PvtFromFluidRequest, PvtFromFluidResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/fluid", tags=["fluid"])


def _get_service():
    """Lazy import so startup doesn't fail if thermo path is misconfigured."""
    try:
        from backend.services.shrink_factor_service import (
            calculate_pvt_from_fluid,
            get_available_components,
        )
        return calculate_pvt_from_fluid, get_available_components
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


@router.post("/pvt", response_model=PvtFromFluidResponse)
def compute_pvt(
    req: PvtFromFluidRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Calculate oil shrinkage factor (Bo⁻¹) and flash factor (scf/stb) from a
    wellstream composition using a two-stage PT flash via the Peng-Robinson EOS.
    """
    if not req.components:
        raise HTTPException(status_code=422, detail="At least one component is required.")

    calc_pvt, _ = _get_service()

    try:
        result = calc_pvt(
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
        logger.exception("PVT calculation failed")
        raise HTTPException(status_code=500, detail=f"Calculation failed: {exc}")

    return PvtFromFluidResponse(**result)


# Legacy alias — keep old URL working during transition
@router.post("/shrink-factor", response_model=PvtFromFluidResponse, include_in_schema=False)
def compute_shrink_factor_legacy(
    req: PvtFromFluidRequest,
    current_user: str = Depends(get_current_user),
):
    return compute_pvt(req, current_user)
