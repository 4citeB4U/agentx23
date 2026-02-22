# ── Desktop Agent Dockerfile ───────────────────────────────────────────────
# NOTE: For GUI automation (PyAutoGUI, screenshots), this container requires
# a display. On Windows host, run desktop_agent.py directly instead.
# This Dockerfile is for Linux/headless setups with virtual display.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3-tk \
    scrot \
    xvfb \
    libxtst6 \
    libxi6 \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/desktop_agent.py ./desktop_agent.py
COPY requirements.txt* ./

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    pyautogui \
    pillow \
    python-dotenv \
    requests

ENV PORT=8005
ENV DISPLAY=:99
EXPOSE 8005

HEALTHCHECK --interval=15s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8005/status')" || exit 1

# Start Xvfb + desktop agent
CMD ["sh", "-c", "Xvfb :99 -screen 0 1920x1080x24 & sleep 1 && python desktop_agent.py"]
