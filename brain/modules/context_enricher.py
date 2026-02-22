"""
brain/modules/context_enricher.py
───────────────────────────────────
Builds augmented prompts that include environmental and emotional context,
and produces voice persona modifiers for the TTS layer.
"""

from typing import Optional


def build_augmented_prompt(user_prompt: str,
                            env: Optional[dict] = None,
                            emotion: Optional[dict] = None) -> str:
    """
    Prepend [ENVIRONMENT] and [EMOTIONAL_STATE] blocks to the raw user prompt.
    Both blocks are optional — if data is None the block is skipped.
    """
    blocks = []

    if env:
        caption  = env.get("caption",  "")
        lighting = env.get("lighting", "unknown")
        objects  = env.get("objects",  [])
        obj_str  = ", ".join(o.get("label", "?") for o in objects[:5]) if objects else "none detected"
        blocks.append(
            f"[ENVIRONMENT]\n"
            f"  Scene:    {caption}\n"
            f"  Lighting: {lighting}\n"
            f"  Objects:  {obj_str}"
        )

    if emotion:
        lines = "\n".join(f"  {k}: {v:.2f}" for k, v in emotion.items())
        blocks.append(f"[EMOTIONAL_STATE]\n{lines}")

    if blocks:
        prefix = "\n\n".join(blocks)
        return f"{prefix}\n\n{user_prompt}"

    return user_prompt


def persona_modifier(emotion: Optional[dict] = None) -> str:
    """
    Return a TTS style descriptor based on emotional state thresholds.
    Used to inject context into the voice rendering pipeline.
    """
    if not emotion:
        return "calm and professional"

    stress      = emotion.get("stress",      0.0)
    urgency     = emotion.get("urgency",     0.0)
    fatigue     = emotion.get("fatigue",     0.0)
    frustration = emotion.get("frustration", 0.0)

    if urgency > 0.6 or stress > 0.6:
        return "urgent and focused"
    if frustration > 0.5:
        return "empathetic and grounded"
    if fatigue > 0.5:
        return "slow and reassuring"
    if stress > 0.3:
        return "steady and decisive"
    return "calm and professional"
