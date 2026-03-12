// LEEWAY v12 HEADER
// File: ecosystem.config.cjs
// Purpose: Pi-Appliance Governor & Port Discipline
// All Node.js services use --max-old-space-size=384 for RAM discipline.
// Boot stages: A=Foundation, B=Core, C=Optional
// Core services: max_restarts=10, exp_backoff. Optional: max_restarts=3.
module.exports = {
  apps: [
    // ─── STAGE B: CORE SERVICES ───────────────────────────────────────────
    {
      name: "AgentLee-Backend",
      script: "node",
      args: "--max-old-space-size=384 dist/index.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/backend",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 7001,
        WS_PORT: 7003,
        NEURAL_ROUTER_PORT: 7004,
        NEURAL_HANDSHAKE:
          process.env.NEURAL_HANDSHAKE ||
          process.env.NEURAL_HANDSHAKE_KEY ||
          "AGENT_LEE_SOVEREIGN_V1",
        VM_HOST: "localhost",
        VM_PORT: 2222,
        VM_USER: "agentlee",
        VM_PASSWORD: "agentlee2026",
        DESKTOP_AGENT_PORT: 7005,
      },
    },
    {
      name: "AgentLee-Brain",
      script:
        "C:/Users/Agent Lee/AppData/Local/Programs/Python/Python312/python.exe",
      args: "server.py",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit",
      interpreter: "none",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      env: {
        NEURAL_ROUTER_PORT: 7004,
        LLAMA_CPP_BASE_URL_05:
          process.env.LLAMA_CPP_BASE_URL_05 || "http://127.0.0.1:8082",
        LLAMA_CPP_BASE_URL_15:
          process.env.LLAMA_CPP_BASE_URL_15 || "http://127.0.0.1:8080",
        LLAMA_CPP_BASE_URL_3B:
          process.env.LLAMA_CPP_BASE_URL_3B || "http://127.0.0.1:8081",
        OLLAMA_URL:
          process.env.OLLAMA_URL || "http://localhost:11434/api/generate",
        NEURAL_HANDSHAKE:
          process.env.NEURAL_HANDSHAKE ||
          process.env.NEURAL_HANDSHAKE_KEY ||
          "AGENT_LEE_SOVEREIGN_V1",
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
        TELEGRAM_BOT_TOKEN_2: process.env.TELEGRAM_BOT_TOKEN_2 || "",
        TELEGRAM_USER_ID: process.env.TELEGRAM_USER_ID || "",
        CANONICAL_MEMORY_BASE_URL: process.env.CANONICAL_MEMORY_BASE_URL || "",
        CANONICAL_MEMORY_API_KEY: process.env.CANONICAL_MEMORY_API_KEY || "",
      },
    },
    {
      name: "AgentLee-Tunnel",
      script: "C:\\Tools\\cloudflared.exe",
      args: "tunnel run agent-lee",
      cwd: "C:\\Tools",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
    },

    // ─── STAGE C: OPTIONAL SERVICES ───────────────────────────────────────
    {
      name: "AgentLee-Frontend",
      script: "node",
      args: "node_modules/vite/bin/vite.js --port 7000 --strictPort --host 0.0.0.0",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/.Agent_Lee_OS",
      autorestart: true,
      max_restarts: 3,
      restart_delay: 5000,
      kill_timeout: 5000,
      watch: false,
      env: {
        NODE_ENV: "development",
        VITE_PORT: 7000,
        VITE_BACKEND_PORT: 7001,
        VITE_NEURAL_HANDSHAKE:
          process.env.VITE_NEURAL_HANDSHAKE ||
          process.env.NEURAL_HANDSHAKE_KEY ||
          process.env.NEURAL_HANDSHAKE ||
          "AGENT_LEE_SOVEREIGN_V1",
      },
    },
    {
      name: "AgentLee-Hands",
      script: "C:/Tools/Portable-VSCode-MCP-Kit/.venv/Scripts/python.exe",
      args: "scripts/vision_agent.py",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit",
      interpreter: "none",
      autorestart: true,
      max_restarts: 3,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        DESKTOP_AGENT_PORT: 7005,
      },
    },
    {
      name: "AgentLee-Bridge",
      script: "node",
      args: "--max-old-space-size=384 src/bridge.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/vscode-mcp-tooling",
      autorestart: true,
      max_restarts: 3,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        MCP_BRIDGE_PORT: 7002,
      },
    },
    {
      name: "AgentLee-InsForgeBridge",
      script: "node",
      args: "--max-old-space-size=384 scripts/insforge_stub.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit",
      autorestart: true,
      max_restarts: 3,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        INSFORGE_STUB_PORT: 7007,
      },
    },

    // ─── STAGE C: MCP AGENTS ──────────────────────────────────────────────
    {
      name: "AgentLee-DashboardMCP",
      script: "node",
      args: "--max-old-space-size=128 index.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/services/dashboard-mcp",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        DASHBOARD_MCP_PORT: 7008,
        BACKEND_PORT: 7001,
        NEURAL_HANDSHAKE:
          process.env.NEURAL_HANDSHAKE ||
          process.env.NEURAL_HANDSHAKE_KEY ||
          "AGENT_LEE_SOVEREIGN_V1",
      },
    },
    {
      name: "AgentLee-BrowserMCP",
      script: "node",
      args: "--max-old-space-size=256 index.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/services/browser-mcp",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      kill_timeout: 5000,
      env: {
        BROWSER_MCP_PORT: 7009,
        BACKEND_PORT: 7001,
        NEURAL_HANDSHAKE:
          process.env.NEURAL_HANDSHAKE ||
          process.env.NEURAL_HANDSHAKE_KEY ||
          "AGENT_LEE_SOVEREIGN_V1",
      },
    },

    // ─── ONE-SHOT / KEEP-ALIVE HELPERS ────────────────────────────────────
    {
      name: "AgentLee-Caffeine",
      script: "C:/Tools/Portable-VSCode-MCP-Kit/.venv/Scripts/python.exe",
      args: "scripts/caffeine.py",
      interpreter: "none",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit",
      autorestart: false,
    },
    {
      name: "AgentLee-PhoneBridge",
      script: "node",
      args: "--max-old-space-size=384 dist/index.js",
      cwd: "C:/Tools/Portable-VSCode-MCP-Kit/phone-bridge",
      autorestart: false,
      env: {
        PORT: 7006,
      },
    },
  ],
};
