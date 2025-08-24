"""
FastAPI backend exposing tool_suite functions as HTTP endpoints.

This simple server wraps each of the tools defined in tool_suite.py
inside JSON APIs so they can be called from the browser. It defines
three endpoints under `/api/tool` for the file system manager,
shell execution and deep research respectively. It also exposes a
capabilities endpoint at `/api/capabilities` to allow the frontend
to determine which features are available.

To run this app locally:

```
uvicorn app:app --reload --port 5175
```

Once running, you can test the endpoints via curl, e.g.:

```
curl -X POST http://localhost:5175/api/tool/fs \ 
  -H 'Content-Type: application/json' \
  -d '{"action":"list","path":"."}'
```
"""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from tool_suite import manage_file_system, execute_shell_command, conduct_deep_research

app = FastAPI()


class FSRequest(BaseModel):
    action: str
    path: str
    content: Optional[str] = None
    confirmation_token: Optional[str] = None


class ShellRequest(BaseModel):
    command: str


class ResearchRequest(BaseModel):
    query: str
    max_sources: int = 5


@app.get("/api/capabilities")
async def capabilities() -> dict:
    """Return a map of available backend capabilities."""
    return {
        "backend": True,
        "fs": True,
        "shell": True,
        "deep_research": True,
    }


@app.post("/api/tool/fs")
async def fs(req: FSRequest) -> dict:
    """Proxy file system operations to the tool_suite.manage_file_system."""
    return manage_file_system(
        action=req.action,
        path=req.path,
        content=req.content,
        confirmation_token=req.confirmation_token,
    )


@app.post("/api/tool/shell")
async def shell(req: ShellRequest) -> dict:
    """Execute a shell command via tool_suite.execute_shell_command."""
    return await execute_shell_command(req.command)


@app.post("/api/tool/deep_research")
async def deep(req: ResearchRequest) -> dict:
    """Conduct deep research via tool_suite.conduct_deep_research."""
    return await conduct_deep_research(req.query, max_sources=req.max_sources)