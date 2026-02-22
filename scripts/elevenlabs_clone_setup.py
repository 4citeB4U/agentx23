#!/usr/bin/env python3
"""
Sets up Agent Lee's voice clone on ElevenLabs.
Run once to: upload reference audio → create voice → save voice ID to .env.local

Usage:
    python scripts/elevenlabs_clone_setup.py --api-key YOUR_KEY_HERE
"""
import argparse, os, sys, json, pathlib, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).parent.parent
REF_AUDIO = ROOT / "agent-lee-studio" / "public" / "agent_lee_reference_voice.m4a"
ENV_FILE  = ROOT / ".env.local"

def add_or_update_env(key: str, value: str):
    lines = ENV_FILE.read_text(encoding="utf-8").splitlines() if ENV_FILE.exists() else []
    found = False
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            found = True
            break
    if not found:
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")

def api_call(method: str, path: str, api_key: str, body=None, files=None):
    url = f"https://api.elevenlabs.io/v1{path}"
    if files:
        import base64, mimetypes
        # multipart/form-data
        boundary = "----AgentLeeBoundary"
        data_parts = []
        for name, (filename, content, ctype) in files.items():
            data_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\nContent-Type: {ctype}\r\n\r\n".encode())
            data_parts.append(content)
            data_parts.append(b"\r\n")
        if body:
            for k, v in body.items():
                data_parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
        data_parts.append(f"--{boundary}--\r\n".encode())
        payload = b"".join(data_parts)
        req = urllib.request.Request(url, data=payload, method=method)
        req.add_header("xi-api-key", api_key)
        req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    else:
        payload = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=payload, method=method)
        req.add_header("xi-api-key", api_key)
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"[ERROR] {e.code}: {err}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True, help="ElevenLabs API key")
    parser.add_argument("--voice-name", default="Agent Lee", help="Voice name on ElevenLabs")
    args = parser.parse_args()

    print("[1/3] Verifying API key...")
    user = api_call("GET", "/user", args.api_key)
    print(f"      Logged in as: {user.get('first_name', 'User')} | Plan: {user.get('subscription', {}).get('tier', 'free')}")

    # Check if voice already exists
    voices = api_call("GET", "/voices", args.api_key)
    existing = next((v for v in voices.get("voices", []) if v["name"] == args.voice_name), None)
    if existing:
        voice_id = existing["voice_id"]
        print(f"[2/3] Voice '{args.voice_name}' already exists (id={voice_id}), skipping upload.")
    else:
        print(f"[2/3] Uploading reference audio: {REF_AUDIO.name} ({REF_AUDIO.stat().st_size//1024}KB)...")
        audio_bytes = REF_AUDIO.read_bytes()
        result = api_call("POST", "/voices/add", args.api_key,
            body={"name": args.voice_name, "description": "Agent Lee sovereign voice"},
            files={"files": (REF_AUDIO.name, audio_bytes, "audio/mp4")})
        voice_id = result["voice_id"]
        print(f"      Voice created! id={voice_id}")

    print(f"[3/3] Saving to .env.local...")
    add_or_update_env("ELEVENLABS_API_KEY", args.api_key)
    add_or_update_env("ELEVENLABS_VOICE_ID", voice_id)
    print(f"\n✅ Done! Agent Lee's voice is ready.")
    print(f"   Voice ID : {voice_id}")
    print(f"   Restart the backend to activate: node node_modules/pm2/bin/pm2 restart AgentLee-Brain AgentLee-Backend")

if __name__ == "__main__":
    main()
