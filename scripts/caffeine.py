import pyautogui
import time
import sys

# Disable fail-safe so corner mouse movements don't kill the script
pyautogui.FAILSAFE = False

def keep_awake():
    print("[Caffeine] Anti-Sleep Protocol Active")
    print("Agent Lee is staying awake to ensure remote mission continuity.")
    while True:
        try:
            # F15 is a virtual key that doesn't affect most apps but prevents idle sleep
            pyautogui.press('f15')
        except Exception as e:
            print(f"[Caffeine] Warning: {e}")
        time.sleep(60)

if __name__ == "__main__":
    keep_awake()
