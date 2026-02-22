from __future__ import annotations

import uuid
import logging
from pathlib import Path

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

from backend.bespoke_parser import read_timeseries
from backend.mpfm_analysis import (
    filter_test_window,
    compute_derived_columns,
    compute_uncertainty_columns,
    compute_deviations,
    build_comparison_table,
    PVTProperties,
    TestWindow,
    MeasurementUncertainties,
    MeterAggregation,
    AggregationMode,
)

from backend.schemas import (
    PVTConfig,
    PVTUncertainties,
    ChannelUncertainties,
    MeterAggregationConfig,
)

# In-memory cache for export (keyed by session_id)
_result_cache: dict[str, dict] = {}


def _sanitize_value(v):
    """Convert NaN/NaT to None for JSON serialization."""
    if v is None:
        return None
    if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to JSON-serializable list of dicts."""
    out = df.reset_index()
    # Convert timestamps to ISO strings
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%S")
    # Replace NaN with None
    out = out.where(out.notna(), None)
    records = out.to_dict("records")
    # Sanitize numpy types
    return [{k: _sanitize_value(v) for k, v in row.items()} for row in records]


def run_analysis(
    filepath: str,
    sheet_name: str,
    pvt_config: PVTConfig,
    test_start,
    test_end,
    pvt_unc: PVTUncertainties | None = None,
    channel_unc: ChannelUncertainties | None = None,
    agg_config: MeterAggregationConfig | None = None,
) -> dict:
    """
    Run the MPFM validation analysis using user-provided config.
    Bypasses read_metadata() — PVT and window come from the form.
    """
    logger.info("=== Starting analysis ===")
    logger.info("File: %s (exists: %s, size: %s bytes)",
                filepath, Path(filepath).exists(),
                Path(filepath).stat().st_size if Path(filepath).exists() else "N/A")
    logger.info("Sheet: %s", sheet_name)
    logger.info("PVT: shrinkage=%s, flash=%s, bsw=%s",
                pvt_config.oil_shrinkage, pvt_config.flash_factor, pvt_config.bsw)
    logger.info("Window: %s -> %s", test_start, test_end)

    pvt = PVTProperties(
        oil_shrinkage=pvt_config.oil_shrinkage,
        flash_factor=pvt_config.flash_factor,
        bsw=pvt_config.bsw,
    )
    def _naive(ts) -> pd.Timestamp:
        """Convert to a tz-naive Timestamp so it can be compared with Excel data."""
        t = pd.Timestamp(ts)
        return t.tz_convert(None) if t.tzinfo is not None else t

    window = TestWindow(start=_naive(test_start), end=_naive(test_end))

    # Determine if file is CSV or Excel
    ext = Path(filepath).suffix.lower()
    logger.info("File extension: %s", ext)

    if ext == ".csv":
        logger.info("Reading as CSV")
        raw = _read_csv(filepath)
    else:
        logger.info("Reading as Excel with openpyxl")
        raw = read_timeseries(filepath, sheet_name)

    logger.info("Raw data: %d rows, %s -> %s", len(raw), raw.index.min(), raw.index.max())

    ts = filter_test_window(raw, window)
    logger.info("Filtered to test window: %d rows", len(ts))

    agg = MeterAggregation(
        mode=AggregationMode(agg_config.mode) if agg_config else AggregationMode.SUM,
        meter_ids=agg_config.meter_ids if agg_config else ["mpfm1", "mpfm2", "mpfm3"],
    )
    logger.info("Aggregation: mode=%s, meters=%s", agg.mode, agg.meter_ids)

    ts = compute_derived_columns(ts, pvt, agg=agg)
    logger.info("Derived columns computed. Columns: %s", list(ts.columns))

    devs = compute_deviations(ts)
    logger.info("Deviations computed: %d rows", len(devs))

    # Build uncertainty container (convert % → fraction)
    if pvt_unc is None:
        pvt_unc = PVTUncertainties()
    if channel_unc is None:
        channel_unc = ChannelUncertainties()

    unc = MeasurementUncertainties(
        r_sep_liquid=channel_unc.sep_liquid_pct / 100.0,
        r_sep_gas=channel_unc.sep_gas_pct / 100.0,
        r_mpfm_oil=channel_unc.mpfm_oil_pct / 100.0,
        r_mpfm_gas=channel_unc.mpfm_gas_pct / 100.0,
        r_mpfm_water=channel_unc.mpfm_water_pct / 100.0,
        r_bsw=pvt_unc.bsw_pct / 100.0,
        r_oil_shrinkage=pvt_unc.oil_shrinkage_pct / 100.0,
        r_flash_factor=pvt_unc.flash_factor_pct / 100.0,
    )

    all_zero = all(v == 0.0 for v in [
        unc.r_sep_liquid, unc.r_sep_gas,
        unc.r_mpfm_oil, unc.r_mpfm_gas, unc.r_mpfm_water,
        unc.r_bsw, unc.r_oil_shrinkage, unc.r_flash_factor,
    ])
    if all_zero:
        sigma_ts = pd.DataFrame(index=ts.index)
        logger.info("All uncertainties are zero — skipping propagation.")
    else:
        sigma_ts = compute_uncertainty_columns(ts, pvt, unc, agg=agg)
        logger.info("Uncertainty columns computed.")

    comparison = build_comparison_table(ts, devs, sigma_df=sigma_ts if not sigma_ts.empty else None)
    logger.info("Comparison table:\n%s", comparison.to_string())

    session_id = str(uuid.uuid4())
    _result_cache[session_id] = {
        "comparison": comparison,
        "deviations": devs,
        "timeseries": ts,
        "sigma_ts": sigma_ts,
    }

    # Sanitize comparison records (handles NaN acceptance_limit, None within_acceptance)
    comp_records = comparison.to_dict("records")
    comp_records = [{k: _sanitize_value(v) for k, v in row.items()} for row in comp_records]

    logger.info("=== Analysis complete. Session: %s ===", session_id)

    return {
        "comparison": comp_records,
        "deviations": _df_to_records(devs),
        "timeseries": _df_to_records(ts),
        "sigma_ts": _df_to_records(sigma_ts) if not sigma_ts.empty else [],
        "n_samples": len(ts),
        "session_id": session_id,
    }


def _read_csv(filepath: str) -> pd.DataFrame:
    """Read CSV with the same column layout as the Excel reader."""
    col_names = [
        "timestamp", "sep_total_liquid", "sep_gas", "sep_temperature",
        "sep_pressure", "sep_gas_dp",
        "mpfm1_oil", "mpfm1_gas", "mpfm1_water",
        "mpfm2_oil", "mpfm2_gas", "mpfm2_water",
        "mpfm3_oil", "mpfm3_gas", "mpfm3_water",
        "spot_wlr",
    ]
    df = pd.read_csv(filepath, names=col_names, parse_dates=["timestamp"])
    df = df.dropna(subset=["timestamp"])
    df = df.set_index("timestamp").sort_index()
    for c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def get_cached_result(session_id: str) -> dict | None:
    return _result_cache.get(session_id)
