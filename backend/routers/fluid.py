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
            calculate_pvt_from_fluid_pvtsim,
            calculate_pvt_from_fluid_multiflash,
            get_available_components,
        )
        return calculate_pvt_from_fluid, calculate_pvt_from_fluid_pvtsim, calculate_pvt_from_fluid_multiflash, get_available_components
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Thermodynamic module unavailable: {exc}",
        )


def _get_component_list() -> list[dict]:
    """
    Import COMPONENT_DATABASE independently of the full calculation stack.
    Falls back gracefully if thermo is unavailable rather than returning 503.
    """
    import os, sys
    logger.info("_get_component_list: THERMO_PATH=%s", os.environ.get("THERMO_PATH"))
    logger.info("_get_component_list: sys.path=%s", sys.path)

    try:
        from backend.services.shrink_factor_service import get_available_components
        components = get_available_components()
        logger.info("_get_component_list: loaded %d components via service", len(components))
        return components
    except ImportError as exc:
        logger.warning("_get_component_list: service import failed: %s", exc)

    try:
        from backend.services.shrink_factor_service import _ensure_thermo_importable
        _ensure_thermo_importable()
        logger.info("_get_component_list: thermo path resolved via _ensure_thermo_importable")
    except Exception as exc:
        logger.warning("_get_component_list: _ensure_thermo_importable failed: %s", exc)

    try:
        from thermo.database import COMPONENT_DATABASE
        components = [
            {"key": k, "name": v["name"], "Mw": v["Mw"], "Tc": v["Tc"], "Pc": v["Pc"]}
            for k, v in COMPONENT_DATABASE.items()
        ]
        logger.info("_get_component_list: loaded %d components directly from DB", len(components))
        return components
    except ImportError as exc:
        logger.error("_get_component_list: direct DB import failed: %s", exc)
        return []


@router.get("/components", response_model=list[ComponentInfo])
def list_components(current_user: str = Depends(get_current_user)):
    """Return all components available in the thermodynamic database."""
    return _get_component_list()


@router.post("/pvt", response_model=PvtFromFluidResponse)
def compute_pvt(
    req: PvtFromFluidRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Calculate oil shrinkage factor (Bo⁻¹) and flash factor (scf/stb) from a
    wellstream composition.  The thermodynamic engine is selected by the caller:

    - ``ims_thermo``  – two-stage PT flash via the internal Peng-Robinson EOS
    - ``pvtsim``      – Stage 1 via PVTsim Nova bridge, Stage 2 via internal PR EOS
    - ``multiflash``  – Stage 1 via KBC Multiflash bridge, Stage 2 via internal PR EOS
    """
    calc_ims, calc_pvtsim, calc_mf, _ = _get_service()

    try:
        if req.thermo_engine == "pvtsim":
            if not req.pvtsim_db_path:
                raise HTTPException(
                    status_code=422,
                    detail="pvtsim_db_path is required when thermo_engine is 'pvtsim'.",
                )
            result = calc_pvtsim(
                db_path=req.pvtsim_db_path,
                fluid_number=req.pvtsim_fluid_number,
                P_sep=req.P_sep,
                T_sep=req.T_sep,
                component_keys=[c.key for c in req.components] or None,
                mole_fractions=[c.zi for c in req.components] or None,
                P_std=req.P_std,
                T_std=req.T_std,
            )
        elif req.thermo_engine == "multiflash":
            if not req.multiflash_mfl_path:
                raise HTTPException(
                    status_code=422,
                    detail="multiflash_mfl_path is required when thermo_engine is 'multiflash'.",
                )
            result = calc_mf(
                mfl_path=req.multiflash_mfl_path,
                P_sep=req.P_sep,
                T_sep=req.T_sep,
                component_keys=[c.key for c in req.components] or None,
                P_std=req.P_std,
                T_std=req.T_std,
            )
        else:
            if not req.components:
                raise HTTPException(status_code=422, detail="At least one component is required.")
            result = calc_ims(
                component_keys=[c.key for c in req.components],
                mole_fractions=[c.zi for c in req.components],
                P_sep=req.P_sep,
                T_sep=req.T_sep,
                P_std=req.P_std,
                T_std=req.T_std,
            )
    except HTTPException:
        raise
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
