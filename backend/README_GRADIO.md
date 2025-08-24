Gradio wrappers for tools and MCPs

- `gradio_tools.py`: Exposes `tool_suite` functions via a small Gradio UI.
- `gradio_mcp_runner.py`: Presents MCP modules as selectable radio options and calls a `handle` or `main` function if present.

Run:

```ps1
python -m pip install -r requirements.txt
python backend\gradio_tools.py
python backend\gradio_mcp_runner.py
```
