// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/stitch-agent-mcp/lib/gemini.ts
// Purpose: Gemini 1.5 Flash helper for text + optional image input
// =============================================================================
import { env } from "../../shared/env.js";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export async function callGemini(
  prompt: string,
  imageBase64?: string,
): Promise<string> {
  const apiKey = env("GEMINI_API_KEY", "");
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const parts: unknown[] = imageBase64
    ? [
        { inlineData: { mimeType: "image/png", data: imageBase64 } },
        { text: prompt },
      ]
    : [{ text: prompt }];

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  if (!res.ok)
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
