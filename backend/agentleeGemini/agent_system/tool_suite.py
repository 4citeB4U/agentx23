"""Compatibility wrapper.

This file used to contain a full tool suite implementation. During a
cleanup the canonical implementation was consolidated to `backend/tool_suite.py`.
To preserve existing import paths (code under `agentleeGemini.agent_system`),
this module now re-exports the canonical functions and constants from the
backend location.

Do not add new implementations here. If you need to extend the tool-suite,
modify `backend/tool_suite.py` and keep this wrapper stable.
"""

from __future__ import annotations

try:
    # Prefer the canonical backend implementation
    from backend.tool_suite import *  # noqa: F401,F403
except Exception:
    # Fall back to relative import for environments that treat the package as a
    # top-level package (tests or alternate layouts).
    from ...tool_suite import *  # type: ignore  # noqa: F401,F403

__all__ = [name for name in globals().keys() if not name.startswith("_")]
# Replaced by agent_lee_loader at runtime; falls back to in-memory instance.
memory_instance: MemoryDatabase = MemoryDatabase()

# Start with Core layers active by default.
active_layers: Set[int] = set(LAYER_GROUPS["core"]["layers"])

# Tiny in-process fallback for time logs if MemoryDatabase lacks these methods.
_time_logs: Dict[str, float] = {}
_time_history: List[tuple[str, float]] = []


def _require_memory() -> MemoryDatabase:
    return memory_instance


def _format_layers() -> str:
    return ", ".join(str(n) for n in sorted(active_layers))


# -----------------------------------------------------------------------------
# Identity & configuration
# -----------------------------------------------------------------------------

@genai.tool
def consult_core_identity(section: str = "directives") -> str:
    """
    Return foundational information about Agent Lee.

    Args:
        section: 'directives' | 'layers' | 'instruction'
    """
    key = section.strip().lower()
    if key in ("directives", "instruction"):
        # AGENT_INSTRUCTION usually contains the core system prompt / constitution.
        return AGENT_INSTRUCTION.strip()
    if key == "layers":
        desc = []
        for group, spec in LAYER_GROUPS.items():
            desc.append(f"{group.title()} → layers {spec['layers']}")
        return "Active layers: " + _format_layers() + "\n\n" + "\n".join(desc)
    return f"Unknown section '{section}'. Valid: directives | layers | instruction."


@genai.tool
def set_operational_mode(mode: str) -> str:
    """
    Switch active personality layers according to presets.
    Presets are derived from LAYER_GROUPS keys.
    """
    # Map preset names to layer groups; edit to taste.
    presets = {
        "focus_work": ["execution", "reasoning"],
        "creative_brainstorm": ["evolution", "execution"],
        "emotional_support": ["awareness", "evolution"],
        "strategic_planning": ["reasoning", "evolution"],
        "casual_chat": ["core", "awareness"],
    }
    mkey = mode.strip().lower()
    if mkey not in presets:
        return f"Unknown operational mode '{mode}'."
    active_layers.clear()
    for group in presets[mkey]:
        if group not in LAYER_GROUPS:
            continue
        active_layers.update(LAYER_GROUPS[group]["layers"])
    return f"Operational mode set to '{mode}'. Active layers: [{_format_layers()}]."


# -----------------------------------------------------------------------------
# Memory & history tools
# -----------------------------------------------------------------------------

@genai.tool
def manage_agent_memory(
    action: str,
    memory_key: Optional[str] = None,
    memory_value: Optional[str] = None,
    memory_type: str = "general",
    importance: int = 1,
) -> str:
    """
    Store, retrieve, or delete long-term memories / emotional anchors.

    Args:
        action: 'store' | 'retrieve' | 'delete'
        memory_key: key for the memory
        memory_value: value to store (required for 'store')
        memory_type: optional category
        importance: weight (unused placeholder)
    """
    db = _require_memory()

    if action == "retrieve" and memory_key:
        anchor: Optional[EmotionalAnchor] = db.retrieve_emotional_anchor(memory_key)
        if not anchor:
            return f"No emotional anchor found for '{memory_key}'."
        return str(anchor)

    if action == "store" and memory_key and memory_value:
        db.store_emotional_anchor(memory_key, memory_value)
        return f"Emotional anchor '{memory_key}' stored."

    if action == "delete" and memory_key:
        db.delete_emotional_anchor(memory_key)
        return f"Emotional anchor '{memory_key}' deleted."

    return "Error: action must be 'store'|'retrieve'|'delete' and memory_key provided."


