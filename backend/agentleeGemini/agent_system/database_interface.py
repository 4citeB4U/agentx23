# LEEWAY HEADER (ASCII) — DO NOT EDIT TAG LINE
# TAG: FILE.AGENTLEEGEMINI.AGENT_SYSTEM.DATABASE_INTERFACE
# COLOR_ONION_HEX: NEON=#FF4D4D FLUO=#33FFA8 PASTEL=#FFD6D6 | SIG: 6A55E517
# ICON_ASCII: family=simple glyph=meta ICON_SIG=64EA9E39
# 5WH: WHAT=todo; WHY=todo; WHEN=todo; HOW=todo; WHERE=todo; WHO=todo

"""
🏷 TAG: FILE.AGENTLEEGEMINI.AGENT_SYSTEM.DATABASE_INTERFACE
🎨 COLOR_ONION: ◯#f04a38 ▷ ◍#bc1a32 ▷ ●#d71d68 | SIG: 8f3baec8

WHAT: In-memory database interface and simple data structures for Agent Lee.
WHY: Provide a lightweight default store for development and testing.
WHEN: Used during startup and by tools needing persistent-like access.
WHERE: agentleeGemini/agent_system package.
WHO: GitHub Copilot (assistant) — header added for LEEWAY compliance.
HOW: Exposes MemoryDatabase class with convenience methods for memory and logs.
ICON: 🧠
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MemoryEntry:
    key: str
    value: str
    memory_type: str = "general"
    importance: int = 1
    timestamp: datetime.datetime = field(default_factory=datetime.datetime.utcnow)


@dataclass
class InteractionRecord:
    timestamp: datetime.datetime
    user: str
    message: str


@dataclass
class EmotionalAnchor:
    label: str
    emotion: str
    strength: int = 1


@dataclass
class TimeLog:
    task_name: str
    project_name: Optional[str]
    start_time: datetime.datetime
    end_time: Optional[datetime.datetime] = None


class MemoryDatabase:
    """A simple in-memory database for long-term storage and logs."""

    def __init__(self) -> None:
        self._memory: Dict[str, MemoryEntry] = {}
        self._interactions: List[InteractionRecord] = []
        self._anchors: Dict[str, EmotionalAnchor] = {}
        self._time_logs: List[TimeLog] = []

    # ------------------------------------------------------------------
    # Memory operations
    # ------------------------------------------------------------------
    def store_long_term_memory(self, key: str, value: str, memory_type: str = "general", importance: int = 1) -> None:
        """Store a key–value pair in long-term memory.

        Parameters
        ----------
        key:
            The identifier for the memory.
        value:
            The content to store.
        memory_type:
            A category tag (e.g. 'general', 'personal', 'project').
        importance:
            An integer weight indicating relative importance.
        """
        self._memory[key] = MemoryEntry(key, value, memory_type, importance)

    def retrieve_long_term_memory(self, key: str) -> Optional[str]:
        """Retrieve a value from long-term memory by key.

        Returns ``None`` if the key does not exist.
        """
        entry = self._memory.get(key)
        return entry.value if entry else None

    def delete_long_term_memory(self, key: str) -> bool:
        """Delete a memory entry.  Returns ``True`` if deleted."""
        return self._memory.pop(key, None) is not None

    # ------------------------------------------------------------------
    # Interaction history
    # ------------------------------------------------------------------
    def record_interaction(self, user: str, message: str) -> None:
        """Append an interaction record to the history."""
        self._interactions.append(InteractionRecord(datetime.datetime.utcnow(), user, message))

    def search_interactions(self, query: str, depth_days: int = 7) -> List[InteractionRecord]:
        """Search interaction history for a string within a date window."""
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=depth_days)
        return [rec for rec in self._interactions if rec.timestamp >= cutoff and query.lower() in rec.message.lower()]

    # ------------------------------------------------------------------
    # Emotional anchors
    # ------------------------------------------------------------------
    def store_emotional_anchor(self, label: str, emotion: str, strength: int = 1) -> None:
        """Create or update an emotional anchor linking a label to an emotion."""
        self._anchors[label] = EmotionalAnchor(label, emotion, strength)

    def retrieve_emotional_anchor(self, label: str) -> Optional[EmotionalAnchor]:
        """Fetch an emotional anchor by label."""
        return self._anchors.get(label)

    # ------------------------------------------------------------------
    # Time logs
    # ------------------------------------------------------------------
    def start_time_log(self, task_name: str, project_name: Optional[str] = None) -> None:
        """Start a new time log entry for a task."""
        self._time_logs.append(TimeLog(task_name, project_name, datetime.datetime.utcnow()))

    def stop_time_log(self, task_name: str) -> None:
        """Stop the most recent time log entry for a given task."""
        for log in reversed(self._time_logs):
            if log.task_name == task_name and log.end_time is None:
                log.end_time = datetime.datetime.utcnow()
                break

    def report_time_logs(self) -> List[Tuple[str, float]]:
        """Return a list of (task_name, duration_seconds) for completed logs."""
        reports: List[Tuple[str, float]] = []
        for log in self._time_logs:
            if log.end_time:
                duration = (log.end_time - log.start_time).total_seconds()
                reports.append((log.task_name, duration))
        return reports