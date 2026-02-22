"""
brain/modules/emotional_engine.py
───────────────────────────────────
Lightweight regex + environment-aware emotional scoring.
No model downloads — keyword heuristics only. Replace with learned classifier later.

Scores returned are floats in [0, 1]:
  stress      — urgency signals (deadline, asap, urgent, broken, critical…)
  fatigue     — exhaustion signals (tired, exhausted, slow, overwhelmed…)
  urgency     — time-pressure signals (now, immediately, fast, quick…)
  frustration — repeated failure / negative affect (again, still broken, ugh, ffs…)
"""

import re
from typing import Optional

# ── Keyword banks ───────────────────────────────────────────────────────────────
_STRESS_WORDS = re.compile(
    r"\b(urgent|asap|deadline|critical|production|outage|down|broken|failing|"
    r"crash|must|panic|emergency|blocker|p0|p1|hotfix)\b", re.I
)
_FATIGUE_WORDS = re.compile(
    r"\b(tired|exhausted|sleepy|drained|overwhelmed|burnt|burnout|"
    r"slow|sluggish|weak|can'?t think|foggy)\b", re.I
)
_URGENCY_WORDS = re.compile(
    r"\b(now|immediately|right now|hurry|quick(ly)?|fast|instantly|"
    r"no time|on fire|right away|time\s*sensitive)\b", re.I
)
_FRUSTRATION_WORDS = re.compile(
    r"\b(again|still|ugh|ffs|wtf|argh|why|not working|doesn'?t work|"
    r"same (issue|error|problem)|for the \w+ time|seriously)\b", re.I
)

# ── Environment modifiers ───────────────────────────────────────────────────────
_LIGHTING_STRESS = {"dark": 0.1, "dim": 0.05, "normal": 0.0, "bright": 0.0, "unknown": 0.0}


def _count_matches(pattern: re.Pattern, text: str) -> float:
    hits = len(pattern.findall(text))
    return min(hits / 3.0, 1.0)   # 3+ hits = score 1.0


def score_emotion(user_text: str,
                  env: Optional[dict] = None,
                  history: Optional[list] = None) -> dict:
    """
    Analyse user_text against keyword banks + optional env snapshot.

    Parameters
    ----------
    user_text : str   — the raw user message
    env       : dict  — perception snapshot from vision_context.get_environment_snapshot()
    history   : list  — recent chat turns (dicts with 'role'/'content') — reserved for future use

    Returns
    -------
    dict with keys: stress, fatigue, urgency, frustration  (all floats 0-1)
    """
    text = user_text or ""

    stress      = _count_matches(_STRESS_WORDS, text)
    fatigue     = _count_matches(_FATIGUE_WORDS, text)
    urgency     = _count_matches(_URGENCY_WORDS, text)
    frustration = _count_matches(_FRUSTRATION_WORDS, text)

    # Backpressure from repeated history failures (reserved)
    if history:
        fail_count = sum(1 for t in history[-5:]
                         if isinstance(t, dict) and "fallback" in str(t.get("model", "")))
        frustration = min(1.0, frustration + fail_count * 0.15)

    # Environment adjustments
    if env:
        lighting = env.get("lighting", "unknown")
        stress   = min(1.0, stress + _LIGHTING_STRESS.get(lighting, 0.0))

        # Many detected objects → busy environment → mild urgency boost
        obj_count = len(env.get("objects", []))
        if obj_count > 5:
            urgency = min(1.0, urgency + 0.05)

    return {
        "stress":      round(stress,      3),
        "fatigue":     round(fatigue,     3),
        "urgency":     round(urgency,     3),
        "frustration": round(frustration, 3),
    }
