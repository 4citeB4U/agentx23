# VOICE IDENTITY POLICY — Agent Lee OS

LEEWAY-CORE-2026 | Updated: 2026-03-07

## Core Intention

Agent Lee must feel like one coherent being.

The voice system must never feel random, stitched together, or unstable. Voice
switching must not happen from turn to turn without a clear reason. Any change
in voice must be **intentional, mode-based, and behaviorally consistent** so
the user experiences one unified intelligence rather than multiple disconnected
speech engines.

---

## Identity Statement

> **Edge TTS (en-US-ChristopherNeural) is Agent Lee's everyday voice.**
> **Gemini TTS is Agent Lee's specialty presentation voice.**
> Both belong to the same coherent identity. Each is used only in the right context.

---

## Primary Identity Voice — Edge TTS

**Voice:** `en-US-ChristopherNeural`
**Engine:** edge-tts (Microsoft Edge online TTS)
**Rate:** `+0%` (configurable via `TTS_RATE` env var)

Used for every live, real-time, and conversational context:

- Real-time replies
- Wake responses
- Command confirmations
- Normal conversation
- Fast assistant interaction
- Task status updates
- Error notices

This is the voice the user recognizes as **Agent Lee**. It must remain stable
across all normal usage so the identity becomes recognizable and trusted.

---

## Secondary Controlled Mode — Gemini TTS

**Model:** `gemini-2.5-flash-preview-tts`
**Voice:** `Charon` (configurable via `GEMINI_TTS_VOICE` env var)

Used **only** when the request explicitly specifies a premium delivery mode:

- `narration` — reading documents or long content aloud
- `premium` — high-quality branded speech
- `archive` — saving polished voice notes
- `onboarding` — guided first-run walk-through
- `ceremony` — announcements, proclamations
- `longform` — storytelling, deep lore

Gemini TTS behaves as a **presentation mode** of Agent Lee, not a separate
being. Same personality, same tone, same wording style — just a different
delivery surface.

---

## The Rule

**Do not randomly flip voices every turn.**
**Make every switch intentional and tied to mode.**

### Correct behaviour

```text
Normal live conversation  →  Edge TTS
Narration / premium       →  Gemini TTS
```

### Forbidden behaviour

```text
Turn 1 = Edge
Turn 2 = Gemini   ← no mode change triggered this
Turn 3 = Edge
Turn 4 = Gemini
```

That uncontrolled switching breaks immersion and weakens Agent Lee's identity.

---

## Operational Policy

1. **Default to Edge** for every request that does not specify an explicit mode.
2. **Only activate Gemini** when the selected mode is in the Gemini modes set.
3. **Do not switch voices mid-conversation** unless the mode changes.
4. **If a mode changes, make the change feel deliberate** — never accidental.
5. **Preserve Agent Lee's same tone, wording style, and personality** across
   both engines.

---

## Mode Classification Table

| Mode             | Engine | Rationale               |
| ---------------- | ------ | ----------------------- |
| `live` (default) | Edge   | Real-time reply         |
| `fast`           | Edge   | Speed-priority response |
| `default`        | Edge   | Catch-all fallback      |
| `reply`          | Edge   | Standard chat answer    |
| `chat`           | Edge   | Conversational          |
| `command`        | Edge   | Action confirmation     |
| `narration`      | Gemini | Long-form reading       |
| `premium`        | Gemini | Branded delivery        |
| `archive`        | Gemini | Saved voice note        |
| `onboarding`     | Gemini | First-run guide         |
| `ceremony`       | Gemini | Announcement            |
| `longform`       | Gemini | Story / lore            |

Any unrecognised mode defaults to `Edge`.

---

## Identity Continuity

The system must always preserve the feeling that:

- Agent Lee is one mind
- one assistant
- one recognizable presence
- with different **delivery modes**, not different identities

Gemini is Agent Lee in presentation mode. Edge is Agent Lee in everyday mode.
The user should never feel they are speaking to a different entity.
