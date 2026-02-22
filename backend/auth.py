"""
Azure AD multi-tenant JWT validation for FastAPI.

Tokens are ID tokens acquired by the React frontend via MSAL.
The audience is fixed to the app's Client ID; the issuer varies per tenant
(multi-tenant), so issuer format is checked but the value is not pinned.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CLIENT_ID = "ae1fa56e-61ae-4e34-a490-2e413ade8b8d"

# Multi-tenant JWKS endpoint (returns keys for all tenants)
_JWKS_URL = "https://login.microsoftonline.com/common/discovery/v2.0/keys"
_JWKS_TTL = 3600.0  # seconds — keys rotate infrequently

# ---------------------------------------------------------------------------
# JWKS key cache
# ---------------------------------------------------------------------------

_jwks_cache: dict[str, object] = {}
_jwks_fetched_at: float = float("-inf")  # ensures first call always fetches


def _fetch_jwks() -> dict[str, object]:
    """Return a {kid: RSA_public_key} dict, refreshing from Azure at most hourly."""
    global _jwks_cache, _jwks_fetched_at

    if time.monotonic() - _jwks_fetched_at < _JWKS_TTL:
        return _jwks_cache

    resp = httpx.get(_JWKS_URL, timeout=10)
    resp.raise_for_status()
    keys = resp.json()["keys"]
    _jwks_cache = {
        k["kid"]: jwt.algorithms.RSAAlgorithm.from_jwk(k)
        for k in keys
    }
    _jwks_fetched_at = time.monotonic()
    logger.info("Refreshed Azure AD JWKS (%d keys)", len(_jwks_cache))
    return _jwks_cache


def _get_public_key(kid: str) -> object:
    """Return the RSA public key for the given key ID, refreshing once if not found."""
    jwks = _fetch_jwks()
    if kid in jwks:
        return jwks[kid]

    # Key may have just rotated — force a refresh
    global _jwks_fetched_at
    _jwks_fetched_at = float("-inf")
    jwks = _fetch_jwks()
    if kid not in jwks:
        raise HTTPException(status_code=401, detail="Unknown signing key")
    return jwks[kid]


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> str:
    """
    Validate an Azure AD ID token and return a stable, globally-unique user ID:
    ``"{tenant_id}:{object_id}"``

    Raises HTTP 401 on any validation failure.
    """
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid: Optional[str] = header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Token has no key ID")

        public_key = _get_public_key(kid)

        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            options={"verify_iss": False},  # issuer varies per tenant
        )

        # Manually verify issuer format (must be an Azure AD tenant)
        iss: str = claims.get("iss", "")
        if not iss.startswith("https://login.microsoftonline.com/"):
            raise HTTPException(status_code=401, detail="Invalid token issuer")

    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        logger.warning("Token validation failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        logger.exception("Unexpected error during token validation")
        raise HTTPException(status_code=401, detail="Authentication error")

    oid: Optional[str] = claims.get("oid")
    tid: Optional[str] = claims.get("tid")
    if not oid or not tid:
        raise HTTPException(status_code=401, detail="Token missing oid/tid claims")

    return f"{tid}:{oid}"
