import os
import time
import json
import base64
import pyautogui
import mss
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image
from io import BytesIO
import google.generativeai as genai
from dotenv import load_dotenv

# Load Environment Secrets
load_dotenv(".env.local")
API_KEY = os.getenv("NEURAL_HANDSHAKE_KEY") # Shared secret
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

app = FastAPI(title="Agent Lee Hands (Desktop Agent)")

class CommandRequest(BaseModel):
    command: str
    handshake: str
    action: str | None = None
    coordinates: list[float] | None = None
    text: str | None = None
    keys: list[str] | None = None
    display: int | None = None  # 1-based monitor index; None means primary

def _resolve_xy(nx: float, ny: float, display: int | None) -> tuple[int, int]:
    """Convert 0-1000 normalized coords to real pixel coords for the given display."""
    with mss.mss() as sct:
        monitors = sct.monitors  # [0]=virtual all, [1]=first, [2]=second...
        idx = (display or 1)
        if idx < 1 or idx >= len(monitors):
            idx = 1
        mon = monitors[idx]
        real_x = int(mon['left'] + (nx / 1000.0) * mon['width'])
        real_y = int(mon['top']  + (ny / 1000.0) * mon['height'])
    return real_x, real_y

@app.get("/status")
async def status():
    return {"status": "online", "resolution": pyautogui.size()}

@app.get("/screen")
async def screen():
    try:
        screenshot = pyautogui.screenshot()
        buffered = BytesIO()
        screenshot.save(buffered, format="JPEG", quality=75)
        buffered.seek(0)
        return StreamingResponse(buffered, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SCREEN_CAPTURE_FAILED: {e}")

@app.post("/act")
async def execute_command(req: CommandRequest):
    # Verify Handshake
    if req.handshake != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    print(f"[hands] Command Received: {req.command}")
    
    # 1. Get Real Screen Dimensions (CRD may change this)
    screen_w, screen_h = pyautogui.size()
    
    if req.action:
        try:
            if req.action == 'move' and req.coordinates and len(req.coordinates) >= 2:
                x, y = _resolve_xy(req.coordinates[0], req.coordinates[1], req.display)
                pyautogui.moveTo(x, y, duration=0)
                return {"status": "executed", "mode": "direct", "action": req.action, "coordinates": [x, y]}

            if req.action in ['click', 'double_click'] and req.coordinates and len(req.coordinates) >= 2:
                x, y = _resolve_xy(req.coordinates[0], req.coordinates[1], req.display)
                pyautogui.moveTo(x, y, duration=0.05)
                if req.action == 'double_click':
                    pyautogui.doubleClick()
                else:
                    pyautogui.click()
                return {"status": "executed", "mode": "direct", "action": req.action, "coordinates": [x, y]}

            if req.action == 'type' and req.text:
                pyautogui.write(req.text, interval=0.02)
                return {"status": "executed", "mode": "direct", "action": req.action}

            if req.action == 'hotkey' and req.keys:
                pyautogui.hotkey(*req.keys)
                return {"status": "executed", "mode": "direct", "action": req.action}

            if req.action == 'scroll':
                # coordinates: [nx, ny, deltaY] — deltaY in browser pixels (positive = down)
                if req.coordinates and len(req.coordinates) >= 2:
                    x, y = _resolve_xy(req.coordinates[0], req.coordinates[1], req.display)
                    pyautogui.moveTo(x, y, duration=0)
                delta = req.coordinates[2] if req.coordinates and len(req.coordinates) > 2 else -300
                # Convert browser deltaY to pyautogui scroll clicks: negative→scroll down (pyautogui neg=down)
                clicks = -int(delta / 40)
                if clicks == 0:
                    clicks = -1 if delta > 0 else 1
                pyautogui.scroll(clicks)
                return {"status": "executed", "mode": "direct", "action": req.action, "clicks": clicks}
        except Exception as e:
            return {"status": "error", "mode": "direct", "message": str(e)}

    # 2. Capture Screenshot
    screenshot = pyautogui.screenshot()
    buffered = BytesIO()
    screenshot.save(buffered, format="JPEG", quality=80)
    img_b64 = base64.b64encode(buffered.getvalue()).decode()
    
    # 3. Vision Prompt (Hardened for Coordinate Mapping)
    prompt = f"""
    You are controlling a Windows Desktop via Remote Desktop.
    System Resolution: {screen_w}x{screen_h}
    Task: "{req.command}"
    
    Examine the screenshot and determine the pixel-perfect action.
    Coordinates must be in a 0-1000 normalized scale [x, y] relative to the image.
    
    Return JSON ONLY:
    {{
        "action": "click" | "double_click" | "type" | "hotkey" | "scroll",
        "coordinates": [x, y],
        "text": "string if typing",
        "keys": ["ctrl", "c"] if hotkey,
        "explanation": "Why you did this"
    }}
    """
    
    try:
        # Call Gemini Vision
        response = model.generate_content([prompt, screenshot])
        action_plan = json.loads(response.text.replace('```json', '').replace('```', '').strip())
        
        # 4. Execution Logic with Scaling
        if action_plan['action'] in ['click', 'double_click']:
            # Precise Mapping from 1000-scale to Real Pixel Space (primary monitor for AI-driven actions)
            x, y = _resolve_xy(action_plan['coordinates'][0], action_plan['coordinates'][1], 1)
            
            # Smooth move (visible for CRD monitoring)
            pyautogui.moveTo(x, y, duration=0.8, tween=pyautogui.easeInOutQuad)
            
            if action_plan['action'] == 'click':
                pyautogui.click()
            else:
                pyautogui.doubleClick()

        elif action_plan['action'] == 'type':
            pyautogui.write(action_plan['text'], interval=0.1)
            pyautogui.press('enter')

        elif action_plan['action'] == 'hotkey':
            pyautogui.hotkey(*action_plan['keys'])
            
        print(f"[hands] Executed: {action_plan['explanation']}")
        return {"status": "executed", "plan": action_plan}
        
    except Exception as e:
        print(f"[hands] Gemini/Execution Error: {e}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Bind to localhost only. The backend proxies requests; the desktop agent should not be directly reachable on the LAN.
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("DESKTOP_AGENT_PORT", "8005")))
