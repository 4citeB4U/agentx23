"""Minimal communication_config shim used during tests and by backend tooling.

This provides a `get_config()` function that returns a dict-like object
with minimal keys expected by `tool_suite.py`.
"""
import os


def get_config():
    # Minimal config with defaults used by tool_suite
    return {
        'secure_workspace_path': os.environ.get('SECURE_WORKSPACE_PATH', './agent_workspace'),
        'confirmation_ttl': int(os.environ.get('CONFIRMATION_TTL', '300')),
        'max_file_size_mb': int(os.environ.get('MAX_FILE_SIZE_MB', '100')),
        'enable_shell_commands': os.environ.get('ENABLE_SHELL_COMMANDS', 'false').lower() in ('1', 'true', 'yes'),
        'shell_command_timeout': int(os.environ.get('SHELL_COMMAND_TIMEOUT', '60')),
    }
