"""
brain/modules/vision_context.py
────────────────────────────────
Pull the latest perception snapshot from the Vision Agent (port 8005).
Returns None on failure so callers can always proceed without vision data.
"""

import httpx
from datetime import datetime, timezone

VISION_URL   = "http://127.0.0.1:8005/stream/state"
MAX_AGE_SECS = 30   # reject snapshots older than this


def get_environment_snapshot() -> dict | None:
    """
    Fetch the latest perception state from Vision Agent.
    Returns a dict with keys: caption, objects, lighting, timestamp
    Returns None if vision is offline or data is stale.
    """
    try:
        resp = httpx.get(VISION_URL, timeout=3.0)
        if resp.status_code != 200:
            return None
        data = resp.json()

        # Staleness check
        ts_str = data.get("timestamp")
        if ts_str:
            try:
                ts = datetime.fromisoformat(ts_str)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - ts).total_seconds()
                if age > MAX_AGE_SECS:
                    return None
            except Exception:
                pass

        return data
    except Exception:
        return None
