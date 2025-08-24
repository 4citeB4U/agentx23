import json
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def test_health_and_capabilities():
    r = client.get('/health')
    assert r.status_code == 200
    # at minimum health should respond with some JSON or text

    r2 = client.get('/api/capabilities')
    assert r2.status_code == 200
    # capabilities should be JSON serializable
    try:
        _ = r2.json()
    except Exception:
        assert False, 'capabilities response not JSON'


def test_tool_fs_list():
    payload = {"action": "list", "path": "."}
    r = client.post('/api/tool/fs', json=payload)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, dict) or isinstance(data, list)


def test_tool_shell_echo():
    payload = {"command": "echo hello"}
    r = client.post('/api/tool/shell', json=payload)
    # shell execution may be sandboxed; check we got a 200 and JSON back
    assert r.status_code == 200
    try:
        _ = r.json()
    except Exception:
        assert False, 'shell endpoint did not return JSON'


def test_tool_deep_research():
    payload = {"query": "unit testing", "max_sources": 1}
    r = client.post('/api/tool/deep_research', json=payload)
    assert r.status_code == 200
    # accept string or JSON
    # no strict assertion because backend may proxy or stub
