"""
Agent Lee Vision Agent — v2.1 (Real Inference)
════════════════════════════════════════════════
● Preserves: /status, /screen, /act (PyAutoGUI + mss)
● Adds:      /analyze, /stream/start, /stream/stop, /stream/state
● Camera loop: 2 FPS default, CPU-throttled to 0.5 FPS when load > 80%
● BLIP-base caption:  Salesforce/blip-image-captioning-base (transformers)
● ResNet-50 objects:  microsoft/resnet-50 (transformers image-classification)
● Lazy model load:    both models warm up in background after /stream/start
● Graceful fallback:  stubs used until models are ready / if load fails
"""

import os, io, time, threading, logging, base64
from datetime import datetime, timezone

import pyautogui
import mss
import mss.tools
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Optional heavy deps — graceful degradation
try:
    import psutil
    _PSUTIL = True
except ImportError:
    _PSUTIL = False

try:
    import cv2
    import numpy as np
    _CV2 = True
except ImportError:
    _CV2 = False

logging.basicConfig(level=logging.INFO, format="[vision] %(message)s")
log = logging.getLogger("vision_agent")

PORT = int(os.getenv("DESKTOP_AGENT_PORT", 6005))

BLIP_MODEL      = "Salesforce/blip-image-captioning-base"
CLASSIFY_MODEL  = "microsoft/resnet-50"
TOP_K_OBJECTS   = 5
MIN_CONFIDENCE  = 0.05   # filter out noise labels

# ── Model registry (lazy-loaded) ─────────────────────────────────────────────────
_model_lock   = threading.Lock()
_captioner    = None   # transformers pipeline("image-to-text")
_classifier   = None   # transformers pipeline("image-classification")
_models_ready = False
_models_error: str | None = None


def _load_models():
    """Load BLIP + ResNet-50 in background. Sets _models_ready when done."""
    global _captioner, _classifier, _models_ready, _models_error
    try:
        from transformers import pipeline
        log.info(f"Loading captioner: {BLIP_MODEL} (first run downloads ~450MB)")
        cap = pipeline("image-to-text", model=BLIP_MODEL, device=-1)   # -1 = CPU
        log.info(f"Loading classifier: {CLASSIFY_MODEL}")
        cls = pipeline("image-classification", model=CLASSIFY_MODEL, device=-1, top_k=TOP_K_OBJECTS)
        with _model_lock:
            _captioner    = cap
            _classifier   = cls
            _models_ready = True
        log.info("Vision models ready — real inference active")
    except Exception as e:
        with _model_lock:
            _models_error = str(e)
        log.warning(f"Vision model load failed (falling back to stubs): {e}")


def _bgr_to_pil(frame_bgr) -> Image.Image:
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)


def _estimate_lighting(frame_bgr) -> str:
    """Classify ambient light from mean pixel brightness — no model needed."""
    if not _CV2:
        return "unknown"
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    mean = float(np.mean(gray))
    if mean < 50:
        return "dark"
    elif mean < 120:
        return "dim"
    elif mean < 200:
        return "normal"
    return "bright"


def _blip_caption(frame_bgr) -> str:
    """Run BLIP-base captioning. Falls back to stub if models not ready."""
    with _model_lock:
        ready = _models_ready
        cap   = _captioner
    if not ready or cap is None:
        return "Initializing vision models..." if _models_error is None else "Scene captured."
    try:
        pil = _bgr_to_pil(frame_bgr)
        result = cap(pil, max_new_tokens=40)
        return result[0]["generated_text"].strip() if result else "Scene captured."
    except Exception as e:
        log.warning(f"BLIP inference error: {e}")
        return "Scene captured."


def _classify_objects(frame_bgr) -> list:
    """Run ResNet-50 image classification. Returns top-K labels as object list."""
    with _model_lock:
        ready = _models_ready
        cls   = _classifier
    if not ready or cls is None:
        return [{"label": "initializing", "confidence": 0.0}]
    try:
        pil     = _bgr_to_pil(frame_bgr)
        results = cls(pil)
        return [
            {"label": r["label"].split(",")[0].strip().lower(), "confidence": round(r["score"], 3)}
            for r in results
            if r["score"] >= MIN_CONFIDENCE
        ]
    except Exception as e:
        log.warning(f"ResNet inference error: {e}")
        return []


# ── Perception state ─────────────────────────────────────────────────────────────
_stream_state: dict = {}
_stream_lock    = threading.Lock()
_stream_running = False
_stream_thread: threading.Thread | None = None
_preload_thread: threading.Thread | None = None

DEFAULT_FPS   = 2.0
THROTTLE_FPS  = 0.5
CPU_THRESHOLD = 80.0   # % — throttle above this
MAX_INFER_MS  = 800    # ms — auto-throttle if inference is slow


