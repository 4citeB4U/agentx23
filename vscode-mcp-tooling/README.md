<!-- LEEWAY HEADER BLOCK -->
<!-- File: vscode-mcp-tooling/README.md -->
<!-- Purpose: Agent Lee OS MCP tooling documentation -->
<!-- Security: LEEWAY-CORE-2026 compliant -->
<!-- Performance: Optimized for sovereign agentic MCP tooling -->
<!-- Discovery: Part of Agent Lee OS compliance pipeline -->
<!--
LEEWAY HEADER BLOCK
File: vscode-mcp-tooling/README.md
Purpose: MCP Tooling documentation for Agent Lee OS
Security: LEEWAY-CORE-2026 compliant
Performance: Sovereign MCP integration
Discovery: Part of Agent Lee OS documentation
-->

# VS Code MCP Tooling

VS Code MCP Tooling (C:\Tools\vscode-mcp-tooling)

Keys:

- stored in: C:\Tools\.env.local
- loaded at runtime by: src/dotenv.js

Run:
cd C:\Tools\vscode-mcp-tooling
node src/tool.js testsprite
node src/tool.js playwright
node src/tool.js insforge
node src/tool.js stitch

Optional local HTTP bridge:
node src/bridge.js
POST <http://127.0.0.1:3737/run/testsprite>
