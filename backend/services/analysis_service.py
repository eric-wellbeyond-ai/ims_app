import sys
import uuid
from pathlib import Path

import pandas as pd
import numpy as np

# Add the algorithm directory to the path
ALGO_DIR = str(Path(__file__).resolve().parent.parent.parent.parent / "claude_algo")
if ALGO_DIR not in sys.path:
    sys.path.insert(0, ALGO_DIR)

from mpfm_analysis import (
    read_timeseries,
    filter_test_window,
    compute_derived_columns,
    compute_deviations,
    build_comparison_table,
    PVTProperties,
    TestWindow,
)

from backend.schemas import PVTConfig

# In-memory cache for export (keyed by session_id)
_result_cache: dict[str, dict] = {}


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to JSON-serializable list of dicts."""
    out = df.reset_index()
    # Convert timestamps to ISO strings
    for col in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[col]):
            out[col] = out[col].dt.strftime("%Y-%m-%dT%H:%M:%S")
    # Replace NaN with None
    out = out.where(out.notna(), None)
    return out.to_dict("records")


def run_analysis(
    filepath: str,
    sheet_name: str,
    pvt_config: PVTConfig,
    test_start,
    test_end,
) -> dict:
    """
    Run the MPFM validation analysis using user-provided config.
    Bypasses read_metadata() — PVT and window come from the form.
    """
    pvt = PVTProperties(
        oil_shrinkage=pvt_config.oil_shrinkage,
        flash_factor=pvt_config.flash_factor,
        bsw=pvt_config.bsw,
    )
    window = TestWindow(
        start=pd.Timestamp(test_start),
        end=pd.Timestamp(test_end),
    )

    # Determine if file is CSV or Excel
    ext = Path(filepath).suffix.lower()
    if ext == ".csv":
        raw = _read_csv(filepath)
    else:
        raw = read_timeseries(filepath, sheet_name)

    ts = filter_test_window(raw, window)
    ts = compute_derived_columns(ts, pvt)
    devs = compute_deviations(ts)
    comparison = build_comparison_table(ts, devs)

    session_id = str(uuid.uuid4())
    _result_cache[session_id] = {
        "comparison": comparison,
        "deviations": devs,
        "timeseries": ts,
    }

    return {
        "comparison": comparison.to_dict("records"),
        "deviations": _df_to_records(devs),
        "timeseries": _df_to_records(ts),
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
