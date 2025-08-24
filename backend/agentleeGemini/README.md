# Agent Lee – AI Homie with 50‑Layer Personality

This repository contains a minimal yet functional implementation of
**Agent Lee**, the AI homie described in the accompanying README and
GEMINI manifest.  The goal of this project is to demonstrate how
Gemini can orchestrate a suite of native Python tools to perform
productivity tasks, manage memory and interact with the world through
files, email and calls.

## Running the Server

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Create a `.env` file or export environment variables:
   - `GOOGLE_GEMINI_API_KEY` – your Google Gemini API key
   - `SECURE_WORKSPACE_PATH` – the directory for sandboxed file operations (default: `./agent_workspace`)
3. Run the API:
   ```bash
   python agent_lee_loader.py
   ```
4. POST to `/ai/chat` with a JSON body like:
   ```json
   {
     "messages": [
       {"role": "user", "content": "Hello, who are you?"}
     ]
   }
   ```
   The agent will respond using the Gemini model and may call native
   tools as needed.

## Project Structure

```
agentleeGemini/
├── agent_lee_loader.py      # Starts the FastAPI server and Gemini model
├── requirements.txt         # Python dependencies
├── README.md                # This file
└── agent_system/            # Core agent package
    ├── __init__.py          # Exposes tool functions and prompts
    ├── prompts.py           # 50‑layer personality and directives
    ├── database_interface.py# Simple memory database
    └── tool_suite.py        # Native tools with 5 Ws & H docstrings
```

## About Agent Lee

Agent Lee is a proactive, context‑aware AI assistant built on Google
Gemini.  It embodies a 50‑layer personality system spanning core
identity, environmental awareness, learning, execution and reasoning.
Each tool is documented with a **What, Why, When, How, Where, Who**
framework to help Gemini decide when and how to use it.  The agent
maintains a long‑term memory, respects a set of prime directives and
operates under strict security protocols.  Consult the `prompts.py`
and `GEMINI.MD` files for a full description of its identity and
operational doctrine.