
import os
import torch
import numpy as np
import copy
from pocket_tts import TTSModel

def test():
    print("Loading model...")
    model = TTSModel.load_model()
    preset = "marius"
    state = model.get_state_for_audio_prompt(preset)
    
    text = "This is a direct test of the pocket-tts output."
    print(f"Generating for: '{text}'")
    
    with torch.no_grad():
        audio_tensor = model.generate_audio(
            copy.deepcopy(state),
            text,
            max_tokens=200,
            frames_after_eos=2,
            copy_state=False
        )
    
    pcm = audio_tensor.float().cpu().numpy()
    print(f"PCM shape: {pcm.shape}")
    print(f"PCM max: {np.max(pcm)}")
    print(f"PCM min: {np.min(pcm)}")
    print(f"PCM mean abs: {np.mean(np.abs(pcm))}")
    
    if np.max(np.abs(pcm)) < 1e-5:
        print("❌ WARNING: Audio is silent (zeros)!")
    else:
        print("✅ Audio has content.")

if __name__ == "__main__":
    test()
