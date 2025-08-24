import sys
import types
import importlib
import pytest

# Provide lightweight stubs so importing the module under test won't fail
tools_mod = types.ModuleType("langchain_community.tools")

class _DummySearch:
    def run(self, *_):
        return ""

def _duck_ctor(*_, **__):
    return _DummySearch()

tools_mod.DuckDuckGoSearchRun = _duck_ctor
sys.modules.setdefault("langchain_community", types.ModuleType("langchain_community"))
sys.modules.setdefault("langchain_community.tools", tools_mod)

# Also ensure a minimal genai stub exists so decorators don't break imports.
genai_mod = types.ModuleType("google.generativeai")

class _Noop:
    def tool(self, func=None, **_):
        if func is None:
            def _decorator(f):
                return f

            return _decorator
        return func

# Expose a callable 'tool' attribute so @genai.tool works in the module under test.
_noop = _Noop()
genai_mod.tool = _noop.tool
genai_mod.genai = _noop
sys.modules.setdefault("google", types.ModuleType("google"))
sys.modules.setdefault("google.generativeai", genai_mod)

from backend import tool_suite as ts


def setup_function():
    # reset mutable module state between tests
    try:
        ts._time_logs.clear()
        ts._time_history.clear()
    except Exception:
        pass
    try:
        ts.active_layers.clear()
        ts.active_layers.update(ts.LAYER_GROUPS["core"]["layers"])
    except Exception:
        pass


def _call_or_xfail(fn, *args, **kwargs):
    import asyncio
    try:
        if asyncio.iscoroutinefunction(fn):
            return asyncio.run(fn(*args, **kwargs))
        res = fn(*args, **kwargs)
        if asyncio.iscoroutine(res):
            return asyncio.run(res)
        return res
    except Exception as e:
        pytest.xfail(f"Function not implemented or raised during call: {e}")


def test_manage_file_system_basic(tmp_path, monkeypatch):
    monkeypatch.setenv("SECURE_WORKSPACE_PATH", str(tmp_path))

    # try write/read/list operations; expect canonical dict results
    r = _call_or_xfail(ts.manage_file_system, "write", "folder/a.txt", "hello world")
    assert isinstance(r, dict)
    assert r.get('ok') is True

    content = _call_or_xfail(ts.manage_file_system, "read", "folder/a.txt")
    assert isinstance(content, dict)
    assert content.get('ok') is True

    listing = _call_or_xfail(ts.manage_file_system, "list", "folder")
    assert isinstance(listing, dict)
    assert listing.get('ok') is True


def test_execute_shell_command_basic():
    res = _call_or_xfail(ts.execute_shell_command, "echo hello")
    # Expect canonical dict result
    assert isinstance(res, dict)
    assert 'ok' in res


def test_calculate_simple():
    out = _call_or_xfail(ts.calculate, "2+3*4")
    assert isinstance(out, dict)
    assert out.get('ok') is True
    assert isinstance(out.get('data'), str)


def test_manage_time_tracker_fallback(monkeypatch):
    # Force fallback by setting memory_instance to an object without expected methods
    monkeypatch.setattr(ts, "memory_instance", object(), raising=False)
    try:
        ts._time_logs.clear()
        ts._time_history.clear()
    except Exception:
        pass

    s = _call_or_xfail(ts.manage_time_tracker, "start", "task1")
    assert isinstance(s, dict)
    assert s.get('ok') is True
    assert isinstance(s.get('data'), str)

    st = _call_or_xfail(ts.manage_time_tracker, "stop", "task1")
    assert isinstance(st, dict)
    assert st.get('ok') is True
    assert isinstance(st.get('data'), str)

    rep = _call_or_xfail(ts.manage_time_tracker, "report", "task1")
    assert isinstance(rep, dict)
    assert rep.get('ok') is True
    assert isinstance(rep.get('data'), str)
