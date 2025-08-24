"""Legacy speech engine configuration and placeholders.

This module preserves the original speech engine.  New implementations should
live in `agent_system/speech_engine.py`.  It centralizes STT/TTS configuration
and provides safe placeholders so the rest of the app can refer to
audio/endpointing settings without external dependencies.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger("agentlee.speech.legacy")

# Provider selection
STT_PROVIDER = os.getenv("AGENTLEE_STT_PROVIDER", "google_stt")
TTS_PROVIDER = os.getenv("AGENTLEE_TTS_PROVIDER", "google_tts")

# Endpointing (VAD) defaults (seconds)
MIN_ENDPOINT_DELAY = float(os.getenv("AGENTLEE_MIN_ENDPOINT_DELAY", "0.8"))
MAX_ENDPOINT_DELAY = float(os.getenv("AGENTLEE_MAX_ENDPOINT_DELAY", "6.0"))

# Correction window (seconds) as described in Nexus Protocol
AUTO_DISPATCH_DELAY = float(os.getenv("AGENTLEE_AUTO_DISPATCH_DELAY", "5.0"))


def generate_expressive_speech(text: str, voice: Optional[str] = None) -> str:
    """Return an SSML‑wrapped string.  This is a best‑effort helper that
    safely formats text as SSML; it does not call any external API.
    """
    safe_text = (text or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    ssml = f"<speak>{safe_text}</speak>"
    return ssml


def synthesize_ssml_to_audio(ssml: str) -> bytes:
    """Placeholder that would call a TTS provider and return binary audio.

    For now this returns empty bytes and logs the intent; it's non‑blocking
    and keeps the system testable without cloud credentials.
    """
    logger.info("synthesize_ssml_to_audio called (legacy) - length=%d", len(ssml or ""))
    return b""


def describe_config() -> dict:
    return {
        "stt_provider": STT_PROVIDER,
        "tts_provider": TTS_PROVIDER,
        "min_endpoint_delay": MIN_ENDPOINT_DELAY,
        "max_endpoint_delay": MAX_ENDPOINT_DELAY,
        "auto_dispatch_delay": AUTO_DISPATCH_DELAY,
    }