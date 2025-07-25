// Register service worker for GitHub Pages subdirectory
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/agentx23/service-worker.js')
      .then(reg => {
        console.log('✅ Service Worker registered with scope:', reg.scope);
      })
      .catch(err => {
        console.error('❌ Service Worker registration failed:', err);
      });
  });
}

window.AgentLeeCore = {
  userToken: null,
  // Use production backend URL if available, fallback to localhost for local dev
  backendURL: window.AGENT_LEE_BACKEND_URL || "https://your-backend.fly.dev", // <-- set your Fly.io backend URL here

  async authenticateUser(name, email) {
    const res = await fetch(`${this.backendURL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email })
    });
    const data = await res.json();
    if (data.token) {
      this.userToken = data.token;
      localStorage.setItem("agentToken", data.token);
      return true;
    } else {
      console.error("Login failed", data);
      return false;
    }
  },

  async dispatchMCPTool(tool, payload) {
    const res = await fetch(`${this.backendURL}/api/mcp/dispatch`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.userToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tool, payload })
    });
    return await res.json();
  },

  async saveMemory(message, response) {
    await fetch(`${this.backendURL}/api/memory/save`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.userToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ speaker: "user", text: message, response })
    });
  }
};

async function downloadAudit() {
  const res = await fetch(`${window.AgentLeeCore.backendURL}/api/audit/summary`, {
    headers: { Authorization: `Bearer ${window.AgentLeeCore.userToken}` }
  });
  const report = await res.json();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `audit-report-${Date.now()}.json`;
  a.click();
}
