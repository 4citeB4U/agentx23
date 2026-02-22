import asyncio
import edge_tts
import os

async def generate_test():
    TEXT = "Neural bridge established. Agent Lee online."
    VOICE = "en-US-AndrewMultilingualNeural"
    OUTPUT_FILE = "test_voice.mp3"
    
    communicate = edge_tts.Communicate(TEXT, VOICE)
    await communicate.save(OUTPUT_FILE)
    print(f"Generated {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(generate_test())
