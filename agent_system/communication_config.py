"""Top-level agent_system.communication_config shim re-exporting the
implementation under agentleeGemini.agent_system.
"""
from agentleeGemini.agent_system.communication_config import get_config  # type: ignore

__all__ = ["get_config"]
