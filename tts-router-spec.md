# TTS Router Specification — Agent Lee OS

LEEWAY-CORE-2026 | Updated: 2026-03-07

## Overview

The TTS Router routes text synthesis requests to the correct engine (Edge TTS
or Gemini TTS) based on a `mode` parameter. This spec defines the routing
contract, mode sets, request schema, response contract, and failure behaviour
for the router in both the Python brain (`server.py`) and the TypeScript
backend (`ttsEnforcer.ts`).

---

## Mode Sets

```txt
EDGE_MODES   = { live, fast, default, reply, chat, command }
GEMINI_MODES = { narration, premium, archive, onboarding, ceremony, longform }
```

Any unrecognised mode is treated as `"live"` (Edge TTS default).

---

## Request Schema (Brain — server.py)

`POST /tts`

```json
{
  "text": "string  (max 800 chars, required)",
  "mode": "string  (optional, default: 'live')",
  "voice": "string  (optional, overrides engine-default voice)",
  "handshake": "string  (optional, security header value)"
}
```

Header:

```
x-neural-handshake: AGENT_LEE_SOVEREIGN_V1
```

---

## Routing Logic (pseudocode)

```python
GEMINI_MODES = {narration, premium, archive, onboarding, ceremony, longform}

function resolve_engine(mode):
    if mode.lower() in GEMINI_MODES:
        return "gemini"
    return "edge"

function handle_tts(request):
    engine = resolve_engine(request.mode ?? "live")

    if engine == "gemini":
        try:
            audio = gemini_tts(request.text, voice=GEMINI_TTS_VOICE)
            return audio  // audio/wav
        except:
            // fall through to edge as emergency fallback

    for voice in [PRIMARY_EDGE_VOICE, FALLBACK_EDGE_VOICE]:
        try:
            audio = edge_tts(request.text, voice=voice)
            return audio  // audio/mpeg
        except:
            continue

    raise HTTP 503 "Voice synthesis unavailable."
```

---

## Response Contract

| Condition          | Content-Type | Body              |
| ------------------ | ------------ | ----------------- |
| Edge TTS success   | `audio/mpeg` | MP3 binary stream |
| Gemini TTS success | `audio/wav`  | WAV binary stream |
| All engines failed | —            | HTTP 503          |

---

## Default Voice Constants

| Setting           | Default                        | Env Override              |
| ----------------- | ------------------------------ | ------------------------- |
| Edge TTS primary  | `en-US-ChristopherNeural`      | `TTS_VOICE`               |
| Edge TTS fallback | `en-US-GuyNeural`              | `EDGE_TTS_FALLBACK_VOICE` |
| Gemini TTS voice  | `Charon`                       | `GEMINI_TTS_VOICE`        |
| Gemini TTS model  | `gemini-2.5-flash-preview-tts` | `GEMINI_TTS_MODEL`        |

---

## TypeScript Backend Contract (ttsEnforcer.ts)

Function signature:

```typescript
async function agentLeeRespond(
  text: string,
  handshake: string,
  mode: string = "live",
): Promise<{
  provider: "GEMINI_TTS" | "EDGE_TTS" | "TEXT_ONLY";
  audio?: Buffer;
}>;
```

Routing:

- mode in `EDGE_MODES` → try Edge TTS first, Gemini as fallback
- mode in `GEMINI_MODES` → try Gemini first, Edge as fallback
- unknown mode → treat as `"live"` (Edge first)

---

## voice_output.py Contract (Python utility layer)

```python
async def synthesize(text: str, mode: str = "live") -> bytes:
    """Return PCM audio bytes. Routes to correct engine by mode."""

def speak(text: str, mode: str = "live") -> None:
    """Play audio synchronously. Always uses Edge for local playback."""
```

---

## Failure Cascade

```
Gemini request → [Gemini fails] → Edge TTS (both voices) → HTTP 503
Edge request   → [Edge fails]   → Edge retry (fallback voice) → HTTP 503
```

No silent fallback to a different mode. Log every fallback with:

```txt
[tts] Gemini TTS failed for mode={mode}: {error} — falling back to edge-tts
[tts] edge-tts {voice} failed: {error}
```

---

## Security

- Auth: `x-neural-handshake: AGENT_LEE_SOVEREIGN_V1` header required on brain endpoint.
- Text is capped at 800 chars before synthesis to prevent abuse.
- No Gemini API keys returned in error responses.

---

## Environment Variables (.env.local)

```bash
TTS_PROVIDER=edge
TTS_VOICE=en-US-ChristopherNeural
TTS_RATE=+0%
TTS_ENABLED=true
EDGE_TTS_VOICE=en-US-ChristopherNeural
GEMINI_TTS_VOICE=Charon
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
```
