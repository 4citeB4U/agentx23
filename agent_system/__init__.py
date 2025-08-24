"""Top-level compatibility package that re-exports
`agentleeGemini.agent_system` so imports using `agent_system` work
during tests and runtime.
"""
from agentleeGemini.agent_system.communication_config import get_config  # re-export

__all__ = ["get_config"]
