"""
SQLite persistence layer for saved validation cases.

Database:   ims_app/data/cases.db
File store: ims_app/data/case_files/{case_id}/{original_filename}
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Paths relative to the ims_app/ root (two levels up from backend/)
_BACKEND_DIR = Path(__file__).parent
_DATA_DIR    = _BACKEND_DIR.parent / "data"
DB_PATH      = _DATA_DIR / "cases.db"
FILES_DIR    = _DATA_DIR / "case_files"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_DDL = """
CREATE TABLE IF NOT EXISTS cases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL DEFAULT 'Unnamed Case',
    created_at  TEXT    NOT NULL,
    config      TEXT    NOT NULL,
    file_name   TEXT,
    file_path   TEXT
);
"""


def _connect() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables if they don't exist.  Safe to call on every startup."""
    with _connect() as conn:
        conn.executescript(_DDL)
        conn.commit()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def save_case(
    config:    dict,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
    name:      str           = "",
) -> int:
    """Insert a new case row.  Returns the new row id."""
    if not name:
        name = datetime.now(timezone.utc).strftime("Case %Y-%m-%d %H:%M UTC")
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO cases (name, created_at, config, file_name, file_path) "
            "VALUES (?, ?, ?, ?, ?)",
            (name, created_at, json.dumps(config), file_name, file_path),
        )
        conn.commit()
        return cur.lastrowid


def update_case(
    case_id:   int,
    config:    dict,
    name:      str,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
) -> bool:
    """Update config and name of an existing case.  Returns True if the row existed."""
    case = get_case(case_id)
    if case is None:
        return False
    with _connect() as conn:
        conn.execute(
            "UPDATE cases SET config = ?, name = ? WHERE id = ?",
            (json.dumps(config), name, case_id),
        )
        conn.commit()
    if file_name is not None and file_path is not None:
        update_case_file(case_id, file_name, file_path)
    return True


def update_case_file(case_id: int, file_name: str, file_path: str) -> None:
    """Attach file metadata to an already-saved case (called after file is written)."""
    with _connect() as conn:
        conn.execute(
            "UPDATE cases SET file_name = ?, file_path = ? WHERE id = ?",
            (file_name, file_path, case_id),
        )
        conn.commit()


def get_case(case_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cases WHERE id = ?", (case_id,)
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def get_latest_case() -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cases ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def list_cases() -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at, file_name FROM cases ORDER BY id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete_case(case_id: int) -> bool:
    """Delete a case and its stored file.  Returns True if the row existed."""
    case = get_case(case_id)
    if case is None:
        return False
    # Remove stored file
    if case.get("file_path"):
        fp = Path(case["file_path"])
        if fp.exists():
            fp.unlink()
        # Remove parent dir if empty
        try:
            fp.parent.rmdir()
        except OSError:
            pass
    with _connect() as conn:
        conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
        conn.commit()
    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if isinstance(d.get("config"), str):
        d["config"] = json.loads(d["config"])
    d["has_file"] = bool(d.get("file_path") and Path(d["file_path"]).exists())
    return d
