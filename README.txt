PORTABLE VS CODE MCP KIT (generated 20260213_191000)

Open this folder in VS Code:
  C:\Tools\Portable-VSCode-MCP-Kit\workspace

This workspace contains:
  .vscode\settings.json  (MCP server commands)

This kit expects:
  Tool runner at: C:\Tools\vscode-mcp-tooling
  Keys file at:  C:\Tools\.env.local

Quick verify:
  cd C:\Tools\vscode-mcp-tooling
  node -e "import {loadDotenv} from './src/dotenv.js'; const e=loadDotenv('C:\\Tools\\.env.local'); console.log('INSFORGE_API_KEY', e.INSFORGE_API_KEY?'set':'missing'); console.log('INSFORGE_TOKEN', e.INSFORGE_TOKEN?'set':'missing'); console.log('TESTSPRITE_API_KEY', e.TESTSPRITE_API_KEY?'set':'missing'); console.log('HF_TOKEN', e.HF_TOKEN?'set':'missing');"

Start servers (each in its own terminal):
  node src\tool.js testsprite
  node src\tool.js playwright
  node src\tool.js insforge
  node src\tool.js stitch

ONE COMMAND STACK (recommended):
  From C:\Tools\Portable-VSCode-MCP-Kit
    .\Run-All.ps1 restart
    .\Run-All.ps1 verify
    .\Run-All.ps1 stop

Notes:
  - Run-All.ps1 uses PM2 + ecosystem.config.cjs to start: Frontend (8000), Backend (8001), MCP Bridge (8002), Neural Router (8004), Desktop Agent (8005).
  - verify performs HTTP checks (not just ports) to confirm the stack is actually responding.
