"""
PocketTTS Proxy — app→voice mapping with server-enforced lock safety

This proxy accepts POST /tts with JSON { text, app } and will only forward
the request to the real PocketTTS endpoint if `app` exists in the configured
`POCKET_VOICE_PRESETS`. It never forwards arbitrary `voice` values — only the
presets. This keeps the upstream PocketTTS server locked while allowing
per-app mappings handled here (auditable).

Env vars:
 - POCKET_TTS_URL (default: http://127.0.0.1:8007/tts)
 - POCKET_VOICE_PRESETS (JSON string mapping app->preset)
 - PROXY_PORT (port to listen on, default 8017)

Usage:
 .venv\Scripts\python.exe scripts\pocket_tts_proxy.py
"""
import json
import os
import sys
import logging
from typing import Dict

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse

logging.basicConfig(level=logging.INFO, format="[PocketTTS-Proxy] %(message)s")
log = logging.getLogger("pocket_tts_proxy")

POCKET_TTS_URL = os.environ.get("POCKET_TTS_URL", "http://127.0.0.1:8007/tts")
PROXY_PORT = int(os.environ.get("PROXY_PORT", "8017"))
try:
    POCKET_VOICE_PRESETS: Dict[str, str] = json.loads(os.environ.get("POCKET_VOICE_PRESETS", "{}"))
except Exception:
    POCKET_VOICE_PRESETS = {}

app = FastAPI(title="PocketTTS Proxy — app→voice mapping")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "proxy_port": PROXY_PORT,
        "pocket_tts_url": POCKET_TTS_URL,
        "mapped_apps": list(POCKET_VOICE_PRESETS.keys()),
    }


def forward_tts(text: str, profile: str):
    headers = {"Content-Type": "application/json"}
    payload = {"text": text, "profile": profile}
    try:
        r = requests.post(POCKET_TTS_URL, json=payload, stream=True, timeout=30)
        if not r.ok:
            raise RuntimeError(f"upstream returned {r.status_code}: {r.text[:200]}")
        content_type = r.headers.get("content-type", "audio/mpeg")
        return StreamingResponse(r.iter_content(chunk_size=4096), media_type=content_type)
    except Exception as e:
        log.warning("Forward TTS error: %s", e)
        raise


@app.post("/tts")
async def synth(req: Request):
    body = await req.json()
    text = (body.get("text") or "").strip()
    app_name = body.get("app")

    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    if not app_name or str(app_name) not in POCKET_VOICE_PRESETS:
        # For audit/safety, we only allow mapped apps. Reject otherwise.
        raise HTTPException(status_code=403, detail="app not mapped to any voice preset")

    profile = POCKET_VOICE_PRESETS.get(str(app_name))
    log.info("Synth request app=%s -> profile=%s len=%d", app_name, profile, len(text))

    try:
        return forward_tts(text, profile)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/synthesize")
async def synth_alias(req: Request):
    return await synth(req)


if __name__ == "__main__":
    # Run via uvicorn when executed directly
    import uvicorn

    log.info("Starting PocketTTS Proxy on :%d -> upstream=%s", PROXY_PORT, POCKET_TTS_URL)
    uvicorn.run(app, host="127.0.0.1", port=PROXY_PORT, log_level="warning")
