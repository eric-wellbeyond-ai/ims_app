"""
MPFM Validation Analysis — Core Algorithm
==========================================
Generic, file-format-agnostic pipeline.  All functions operate on plain
pandas DataFrames with well-known column names; no spreadsheet I/O here.

File-format-specific parsing lives in bespoke_parser.py.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import numpy as np
import pandas as pd
from scipy import stats


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class PVTProperties:
    """PVT conversion properties."""
    oil_shrinkage: float   # multiply stock-tank volume (Bo^-1 style)
    flash_factor:  float   # scf/stb — gas evolved when oil flashes to STD
    bsw:           float   # basic sediment & water fraction (0–1)


@dataclass
class MeasurementUncertainties:
    """
    Relative (fractional) uncertainties for each input channel and PVT
    property.  All values are fractions, e.g. 0.05 = 5 %.
    Zero means no uncertainty assumed.
    """
    r_sep_liquid:    float = 0.0
    r_sep_gas:       float = 0.0
    r_mpfm_oil:      float = 0.0
    r_mpfm_gas:      float = 0.0
    r_mpfm_water:    float = 0.0
    r_bsw:           float = 0.0
    r_oil_shrinkage: float = 0.0
    r_flash_factor:  float = 0.0


@dataclass
class TestWindow:
    """Defines the valid test period."""
    start: pd.Timestamp
    end:   pd.Timestamp


@dataclass
class MPFMAnalysisResult:
    """Container for all analysis outputs."""
    ts:         pd.DataFrame
    comparison: pd.DataFrame
    deviations: pd.DataFrame
    pvt:        PVTProperties
    window:     TestWindow


# ---------------------------------------------------------------------------
# Meter aggregation
# ---------------------------------------------------------------------------

class AggregationMode(str, Enum):
    """How individual meter readings are combined into a single MPFM value."""
    SUM          = "sum"           # sum of selected meters
    BY_DIFFERENCE = "by_difference"  # infer well rate by difference (future)


@dataclass
class MeterAggregation:
    """
    Configuration controlling how raw per-meter columns are aggregated.

    For SUM mode, *meter_ids* lists the meters to add together.  Each meter
    must have columns ``{id}_oil``, ``{id}_gas``, and ``{id}_water`` in the
    input DataFrame.  Gas columns are expected in mmscf/day and are converted
    to mscf/day during aggregation.

    BY_DIFFERENCE mode is reserved for future implementation.
    """
    mode:      AggregationMode = AggregationMode.SUM
    meter_ids: list            = field(default_factory=lambda: ["mpfm1", "mpfm2", "mpfm3"])


def aggregate_mpfm(df: pd.DataFrame, agg: MeterAggregation) -> pd.DataFrame:
    """
    Add ``mpfm_oil``, ``mpfm_gas``, ``mpfm_water``, and ``mpfm_liquid``
    columns to *df* based on the aggregation configuration.

    Returns a copy of *df* with the new columns appended.
    """
    out = df.copy()

    if agg.mode == AggregationMode.SUM:
        out["mpfm_oil"]   = sum(out[f"{m}_oil"]   for m in agg.meter_ids)
        out["mpfm_water"] = sum(out[f"{m}_water"] for m in agg.meter_ids)
        # Gas: per-meter columns are in mmscf/day → convert to mscf/day
        out["mpfm_gas"]   = sum(out[f"{m}_gas"]   for m in agg.meter_ids) * 1000.0
        out["mpfm_liquid"] = out["mpfm_oil"] + out["mpfm_water"]

    elif agg.mode == AggregationMode.BY_DIFFERENCE:
        raise NotImplementedError(
            "BY_DIFFERENCE aggregation is not yet implemented."
        )

    else:
        raise ValueError(f"Unknown aggregation mode: {agg.mode!r}")

    return out


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

def filter_test_window(df: pd.DataFrame, window: TestWindow) -> pd.DataFrame:
    """Return only rows within the test period (inclusive)."""
    mask     = (df.index >= window.start) & (df.index <= window.end)
    filtered = df.loc[mask].copy()
    if filtered.empty:
        raise ValueError(
            f"No data found in test window {window.start} – {window.end}. "
            f"Data spans {df.index.min()} – {df.index.max()}."
        )
    return filtered


def compute_derived_columns(
    df:  pd.DataFrame,
    pvt: PVTProperties,
    agg: Optional[MeterAggregation] = None,
) -> pd.DataFrame:
    """
    Aggregate MPFM meter readings and convert separator readings to standard
    conditions.  Also computes water cut and GOR for both sides.

    Steps:
      1. Aggregate individual meter columns → mpfm_oil / gas / water / liquid
      2. Convert separator readings (test P,T) → standard conditions
      3. Compute WC and GOR for MPFM and separator
    """
    if agg is None:
        agg = MeterAggregation()

    out = aggregate_mpfm(df, agg)

    # --- Separator reference → standard conditions ---
    out["sep_free_water"]        = out["sep_total_liquid"] * pvt.bsw
    out["sep_oil_before_shrink"] = out["sep_total_liquid"] - out["sep_free_water"]
    out["sep_oil_std"]           = out["sep_oil_before_shrink"] * pvt.oil_shrinkage
    out["sep_liquid_std"]        = out["sep_free_water"] + out["sep_oil_std"]
    out["sep_flash_gas"]         = out["sep_oil_std"] * pvt.flash_factor / 1000.0  # mscf/day
    out["sep_gas_std"]           = out["sep_gas"] + out["sep_flash_gas"]

    # --- Water cut ---
    out["mpfm_wc"] = out["mpfm_water"] / out["mpfm_liquid"]
    out["sep_wc"]  = out["sep_free_water"] / out["sep_liquid_std"]

    # --- GOR (scf/stb) ---
    out["mpfm_gor"] = out["mpfm_gas"] * 1000.0 / out["mpfm_oil"]
    out["sep_gor"]  = out["sep_gas_std"] * 1000.0 / out["sep_oil_std"]

    return out


def compute_uncertainty_columns(
    df:  pd.DataFrame,
    pvt: PVTProperties,
    unc: MeasurementUncertainties,
    agg: Optional[MeterAggregation] = None,
) -> pd.DataFrame:
    """
    Compute per-timestep 1-sigma absolute uncertainties for all derived
    quantities using first-order Gaussian error propagation.

    Returns a DataFrame with the same index as *df* containing sigma_* columns.
    """
    if agg is None:
        agg = MeterAggregation()

    out = pd.DataFrame(index=df.index)

    # ------------------------------------------------------------------
    # 1. MPFM totals — sum of independent meters with same relative unc
    #    σ_sum = r * sqrt(Σ xᵢ²)
    # ------------------------------------------------------------------
    out["sigma_mpfm_oil"] = unc.r_mpfm_oil * np.sqrt(
        sum(df[f"{m}_oil"]   ** 2 for m in agg.meter_ids)
    )
    out["sigma_mpfm_water"] = unc.r_mpfm_water * np.sqrt(
        sum(df[f"{m}_water"] ** 2 for m in agg.meter_ids)
    )
    # Gas columns are mmscf/day in the raw data; match the ×1000 conversion
    out["sigma_mpfm_gas"] = unc.r_mpfm_gas * np.sqrt(
        sum(df[f"{m}_gas"]   ** 2 for m in agg.meter_ids)
    ) * 1000.0
    out["sigma_mpfm_liquid"] = np.sqrt(
        out["sigma_mpfm_oil"] ** 2 + out["sigma_mpfm_water"] ** 2
    )

    # ------------------------------------------------------------------
    # 2. Separator free water:  sep_free_water = sep_liq * bsw
    #    ∂/∂sep_liq = bsw,  ∂/∂bsw = sep_liq
    # ------------------------------------------------------------------
    sigma_sep_liq = unc.r_sep_liquid * df["sep_total_liquid"]
    sigma_bsw     = unc.r_bsw * pvt.bsw

    sigma_sep_free_water = np.sqrt(
        (pvt.bsw              * sigma_sep_liq) ** 2
        + (df["sep_total_liquid"] * sigma_bsw)  ** 2
    )
    out["sigma_sep_free_water"] = sigma_sep_free_water

    # ------------------------------------------------------------------
    # 3. Sep oil at standard conditions:
    #    sep_oil_std = sep_liq * (1−bsw) * shrinkage
    # ------------------------------------------------------------------
    one_minus_bsw   = 1.0 - pvt.bsw
    sigma_shrinkage = unc.r_oil_shrinkage * pvt.oil_shrinkage

    out["sigma_sep_oil_std"] = np.sqrt(
        (pvt.oil_shrinkage * one_minus_bsw      * sigma_sep_liq)  ** 2
        + (pvt.oil_shrinkage * df["sep_total_liquid"] * sigma_bsw) ** 2
        + (one_minus_bsw    * df["sep_total_liquid"] * sigma_shrinkage) ** 2
    )

    # ------------------------------------------------------------------
    # 4. Sep liquid at standard conditions: free_water + oil_std
    # ------------------------------------------------------------------
    out["sigma_sep_liquid_std"] = np.sqrt(
        sigma_sep_free_water    ** 2
        + out["sigma_sep_oil_std"] ** 2
    )

    # ------------------------------------------------------------------
    # 5. Sep gas at standard conditions:
    #    sep_gas_std = sep_gas + sep_oil_std * flash / 1000
    # ------------------------------------------------------------------
    sigma_sep_gas = unc.r_sep_gas    * df["sep_gas"]
    sigma_flash   = unc.r_flash_factor * pvt.flash_factor

    out["sigma_sep_gas_std"] = np.sqrt(
        sigma_sep_gas ** 2
        + (pvt.flash_factor / 1000.0 * out["sigma_sep_oil_std"]) ** 2
        + (df["sep_oil_std"] / 1000.0 * sigma_flash)             ** 2
    )

    # ------------------------------------------------------------------
    # 6. Water cut:  wc = num / denom
    #    σ_wc² = (σ_num/denom)² + (num·σ_denom/denom²)²
    # ------------------------------------------------------------------
    out["sigma_mpfm_wc"] = np.sqrt(
        (out["sigma_mpfm_water"] / df["mpfm_liquid"]) ** 2
        + (df["mpfm_water"] * out["sigma_mpfm_liquid"] / df["mpfm_liquid"] ** 2) ** 2
    )
    out["sigma_sep_wc"] = np.sqrt(
        (sigma_sep_free_water / df["sep_liquid_std"]) ** 2
        + (df["sep_free_water"] * out["sigma_sep_liquid_std"] / df["sep_liquid_std"] ** 2) ** 2
    )

    # ------------------------------------------------------------------
    # 7. GOR:  gor = gas * 1000 / oil
    # ------------------------------------------------------------------
    out["sigma_mpfm_gor"] = np.sqrt(
        (1000.0 * out["sigma_mpfm_gas"] / df["mpfm_oil"]) ** 2
        + (1000.0 * df["mpfm_gas"] * out["sigma_mpfm_oil"] / df["mpfm_oil"] ** 2) ** 2
    )
    out["sigma_sep_gor"] = np.sqrt(
        (1000.0 * out["sigma_sep_gas_std"] / df["sep_oil_std"]) ** 2
        + (1000.0 * df["sep_gas_std"] * out["sigma_sep_oil_std"] / df["sep_oil_std"] ** 2) ** 2
    )

    return out


def compute_deviations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute per-timestep relative and absolute deviations between MPFM and
    separator reference for each phase.
    """
    phases = {
        "oil":    ("mpfm_oil",    "sep_oil_std"),
        "gas":    ("mpfm_gas",    "sep_gas_std"),
        "water":  ("mpfm_water",  "sep_free_water"),
        "liquid": ("mpfm_liquid", "sep_liquid_std"),
        "wc":     ("mpfm_wc",    "sep_wc"),
        "gor":    ("mpfm_gor",   "sep_gor"),
    }

    devs = pd.DataFrame(index=df.index)
    for phase, (mpfm_col, sep_col) in phases.items():
        devs[f"{phase}_abs_dev"] = df[mpfm_col] - df[sep_col]
        devs[f"{phase}_rel_dev"] = df[mpfm_col] / df[sep_col] - 1.0
        devs[f"{phase}_mpfm"]   = df[mpfm_col]
        devs[f"{phase}_sep"]    = df[sep_col]

    return devs


