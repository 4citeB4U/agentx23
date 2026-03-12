// LEEWAY v12 HEADER
// File: backend/src/routes/chat.ts
// Purpose: Chat router, Telegram relay, and sovereign TTS proxy with ConcurrencyGuard.
// Security: Sovereign handshake enforced; TTS voice locked in server.py (not client-overrideable).
// Performance: TTS slot capped via ConcurrencyGuard; 429 returned when at capacity.
// Discovery: ROLE=internal; INTENT=chat-tts-relay; REGION=💬 COMM

import { Router } from "express";
import { concurrencyGuard } from "../services/ConcurrencyGuard.js";
import { messageRouter } from "../services/router.js";

export const chatRouter = Router();

const NEURAL_ROUTER_PORT = Number(process.env.NEURAL_ROUTER_PORT || 7004);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const TTS_WAIT_TIMEOUT_MS = Number(process.env.TTS_WAIT_TIMEOUT_MS || 6000);

let telegramOffset = Number(process.env.TELEGRAM_INITIAL_OFFSET || "0");

const getTelegramConfig = () => {
  const token =
    process.env.TELEGRAM_BOT_TOKEN_2 || process.env.TELEGRAM_BOT_TOKEN;
  const userId = process.env.TELEGRAM_USER_ID;
  return { token, userId };
};

const sendTelegramMessage = async (text: string) => {
  const { token, userId } = getTelegramConfig();
  if (!token || !userId) {
    return { enabled: false };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: userId,
        text,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TELEGRAM_SEND_FAILED: ${body}`);
  }

  return { enabled: true };
};

/**
 * Synthesize speech via Neural Router TTS then send as a Telegram voice note.
 */
const sendTelegramVoice = async (text: string) => {
  const { token, userId } = getTelegramConfig();
  if (!token || !userId) return;

  try {
    const ttsRes = await fetch(`http://localhost:${NEURAL_ROUTER_PORT}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 400) }),
    });

    if (!ttsRes.ok) {
      console.warn(
        "[telegram-voice] TTS responded",
        ttsRes.status,
        "— skipping voice note",
      );
      return;
    }

    const audioBuffer = await ttsRes.arrayBuffer();

    // Build a multipart form and send to Telegram as a voice note
    const form = new FormData();
    form.append("chat_id", userId);
    // Telegram accepts OGG/Opus or MP3; send whatever the TTS returns (server.py returns MP3)
    form.append(
      "voice",
      new Blob([audioBuffer], { type: "audio/mpeg" }),
      "voice.mp3",
    );

    const voiceRes = await fetch(
      `https://api.telegram.org/bot${token}/sendVoice`,
      {
        method: "POST",
        body: form,
      },
    );

    if (!voiceRes.ok) {
      const body = await voiceRes.text();
      console.warn("[telegram-voice] sendVoice failed:", body);
    } else {
      console.log("[telegram-voice] 🎤 Voice note delivered to Telegram");
    }
  } catch (err: any) {
    console.warn("[telegram-voice] Error:", err?.message || err);
  }
};

