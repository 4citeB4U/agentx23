from fastapi.testclient import TestClient
from backend.app import app
import json

c = TestClient(app)
payload = {'files': ['D:\\agentleegeminialmost\\public\\agentvoice1.m4a'], 'name': 'lee_test'}
r = c.post('/api/voice/clone', json=payload)
print('STATUS', r.status_code)
try:
    print(r.json())
except Exception:
    print(r.text)
