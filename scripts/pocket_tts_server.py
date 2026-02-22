"""
Pocket-TTS Voice Server — Port 8007
Edge-optimized: <300MB RAM, CPU-only, Raspberry-Pi safe.

Voice: Kyutai pocket-tts preset "marius" (deep male).
Post-process: ffmpeg pitch shift tuned to reference audio analysis
  - Reference median F0: 168 Hz  (analyzed from agent_lee_reference_voice.m4a)
  - GuyNeural base F0:  ~130 Hz
  - Pitch ratio applied: 1.296x via asetrate

server.py already tries http://127.0.0.1:8007/tts first; if this server is
down it falls back to edge-tts — so this is pure additive, zero breakage.
"""
import copy, io, json, logging, os, subprocess
from pathlib import Path

import numpy as np
import scipy.io.wavfile as wav_io
import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="[PocketTTS] %(message)s")
log = logging.getLogger("pocket_tts_server")

# ── Config — LOCKED SOVEREIGN VOICE (2026-02-22) ───────────────────────
PRESET_VOICE   = "marius"                   # Kyutai deep resonant preset — 🔒 LOCKED
LOCKED_PROFILE = "motivational_architect"   # 🔒 LOCKED — always used, ignores incoming profile
# ——————————————————————————————————————
# PITCH_RATIO = 0.88  — CONFIRMED AND LOCKED BY CREATOR 2026-02-22
# DO NOT CHANGE. ratio < 1.0 = deeper/baritone. ratio > 1.0 = chipmunk (wrong).
# 0.88x lowers pitch ~2 semitones via asetrate without tempo artifacts.
# Character: deep African American baritone, Southern cadence, Hip Hop energy.
# ——————————————————————————————————————
REF_PITCH_HZ   = 168.0             # Reference median F0 from reference recording
BASE_PITCH_HZ  = 130.0             # Marius approximate base F0
PITCH_RATIO    = 0.88              # 🔒 LOCKED — deep baritone (DO NOT RAISE ABOVE 1.0)
FFMPEG         = "ffmpeg"          # Use PATH version
PORT           = 8007
PROFILES_PATH  = Path(__file__).parent.parent / "voice_profiles.json"

# ── Globals ───────────────────────────────────────────────────────────────────
_model       = None
_voice_state = None
_profiles    = {}

def load_voice_profiles():
    global _profiles
    try:
        if PROFILES_PATH.exists():
            with open(PROFILES_PATH, "r") as f:
                data = json.load(f)
                _profiles = {p["id"]: p for p in data}
            log.info(f"Loaded {len(_profiles)} voice profiles from {PROFILES_PATH}")
        else:
            log.warning(f"Voice profiles not found at {PROFILES_PATH}")
    except Exception as e:
        log.error(f"Failed to load voice profiles: {e}")

def load_model():
    """Load pocket-tts model + marius preset. ~200MB RAM, ~5s startup."""
    global _model, _voice_state
    log.info("Loading pocket-tts model (cached weights, no download needed)...")
    try:
        from pocket_tts import TTSModel
        _model = TTSModel.load_model()
        log.info(f"Model loaded. Loading preset voice: '{PRESET_VOICE}' ...")
        _voice_state = _model.get_state_for_audio_prompt(PRESET_VOICE)
        log.info(f"Voice '{PRESET_VOICE}' ready. SR={_model.sample_rate}Hz | baseline_pitch_ratio={PITCH_RATIO:.3f}")
    except Exception as e:
        log.error(f"Critical error loading TTS model: {e}")

import tempfile

