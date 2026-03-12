#!/usr/bin/env python3
"""
Low-latency Agent Lee client (streaming).

Sends user messages to backend `/api/chat`, fetches the AI reply, requests TTS
from `/api/chat/tts` and streams the returned audio through `ffmpeg` into
PortAudio using `sounddevice` for low-latency playback.

Requirements:
 - ffmpeg on PATH
 - Python packages: requests, sounddevice, numpy

Usage:
 .venv\Scripts\python.exe scripts\interactive_agentlee_stream.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Optional

import requests

try:
    import sounddevice as sd
except Exception:
    sd = None

API_BASE = os.environ.get("AGENTLEE_API", "http://127.0.0.1:8001/api/chat")
CHAT_ENDPOINT = API_BASE.rstrip("/")
TTS_ENDPOINT = CHAT_ENDPOINT + "/tts"


def has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def stream_play_mp3_bytes(mp3_iter, sample_rate: int = 24000, channels: int = 1):
    """Pipe MP3 bytes into ffmpeg stdin and read raw PCM from stdout, play via sounddevice."""
    if sd is None:
        print("sounddevice not installed — falling back to saving file and opening default player")
        # fallback: write to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        for chunk in mp3_iter:
            tmp.write(chunk)
        tmp.close()
        if sys.platform.startswith("win"):
            subprocess.run(["powershell", "-Command", f"Start-Process -FilePath '{tmp.name}'"]) 
        else:
            opener = shutil.which("xdg-open") or shutil.which("open")
            if opener:
                subprocess.run([opener, tmp.name])
        return

    if not has_ffmpeg():
        print("ffmpeg not found on PATH — install ffmpeg for streaming playback")
        return

    # Start ffmpeg process: read compressed audio from stdin, output s16le PCM to stdout
    ff = subprocess.Popen([
        "ffmpeg",
        "-hide_banner",
        "-loglevel", "error",
        "-i", "pipe:0",
        "-f", "s16le",
        "-ar", str(sample_rate),
        "-ac", str(channels),
        "pipe:1",
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE, bufsize=0)

    # Open sounddevice stream with matching parameters
    with sd.RawOutputStream(samplerate=sample_rate, channels=channels, dtype='int16') as stream:
        try:
            # Feed ffmpeg stdin while writing stdout to audio stream
            for chunk in mp3_iter:
                if not chunk:
                    continue
                ff.stdin.write(chunk)
                # Read available PCM from stdout and write to output stream
                # Use small reads to reduce latency
                while True:
                    out = ff.stdout.read(4096)
                    if not out:
                        break
                    stream.write(out)
        finally:
            try:
                ff.stdin.close()
            except Exception:
                pass
            ff.terminate()


def get_reply(text: str) -> Optional[str]:
    try:
        r = requests.post(CHAT_ENDPOINT, json={"text": text}, timeout=60)
        r.raise_for_status()
        data = r.json()
        return data.get("text") or data.get("reply") or ''
    except Exception as e:
        print("Chat request failed:", e)
        return None


def stream_tts_and_play(text: str):
    try:
        r = requests.post(TTS_ENDPOINT, json={"text": text}, stream=True, timeout=60)
        r.raise_for_status()
    except Exception as e:
        print("TTS request failed:", e)
        return

    # r.iter_content yields mp3 bytes; stream into ffmpeg
    mp3_iter = r.iter_content(chunk_size=4096)
    stream_play_mp3_bytes(mp3_iter)


def main():
    print("Interactive low-latency Agent Lee (streaming). Type 'quit' to exit.")
    if sd is None:
        print("Note: Python package 'sounddevice' not installed — install it for low-latency playback")
    if not has_ffmpeg():
        print("Note: ffmpeg not found on PATH — install ffmpeg for streaming decode")

    while True:
        try:
            user = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if not user:
            continue
        if user.lower() in ("quit", "exit"):
            break

        reply = get_reply(user)
        if not reply:
            print("No reply received.")
            continue
        print("Agent Lee:", reply)
        stream_tts_and_play(reply)


if __name__ == '__main__':
    main()
