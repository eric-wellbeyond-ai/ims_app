"""
Case persistence API endpoints.

POST   /api/cases              – save a new case (config + optional file)
GET    /api/cases              – list all cases (summary only)
GET    /api/cases/latest       – retrieve the most recently saved case
GET    /api/cases/{id}         – retrieve a specific case
GET    /api/cases/{id}/file    – stream the stored data file
DELETE /api/cases/{id}         – delete a case
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.database import (
    FILES_DIR,
    delete_case,
    get_case,
    get_latest_case,
    list_cases,
    save_case,
    update_case,
    update_case_file,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/cases", tags=["cases"])


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

@router.post("")
async def create_case(
    config: str           = Form(...),
    name:   str           = Form(default=""),
    file:   Optional[UploadFile] = File(default=None),
):
    """Save the current form inputs (and optionally the data file)."""
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config JSON: {exc}")

    # Insert the row first to obtain the case_id (used as the file directory)
    case_id = save_case(config=config_dict, name=name)

    if file and file.filename:
        file_dir = FILES_DIR / str(case_id)
        file_dir.mkdir(parents=True, exist_ok=True)
        dest = file_dir / file.filename
        content = await file.read()
        dest.write_bytes(content)
        update_case_file(case_id, file.filename, str(dest))
        logger.info("Saved case %d with file %s (%d bytes)", case_id, dest, len(content))
    else:
        logger.info("Saved case %d (no file)", case_id)

    return {"id": case_id}


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------

@router.put("/{case_id}")
async def update_case_endpoint(
    case_id: int,
    config:  str                  = Form(...),
    name:    str                  = Form(default=""),
    file:    Optional[UploadFile] = File(default=None),
):
    """Update an existing case's config/name and optionally replace its data file."""
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config JSON: {exc}")

    if not update_case(case_id, config_dict, name):
        raise HTTPException(status_code=404, detail="Case not found")

    if file and file.filename:
        file_dir = FILES_DIR / str(case_id)
        file_dir.mkdir(parents=True, exist_ok=True)
        dest = file_dir / file.filename
        content = await file.read()
        dest.write_bytes(content)
        update_case_file(case_id, file.filename, str(dest))
        logger.info("Updated case %d file → %s (%d bytes)", case_id, dest, len(content))
    else:
        logger.info("Updated case %d (config/name only)", case_id)

    return {"id": case_id}


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("")
def get_cases():
    """Return a summary list of all saved cases (newest first)."""
    return list_cases()


# ---------------------------------------------------------------------------
# Latest / by ID
# ---------------------------------------------------------------------------

@router.get("/latest")
def retrieve_latest():
    """Return the most recently saved case, or 404 if none exist."""
    case = get_latest_case()
    if case is None:
        raise HTTPException(status_code=404, detail="No saved cases found")
    return case


@router.get("/{case_id}")
def retrieve_case(case_id: int):
    case = get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------

@router.get("/{case_id}/file")
def download_file(case_id: int):
    """Stream the stored data file for this case."""
    case = get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if not case.get("has_file"):
        raise HTTPException(status_code=404, detail="No file stored for this case")

    file_path = Path(case["file_path"])
    return FileResponse(
        path=str(file_path),
        filename=case["file_name"],
        media_type="application/octet-stream",
    )


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

@router.delete("/{case_id}")
def remove_case(case_id: int):
    if not delete_case(case_id):
        raise HTTPException(status_code=404, detail="Case not found")
    return {"deleted": case_id}
