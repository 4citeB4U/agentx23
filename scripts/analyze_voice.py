"""
Lightweight reference voice analysis — no GPU, no ML.
Pure signal math via numpy + scipy.
Outputs recommended edge-tts and ffmpeg params.
"""
import subprocess, numpy as np, scipy.io.wavfile as wav
from pathlib import Path
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks, correlate

BASE    = Path(__file__).parent.parent
REF_M4A = BASE / "agent-lee-studio/public/agent_lee_reference_voice.m4a"
REF_WAV = BASE / "workspace/agent_lee_ref_16k.wav"
FFMPEG  = r"C:\ProgramData\chocolatey\bin\ffmpeg.exe"

REF_WAV.parent.mkdir(exist_ok=True)

# Convert m4a → 16kHz mono WAV if needed
if not REF_WAV.exists() or REF_WAV.stat().st_size < 10000:
    print(f"Converting {REF_M4A} → {REF_WAV} ...")
    r = subprocess.run(
        [FFMPEG, "-y", "-i", str(REF_M4A), "-ar", "16000", "-ac", "1", "-f", "wav", str(REF_WAV)],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {r.stderr[-300:]}")

sr, data = wav.read(str(REF_WAV))
if data.dtype != np.float32:
    data = data.astype(np.float32) / 32768.0
print(f"WAV: {len(data)/sr:.1f}s at {sr}Hz")

# ── 1. Fundamental pitch via autocorrelation ──────────────────────────────────
frame_s = int(0.04 * sr)   # 40ms frames
hop_s   = int(0.01 * sr)   # 10ms hop
f0s = []
for i in range(0, len(data) - frame_s, hop_s):
    frame = data[i:i+frame_s]
    if np.mean(frame**2) < 0.0005:   # skip silence
        continue
    ac  = correlate(frame, frame, mode='full')
    ac  = ac[len(ac)//2:]
    lo, hi = max(1, int(sr/350)), min(len(ac)-1, int(sr/80))
    peak = np.argmax(ac[lo:hi]) + lo
    f0   = sr / peak
    if 70 < f0 < 380:
        f0s.append(f0)

median_f0 = float(np.median(f0s)) if f0s else 130.0
print(f"Pitch: median={median_f0:.1f}Hz  (from {len(f0s)} voiced frames)")

# ── 2. Speaking rate via syllable onset peaks ─────────────────────────────────
env   = uniform_filter1d(np.abs(data), size=int(0.02*sr))
thr   = np.percentile(env[env > 0], 20)
peaks, _ = find_peaks(env, height=thr, distance=int(0.06*sr))
dur_s    = len(data) / sr
syl_rate = len(peaks) / dur_s if dur_s > 0 else 4.5
print(f"Speaking rate: {syl_rate:.2f} syl/sec  (peaks={len(peaks)}, dur={dur_s:.1f}s)")

# ── 3. Map → edge-tts + ffmpeg params ────────────────────────────────────────
# GuyNeural base pitch ≈ 130Hz
BASE_HZ   = 130.0
BASE_RATE = 4.5   # English average syl/sec

# edge-tts SSML pitch offset (Hz)
pitch_offset_hz  = int(median_f0 - BASE_HZ)
pitch_offset_str = f"{pitch_offset_hz:+d}Hz"

# edge-tts rate %: negative = slower
rate_pct = int(((syl_rate / BASE_RATE) - 1.0) * 100)
rate_pct = max(-35, min(35, rate_pct))
rate_str = f"{rate_pct:+d}%"

# ffmpeg atempo for post-process (applied AFTER edge-tts output)
# atempo corrects any residual rate difference
atempo = max(0.5, min(2.0, syl_rate / BASE_RATE))
# ffmpeg asetrate pitch ratio (no resampling = pitch shift)
pitch_ratio = median_f0 / BASE_HZ

print()
print("="*44)
print("  Recommended settings for current voice")
print("="*44)
print(f"  Median F0          : {median_f0:.0f} Hz")
print(f"  edge-tts pitch     : {pitch_offset_str}")
print(f"  edge-tts rate      : {rate_str}")
print(f"  ffmpeg pitch ratio : {pitch_ratio:.3f}")
print(f"  ffmpeg atempo      : {atempo:.3f}")
print("="*44)
