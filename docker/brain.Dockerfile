# ── Gemini Brain Router Dockerfile ────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app
COPY server.py ./
COPY .env.local ./ 2>/dev/null || true

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    google-generativeai \
    python-dotenv \
    requests \
    edge-tts

ENV PORT=8004
EXPOSE 8004

HEALTHCHECK --interval=15s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8004/health')" || exit 1

CMD ["python", "server.py"]
