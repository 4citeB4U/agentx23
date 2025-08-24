"""Legacy tool suite for Agent Lee.

This file preserves the earlier implementation of the tool suite.  It exists
solely for historical reference and migration.  New development should occur
in `agent_system/tool_suite.py`.
"""

from __future__ import annotations
import asyncio
import functools
import inspect
import logging
import pathlib
import shutil
import shlex
import time
import uuid
from typing import Any, Dict, Optional

# The legacy configuration loader; may not work in all contexts
try:
    from .communication_config import get_config  # type: ignore
except Exception:
    from agent_system.communication_config import get_config  # type: ignore

logger = logging.getLogger(__name__)
config = get_config()

try:
    from duckduckgo_search import DDGS  # type: ignore
except Exception:
    DDGS = None

# Workspace root
SECURE_BASE_DIR = pathlib.Path(config.get('secure_workspace_path', './agent_workspace')).resolve()
SECURE_BASE_DIR.mkdir(parents=True, exist_ok=True)

CONFIRMATION_TOKENS: Dict[str, Dict[str, Any]] = {}


def make_result(ok: bool, data: Any = None, error: Optional[str] = None, confirmation_required: bool = False, token: Optional[str] = None) -> Dict[str, Any]:
    return {"ok": ok, "data": data, "error": error, "confirmation_required": confirmation_required, "token": token}


def require_confirmation(action: str, details: Dict[str, Any]) -> Dict[str, Any]:
    token = uuid.uuid4().hex
    ttl = int(config.get('confirmation_ttl', 300))
    CONFIRMATION_TOKENS[token] = {"action": action, "details": details, "expires_at": time.time() + ttl}
    return make_result(False, data={"action": action, "details": details}, confirmation_required=True, token=token)


def validate_confirmation(token: str, action: str) -> bool:
    entry = CONFIRMATION_TOKENS.get(token)
    if not entry:
        return False
    if entry.get("action") != action:
        return False
    if time.time() > entry.get("expires_at", 0):
        del CONFIRMATION_TOKENS[token]
        return False
    del CONFIRMATION_TOKENS[token]
    return True


def sandboxed_path(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            sig = inspect.signature(func)
            bound = sig.bind_partial(*args, **kwargs)
            if 'path' not in bound.arguments:
                return func(*args, **kwargs)
            raw = bound.arguments.get('path')
            if raw is None:
                return make_result(False, error="'path' argument required")
            resolved = (SECURE_BASE_DIR / str(raw)).resolve()
            if not str(resolved).startswith(str(SECURE_BASE_DIR)):
                return make_result(False, error='Access denied: outside secure workspace')
            bound.arguments['path'] = str(resolved)
            return func(**bound.arguments)
        except Exception as e:
            logger.exception('sandbox error')
            return make_result(False, error=str(e))

    return wrapper


@sandboxed_path
def manage_file_system(action: str, path: str, content: str = None, confirmation_token: Optional[str] = None) -> Dict[str, Any]:
    try:
        p = pathlib.Path(path)
        if action == 'read':
            if not p.is_file():
                return make_result(False, error=f'File not found: {path}')
            max_bytes = int(config.get('max_file_size_mb', 100)) * 1024 * 1024
            if p.stat().st_size > max_bytes:
                return make_result(False, error='File too large')
            return make_result(True, data=p.read_text(encoding='utf-8'))

        if action == 'write':
            if content is None:
                return make_result(False, error="'content' is required")
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding='utf-8')
            return make_result(True, data={'path': str(p)})

        if action == 'list':
            if not p.is_dir():
                return make_result(False, error=f'Directory not found: {path}')
            items = [x.name for x in p.iterdir()]
            return make_result(True, data=items)

        if action == 'delete':
            if not p.exists():
                return make_result(False, error=f'Path not found: {path}')
            if not confirmation_token:
                return require_confirmation('delete', {'path': str(p)})
            if not validate_confirmation(confirmation_token, 'delete'):
                return make_result(False, error='Invalid or expired confirmation token')
            if p.is_file():
                p.unlink()
                return make_result(True, data={'deleted': str(p)})
            if p.is_dir():
                shutil.rmtree(p)
                return make_result(True, data={'deleted': str(p)})

        return make_result(False, error='Invalid action')
    except Exception as e:
        logger.exception('manage_file_system')
        return make_result(False, error=str(e))


async def execute_shell_command(command) -> Dict[str, Any]:
    try:
        if isinstance(command, (list, tuple)):
            tokens = list(command)
            use_shell = False
        else:
            for c in [';', '&&', '||', '\n', '|', '&', '>', '<', '`', '$']:
                if c in str(command):
                    return make_result(False, error='Command contains disallowed operator or metacharacter')
            lowered = str(command).lower()
            for w in ['sudo', ' rm ', 'mkfs', 'shutdown', 'reboot', 'passwd', 'chmod', 'chown']:
                if w in lowered:
                    return make_result(False, error='Forbidden operation in command')
            use_shell = True

        if not config.get('enable_shell_commands', False):
            return make_result(False, error='Shell commands disabled by config')

        if use_shell:
            proc = await asyncio.create_subprocess_shell(str(command), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        else:
            proc = await asyncio.create_subprocess_exec(*tokens, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)

        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=int(config.get('shell_command_timeout', 60)))
        except asyncio.TimeoutError:
            proc.kill()
            return make_result(False, error='Command timed out')

        out = stdout.decode(errors='ignore').strip()
        err = stderr.decode(errors='ignore').strip()
        if proc.returncode == 0:
            return make_result(True, data={'output': out})
        return make_result(False, error=err or f'Exit {proc.returncode}')
    except Exception as e:
        logger.exception('execute_shell_command')
        return make_result(False, error=str(e))


async def conduct_deep_research(query: str, max_sources: int = 5) -> Dict[str, Any]:
    try:
        if DDGS is None:
            return make_result(False, error='Search backend not available')
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_sources):
                results.append({
                    'title': r.get('title'),
                    'link': r.get('href') or r.get('link'),
                    'snippet': (r.get('body') or '')[:300],
                })
        if not results:
            return make_result(False, error='No results')
        synthesis = '\n\n'.join([f"{i+1}. {s['title']} - {s['snippet']}\n{s['link']}" for i, s in enumerate(results)])
        return make_result(True, data={'synthesis': synthesis, 'sources': results})
    except Exception as e:
        logger.exception('conduct_deep_research')
        return make_result(False, error=str(e))


MASTER_TOOL_SUITE = [manage_file_system, execute_shell_command, conduct_deep_research]