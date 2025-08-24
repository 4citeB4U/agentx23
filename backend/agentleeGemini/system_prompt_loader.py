# system_prompt_loader.py
"""
Utilities to load and inject Agent Lee's system prompt (constitution).

Prefer the external GEMINI.MD if present; otherwise fall back to the
AGENT_INSTRUCTION constant from prompts.py.
"""
from __future__ import annotations
from typing import List, Dict, Any
import os

try:
    # Local import so this module stays lightweight
    from .prompts import AGENT_INSTRUCTION  # type: ignore
except Exception:
    AGENT_INSTRUCTION = ""  # Fallback if package-style import fails

def load_system_prompt(path: str = "GEMINI.MD") -> str:
    """Return the manifesto text to use as the system prompt.
    
    Order of preference:
    1) A file named GEMINI.MD in the current working directory (or ENV AGENTLEE_MANIFESTO_PATH)
    2) The AGENT_INSTRUCTION constant in prompts.py
    3) Empty string if neither exists
    """
    file_path = os.getenv("AGENTLEE_MANIFESTO_PATH", path)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
            if text:
                return text
    except Exception:
        pass
    return AGENT_INSTRUCTION or ""

def inject_system_prompt(parts: List[Dict[str, Any]], manifesto: str) -> List[Dict[str, Any]]:
    """Return a new messages list with the system prompt prepended once.
    
    Expects OpenAI/Gemini-compatible message dicts: {"role": "system"|"user"|"assistant", "parts"|"content": ...}
    """
    if not manifesto:
        return parts
    # Avoid double-injection
    if parts and parts[0].get("role") == "system":
        return parts
    return [{ "role": "system", "parts": [manifesto] }] + parts