# -----------------------------------------------------------------------------
# Productivity tools
# -----------------------------------------------------------------------------

@genai.tool
def manage_file_system(
    action: str,
    path: str,
    content: Optional[str] = None,
    new_path: Optional[str] = None,
) -> str:
    """
    Safe file operations inside a sandbox.

    Args:
        action: 'read'|'write'|'list'|'move'|'delete'|'create_directory'
        path: relative path within the workspace
        content: text for 'write'
        new_path: destination for 'move'
    """
    workspace_root = os.getenv("SECURE_WORKSPACE_PATH", "./agent_workspace")
    abs_path = os.path.abspath(os.path.join(workspace_root, path))
    root_abs = os.path.abspath(workspace_root)

    # Prevent traversal
    if not abs_path.startswith(root_abs):
        return "Error: Path escapes the secure workspace."

    os.makedirs(os.path.dirname(abs_path), exist_ok=True)

    try:
        if action == "write":
            if content is None:
                return "Error: 'content' must be provided for write operations."
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(content)
            return f"File written to {path}."

        if action == "read":
            if not os.path.exists(abs_path):
                return f"Error: File '{path}' does not exist."
            with open(abs_path, "r", encoding="utf-8") as f:
                return f.read()

        if action == "list":
            if not os.path.isdir(abs_path):
                return f"Error: '{path}' is not a directory."
            return "\n".join(sorted(os.listdir(abs_path)))

        if action == "move":
            if new_path is None:
                return "Error: 'new_path' is required to move a file."
            dest = os.path.abspath(os.path.join(workspace_root, new_path))
            if not dest.startswith(root_abs):
                return "Error: Destination escapes the secure workspace."
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            os.rename(abs_path, dest)
            return f"Moved '{path}' to '{new_path}'."

        if action == "delete":
            if os.path.isdir(abs_path):
                os.rmdir(abs_path)
                return f"Directory '{path}' deleted."
            os.remove(abs_path)
            return f"File '{path}' deleted."

        if action == "create_directory":
            os.makedirs(abs_path, exist_ok=True)
            return f"Directory '{path}' created."

        return "Error: Unknown file system action."
    except Exception as exc:  # noqa: BLE001
        return f"Error: {exc}"


@genai.tool
def manage_time_tracker(act: str, task_name: str, project_name: Optional[str] = None) -> str:
    """
    Start/stop/report a lightweight time tracker.

    Args:
        act: 'start'|'stop'|'report'
        task_name: task label
        project_name: optional project label
    """
    db = _require_memory()

    # Prefer database-backed implementation if available
    if hasattr(db, "start_time_log") and hasattr(db, "stop_time_log") and hasattr(db, "report_time_logs"):
        if act == "start":
            db.start_time_log(task_name, project_name)
            return f"Timer started for task '{task_name}'."
        if act == "stop":
            db.stop_time_log(task_name)
            return f"Timer stopped for task '{task_name}'."
        if act == "report":
            reports = db.report_time_logs()
            if not reports:
                return "No completed time logs found."
            return "\n".join(f"{name}: {duration:.1f}s" for name, duration in reports)
        return "Error: act must be 'start'|'stop'|'report'."

    # Fallback in-memory implementation
    now = datetime.utcnow().timestamp()
    if act == "start":
        _time_logs[task_name] = now
        return f"Timer started for task '{task_name}'."
    if act == "stop":
        start = _time_logs.pop(task_name, None)
        if start is None:
            return f"No running timer for '{task_name}'."
        dur = now - start
        _time_history.append((task_name, dur))
        return f"Timer stopped for '{task_name}' ({dur:.1f}s)."
    if act == "report":
        if not _time_history:
            return "No completed time logs found."
        return "\n".join(f"{name}: {secs:.1f}s" for name, secs in _time_history)
    return "Error: act must be 'start'|'stop'|'report'."


