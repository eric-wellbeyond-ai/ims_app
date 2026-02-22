import io
import logging
import os
import tempfile
import traceback
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from backend.schemas import AnalysisRequest, AnalysisResponse, PhaseResult
from backend.services.analysis_service import run_analysis, get_cached_result

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    file: UploadFile = File(...),
    config: str = Form(...),
):
    """Run MPFM validation analysis on an uploaded spreadsheet."""
    logger.info("Received analysis request")
    logger.info("File: %s (content_type: %s)", file.filename, file.content_type)
    logger.info("Config JSON: %s", config)

    req = AnalysisRequest.model_validate_json(config)
    logger.info("Parsed config: pvt=%s, window=%s -> %s, sheet=%s",
                req.pvt, req.test_start, req.test_end, req.sheet_name)

    suffix = Path(file.filename or "upload.xlsx").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    logger.info("Saved upload to temp file: %s (%d bytes)", tmp_path, len(content))

    try:
        result = run_analysis(
            tmp_path,
            req.sheet_name,
            req.pvt,
            req.test_start,
            req.test_end,
            pvt_unc=req.pvt_uncertainties,
            channel_unc=req.channel_uncertainties,
        )
    except ValueError as e:
        logger.error("Analysis ValueError: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Analysis failed: %s", e)
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    logger.info("Returning response with %d comparison rows, %d deviation rows",
                len(result["comparison"]), len(result["deviations"]))

    return AnalysisResponse(
        comparison=[PhaseResult(**row) for row in result["comparison"]],
        deviations=result["deviations"],
        timeseries=result["timeseries"],
        sigma_ts=result.get("sigma_ts", []),
        pvt=req.pvt,
        test_start=req.test_start.isoformat(),
        test_end=req.test_end.isoformat(),
        n_samples=result["n_samples"],
        session_id=result["session_id"],
    )


@router.get("/api/export/{session_id}")
async def export_csv(session_id: str):
    """Export the comparison summary as a CSV file."""
    cached = get_cached_result(session_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Session expired or not found")

    csv_buffer = io.StringIO()
    cached["comparison"].to_csv(csv_buffer, index=False)
    csv_bytes = csv_buffer.getvalue().encode("utf-8")

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=comparison_{session_id}.csv"
        },
    )
