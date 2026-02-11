import io
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from backend.schemas import AnalysisRequest, AnalysisResponse, PhaseResult
from backend.services.analysis_service import run_analysis, get_cached_result

router = APIRouter()


@router.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(
    file: UploadFile = File(...),
    config: str = Form(...),
):
    """Run MPFM validation analysis on an uploaded spreadsheet."""
    req = AnalysisRequest.model_validate_json(config)

    suffix = Path(file.filename or "upload.xlsx").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = run_analysis(
            tmp_path,
            req.sheet_name,
            req.pvt,
            req.test_start,
            req.test_end,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return AnalysisResponse(
        comparison=[PhaseResult(**row) for row in result["comparison"]],
        deviations=result["deviations"],
        timeseries=result["timeseries"],
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
