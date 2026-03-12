// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/voice-agent-mcp/index.ts
// Project: Agent Lee OS — VoiceAgent MCP Server
// Purpose: TTS synthesis via Edge-TTS (local) + multilingual translate-and-speak
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// In-memory voice mode state and notification queue
const voiceState: Record<string, boolean> = {};
const notificationQueue: Array<{
  message: string;
  priority: string;
  ts: string;
}> = [];

// Language → Edge-TTS voice mapping (covers Agent Lee's multilingual lanes)
const LANGUAGE_VOICES: Record<string, string> = {
  en: "en-US-GuyNeural",
  "en-gb": "en-GB-RyanNeural",
  es: "es-ES-AlvaroNeural",
  fr: "fr-FR-HenriNeural",
  de: "de-DE-ConradNeural",
  pt: "pt-BR-AntonioNeural",
  it: "it-IT-DiegoNeural",
  ja: "ja-JP-KeitaNeural",
  ko: "ko-KR-InJoonNeural",
  zh: "zh-CN-YunxiNeural",
  ar: "ar-SA-HamedNeural",
  hi: "hi-IN-MadhurNeural",
  ru: "ru-RU-DmitryNeural",
  nl: "nl-NL-MaartenNeural",
  pl: "pl-PL-MarekNeural",
  tr: "tr-TR-AhmetNeural",
  sv: "sv-SE-MattiasNeural",
};

async function synthesizeEdgeTTS(
  text: string,
  voiceId: string,
  speed: number,
): Promise<string> {
  const outPath = join(tmpdir(), `lee_voice_${randomUUID()}.mp3`);
  // Edge-TTS CLI: pip install edge-tts
  const rate =
    speed >= 1
      ? `+${Math.round((speed - 1) * 100)}%`
      : `-${Math.round((1 - speed) * 100)}%`;
  await execAsync(
    `edge-tts --text "${text.replace(/"/g, "'")}" --voice "${voiceId}" --rate "${rate}" --write-media "${outPath}"`,
  );
  const buf = await readFile(outPath);
  await unlink(outPath).catch(() => {});
  return buf.toString("base64");
}

/** Use Gemini to translate text to target language */
async function translateWithGemini(
  text: string,
  targetLanguage: string,
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2 || "";
  if (!apiKey) return text; // no key — return original
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, no explanation:\n\n${text}`,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) return text;
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? text;
}

const TOOLS = [
  {
    name: "speak_response",
    description: "Convert text to speech using Edge-TTS.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        voice_id: {
          type: "string",
          description: "Edge-TTS voice ID (e.g. en-US-GuyNeural)",
        },
        speed: {
          type: "number",
          description: "Speech rate multiplier (default: 1.0)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "translate_and_speak",
    description:
      "Translate text to a target language using Gemini, then synthesize with the matching Edge-TTS voice.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Source text to translate and speak.",
        },
        target_language: {
          type: "string",
          description:
            "Target language code: es, fr, de, ja, ko, zh, ar, hi, pt, it, ru, nl...",
        },
        speed: {
          type: "number",
          description: "Speech rate multiplier (default: 1.0)",
        },
      },
      required: ["text", "target_language"],
    },
  },
  {
    name: "list_supported_languages",
    description:
      "List all languages Agent Lee can speak via translate_and_speak.",
    inputSchema: { type: "object" },
  },
  {
    name: "stream_voice_reply",
    description: "Stream a voice reply sentence-by-sentence.",
    inputSchema: { type: "object" },
  },
  {
    name: "set_voice_mode",
    description: "Enable or disable voice mode for this session.",
    inputSchema: { type: "object" },
  },
  {
    name: "queue_voice_notification",
    description: "Add a message to the voice notification queue.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "voice-agent-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;

  switch (req.params.name) {
    case "speak_response": {
      const text = String(args["text"] ?? "");
      const voiceId = String(args["voice_id"] ?? "en-US-GuyNeural");
      const speed = Number(args["speed"] ?? 1.0);
      try {
        const audio_base64 = await synthesizeEdgeTTS(text, voiceId, speed);
        result = { audio_base64, voice_id: voiceId, format: "mp3" };
      } catch (err) {
        console.warn("[VoiceAgent] Edge-TTS failed:", err);
        result = {
          audio_base64: null,
          error: "TTS unavailable",
          text_fallback: text,
        };
      }
      break;
    }
    case "translate_and_speak": {
      const text = String(args["text"] ?? "");
      const targetLang = String(args["target_language"] ?? "en").toLowerCase();
      const speed = Number(args["speed"] ?? 1.0);
      // Pick the matching voice, fallback to en-US-GuyNeural
      const voiceId = LANGUAGE_VOICES[targetLang] ?? "en-US-GuyNeural";
      try {
        const translated = await translateWithGemini(text, targetLang);
        const audio_base64 = await synthesizeEdgeTTS(
          translated,
          voiceId,
          speed,
        );
        result = {
          translated_text: translated,
          audio_base64,
          voice_id: voiceId,
          target_language: targetLang,
          format: "mp3",
        };
      } catch (err) {
        console.warn("[VoiceAgent] translate_and_speak failed:", err);
        result = {
          translated_text: text,
          audio_base64: null,
          error: "Translation or TTS unavailable",
          target_language: targetLang,
        };
      }
      break;
    }
    case "list_supported_languages": {
      result = {
        languages: Object.entries(LANGUAGE_VOICES).map(([code, voice]) => ({
          code,
          voice,
        })),
      };
      break;
    }
    case "stream_voice_reply": {
      // Sentence-split and return array of audio blobs (client streams them in order)
      const text = String(args["text"] ?? "");
      const voiceId = String(args["voice_id"] ?? "en-US-GuyNeural");
      const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
      const chunks: Array<{ text: string; audio_base64: string | null }> = [];
      for (const s of sentences) {
        try {
          const audio_base64 = await synthesizeEdgeTTS(s.trim(), voiceId, 1.0);
          chunks.push({ text: s.trim(), audio_base64 });
        } catch {
          chunks.push({ text: s.trim(), audio_base64: null });
        }
      }
      result = { chunks };
      break;
    }
    case "set_voice_mode": {
      const sessionId = String(args["session_id"] ?? "default");
      voiceState[sessionId] = Boolean(args["enabled"]);
      result = { session_id: sessionId, voice_mode: voiceState[sessionId] };
      break;
    }
    case "queue_voice_notification": {
      const entry = {
        message: String(args["message"] ?? ""),
        priority: String(args["priority"] ?? "normal"),
        ts: new Date().toISOString(),
      };
      notificationQueue.push(entry);
      result = { queued: true, queue_length: notificationQueue.length };
      break;
    }
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
