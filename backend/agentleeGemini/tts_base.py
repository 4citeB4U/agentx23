# tts_base.py
"""CPU-friendly TTS service for Agent Lee.

Default engine order:
  1) Piper (if installed via env PIPER_BIN and PIPER_MODEL)
  2) pyttsx3 (system voices; fully offline)
  3) Fallback: generate a short tone so the pipeline never breaks

Returns an audio URL (served from /static/audio) and optional naive visemes.
"""
from __future__ import annotations
import os, uuid, subprocess, json, shutil
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="", tags=["tts"])

AUDIO_ROOT = Path(os.getenv("AGENTLEE_AUDIO_DIR", "./agent_workspace/audio")).resolve()
AUDIO_ROOT.mkdir(parents=True, exist_ok=True)

class SpeakRequest(BaseModel):
    text: str
    voice: str | None = None
    format: str = "wav"   # "wav" or "mp3" (we always render wav and let client convert if needed)
    visemes: bool = True
    inline: bool = False  # if True, return file bytes directly

@router.post("/speak")
def speak(req: SpeakRequest) -> Dict[str, Any]:
    if not req.text or not req.text.strip():
        raise HTTPException(400, "text is required")
    file_id = str(uuid.uuid4())
    out_wav = AUDIO_ROOT / f"{file_id}.wav"

    # Try Piper first (best CPU quality if installed)
    piper_bin = os.getenv("PIPER_BIN")
    piper_model = os.getenv("PIPER_MODEL")
    if piper_bin and piper_model and Path(piper_bin).exists() and Path(piper_model).exists():
        try:
            cmd = [piper_bin, "-m", piper_model, "-f", str(out_wav)]
            p = subprocess.run(cmd, input=req.text.encode("utf-8"), capture_output=True, timeout=60)
            if p.returncode != 0:
                raise RuntimeError(p.stderr.decode("utf-8", errors="ignore"))
        except Exception as e:
            # Fall through to pyttsx3
            pass

    # pyttsx3 fallback
    if not out_wav.exists():
        try:
            import pyttsx3  # type: ignore
            engine = pyttsx3.init()
            if req.voice:
                # Try to set voice if available
                for v in engine.getProperty('voices'):
                    if req.voice.lower() in (v.name or '').lower():
                        engine.setProperty('voice', v.id); break
            engine.save_to_file(req.text, str(out_wav))
            engine.runAndWait()
        except Exception as e:
            # Final fallback: synthesize a short tone so flow doesn't break
            _write_tone(out_wav)

    if not out_wav.exists():
        raise HTTPException(500, "TTS failed to render audio")

    # Optionally produce naive visemes (time-sliced by words)
    vis = []
    if req.visemes:
        vis = _naive_visemes(req.text)

    if req.inline:
        return {"audio_path": str(out_wav), "visemes": vis, "inline": True}
    # Returned URL assumes FastAPI mounted StaticFiles at /static pointing to ./agent_workspace
    url = f"/static/audio/{out_wav.name}"
    return {"audioUrl": url, "visemes": vis}

# ----------------- helpers -----------------
def _write_tone(path: Path, seconds: float = 0.8, hz: int = 440, rate: int = 16000):
    """Write a simple sine tone to a WAV file (16k mono)."""
    import wave, math, struct
    frames = int(seconds * rate)
    with wave.open(str(path), 'w') as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(rate)
        for i in range(frames):
            val = int(32767.0 * 0.2 * math.sin(2.0 * math.pi * hz * (i / rate)))
            wf.writeframes(struct.pack('<h', val))

_V_MAP = {
    'a': 'AA', 'e': 'EH', 'i': 'IH', 'o': 'AO', 'u': 'UH',
    'b': 'BMP', 'm': 'BMP', 'p': 'BMP',
    'f': 'FV', 'v': 'FV',
    'c': 'K', 'k': 'K', 'g': 'K',
    'l': 'L', 'r': 'R', 's': 'S', 'z': 'S',
    't': 'T', 'd': 'T',
    'w': 'WQ', 'q': 'WQ', 'y': 'Y'
}

def _naive_visemes(text: str) -> List[Dict[str, Any]]:
    # Very rough viseme schedule: one viseme per ~120ms per token
    words = [w for w in text.split() if w]
    t = 0.0
    out = []
    for w in words:
        ch = w[0].lower()
        v = _V_MAP.get(ch, 'REST')
        out.append({"t": round(t, 3), "v": v})
        t += 0.12
    return out
