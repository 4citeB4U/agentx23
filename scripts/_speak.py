import urllib.request, json, os, tempfile

hs = 'AGENT_LEE_SOVEREIGN_V1'
msg = 'Yo. What up. Agent Lee in the building. Systems online, tunnel locked in, voice crisp. I am ready to work.'

body = json.dumps({'text': msg, 'voice': 'en-US-GuyNeural', 'rate': '+20%'}).encode()
req = urllib.request.Request(
    'http://localhost:6001/api/chat/tts',
    data=body,
    headers={'Content-Type': 'application/json', 'x-neural-handshake': hs},
    method='POST'
)
print('Calling TTS...')
r = urllib.request.urlopen(req, timeout=20)
audio = r.read()
ct = r.headers.get('Content-Type')
print('Got ' + str(len(audio)) + ' bytes, Content-Type: ' + str(ct))

tmp = tempfile.mktemp(suffix='.mp3')
with open(tmp, 'wb') as f:
    f.write(audio)
print('Saved to: ' + tmp)
os.startfile(tmp)
print('PLAYING - Agent Lee is speaking!')