const syncTelegramInbox = async () => {
  const { token, userId } = getTelegramConfig();
  if (!token || !userId) {
    return { enabled: false, processed: 0 };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset: telegramOffset + 1,
        limit: 25,
        timeout: 0,
        allowed_updates: ["message"],
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TELEGRAM_SYNC_FAILED: ${body}`);
  }

  const data = await response.json();
  const updates = Array.isArray(data?.result) ? data.result : [];

  let processed = 0;
  for (const update of updates) {
    const updateId = Number(update?.update_id);
    if (!Number.isNaN(updateId)) {
      telegramOffset = Math.max(telegramOffset, updateId);
    }

    const message = update?.message;
    const text = typeof message?.text === "string" ? message.text.trim() : "";
    const chatId = String(message?.chat?.id ?? "");

    if (!text || !chatId || chatId !== String(userId)) {
      continue;
    }

    const routed = await messageRouter.routeMessage({
      text,
      source: "telegram",
      id: `telegram-${updateId}`,
    });

    if (routed) {
      processed += 1;
      // Push incoming Telegram user message to all WS-connected UI clients
      messageRouter.broadcast({
        source: "telegram",
        role: "user",
        text,
        id: `telegram-${updateId}`,
      });
      // AI response is auto-broadcast by routeMessage → dispatchResponse
      // Send text + voice note back to Telegram
      await sendTelegramMessage(routed.text);
      sendTelegramVoice(routed.text).catch(() => {});
    }
  }

  return { enabled: true, processed };
};

chatRouter.get("/history", async (req, res) => {
  try {
    const since = Number(req.query.since || 0);
    const source =
      typeof req.query.source === "string" ? req.query.source : undefined;

    const messages = messageRouter.getHistory({
      since: Number.isNaN(since) ? undefined : since,
      source:
        source === "web" ||
        source === "voice" ||
        source === "telegram" ||
        source === "system"
          ? source
          : undefined,
    });

    res.json({ messages });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Clear all chat history and start fresh. */
chatRouter.post("/clear", async (_req, res) => {
  try {
    await messageRouter.clearHistory();
    res.json({ ok: true, message: "Chat history cleared." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

chatRouter.post("/telegram/sync", async (_req, res) => {
  try {
    const result = await syncTelegramInbox();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message to the OS
chatRouter.post("/", async (req, res) => {
  try {
    const { text, message, source, id } = req.body;
    const msgText = (text || message || "").trim();

    if (!msgText) {
      return res.status(400).json({ error: "Missing message text" });
    }

    // 🔥 INSTANT Telegram relay — fire before AI processing so user sees it immediately
    if ((source || "web") !== "telegram") {
      sendTelegramMessage(
        `📨 ${source === "voice" ? "🎤 Voice" : "💬 User"}: ${msgText}`,
      ).catch((err: any) => {
        console.error("[telegram] Instant relay error:", err?.message || err);
      });
    }

    const response = await messageRouter.routeMessage({
      text: msgText,
      source: source || "web",
      id: id || undefined,
    });

    if (!response) {
      return res.status(202).json({ status: "ignored", reason: "duplicate" });
    }

    // Parse BUILD_PLAN markers injected by consciousness
    let responseText = response.text;
    let planSteps: string[] | undefined;
    const planMatch = responseText.match(/BUILD_PLAN::([\s\S]+?)::END_PLAN\n?/);
    if (planMatch) {
      planSteps = planMatch[1]
        .split("|")
        .map((s: string) => s.trim())
        .filter(Boolean);
      responseText = responseText
        .replace(/BUILD_PLAN::([\s\S]+?)::END_PLAN\n?/, "")
        .trim();
    }

    // Send Agent Lee's response to Telegram after AI finishes
    if ((source || "web") !== "telegram") {
      sendTelegramMessage(`🤖 Agent Lee: ${responseText}`).catch(
        (telegramError: any) => {
          console.error(
            "[telegram] Outbound relay error:",
            telegramError?.message || telegramError,
          );
        },
      );
    }

    res.json({
      ...response,
      text: responseText,
      ...(planSteps ? { plan: planSteps } : {}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * SOVEREIGN VOICE BRIDGE (Proxy to Neural Router TTS)
 */
chatRouter.all("/tts", async (req, res) => {
  try {
    const text = req.body.text || req.query.text;
    const mode = String(req.body.mode || req.query.mode || "live");
    // NOTE: `voice` from the client is intentionally IGNORED.
    // The sovereign voice (marius/motivational_architect) is locked in server.py.
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const ttsAcquireStartedAt = Date.now();
    let ttsSlot = concurrencyGuard.acquire("tts");
    while (
      !ttsSlot.allowed &&
      Date.now() - ttsAcquireStartedAt < TTS_WAIT_TIMEOUT_MS
    ) {
      await sleep(ttsSlot.retryAfterMs ?? 120);
      ttsSlot = concurrencyGuard.acquire("tts");
    }
    if (!ttsSlot.allowed)
      return res
        .status(429)
        .json({ error: "TTS is saturated right now — retry shortly" });

    try {
      const response = await fetch(
        `http://localhost:${NEURAL_ROUTER_PORT}/tts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            mode,
            // No `voice` field — let server.py enforce the sovereign lock
            handshake: process.env.NEURAL_HANDSHAKE,
          }),
        },
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

      // Forward the actual content-type from brain (WAV or MP3)
      const contentType = response.headers.get("content-type") || "audio/wav";
      res.setHeader("Content-Type", contentType);
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } finally {
      concurrencyGuard.release("tts");
    }
  } catch (error: any) {
    console.error("[voice] TTS Bridge Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Auto-poll Telegram inbox every POLL_INTERVAL ms and push new messages to
 * WebSocket-connected UI clients via messageRouter.broadcast().
 */
const TELEGRAM_POLL_INTERVAL = Number(
  process.env.TELEGRAM_POLL_INTERVAL || 3500,
);

export function startTelegramPolling() {
  const { token, userId } = getTelegramConfig();
  if (!token || !userId) {
    console.log(
      "[telegram-poll] Bot token or user ID not configured — polling disabled",
    );
    return;
  }
  console.log(
    `[telegram-poll] 📡 Polling Telegram every ${TELEGRAM_POLL_INTERVAL}ms`,
  );
  setInterval(async () => {
    try {
      await syncTelegramInbox();
    } catch (err: any) {
      // Log but don't crash — network blips should not stop the loop
      console.warn("[telegram-poll] Sync error:", err?.message || err);
    }
  }, TELEGRAM_POLL_INTERVAL);
}
