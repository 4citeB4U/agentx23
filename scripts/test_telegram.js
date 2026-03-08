/**
 * test_telegram.js — Verify Telegram instant-relay + agent reply pipeline
 * Run: node scripts/test_telegram.js
 *
 * Requires:
 *   .env.local -> TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID (chat_id)
 *   Backend running on 6001 with valid handshake
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Load .env.local
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(ROOT, ".env.local");
const env = {};
readFileSync(envPath, "utf8")
  .split("\n")
  .forEach((line) => {
    const m = line.match(/^([^#][^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });

const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN_2 || env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = env.TELEGRAM_USER_ID;
const BASE = "http://127.0.0.1:6001";
const HANDSHAKE = "AGENT_LEE_SOVEREIGN_V1";
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let passed = 0,
  failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

async function getLatestUpdates(limit = 10) {
  const r = await fetch(
    `${TG_API}/getUpdates?limit=${limit}&allowed_updates=["message"]`,
  );
  const d = await r.json();
  if (!d.ok) throw new Error(`Telegram API error: ${d.description}`);
  return d.result;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("─────────────────────────────────────");
  console.log("  AGENT LEE OS — Telegram Test Suite");
  console.log("─────────────────────────────────────\n");

  assert(BOT_TOKEN, "TELEGRAM_BOT_TOKEN not set in .env.local");
  assert(CHAT_ID, "TELEGRAM_USER_ID not set in .env.local");

  const TAG = `TEST-${Date.now()}`;

  // Snapshot of existing messages before we send
  const before = await getLatestUpdates(50);
  const beforeIds = new Set((before || []).map((u) => u.update_id));

  // ── 1. Send a tagged message to Agent Lee ─────────────────────────────────
  const sendTime = Date.now();
  let chatRes;

  await test("POST /api/chat sends without error", async () => {
    const r = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-neural-handshake": HANDSHAKE,
      },
      body: JSON.stringify({
        text: `Yo this is a test ping ${TAG}`,
        id: TAG,
        source: "web",
      }),
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    chatRes = await r.json();
    assert(chatRes.text, "No text in response");
  });

  const aiDoneTime = Date.now();
  const aiLatency = aiDoneTime - sendTime;
  console.log(`\n  ⏱  AI response latency: ${aiLatency}ms`);

  // ── 2. Poll Telegram for the user message (should have arrived fast) ────────
  console.log("\n  Polling Telegram for messages (30s window)...");

  let userMsgFound = false;
  let agentMsgFound = false;
  let userMsgTime = null;

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await sleep(2000);
    const updates = await getLatestUpdates(50).catch(() => []);
    const fresh = (updates || []).filter((u) => !beforeIds.has(u.update_id));

    for (const u of fresh) {
      const text = u.message?.text || "";
      if (
        text.includes(TAG) &&
        !userMsgFound &&
        (text.includes("User:") ||
          text.includes("Voice:") ||
          text.includes(TAG))
      ) {
        userMsgFound = true;
        userMsgTime = Date.now();
      }
      if (text.includes("Agent Lee:") && !agentMsgFound) {
        agentMsgFound = true;
      }
    }

    if (userMsgFound && agentMsgFound) break;
  }

  await test("User message appeared on Telegram", () => {
    assert(
      userMsgFound,
      `No Telegram message containing "${TAG}" found within 30s`,
    );
  });

  if (userMsgFound && userMsgTime) {
    const relayDelay = userMsgTime - sendTime;
    console.log(
      `  ⏱  User message relay delay: ${relayDelay}ms (target < 2000ms)`,
    );
    await test("User message arrived within 2 seconds of send", () => {
      assert(
        relayDelay < 2000,
        `Relay took ${relayDelay}ms — expected < 2000ms. Check fire-and-forget in chat.ts`,
      );
    });
  }

  await test("Agent reply appeared on Telegram", () => {
    assert(
      agentMsgFound,
      "Agent Lee reply message not found on Telegram within 30s",
    );
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n─────────────────────────────────────`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log(`─────────────────────────────────────`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
