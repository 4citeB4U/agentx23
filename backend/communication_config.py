"""Backend-level communication_config shim that delegates to
`agentleeGemini.agent_system.communication_config.get_config`.
"""
from agentleeGemini.agent_system.communication_config import get_config  # type: ignore

__all__ = ["get_config"]