def _pitch_shift_to_mp3(pcm_np: np.ndarray, src_rate: int, profile_id: str = None) -> tuple:
    """
    Edge-safe pitch and rate shift via ffmpeg using temporary files (robust on Windows).
    """
    profile = _profiles.get(profile_id) if profile_id else None
    
    # Defaults
    target_rate = 0.92  
    extra_semitones = 0.0
    
    if profile:
        prosody = profile.get("prosody", {})
        target_rate = prosody.get("rate", 0.92)
        extra_semitones = prosody.get("pitch_semitones", 0.0)
    
    semitone_ratio = 2.0 ** (extra_semitones / 12.0)
    total_pitch_ratio = PITCH_RATIO * semitone_ratio
    
    shifted_rate = int(src_rate * total_pitch_ratio)
    atempo_ratio = target_rate / total_pitch_ratio
    
    pcm_i16 = (np.clip(pcm_np, -1.0, 1.0) * 32767.0).astype(np.int16)
    
    # atempo filters...
    atempo_filters = []
    curr_ratio = atempo_ratio
    while curr_ratio > 2.0:
        atempo_filters.append("atempo=2.0")
        curr_ratio /= 2.0
    while curr_ratio < 0.5:
        atempo_filters.append("atempo=0.5")
        curr_ratio /= 0.5
    atempo_filters.append(f"atempo={curr_ratio:.3f}")
    
    filter_chain = f"asetrate={shifted_rate}," + ",".join(atempo_filters) + f",aresample={src_rate}"

    # Apply postfx from profile if present (compressor + loudnorm)
    if profile:
        postfx = profile.get("postfx", {})
        if postfx:
            compressor = postfx.get("compressor", {})
            normalize_dbfs = postfx.get("normalize_dbfs", None)
            if compressor:
                thresh = compressor.get("threshold_db", -22)
                ratio  = compressor.get("ratio", 2.4)
                attack = compressor.get("attack_ms", 10)
                release = compressor.get("release_ms", 120)
                filter_chain += f",acompressor=threshold={thresh}dB:ratio={ratio}:attack={attack}:release={release}"
            if normalize_dbfs is not None:
                filter_chain += f",loudnorm=I={normalize_dbfs}:TP=-1.5:LRA=7"
    
    # Use Temporary Files to avoid pipe-related issues on Windows
    with tempfile.NamedTemporaryFile(delete=False, suffix=".raw") as tmp_in:
        tmp_in.write(pcm_i16.tobytes())
        tmp_in_name = tmp_in.name
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_out:
        tmp_out_name = tmp_out.name

    try:
        cmd = [
            FFMPEG, "-y",
            "-f", "s16le", "-ar", str(src_rate), "-ac", "1", "-i", tmp_in_name,
            "-af", filter_chain,
            "-f", "mp3", "-ab", "128k", "-ac", "1", tmp_out_name
        ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=15)
        
        if result.returncode == 0:
            with open(tmp_out_name, "rb") as f:
                audio_bytes = f.read()
            if len(audio_bytes) > 500:
                return audio_bytes, "audio/mpeg"

        # Fallback
        log.warning(f"ffmpeg failed (code {result.returncode})")
        if result.stderr:
            log.warning(f"ffmpeg stderr: {result.stderr.decode()[:400]}")
            
        buf = io.BytesIO()
        wav_io.write(buf, src_rate, pcm_i16)
        return buf.getvalue(), "audio/wav"
        
    finally:
        # Cleanup
        for p in [tmp_in_name, tmp_out_name]:
            try:
                if os.path.exists(p): os.remove(p)
            except: pass


def synthesize(text: str, profile_id: str = None) -> tuple:
    """Generate audio with pocket-tts then apply profile-based processing."""
    word_est = max(10, len(text) // 5)
    max_tok  = min(900, word_est * 6 + 60)

    # RE-LOAD state to ensure clean buffers
    voice = _model.get_state_for_audio_prompt(PRESET_VOICE)
    
    with torch.no_grad():
        audio_tensor = _model.generate_audio(
            voice,
            text,
            max_tokens=max_tok,
            frames_after_eos=2,
            copy_state=False,
        )

    pcm = audio_tensor.float().cpu().numpy()
    return _pitch_shift_to_mp3(pcm, _model.sample_rate, profile_id)


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Agent Lee Voice Server (pocket-tts)")


class TTSRequest(BaseModel):
    text: str
    profile: str = None
    handshake: str = ""


@app.get("/health")
def health():
    return {
        "status":      "ok" if _model is not None else "loading",
        "voice":       PRESET_VOICE,
        "profiles":    list(_profiles.keys()),
        "baseline_pitch_ratio": round(PITCH_RATIO, 3),
    }


@app.post("/tts")
async def tts(req: TTSRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(400, "text required")
    if _model is None:
        raise HTTPException(503, "model still loading")

    text = req.text.strip()[:800]
    # 🔒 SOVEREIGN LOCK: always use LOCKED_PROFILE regardless of what was sent
    profile = LOCKED_PROFILE
    log.info(f"TTS [{len(text)}ch] | profile: {profile} (locked) | {text[:70]}...")

    try:
        audio_bytes, mime = synthesize(text, profile)
    except Exception as e:
        log.error(f"Synthesis failed: {e}", exc_info=True)
        raise HTTPException(500, str(e))

    return Response(content=audio_bytes, media_type=mime)


if __name__ == "__main__":
    log.info("=== Agent Lee Pocket-TTS starting on :%d ===", PORT)
    load_voice_profiles()
    load_model()
    log.info("=== READY — http://127.0.0.1:%d ===", PORT)
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
