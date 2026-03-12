#!/usr/bin/env node
// Node.js fallback client: posts to /api/chat, then requests /api/chat/tts and
// plays via ffplay if available, otherwise opens the saved file.

const fs = require("fs");
const { spawnSync, spawn } = require("child_process");
const fetch = global.fetch || require("node-fetch");
const path = require("path");

const API_BASE = process.env.AGENTLEE_API || "http://127.0.0.1:8001/api/chat";
const CHAT = API_BASE.replace(/\/$/, "");
const TTS = CHAT + "/tts";

async function chat(text) {
  const res = await fetch(CHAT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Chat failed ${res.status}`);
  return res.json();
}

async function ttsSave(text) {
  const res = await fetch(TTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join(process.cwd(), `agentlee_tts_${Date.now()}.mp3`);
  fs.writeFileSync(out, buf);
  return out;
}

function playFile(file) {
  const ffplay = spawnSync(
    "ffplay",
    ["-nodisp", "-autoexit", "-loglevel", "error", file],
    { stdio: "inherit" },
  );
  if (ffplay.error) {
    if (process.platform === "win32") {
      spawn("powershell", ["-Command", "Start-Process", "-FilePath", file], {
        detached: true,
      });
    } else {
      const opener = spawnSync("xdg-open", [file]);
    }
  }
}

async function main() {
  const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  for await (const line of readline) {
    const text = line.trim();
    if (!text) continue;
    if (text === "quit" || text === "exit") break;
    try {
      const data = await chat(text);
      const reply = data?.text || data?.reply || "";
      console.log("Agent Lee:", reply);
      const file = await ttsSave(reply);
      playFile(file);
    } catch (err) {
      console.error("Error:", err.message || err);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
