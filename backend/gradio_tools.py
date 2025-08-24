"""Gradio components for the canonical `backend.tool_suite` functions.

This module exposes `create_tools_component()` which returns a `gr.Blocks`
component suitable for embedding in a larger Gradio app or launching on its
own. The functions return canonical structured dict results from
`backend.tool_suite` (no compatibility string coercion).
"""
from typing import Optional
import asyncio
import gradio as gr

from backend import tool_suite


async def _maybe_await(fn, *args, **kwargs):
    if asyncio.iscoroutinefunction(fn):
        return await fn(*args, **kwargs)
    else:
        return fn(*args, **kwargs)


def _run_async(fn, *args, **kwargs):
    """Run an async function or coroutine safely and return its result."""
    if asyncio.iscoroutinefunction(fn):
        return asyncio.run(fn(*args, **kwargs))
    res = fn(*args, **kwargs)
    # If function returned a coroutine by mistake, run it
    if asyncio.iscoroutine(res):
        return asyncio.run(res)
    return res


def fs_action(action: str, path: str, content: str, token: str):
    return _run_async(tool_suite.manage_file_system, action=action, path=path or '.', content=content or None, confirmation_token=token or None)


def shell_run(command: str):
    return _run_async(tool_suite.execute_shell_command, command)


def deep_research(query: str, max_sources: int = 5):
    return _run_async(tool_suite.conduct_deep_research, query, max_sources)


def create_tools_component() -> gr.Blocks:
    """Return a Gradio Blocks component exposing the tool suite.

    The outputs return the canonical dicts from `backend.tool_suite` and are
    presented using `gr.JSON` for convenient debugging and embedding.
    """
    with gr.Blocks() as demo:
        gr.Markdown("# Tool Suite")
        with gr.Tab("Filesystem"):
            action = gr.Dropdown(['read', 'write', 'list', 'delete'], value='list', label='Action')
            path = gr.Textbox(value='.', label='Path')
            content = gr.Textbox(lines=6, placeholder='File content (for write)')
            token = gr.Textbox(visible=False)
            out = gr.JSON()
            btn = gr.Button('Run')
            btn.click(fn=fs_action, inputs=[action, path, content, token], outputs=out)

        with gr.Tab("Shell"):
            cmd = gr.Textbox(label='Command')
            sout = gr.JSON()
            run = gr.Button('Run')
            run.click(fn=shell_run, inputs=cmd, outputs=sout)

        with gr.Tab("Research"):
            q = gr.Textbox(label='Query')
            k = gr.Slider(minimum=1, maximum=20, step=1, value=5, label='Max sources')
            res = gr.JSON()
            go = gr.Button('Search')
            go.click(fn=deep_research, inputs=[q, k], outputs=res)

    return demo


if __name__ == '__main__':
    create_tools_component().launch(server_name='0.0.0.0', share=False)
