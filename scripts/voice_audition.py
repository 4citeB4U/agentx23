
import requests
import argparse
import os
import sys
import subprocess
import time

def audition():
    parser = argparse.ArgumentParser(description="Agent Lee Voice Audition CLI")
    parser.add_argument("text", help="Text to speak")
    parser.add_argument("--profile", default="narrator_classic", help="Voice profile ID")
    parser.add_argument("--play", action="store_true", help="Play the audio using ffplay")
    parser.add_argument("--out", help="Output file path")
    parser.add_argument("--port", type=int, default=8001, help="Port to target (8001: backend, 8007: direct)")
    
    args = parser.parse_args()
    
    if args.port == 8007:
        url = "http://127.0.0.1:8007/tts"
    else:
        url = "http://127.0.0.1:8001/api/chat/tts"
        
    handshake = os.getenv("NEURAL_HANDSHAKE") or "AGENT_LEE_SOVEREIGN_V1"
    
    payload = {
        "text": args.text,
        "voice": args.profile,
        "profile": args.profile, # matching both
        "handshake": handshake
    }
    headers = {
        "x-neural-handshake": handshake,
        "Content-Type": "application/json"
    }
    
    print(f"🎤 Auditioning profile: '{args.profile}' via port {args.port}...")
    
    start = time.time()
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=25)
        response.raise_for_status()
    except Exception as e:
        print(f"❌ Error: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response: {e.response.text}")
        sys.exit(1)
        
    latency = (time.time() - start) * 1000
    print(f"✅ Received audio ({len(response.content)} bytes) in {latency:.0f}ms")
    
    out_file = args.out or f"audition_{args.profile}.mp3"
    with open(out_file, "wb") as f:
        f.write(response.content)
    print(f"💾 Saved to: {out_file}")
    
    if args.play:
        print(f"🔊 Playing {out_file}...")
        subprocess.run(["ffplay", "-nodisp", "-autoexit", out_file], stderr=subprocess.DEVNULL)

if __name__ == "__main__":
    audition()
