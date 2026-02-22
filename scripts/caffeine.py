import pyautogui
import time
import threading
import sys

def keep_awake():
    print("[Caffeine] Anti-Sleep Protocol Active")
    print("Agent Lee is staying awake to ensure remote mission continuity.")
    try:
        while True:
            # F15 is a virtual key that doesn't affect most apps but prevents idle sleep
            pyautogui.press('f15')
            time.sleep(60)
    except Exception as e:
        print(f"[Caffeine] Failure: {e}")

if __name__ == "__main__":
    keep_awake()
