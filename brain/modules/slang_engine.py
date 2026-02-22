"""
Agent Lee — Slang Engine (brain/modules/slang_engine.py)
══════════════════════════════════════════════════════════
Loads the sovereign slang lexicon and injects authentic vernacular context
into Agent Lee's prompt layers. This ADDS to the existing 52-layer persona
without removing any existing behaviour.

The engine:
  1. Loads brain/slang_lexicon.json at startup (once, cached)
  2. Selects a random subset of entries per request for few-shot injection
  3. Builds a persona block that is appended to the SOVEREIGN_LEARNING_DIRECTIVE
  4. Provides a runtime lookup tool that the brain can call to define terms

Ethical notes:
  - All entries are annotated; offensive=True entries are filtered from output
  - Source attribution preserved in each entry
  - AAVE terms handled with cultural respect — no parody or mockery
"""

import json
import random
import os
from typing import List, Dict, Optional

# ── Load lexicon once at module import ────────────────────────────────────────
_LEXICON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "slang_lexicon.json")
_LEXICON: List[Dict] = []
_LEXICON_BY_TERM: Dict[str, Dict] = {}

def _load():
    global _LEXICON, _LEXICON_BY_TERM
    if _LEXICON:
        return  # already loaded
    try:
        with open(_LEXICON_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        # Filter out offensive entries — never inject slurs
        _LEXICON = [e for e in raw if not e.get("offensive", False)]
        _LEXICON_BY_TERM = {e["slang"].lower(): e for e in _LEXICON}
    except Exception as ex:
        import sys
        print(f"[slang_engine] Could not load lexicon: {ex}", file=sys.stderr)
        _LEXICON = []
        _LEXICON_BY_TERM = {}

_load()

# ── Public API ────────────────────────────────────────────────────────────────

def get_random_entries(n: int = 6, positive_only: bool = False) -> List[Dict]:
    """Return n random non-offensive lexicon entries (optionally only positive sentiment)."""
    pool = [e for e in _LEXICON if not positive_only or e.get("sentiment") == "positive"]
    return random.sample(pool, min(n, len(pool))) if pool else []


def lookup_term(term: str) -> Optional[Dict]:
    """Case-insensitive lookup of a slang term. Returns the entry or None."""
    return _LEXICON_BY_TERM.get(term.lower().strip())


def build_few_shot_examples(n: int = 5) -> str:
    """
    Build a few-shot block showing how Agent Lee naturally uses slang in responses.
    Pulls entries that have 'agent_lee_usage' annotations.
    """
    with_usage = [e for e in _LEXICON if "agent_lee_usage" in e]
    chosen = random.sample(with_usage, min(n, len(with_usage)))

    lines = []
    for e in chosen:
        lines.append(f'  • "{e["slang"]}" ({e["canonical"]}) — {e["definition"]}')
        lines.append(f'    Agent Lee says: "{e["agent_lee_usage"]}"')
    return "\n".join(lines)


def build_slang_persona_block() -> str:
    """
    Returns the full slang persona section to append to SOVEREIGN_LEARNING_DIRECTIVE.
    This ADDS to the directive — never replaces existing content.
    """
    few_shot = build_few_shot_examples(n=6)
    all_terms = ", ".join(f'"{e["slang"]}"' for e in _LEXICON)

    return f"""
══════════════════════════════════════════════════════════════
AGENT LEE VERNACULAR LAYER — SOVEREIGN SLANG ENGINE v1.0
══════════════════════════════════════════════════════════════

Agent Lee speaks with authentic, rhythmic vernacular rooted in AAVE (African
American Vernacular English), hip-hop culture, and internet slang. This layer
ADDS to his existing professional persona — it does not replace it.

RULES:
- Use slang naturally, not forcefully. Never overdo it.
- Maintain professional substance. Slang is the delivery, not the content.
- Never use offensive terms (flagged in lexicon and filtered automatically).
- Cultural context matters — use AAVE terms respectfully, not as parody.
- When building, developing, or explaining: drop a slang cue to keep it real.
- "no cap", "bet", "real talk", "lock it in" are Agent Lee's signature phrases.
- "Fam" replaces "user" in casual address. "Creator" for the sovereign user.
- Use "..." naturally for pauses and rhythm — this IS the voice.
- Short affirmations: "Bet.", "W.", "Say less.", "Lock it in.", "Period."

FEW-SHOT EXAMPLES (how Agent Lee delivers with slang):
{few_shot}

FULL LEXICON AVAILABLE ({len(_LEXICON)} terms — non-offensive):
{all_terms}

INTEGRATION WITH VS CODE / GITHUB COPILOT:
When Agent Lee creates or develops an application, plan, or codebase, he ALWAYS
connects to GitHub Copilot via VS Code using the Clarity OS system. Every build
session MUST begin with a VS Code connection context. Agent Lee treats GitHub
Copilot as a collaborator — he orchestrates, Copilot generates, Agent Lee reviews
and approves. Slang carries the energy of that collaboration:
"Yo Copilot, let's build this — no cap." / "Bet — Copilot locked in."
══════════════════════════════════════════════════════════════
"""


def get_runtime_slang_context(user_message: str) -> str:
    """
    Detect if the user message contains known slang terms
    and return a brief context note for the LLM.
    Returns empty string if no slang detected.
    """
    words = user_message.lower().split()
    found = []
    for word in words:
        clean = word.strip(".,!?\"'")
        if clean in _LEXICON_BY_TERM:
            entry = _LEXICON_BY_TERM[clean]
            found.append(f'"{clean}" = {entry["canonical"]}')
    if found:
        return f"[slang detected: {'; '.join(found)}]"
    return ""


def get_lexicon_stats() -> Dict:
    """Return basic stats about the loaded lexicon."""
    return {
        "total": len(_LEXICON),
        "with_agent_usage": len([e for e in _LEXICON if "agent_lee_usage" in e]),
        "regions": list(set(e.get("region", "unknown") for e in _LEXICON)),
        "pos_types": list(set(e.get("pos", "?") for e in _LEXICON)),
    }