@genai.tool
def manage_schedule(action: str, event_title: str, time: Optional[str] = None) -> str:
    """
    Minimal schedule facade (placeholder).

    Args:
        action: 'add'|'list'
        event_title: title when adding
        time: time string when adding
    """
    if action.lower() == "add":
        if time is None:
            return "Error: 'time' is required when adding an event."
        return f"Added '{event_title}' to the calendar at {time}."
    if action.lower() == "list":
        return "Upcoming events: [Event 1, Event 2, Event 3]."
    return "Error: Unknown schedule action."


@genai.tool
def manage_user_focus(action: str, duration_minutes: int = 25) -> str:
    """
    Start/end a focus session (Pomodoro-style).
    """
    if action.lower() == "start_session":
        return f"Focus session started for {duration_minutes} minutes."
    if action.lower() == "end_session":
        return "Focus session ended."
    return "Error: Unknown focus action. Use 'start_session' or 'end_session'."


@genai.tool
def analyze_weather_impact(location: str) -> str:
    """
    Basic weather + impact analysis using wttr.in (best effort).
    """
    url = f"https://wttr.in/{location}?format=j1"
    try:
        data = requests.get(url, timeout=10).json()
        current = data["current_condition"][0]
        temp_c = current.get("temp_C")
        condition = current.get("weatherDesc", [{"value": "N/A"}])[0]["value"]
        aqi = current.get("air_quality", "N/A")
        uv_index = current.get("uvIndex", "N/A")
        return (
            f"Weather Impact Analysis for {location}:\n"
            f"- Conditions: {condition}, {temp_c}°C\n"
            f"- Air Quality (AQI): {aqi}\n"
            f"- UV Index: {uv_index}\n"
            f"- Recommendation: Plan accordingly and stay safe."
        )
    except Exception:  # noqa: BLE001
        return f"Sorry, I couldn't fetch weather data for {location}."


# -----------------------------------------------------------------------------
# Research & automation tools
# -----------------------------------------------------------------------------

@genai.tool
def conduct_deep_research(query: str, max_sources: int = 3) -> str:
    """
    Multi-source web research (DuckDuckGo snippets + simple fetch).
    """
    search_tool = DuckDuckGoSearchRun()
    raw_results = search_tool.run(query)
    urls: List[str] = []

    for line in (raw_results.split("\n") if isinstance(raw_results, str) else []):
        if "http://" in line or "https://" in line:
            urls.append(line.strip())
        if len(urls) >= max_sources:
            break

    summaries = []
    for url in urls:
        try:
            resp = requests.get(url, timeout=5)
            text = re.sub(r"\s+", " ", resp.text)[:600]
            summaries.append((url, text))
        except Exception:
            summaries.append((url, "(Failed to fetch snippet.)"))

    if not summaries:
        return f"No research results found for '{query}'."

    report = [f"Deep Research Results for '{query}':"]
    for i, (u, snip) in enumerate(summaries, start=1):
        report.append(f"{i}. {u}\n{snip}\n")
    return "\n".join(report)


