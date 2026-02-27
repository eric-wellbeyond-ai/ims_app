"""
Shrink factor calculation service using the thermo module.

Uses a two-stage flash calculation:
  Stage 1 – Flash the wellstream at separator conditions
             → separator liquid composition + density
  Stage 2 – Flash the separator liquid at standard conditions
             → stock-tank liquid volume

oil_shrinkage = V_stock_tank / V_separator_liquid  (dimensionless, < 1 typically)
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

from thermo.substance import Substance           # noqa: E402
from thermo.database import COMPONENT_DATABASE   # noqa: E402

# Standard conditions
P_STD_DEFAULT = 101_325.0   # Pa  (1 atm)
T_STD_DEFAULT = 288.15      # K   (15 °C)


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


def calculate_shrink_factor(
    component_keys: list[str],
    mole_fractions: list[float],
    P_sep: float,
    T_sep: float,
    P_std: float = P_STD_DEFAULT,
    T_std: float = T_STD_DEFAULT,
) -> dict:
    """
    Calculate the oil shrinkage factor (Bo⁻¹) from a wellstream composition.

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
        oil_shrinkage : float – V_stock_tank / V_separator_liquid  (dimensionless)
        beta_sep      : float – vapour fraction at separator conditions
        beta_std      : float – vapour fraction at standard conditions (from sep liquid)
    """
    # --- Stage 1: flash wellstream at separator conditions ---
    sub_sep = Substance(component_keys, mole_fractions)
    sub_sep.set_state(P=P_sep, T=T_sep)
    sub_sep.calculate_phase_split()

    beta_sep = float(sub_sep.beta)
    xi_sep = sub_sep.xi
    rho_l_sep = float(sub_sep.density_l)

    if beta_sep >= 1.0 - 1e-6:
        raise ValueError(
            "The fluid is entirely vapour at the specified separator conditions. "
            "No liquid phase exists — oil shrinkage factor cannot be computed."
        )

    # Molar masses [g/mol]
    Mw_i = [COMPONENT_DATABASE[k]["Mw"] for k in component_keys]

    # Average molar mass of separator liquid [g/mol]
    Mw_l_sep = float(sum(x * mw for x, mw in zip(xi_sep, Mw_i)))

    # --- Stage 2: flash separator liquid at standard conditions ---
    sub_std = Substance(component_keys, xi_sep.tolist())
    sub_std.set_state(P=P_std, T=T_std)
    sub_std.calculate_phase_split()

    beta_std = float(sub_std.beta)
    xi_std = sub_std.xi
    rho_l_std = float(sub_std.density_l)

    Mw_l_std = float(sum(x * mw for x, mw in zip(xi_std, Mw_i)))

    # Molar volumes [m³ / mol of separator liquid]
    #   ρ [kg/m³], Mw [g/mol]  →  V [m³/mol] = (Mw / 1000) / ρ
    V_m_sep = (Mw_l_sep / 1000.0) / rho_l_sep
    V_m_std = (1.0 - beta_std) * (Mw_l_std / 1000.0) / rho_l_std

    oil_shrinkage = V_m_std / V_m_sep

    logger.info(
        "Shrink factor calculated: %.4f  (β_sep=%.3f, β_std=%.3f)",
        oil_shrinkage, beta_sep, beta_std,
    )

    return {
        "oil_shrinkage": oil_shrinkage,
        "beta_sep": beta_sep,
        "beta_std": beta_std,
    }