def build_comparison_table(
    df:       pd.DataFrame,
    devs:     pd.DataFrame,
    sigma_df: "pd.DataFrame | None" = None,
) -> pd.DataFrame:
    """
    Build a summary comparison table with mean values, deviations, standard
    errors, confidence intervals, and propagated measurement uncertainties.
    """
    phases     = ["oil", "gas", "water", "liquid", "wc", "gor"]
    units      = {
        "oil": "STB/day", "gas": "MSCF/day", "water": "STB/day",
        "liquid": "STB/day", "wc": "fraction", "gor": "SCF/STB",
    }
    acceptance = {
        "oil": 0.05, "gas": 0.05, "water": 0.05,
        "liquid": None, "wc": None, "gor": None,
    }

    _sigma_mpfm_col = {
        "oil": "sigma_mpfm_oil", "gas": "sigma_mpfm_gas",
        "water": "sigma_mpfm_water", "liquid": "sigma_mpfm_liquid",
        "wc": "sigma_mpfm_wc", "gor": "sigma_mpfm_gor",
    }
    _sigma_sep_col = {
        "oil": "sigma_sep_oil_std", "gas": "sigma_sep_gas_std",
        "water": "sigma_sep_free_water", "liquid": "sigma_sep_liquid_std",
        "wc": "sigma_sep_wc", "gor": "sigma_sep_gor",
    }

    n       = len(df)
    records = []

    for phase in phases:
        mpfm_mean = devs[f"{phase}_mpfm"].mean()
        sep_mean  = devs[f"{phase}_sep"].mean()
        abs_dev   = devs[f"{phase}_abs_dev"]
        rel_dev   = devs[f"{phase}_rel_dev"]

        mean_rel = rel_dev.mean()
        std_rel  = rel_dev.std(ddof=1)
        se_rel   = std_rel / np.sqrt(n)

        mean_abs = abs_dev.mean()
        std_abs  = abs_dev.std(ddof=1)
        se_abs   = std_abs / np.sqrt(n)

        ci95_rel = 1.96 * se_rel

        # Propagated uncertainties on means
        sigma_mpfm_mean = None
        sigma_sep_mean  = None
        sigma_rel_dev   = None
        if sigma_df is not None and not sigma_df.empty:
            mc = _sigma_mpfm_col.get(phase)
            sc = _sigma_sep_col.get(phase)
            if mc and mc in sigma_df.columns:
                sigma_mpfm_mean = float(sigma_df[mc].mean())
            if sc and sc in sigma_df.columns:
                sigma_sep_mean = float(sigma_df[sc].mean())
            if sigma_mpfm_mean is not None and sigma_sep_mean is not None and sep_mean != 0:
                sigma_rel_dev = float(np.sqrt(
                    (sigma_mpfm_mean / sep_mean) ** 2
                    + (mpfm_mean * sigma_sep_mean / sep_mean ** 2) ** 2
                ))

        # Paired z-test: H0 = mean(MPFM − Sep) = 0
        if se_abs > 0:
            z_stat  = mean_abs / se_abs
            p_value = 2.0 * (1.0 - stats.norm.cdf(abs(z_stat)))
        else:
            z_stat  = 0.0
            p_value = 1.0

        records.append({
            "phase":              phase,
            "unit":               units[phase],
            "mpfm_mean":          mpfm_mean,
            "sep_ref_mean":       sep_mean,
            "mean_abs_deviation": mean_abs,
            "mean_rel_deviation": mean_rel,
            "std_rel_deviation":  std_rel,
            "se_rel_deviation":   se_rel,
            "ci95_rel_lower":     mean_rel - ci95_rel,
            "ci95_rel_upper":     mean_rel + ci95_rel,
            "std_abs_deviation":  std_abs,
            "se_abs_deviation":   se_abs,
            "z_statistic":        z_stat,
            "p_value":            p_value,
            "sigma_mpfm_mean":    sigma_mpfm_mean,
            "sigma_sep_mean":     sigma_sep_mean,
            "sigma_rel_dev":      sigma_rel_dev,
            "n_samples":          n,
            "acceptance_limit":   acceptance.get(phase),
            "within_acceptance":  (
                abs(mean_rel) <= acceptance[phase]
                if acceptance.get(phase) is not None else None
            ),
        })

    return pd.DataFrame(records)
