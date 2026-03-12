# LEEWAY HEADER BLOCK
# File: tts_edge.py
# Purpose: Edge TTS service — primary voice engine for Agent Lee OS
# Engine: edge-tts (Microsoft Edge online TTS, pip install edge-tts)
# Playback: pygame
"""
EdgeTTSService
══════════════
Primary voice output engine for Agent Lee. Reads voice/rate from env vars so
the entire system has one canonical voice configuration:

    TTS_VOICE = en-US-ChristopherNeural  (deep male, clear)
    TTS_RATE  = +0%

Usage:
    python tts_edge.py                   # self-test
    from tts_edge import EdgeTTSService  # import into other modules
"""

import asyncio
import os
import tempfile
import time
from pathlib import Path

import edge_tts
import pygame


VOICE = os.getenv("TTS_VOICE", "en-US-ChristopherNeural")
RATE  = os.getenv("TTS_RATE",  "+0%")


class EdgeTTSService:
    def __init__(
        self,
        voice: str = VOICE,
        rate: str = RATE,
    ):
        self.voice = voice
        self.rate = rate
        self._initialized = False

    def _init_audio(self):
        if not self._initialized:
            pygame.mixer.init()
            self._initialized = True

    async def synthesize_to_file(self, text: str, output_file: str) -> str:
        """Generate MP3 audio from text and save to output_file. Returns output_file path."""
        communicate = edge_tts.Communicate(text=text, voice=self.voice, rate=self.rate)
        await communicate.save(output_file)
        return output_file

    async def synthesize_to_bytes(self, text: str) -> bytes:
        """Generate MP3 audio from text and return raw bytes."""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            path = tmp.name
        communicate = edge_tts.Communicate(text=text, voice=self.voice, rate=self.rate)
        await communicate.save(path)
        data = Path(path).read_bytes()
        try:
            Path(path).unlink()
        except OSError:
            pass
        return data

    async def speak(self, text: str) -> str:
        """Speak text aloud via pygame. Returns path to the temp MP3 (already played)."""
        self._init_audio()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            output_path = tmp.name

        communicate = edge_tts.Communicate(text=text, voice=self.voice, rate=self.rate)
        await communicate.save(output_path)

        pygame.mixer.music.load(output_path)
        pygame.mixer.music.play()

        while pygame.mixer.music.get_busy():
            time.sleep(0.1)

        return output_path


async def main():
    tts = EdgeTTSService()
    print(f"[tts_edge] Voice: {tts.voice} | Rate: {tts.rate}")
    await tts.speak(
        "Agent Lee system online. Edge TTS is now the active voice engine. All systems nominal."
    )
    print("[tts_edge] Self-test complete.")


if __name__ == "__main__":
    asyncio.run(main())
