"""Lightweight re-export shim for the canonical backend.tool_suite.

This module intentionally keeps minimal logic: it exposes the public
symbols of `backend.tool_suite` so imports like
`agentleeGemini.agent_system.tool_suite` continue to work. Callers should
use the canonical structured dict return values and await async callables
when appropriate.
"""
try:
    # Prefer package import when available
    from backend.tool_suite import *  # type: ignore
except Exception:
    # Fallback: load by path so tests that import by file path still work
    import importlib.util
    from pathlib import Path
    repo_root = Path(__file__).resolve().parents[2]
    candidate = repo_root / 'backend' / 'tool_suite.py'
    if candidate.exists():
        spec = importlib.util.spec_from_file_location('backend.tool_suite', str(candidate))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)  # type: ignore
        globals().update({k: getattr(mod, k) for k in dir(mod) if not k.startswith('_')})
    else:
        raise

__all__ = [n for n in globals().keys() if not n.startswith('_')]

# Final __all__ already set earlier; keep compatibility wrappers above intact.