def _perception_loop():
    global _stream_running, _stream_state
    log.info("Perception loop started")
    cam = None

    if _CV2:
        cam = cv2.VideoCapture(0)
        if not cam.isOpened():
            log.warning("Camera not found — running in screen-only mode")
            cam = None

    while _stream_running:
        loop_start = time.time()

        # Decide FPS
        cpu_pct    = psutil.cpu_percent(interval=None) if _PSUTIL else 0.0
        target_fps = THROTTLE_FPS if cpu_pct > CPU_THRESHOLD else DEFAULT_FPS
        interval   = 1.0 / target_fps

        frame_bgr = None
        if cam is not None and _CV2:
            ok, frame_bgr = cam.read()
            if not ok:
                frame_bgr = None

        infer_start = time.time()
        caption  = _blip_caption(frame_bgr)    if frame_bgr is not None else "No camera."
        objects  = _classify_objects(frame_bgr) if frame_bgr is not None else []
        lighting = _estimate_lighting(frame_bgr) if frame_bgr is not None else "unknown"
        infer_ms = (time.time() - infer_start) * 1000

        # Auto-throttle on slow inference
        if infer_ms > MAX_INFER_MS:
            target_fps = THROTTLE_FPS

        with _stream_lock:
            _stream_state = {
                "caption":   caption,
                "objects":   objects,
                "lighting":  lighting,
                "cpu":       round(cpu_pct, 1),
                "infer_ms":  round(infer_ms, 1),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        elapsed = time.time() - loop_start
        sleep_t = max(0.0, interval - elapsed)
        time.sleep(sleep_t)

    if cam is not None:
        cam.release()
    log.info("Perception loop stopped")


# ── FastAPI app ─────────────────────────────────────────────────────────────────
app = FastAPI(title="AgentLee-Vision", version="2.1.0")


class ActRequest(BaseModel):
    action: str           # "click" | "type" | "scroll" | "move" | "hotkey"
    x: int | None = None
    y: int | None = None
    text: str | None = None
    dx: int = 0
    dy: int = 0
    keys: list[str] = []


@app.get("/health")
def health():
    with _model_lock:
        ready = _models_ready
        err   = _models_error
    return {
        "status":        "vision_online",
        "version":       "2.1.0",
        "cv2":           _CV2,
        "psutil":        _PSUTIL,
        "stream_active": _stream_running,
        "models_ready":  ready,
        "models_error":  err,
    }


@app.get("/models/status")
def models_status():
    """Detailed model load status."""
    with _model_lock:
        return {
            "blip":     {"model": BLIP_MODEL,     "loaded": _captioner  is not None},
            "classify": {"model": CLASSIFY_MODEL, "loaded": _classifier is not None},
            "ready":    _models_ready,
            "error":    _models_error,
        }


@app.get("/status")
def status():
    """Backward-compatible with desktop_agent.py."""
    return {"status": "online", "mode": "vision_agent",
            "stream_active": _stream_running, "cv2": _CV2}


@app.get("/screen")
def screen():
    """Capture full desktop screenshot as JPEG bytes (base64-encoded JSON)."""
    with mss.mss() as sct:
        mon = sct.monitors[0]
        raw = sct.grab(mon)
        img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        buf.seek(0)
        return JSONResponse({
            "image_b64": base64.b64encode(buf.read()).decode(),
            "width":  raw.width,
            "height": raw.height,
        })


@app.post("/act")
def act(req: ActRequest):
    """Execute desktop actions via PyAutoGUI."""
    try:
        if req.action == "click" and req.x is not None and req.y is not None:
            pyautogui.click(req.x, req.y)
        elif req.action == "move" and req.x is not None and req.y is not None:
            pyautogui.moveTo(req.x, req.y)
        elif req.action == "type" and req.text:
            pyautogui.typewrite(req.text, interval=0.05)
        elif req.action == "scroll":
            pyautogui.scroll(req.dy, x=req.x, y=req.y)
        elif req.action == "hotkey" and req.keys:
            pyautogui.hotkey(*req.keys)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")
        return {"ok": True, "action": req.action}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analyze")
def analyze():
    """Return latest perception snapshot from the stream (or a fresh one)."""
    with _stream_lock:
        if _stream_state:
            return dict(_stream_state)
    # No stream running — do a one-shot desktop analysis
    return {
        "caption":   "Stream not active — use /stream/start to enable continuous vision.",
        "objects":   [],
        "lighting":  "unknown",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/stream/start")
def stream_start():
    global _stream_running, _stream_thread, _preload_thread
    if _stream_running:
        return {"ok": True, "message": "Already running", "models_ready": _models_ready}
    # Kick off model preload in background if not already loaded
    with _model_lock:
        already_ready = _models_ready
    if not already_ready:
        _preload_thread = threading.Thread(target=_load_models, daemon=True, name="model-preload")
        _preload_thread.start()
        log.info("Model preload started in background")
    _stream_running = True
    _stream_thread  = threading.Thread(target=_perception_loop, daemon=True, name="perception-loop")
    _stream_thread.start()
    return {
        "ok":          True,
        "message":     "Perception stream started",
        "fps":         DEFAULT_FPS,
        "models_ready": already_ready,
        "note":        "Models loading in background" if not already_ready else "Models already ready",
    }


@app.post("/stream/stop")
def stream_stop():
    global _stream_running
    _stream_running = False
    return {"ok": True, "message": "Perception stream stopping"}


@app.get("/stream/state")
def stream_state():
    with _stream_lock:
        if not _stream_state:
            raise HTTPException(status_code=404, detail="No perception data yet. POST /stream/start first.")
        return dict(_stream_state)


if __name__ == "__main__":
    log.info(f"Starting Vision Agent on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
