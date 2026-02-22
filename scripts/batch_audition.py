
import os
import requests
import json
import time

PHRASES = [
    "System initialization sequence complete. All neural pathways are synchronized.",
    "Warning: Detected unauthorized file modification in the core directory.",
    "I've reviewed the code changes. The implementation looks solid and adheres to our standards.",
    "Let's explore the deeper implications of this data structure together.",
    "Quick status update: 42 modules built, 0 errors, 12 warnings pending.",
    "I'm here to guide you through the setup process. Please proceed with caution.",
    "Negative. I cannot execute that command without explicit administrative override.",
    "Fascinating. The correlation between these two variables suggests a hidden pattern.",
    "Running regression tests now... everything is looking great so far!",
    "The mission parameters have been updated. Please check the briefing for details."
]

PROFILES = [
    "narrator_classic",
    "calm_consultant",
    "firm_commander",
    "energetic_analyst",
    "reflective_scholar"
]

def run_batch():
    base_dir = "workspace/auditions/batch"
    os.makedirs(base_dir, exist_ok=True)
    
    # Target Pocket-TTS directly on 8007 for reliability and speed
    url = "http://127.0.0.1:8007/tts"
    
    print(f"🚀 Starting batch generation of {len(PHRASES) * len(PROFILES)} samples via Pocket-TTS (:8007)...")
    
    for p_idx, profile in enumerate(PROFILES):
        profile_dir = os.path.join(base_dir, profile)
        os.makedirs(profile_dir, exist_ok=True)
        
        for t_idx, text in enumerate(PHRASES):
            out_file = os.path.join(profile_dir, f"phrase_{t_idx:02d}.mp3")
            print(f"[{p_idx+1}/{len(PROFILES)}] Generating '{profile}' - Phrase {t_idx:02d}...", end=" ", flush=True)
            
            payload = {
                "text": text,
                "profile": profile
            }
            
            try:
                start = time.time()
                response = requests.post(url, json=payload, timeout=45)
                response.raise_for_status()
                
                with open(out_file, "wb") as f:
                    f.write(response.content)
                
                lat = (time.time() - start)
                print(f"Done ({lat:.1f}s)")
                
                # Small gap to let the CPU breathe
                time.sleep(0.5)
            except Exception as e:
                print(f"\n  ❌ Error: {e}")
                if hasattr(e, 'response') and e.response:
                    print(f"     Response: {e.response.text}")

    print(f"\n✅ Batch generation complete. Files saved to {base_dir}")

if __name__ == "__main__":
    run_batch()