@genai.tool
def execute_shell_command(command: str) -> str:
    """
    Execute a whitelisted shell command (no chaining, dangerous ops blocked).
    """
    if not command or not isinstance(command, str):
        return "Error: 'command' must be a non-empty string."

    if any(tok in command for tok in [";", "&&", "||", "\n"]):
        return "Error: Command chaining is not allowed."

    dangerous_re = re.compile(
        r"\b(sudo|rm\s+-rf|mkfs|dd\b|shutdown|reboot|passwd|chown|chmod|chattr|systemctl|init|telinit|halt)\b",
        re.IGNORECASE,
    )
    if dangerous_re.search(command):
        return "Error: Command contains forbidden operations."

    allowed = {"ls", "echo", "cat", "pwd", "git", "whoami"}

    try:
        tokens = shlex.split(command)
    except Exception:
        return "Error: Unable to parse command."

    if tokens[0] not in allowed:
        return f"Error: Command '{tokens[0]}' is not in the allowed list."

    try:
        result = subprocess.run(tokens, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            return result.stdout or "Command executed successfully with no output."
        return f"Command failed ({result.returncode}):\n{result.stderr}"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out."
    except Exception as exc:  # noqa: BLE001
        return f"Error: {exc}"


# -----------------------------------------------------------------------------
# Communication helpers (placeholders for real integrations)
# -----------------------------------------------------------------------------

@genai.tool
def compose_email(to: str, subject: str, body: str) -> str:
    return f"Drafted an email to {to} with subject '{subject}'."


@genai.tool
def take_note(content: str, title: Optional[str] = None) -> str:
    title = title or datetime.utcnow().strftime("note_%Y%m%d_%H%M%S.txt")
    path = os.path.join("notes", title)
    return manage_file_system("write", path, content)


@genai.tool
def make_call(phone_number: str) -> str:
    return f"Connecting you to {phone_number}..."


@genai.tool
def answer_incoming_call() -> str:
    return "Call answered. You are now live."


@genai.tool
def manage_active_call(action: str, call_sid: str, target_number: Optional[str] = None) -> str:
    return f"Performing '{action}' on call {call_sid}."


@genai.tool
def send_sms(to_number: str, message_body: str) -> str:
    return f"SMS sent to {to_number}."


@genai.tool
def check_call_log() -> str:
    return "Recent calls: [Log entries here]."


@genai.tool
def get_caller_info(call_sid: str) -> str:
    return f"Caller info for {call_sid}: [Details]."


@genai.tool
def summarize_conversation() -> str:
    return "Conversation summary: [Not implemented]."


# -----------------------------------------------------------------------------
# Basic utility tools
# -----------------------------------------------------------------------------

@genai.tool
def search_web(query: str) -> str:
    tool = DuckDuckGoSearchRun()
    results = tool.run(query)
    return results[:1500] if isinstance(results, str) else str(results)


@genai.tool
def get_weather(location: str) -> str:
    try:
        text = requests.get(f"https://wttr.in/{location}?format=3", timeout=10).text.strip()
        return text
    except Exception as exc:  # noqa: BLE001
        return f"Error fetching weather: {exc}"


@genai.tool
def get_current_time(timezone: str = "local") -> str:
    try:
        if timezone.lower() == "local":
            now = datetime.now()
        else:
            tz = pytz.timezone(timezone)
            now = datetime.now(tz)
        return now.strftime("%A, %B %d, %Y at %I:%M %p %Z")
    except Exception:
        return f"Error: Unknown timezone '{timezone}'."


@genai.tool
def calculate(expression: str) -> str:
    import ast
    import operator as op

    allowed_ops = {ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv, ast.Pow: op.pow}

    def _eval(node):  # noqa: ANN001
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_ops:
            return allowed_ops[type(node.op)](_eval(node.left), _eval(node.right))
        raise ValueError("Unsupported operation")

    try:
        result = _eval(ast.parse(expression, mode="eval").body)
        return f"{expression} = {result}"
    except Exception as exc:  # noqa: BLE001
        return f"Error: {exc}"


@genai.tool
def translate_text(text: str, target_language: str) -> str:
    return f"'{text}' translated to {target_language}: [translation pending]"


@genai.tool
def set_reminder(task: str, time: str) -> str:
    return f"Reminder set: '{task}' at {time}'."
