// Simple Node E2E checker for Agent Lee services
// Usage: node scripts/agentlee-e2e.js

const urls = [
  { name: "Frontend", url: "http://127.0.0.1:6000" },
  { name: "Backend health", url: "http://127.0.0.1:6001/health" },
  { name: "Neural router health", url: "http://127.0.0.1:6004/health" },
  { name: "Model server (example)", url: "http://127.0.0.1:8082/v1/models" },
];

const HEADERS = {
  "x-neural-handshake": "AGENT_LEE_SOVEREIGN_V1",
  "Content-Type": "application/json",
};

async function checkUrls() {
  for (const u of urls) {
    try {
      const res = await fetch(u.url, { method: "GET" });
      console.log(`${u.name}: UP ${res.status} - ${u.url}`);
    } catch (err) {
      console.log(`${u.name}: DOWN - ${u.url} - ${err.message}`);
    }
  }
}

async function chatTest() {
  const url = "http://127.0.0.1:6001/api/chat";
  const body = { message: "Say exactly: I am Agent Lee." };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`CHAT ${res.status}: ${text.slice(0, 1000)}`);
  } catch (err) {
    console.log(`CHAT ERR: ${err.message}`);
  }
}

async function ttsTest() {
  // Try common TTS endpoints — adjust if your backend uses a different route
  const candidates = [
    "http://127.0.0.1:6001/api/chat/tts",
    "http://127.0.0.1:6001/api/tts",
    "http://127.0.0.1:6001/api/chat/speak",
  ];
  const body = { message: "Test TTS: Agent Lee speaking." };
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        console.log(`TTS OK from ${url} — ${buf.byteLength} bytes`);
        return;
      } else {
        console.log(`TTS ${url} responded ${res.status}`);
      }
    } catch (err) {
      console.log(`TTS ERR ${url}: ${err.message}`);
    }
  }
  console.log("TTS: no working endpoint found from candidates");
}

async function telegramSync() {
  const url = "http://127.0.0.1:6001/api/chat/telegram/sync";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    console.log(`TELEGRAM SYNC ${res.status}: ${text.slice(0, 500)}`);
  } catch (err) {
    console.log(`TELEGRAM SYNC ERR: ${err.message}`);
  }
}

(async () => {
  console.log("Starting Agent Lee quick E2E checks...");
  await checkUrls();
  await chatTest();
  await ttsTest();
  await telegramSync();
  console.log("E2E checks complete.");
})();
