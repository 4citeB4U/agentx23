#!/usr/bin/env python3
"""
Interactive Agent Lee client — sends user input to backend `/api/chat`,
fetches the reply, requests TTS via `/api/chat/tts`, and plays audio with ffplay.

Usage: .venv\Scripts\python.exe scripts\interactive_agentlee.py
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import requests

API_BASE = os.environ.get("AGENTLEE_API", "http://127.0.0.1:8001/api/chat")
TTS_ENDPOINT = API_BASE.rstrip("/") + "/tts"
CHAT_ENDPOINT = API_BASE.rstrip("/")


def play_file(path: str):
    """Play `path` using ffplay if available, otherwise open with default app."""
    ffplay = shutil.which("ffplay")
    if ffplay:
        cmd = [ffplay, "-nodisp", "-autoexit", "-hide_banner", "-loglevel", "error", path]
        subprocess.run(cmd)
    else:
        # Fallback to OS open (may spawn GUI)
        if sys.platform.startswith("win"):
            subprocess.run(["powershell", "-Command", f"Start-Process -FilePath '{path}'"]) 
        else:
            opener = shutil.which("xdg-open") or shutil.which("open")
            if opener:
                subprocess.run([opener, path])


def synthesize_and_play(text: str):
    try:
        r = requests.post(TTS_ENDPOINT, json={"text": text}, timeout=30)
        r.raise_for_status()
    except Exception as e:
        print("TTS request failed:", e)
        return

    # Save to temp file
    suffix = ".mp3"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(r.content)
    tmp.flush()
    tmp.close()
    try:
        play_file(tmp.name)
    finally:
        try:
            os.remove(tmp.name)
        except Exception:
            pass


def get_reply(text: str) -> str:
    try:
        r = requests.post(CHAT_ENDPOINT, json={"text": text}, timeout=60)
        r.raise_for_status()
        data = r.json()
        # The route returns `{ text: responseText, ... }` per backend
        return data.get("text") or data.get("reply") or ''
    except Exception as e:
        print("Chat request failed:", e)
        return ''


def main():
    print("Interactive Agent Lee — type 'quit' to exit")
    while True:
        try:
            user = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
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
        synthesize_and_play(reply)


if __name__ == "__main__":
    main()
