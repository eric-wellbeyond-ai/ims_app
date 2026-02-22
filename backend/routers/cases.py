"""
Case persistence API endpoints.

POST   /api/cases                  – save a new case (config + optional file)
GET    /api/cases                  – list all cases (summary only)
GET    /api/cases/latest           – retrieve the most recently saved case
GET    /api/cases/{id}             – retrieve a specific case
GET    /api/cases/{id}/file        – stream the stored data file
PUT    /api/cases/{id}             – update an existing case
DELETE /api/cases/{id}             – delete a case
POST   /api/cases/claim-unassigned – assign pre-auth cases to the current user
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.auth import get_current_user
from backend.database import (
    FILES_DIR,
    claim_unassigned_cases,
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
# Claim unassigned (called once on first login to adopt pre-auth data)
# ---------------------------------------------------------------------------

@router.post("/claim-unassigned")
def claim_cases(current_user: str = Depends(get_current_user)):
    """Assign any ownerless cases (user_id='') to the authenticated user."""
    claimed = claim_unassigned_cases(current_user)
    return {"claimed": claimed}


# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------

@router.post("")
async def create_case(
    config:       str                  = Form(...),
    name:         str                  = Form(default=""),
    file:         Optional[UploadFile] = File(default=None),
    current_user: str                  = Depends(get_current_user),
):
    """Save the current form inputs (and optionally the data file)."""
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config JSON: {exc}")

    case_id = save_case(config=config_dict, name=name, user_id=current_user)

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
    case_id:      int,
    config:       str                  = Form(...),
    name:         str                  = Form(default=""),
    file:         Optional[UploadFile] = File(default=None),
    current_user: str                  = Depends(get_current_user),
):
    """Update an existing case's config/name and optionally replace its data file."""
    try:
        config_dict = json.loads(config)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid config JSON: {exc}")

    if not update_case(case_id, config_dict, name, user_id=current_user):
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
def get_cases(current_user: str = Depends(get_current_user)):
    """Return a summary list of all cases owned by the current user (newest first)."""
    return list_cases(current_user)


# ---------------------------------------------------------------------------
# Latest / by ID
# ---------------------------------------------------------------------------

@router.get("/latest")
def retrieve_latest(current_user: str = Depends(get_current_user)):
    """Return the most recently saved case for the current user, or 404 if none."""
    case = get_latest_case(current_user)
    if case is None:
        raise HTTPException(status_code=404, detail="No saved cases found")
    return case


@router.get("/{case_id}")
def retrieve_case(case_id: int, current_user: str = Depends(get_current_user)):
    case = get_case(case_id, current_user)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------

@router.get("/{case_id}/file")
def download_file(case_id: int, current_user: str = Depends(get_current_user)):
    """Stream the stored data file for this case."""
    case = get_case(case_id, current_user)
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
def remove_case(case_id: int, current_user: str = Depends(get_current_user)):
    if not delete_case(case_id, current_user):
        raise HTTPException(status_code=404, detail="Case not found")
    return {"deleted": case_id}
