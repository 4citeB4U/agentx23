// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/vision-agent-mcp/lib/glm-vision.ts
// Purpose: GLM-4.6V-Flash API helper with Qwen local fallback
// =============================================================================
import { env } from "../../shared/env.js";

const GLM_VISION_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const GLM_VISION_MODEL = "glm-4v-flash";

async function callQwenVisionLocal(
  prompt: string,
  imageBase64: string,
): Promise<string> {
  // Qwen3-VL-2B served locally via Ollama or LM Studio on port 11434
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen3-vl:2b",
      prompt,
      images: [imageBase64],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Qwen local vision failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

export async function callGlmVision(
  prompt: string,
  imageBase64: string,
  imageBase64_2?: string,
): Promise<string> {
  const apiKey = env("ZAI_API_KEY", "");

  const imageContent: unknown[] = [
    {
      type: "image_url",
      image_url: { url: `data:image/png;base64,${imageBase64}` },
    },
  ];
  if (imageBase64_2) {
    imageContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${imageBase64_2}` },
    });
  }
  imageContent.push({ type: "text", text: prompt });

  if (!apiKey) {
    console.warn(
      "[VisionAgent] No ZAI_API_KEY — falling back to Qwen local vision",
    );
    return callQwenVisionLocal(prompt, imageBase64);
  }

  try {
    const res = await fetch(GLM_VISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GLM_VISION_MODEL,
        messages: [{ role: "user", content: imageContent }],
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      console.warn(
        `[VisionAgent] GLM vision failed (${res.status}), trying Qwen local`,
      );
      return callQwenVisionLocal(prompt, imageBase64);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[VisionAgent] GLM vision error:", err);
    return callQwenVisionLocal(prompt, imageBase64);
  }
}
