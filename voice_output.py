# LEEWAY HEADER BLOCK
# File: voice_output.py
# Purpose: Single stable wrapper so all Agent Lee modules call one speak() function
# Engine: EdgeTTSService (tts_edge.py) — mode-aware routing
"""
voice_output — canonical speak() wrapper
════════════════════════════════════════
Every module in Agent Lee that needs to produce voice output must import from
THIS file only. Never import edge_tts directly in other modules.

Mode routing:
  Edge modes   (default): live, fast, default, reply, chat, command
  Gemini modes (premium): narration, premium, archive, onboarding, ceremony, longform

For local playback, speak() always uses Edge (fastest, no API call).
For synthesize() used in server streaming, mode is respected.

Usage:
    from voice_output import speak

    speak("Task complete.")
    speak("Cerebral is ready.")
    speak("Welcome to Agent Lee.", mode="onboarding")  # signals premium delivery
"""

import asyncio
from tts_edge import EdgeTTSService

# Mirror the mode set from server.py so callers can inspect without importing server
GEMINI_MODES = {"narration", "premium", "archive", "onboarding", "ceremony", "longform"}

_tts = EdgeTTSService()


def speak(text: str, mode: str = "live") -> None:
    """Speak text aloud. Blocks until playback is complete.
    Local playback always uses Edge TTS regardless of mode (fastest path)."""
    asyncio.run(_tts.speak(text))


async def speak_async(text: str, mode: str = "live") -> None:
    """Async variant — use inside async contexts to avoid nested event loops.
    Local playback always uses Edge TTS regardless of mode."""
    await _tts.speak(text)


async def synthesize(text: str, mode: str = "live") -> bytes:
    """Return raw audio bytes without playing (for streaming to frontend).
    Edge modes return MP3; Gemini modes return MP3 (via edge-tts) for local use.
    For Gemini WAV output, call the /tts endpoint directly with mode=narration."""
    return await _tts.synthesize_to_bytes(text)


if __name__ == "__main__":
    speak("Voice output wrapper is working. Agent Lee is ready.")
