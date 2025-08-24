"""Gradio MCP runner component.

Exposes `create_mcp_component()` which returns a Gradio Blocks UI allowing
manual invocation of MCP modules. Callables that are coroutines are awaited
using `asyncio.run` so calling from Gradio returns canonical dict results.
"""
import importlib
import asyncio
import gradio as gr

MCP_MODULES = [
    'agentlee_mcp_hub.mcp.email_api',
    'agentlee_mcp_hub.mcp.google_maps_api',
    'agentlee_mcp_hub.mcp.memory',
    'agentlee_mcp_hub.mcp.memory_api',
    'agentlee_mcp_hub.mcp.notion_api',
    'agentlee_mcp_hub.mcp.video_api',
    'agentlee_mcp_hub.mcp.webhook_api',
]


def _call_entrypoint(m, input_text: str):
    try:
        if hasattr(m, 'handle'):
            fn = m.handle
        elif hasattr(m, 'main'):
            fn = m.main
        else:
            return {'ok': False, 'error': 'No callable entrypoint found'}

        if asyncio.iscoroutinefunction(fn):
            return asyncio.run(fn(input_text))
        res = fn(input_text)
        if asyncio.iscoroutine(res):
            return asyncio.run(res)
        return res
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def call_mcp(module_name: str, input_text: str):
    try:
        m = importlib.import_module(module_name)
        return _call_entrypoint(m, input_text)
    except Exception as e:
        return {'ok': False, 'error': str(e)}


def create_mcp_component() -> gr.Blocks:
    with gr.Blocks() as demo:
        gr.Markdown('# MCP Runner')
        sel = gr.Radio(choices=MCP_MODULES, value=MCP_MODULES[0], label='MCP')
        inp = gr.Textbox(label='Input')
        out = gr.JSON()
        btn = gr.Button('Call MCP')
        btn.click(fn=call_mcp, inputs=[sel, inp], outputs=out)
    return demo


if __name__ == '__main__':
    create_mcp_component().launch(server_name='0.0.0.0', share=False)
