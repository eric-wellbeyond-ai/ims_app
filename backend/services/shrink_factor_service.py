"""
PVT property calculation service using the thermo module.

Delegates entirely to thermo.pvt_properties.calculate_pvt_properties,
which performs a two-stage PT flash (Peng-Robinson EOS) and returns:
  - oil_shrinkage  (Bo⁻¹ = V_stock_tank / V_separator_liquid)
  - flash_factor   (solution GOR in scf/stb)
  - beta_sep / beta_std (vapour fractions at each stage)
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def _ensure_thermo_importable() -> None:
    """Add the thermo package directory to sys.path if not already importable."""
    try:
        import thermo  # noqa: F401
        return
    except ImportError:
        pass

    candidates: list[Path] = []

    # Allow an explicit override (useful in Docker or CI)
    env_path = os.environ.get("THERMO_PATH")
    if env_path:
        candidates.append(Path(env_path))

    # Derive from file location: backend/services/ → ims_app root → IMS/
    app_root = Path(__file__).parents[2]
    candidates += [
        app_root.parent / "thermo",   # sibling workspace directory: IMS/thermo
        app_root / "thermo",          # vendored copy inside app: ims_app/thermo
    ]

    for path in candidates:
        if path.is_dir() and (path / "thermo" / "__init__.py").exists():
            if str(path) not in sys.path:
                sys.path.insert(0, str(path))
            logger.info("Loaded thermo package from %s", path)
            return

    raise ImportError(
        "Cannot locate the thermo package. "
        "Set the THERMO_PATH environment variable to the directory that "
        "contains the 'thermo/' sub-package (e.g. /path/to/IMS/thermo)."
    )


_ensure_thermo_importable()

from thermo.pvt_properties import calculate_pvt_properties as _thermo_pvt  # noqa: E402
from thermo.database import COMPONENT_DATABASE                               # noqa: E402


def get_available_components() -> list[dict]:
    """Return all components defined in the thermo database."""
    return [
        {
            "key": key,
            "name": data["name"],
            "Mw": data["Mw"],
            "Tc": data["Tc"],
            "Pc": data["Pc"],
        }
        for key, data in COMPONENT_DATABASE.items()
    ]


def calculate_pvt_from_fluid(
    component_keys: list[str],
    mole_fractions: list[float],
    P_sep: float,
    T_sep: float,
    P_std: float = 101_325.0,
    T_std: float = 288.15,
) -> dict:
    """
    Calculate oil shrinkage factor and flash factor from a wellstream composition.

    Delegates to thermo.pvt_properties.calculate_pvt_properties.

    Parameters
    ----------
    component_keys  : component keys from the thermo database (e.g. ["C1", "C3", "nC7"])
    mole_fractions  : corresponding mole fractions (normalised internally)
    P_sep           : separator pressure [Pa]
    T_sep           : separator temperature [K]
    P_std           : standard pressure [Pa]   (default 1 atm)
    T_std           : standard temperature [K]  (default 15 °C)

    Returns
    -------
    dict with keys:
        oil_shrinkage : float – Bo⁻¹ = V_stock_tank / V_separator_liquid
        flash_factor  : float – solution GOR [scf / stb]
        beta_sep      : float – vapour fraction at separator conditions
        beta_std      : float – vapour fraction at standard conditions
    """
    result = _thermo_pvt(
        component_keys=component_keys,
        mole_fractions=mole_fractions,
        P_sep=P_sep,
        T_sep=T_sep,
        P_std=P_std,
        T_std=T_std,
    )

    logger.info(
        "PVT calculated: shrinkage=%.4f  flash_factor=%.2f scf/stb  "
        "(β_sep=%.3f, β_std=%.3f)",
        result["oil_shrinkage"],
        result["flash_factor"],
        result["beta_sep"],
        result["beta_std"],
    )

    return result
