"""
SQLite persistence layer for saved validation cases.

Database:   ims_app/data/cases.db
File store: ims_app/data/case_files/{case_id}/{original_filename}

All queries are scoped by user_id (format: "{tenant_id}:{object_id}" from Azure AD).
"""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

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
    file_path   TEXT,
    user_id     TEXT    NOT NULL DEFAULT ''
);
"""


def _connect() -> sqlite3.Connection:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create tables and run migrations.  Safe to call on every startup."""
    with _connect() as conn:
        conn.executescript(_DDL)
        conn.commit()
    _migrate()


def _migrate() -> None:
    """Add new columns to existing tables without data loss."""
    with _connect() as conn:
        existing_cols = {
            row[1]
            for row in conn.execute("PRAGMA table_info(cases)").fetchall()
        }
        if "user_id" not in existing_cols:
            conn.execute(
                "ALTER TABLE cases ADD COLUMN user_id TEXT NOT NULL DEFAULT ''"
            )
            conn.commit()
            logger.info("Migration: added user_id column to cases table")


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def save_case(
    config:    dict,
    name:      str,
    user_id:   str,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
) -> int:
    """Insert a new case row.  Returns the new row id."""
    if not name:
        name = datetime.now(timezone.utc).strftime("Case %Y-%m-%d %H:%M UTC")
    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO cases (name, created_at, config, file_name, file_path, user_id) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (name, created_at, json.dumps(config), file_name, file_path, user_id),
        )
        conn.commit()
        return cur.lastrowid


def update_case(
    case_id:   int,
    config:    dict,
    name:      str,
    user_id:   str,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
) -> bool:
    """Update config and name of an existing case owned by user_id.
    Returns True if the row existed and was updated."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT id FROM cases WHERE id = ? AND user_id = ?",
            (case_id, user_id),
        ).fetchone()
        if row is None:
            return False
        conn.execute(
            "UPDATE cases SET config = ?, name = ? WHERE id = ? AND user_id = ?",
            (json.dumps(config), name, case_id, user_id),
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


def get_case(case_id: int, user_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cases WHERE id = ? AND user_id = ?",
            (case_id, user_id),
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def get_latest_case(user_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM cases WHERE user_id = ? ORDER BY id DESC LIMIT 1",
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return _row_to_dict(row)


def list_cases(user_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, name, created_at, file_name FROM cases "
            "WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_case(case_id: int, user_id: str) -> bool:
    """Delete a case and its stored file.  Returns True if the row existed."""
    case = get_case(case_id, user_id)
    if case is None:
        return False
    if case.get("file_path"):
        fp = Path(case["file_path"])
        if fp.exists():
            fp.unlink()
        try:
            fp.parent.rmdir()
        except OSError:
            pass
    with _connect() as conn:
        conn.execute(
            "DELETE FROM cases WHERE id = ? AND user_id = ?",
            (case_id, user_id),
        )
        conn.commit()
    return True


def claim_unassigned_cases(user_id: str) -> int:
    """Assign all cases with no owner (user_id='') to user_id.
    Called once after first login to preserve any pre-auth data.
    Returns the number of cases claimed."""
    with _connect() as conn:
        cur = conn.execute(
            "UPDATE cases SET user_id = ? WHERE user_id = ''",
            (user_id,),
        )
        conn.commit()
        count = cur.rowcount
    if count:
        logger.info("Claimed %d unassigned case(s) for user %s", count, user_id[:8] + "…")
    return count


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    if isinstance(d.get("config"), str):
        d["config"] = json.loads(d["config"])
    d["has_file"] = bool(d.get("file_path") and Path(d["file_path"]).exists())
    return d
