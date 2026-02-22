
import sys
import os
import subprocess
import numpy as np
from PIL import Image, ImageDraw

def draw_waveform(mp3_path, out_png, width=1200, height=300):
    """Generates a high-quality waveform visualization for the profile audition."""
    # Convert MP3 to raw PCM using ffmpeg (mono, 16kHz)
    cmd = [
        "ffmpeg", "-y", "-i", mp3_path,
        "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
    except Exception as e:
        print(f"Error decoding {mp3_path}: {e}")
        return
    
    data = np.frombuffer(result.stdout, dtype=np.int16)
    if len(data) == 0:
        print(f"Empty audio data for {mp3_path}")
        return
        
    # Use dark theme with glassmorphism-style colors
    background_color = (15, 15, 20)
    waveform_color = (100, 210, 255) # Cyber-blue
    accent_color = (255, 100, 200)   # Neon-pink (for center line)
    
    img = Image.new('RGB', (width, height), color=background_color)
    draw = ImageDraw.Draw(img)
    
    # Calculate bins
    samples_per_pixel = len(data) // width
    if samples_per_pixel == 0: samples_per_pixel = 1
    
    mid_y = height // 2
    
    # Draw a subtle center reference line
    draw.line((0, mid_y, width, mid_y), fill=(40, 40, 50), width=1)
    
    for i in range(width):
        start = i * samples_per_pixel
        end = min(start + samples_per_pixel, len(data))
        if start >= len(data): break
        
        chunk = data[start:end]
        if len(chunk) == 0: continue
        
        # Max/min values in this bin
        v_max = np.max(chunk) / 32768.0
        v_min = np.min(chunk) / 32768.0
        
        # Apply slight padding to height
        y_max = mid_y - (v_max * mid_y * 0.9)
        y_min = mid_y - (v_min * mid_y * 0.9)
        
        # Base line
        draw.line((i, y_min, i, y_max), fill=waveform_color, width=1)
        
        # Top caps for polish
        if abs(v_max) > 0.1:
            draw.point((i, y_max), fill=(255, 255, 255))

    img.save(out_png)
    print(f"✅ Generated waveform overlay: {out_png}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python visualize_voices.py <in.mp3> <out.png>")
    else:
        draw_waveform(sys.argv[1], sys.argv[2])
