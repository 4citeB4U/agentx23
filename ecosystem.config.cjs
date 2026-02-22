module.exports = {
    apps: [
        {
            name: "AgentLee-Brain",
            script: "python",
            args: "server.py",
            cwd: "./",
            env: {
                NEURAL_ROUTER_PORT: 8004
            }
        },
        {
            name: "AgentLee-Backend",
            script: "node",
            args: "dist/index.js",
            cwd: "./backend",
            env: {
                NODE_ENV: "development",
                PORT: 8001,
                WS_PORT: 8003,
                MCP_BRIDGE_PORT: 8002,
                NEURAL_ROUTER_PORT: 8004,
                DESKTOP_AGENT_PORT: 8005,
                FRONTEND_PORT: 8000
            }
        },
        {
            name: "AgentLee-Frontend",
            script: "cmd",
            args: "/c node node_modules/vite/bin/vite.js",
            cwd: "./.Agent_Lee_OS",
            autorestart: true,
            watch: false,
            env: {
                VITE_PORT: 8001,
                VITE_BACKEND_PORT: 8001,
                // Allow the web UI to access handshake-protected routes (chat, LIVE, FS) when started via Run-All.ps1.
                // NOTE: This intentionally exposes the handshake to the browser; treat it as a bootstrap key.
                VITE_NEURAL_HANDSHAKE: process.env.VITE_NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || process.env.NEURAL_HANDSHAKE || ""
            }
        },
        {
            name: "AgentLee-Bridge",
            script: "node",
            args: "src/bridge.js",
            cwd: "./vscode-mcp-tooling",
            env: {
                MCP_BRIDGE_PORT: 8002
            }
        },
        {
            name: "AgentLee-Hands",
            script: "python",
            args: "scripts/vision_agent.py",
            cwd: "./",
            autorestart: true,
            max_restarts: 3,
            env: {
                DESKTOP_AGENT_PORT: 8005
            }
        },
        {
            name: "AgentLee-Caffeine",
            script: "python",
            args: "scripts/caffeine.py",
            cwd: "./"
        },
        {
            name: "AgentLee-Tunnel",
            script: "C:\\Tools\\cloudflared.exe",
            args: "tunnel run agent-lee",
            cwd: "C:\\Tools",
            autorestart: true,
            restart_delay: 5000
        },
        {
            name: "AgentLee-PhoneBridge",
            script: "node",
            args: "dist/index.js",
            cwd: "./phone-bridge",
            env: {
                PORT: 8008
            },
            autorestart: false
        },
        {
            name: "AgentLee-InsForgeBridge",
            script: "node",
            args: "scripts/insforge_stub.js",
            cwd: "./",
            env: {
                INSFORGE_STUB_PORT: 7130
            }
        },
        {
            name: "AgentLee-PocketTTS",
            script: ".venv/Scripts/python.exe",
            args: "scripts/pocket_tts_server.py",
            cwd: "./",
            env: {
                POCKET_TTS_PORT: 8007
            },
            autorestart: true,
            max_restarts: 3,
            restart_delay: 5000
        }
    ]
};
