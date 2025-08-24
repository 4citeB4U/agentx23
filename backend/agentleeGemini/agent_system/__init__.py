# LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
# TAG: FILE.AGENTLEEGEMINI.AGENT_SYSTEM.INIT
# COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: A7B0B48B
# ICON_ASCII: family=simple glyph=undefined ICON_SIG=4550809C
# 5WH: WHAT=todo; WHY=todo; WHEN=todo; HOW=todo; WHERE=todo; WHO=todo

"""
🏷 TAG: FILE.AGENTLEEGEMINI.AGENT_SYSTEM.INIT
🎨 COLOR_ONION: ◯#1ce39a ▷ ◍#1c9249 ▷ ●#21ab33 | SIG: 52085468

WHAT: Public exports for the Agent Lee system package (prompts, DB interface, tools).
WHY: Provide a single import surface for higher-level modules and the loader.
WHEN: Imported during application startup (agent_lee_loader.py).
WHERE: agentleeGemini/agent_system package root.
WHO: GitHub Copilot (assistant) — added header to satisfy LEEWAY tooling.
HOW: Re-exports key modules to simplify imports elsewhere in the project.
ICON: 🧩

This package contains the core logic for Agent Lee.  It exposes the
database interface, the 50-layer personality prompts, and the native
tool suite which Gemini can call directly.  All public functions in
``tool_suite`` are annotated as Gemini tools so that the
``GenerativeModel`` can discover them at runtime.

The package is deliberately light-weight: stateful objects (e.g.
database connections, memory caches) should be instantiated in
``agent_lee_loader.py`` and passed into the tools or exposed via
module-level singletons.  This separation makes it trivial to swap
implementations (e.g. SQLite vs. SurrealDB) without modifying the
tools themselves.
"""

from ..prompts import AGENT_INSTRUCTION, LAYER_GROUPS  # noqa: F401
from .database_interface import MemoryDatabase  # noqa: F401
from .tool_suite import (
    consult_core_identity,
    set_operational_mode,
    manage_agent_memory,
    search_interaction_history,
    manage_emotional_anchors,
    consult_prime_directives,
    manage_file_system,
    manage_time_tracker,
    manage_schedule,
    manage_user_focus,
    analyze_weather_impact,
    conduct_deep_research,
    execute_shell_command,
    compose_email,
    take_note,
    make_call,
    answer_incoming_call,
    manage_active_call,
    send_sms,
    check_call_log,
    get_caller_info,
    summarize_conversation,
    search_web,
    get_weather,
    get_current_time,
    calculate,
    translate_text,
    set_reminder,
)  # noqa: F401