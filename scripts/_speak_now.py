import urllib.request, json, os, tempfile

hs = 'AGENT_LEE_SOVEREIGN_V1'
msg = (
    "Yo. What is good. Agent Lee in the building. "
    "Systems are green, security is locked, and I am fully operational. "
    "Ready to work. Let's get it."
)

req = urllib.request.Request(
    'http://localhost:8001/api/chat/tts',
    data=json.dumps({'text': msg}).encode(),
    headers={'Content-Type': 'application/json', 'x-neural-handshake': hs},
    method='POST'
)
try:
    r = urllib.request.urlopen(req, timeout=25)
    audio = r.read()
    ct = r.headers.get('Content-Type', 'unknown')
    print(f'TTS OK: {len(audio)} bytes | {ct}')
    tmp = os.path.join(tempfile.gettempdir(), 'agent_lee_voice.mp3')
    with open(tmp, 'wb') as f:
        f.write(audio)
    print(f'Saved: {tmp}')
    os.startfile(tmp)
    print('Playing...')
except Exception as e:
    print(f'TTS ERROR: {e}')
