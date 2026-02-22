"""
scripts/synthetic_job.py — Agent Lee Synthetic Data Generator
Reads episodes from workspace/episodes.db, uses Gemini to generate
improved Q/A pairs, and appends them to workspace/synthetic.jsonl.

Usage:
    python scripts/synthetic_job.py [--domain cdl|drone|code|general] [--limit 50]
"""

import os
import json
import sqlite3
import argparse
import datetime
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv(Path(__file__).parent.parent / ".env.local")
GEMINI_KEYS  = [os.getenv(f"GEMINI_API_KEY{'_' + str(i) if i > 1 else ''}") for i in range(1, 6)]
GEMINI_KEYS  = [k for k in GEMINI_KEYS if k]
DB_PATH      = Path(__file__).parent.parent / "workspace" / "episodes.db"
OUT_PATH     = Path(__file__).parent.parent / "workspace" / "synthetic.jsonl"

SYNTH_PROMPT = """
You are a data augmentation expert. Given an episode (user input + agent response),
generate 3 high-quality training variations in this JSON format:
[
  {{
    "instruction": "<improved user question>",
    "input": "",
    "output": "<ideal Agent Lee response>",
    "domain": "{domain}",
    "source": "synthetic_v1"
  }},
  ...
]
Ensure responses match Agent Lee's voice: confident, rhythmic, empathetic.
Use SPEAK/TRANSCRIPT/CHECKLIST format when appropriate.

Original episode:
User: {user_input}
Agent: {agent_output}
Domain: {domain}

Return ONLY valid JSON array. No markdown.
"""

def get_episodes(domain: str | None, limit: int) -> list[dict]:
    if not DB_PATH.exists():
        print(f"[synth] No episodes DB at {DB_PATH}")
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if domain:
        cur.execute(
            "SELECT * FROM episodes WHERE domain=? AND feedback_score IS NULL ORDER BY timestamp DESC LIMIT ?",
            (domain, limit)
        )
    else:
        cur.execute(
            "SELECT * FROM episodes WHERE feedback_score IS NULL ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def generate_synthetic(episode: dict, gemini_key: str) -> list[dict]:
    genai.configure(api_key=gemini_key)
    model    = genai.GenerativeModel("gemini-1.5-flash")
    prompt   = SYNTH_PROMPT.format(
        user_input=json.loads(episode["input_payload"]).get("prompt", ""),
        agent_output=json.loads(episode["output_payload"]).get("response", ""),
        domain=episode["domain"],
    )
    result = model.generate_content(prompt)
    raw = result.text.strip()
    # strip markdown fences if present
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        if raw.endswith("```"):
            raw = raw[:-3]
    return json.loads(raw)


def main():
    parser = argparse.ArgumentParser(description="Agent Lee Synthetic Data Generator")
    parser.add_argument("--domain", type=str, default=None, help="Filter by domain")
    parser.add_argument("--limit",  type=int, default=20,   help="Max episodes to process")
    args = parser.parse_args()

    if not GEMINI_KEYS:
        print("[synth] ERROR: No GEMINI_API_KEY found in .env.local")
        return

    episodes = get_episodes(args.domain, args.limit)
    print(f"[synth] Found {len(episodes)} episodes to augment")

    generated_total = 0
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUT_PATH.open("a", encoding="utf-8") as out_f:
        for ep in episodes:
            try:
                key = GEMINI_KEYS[generated_total % len(GEMINI_KEYS)]
                variations = generate_synthetic(ep, key)
                for v in variations:
                    v["episode_id"] = ep["id"]
                    v["created_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    out_f.write(json.dumps(v, ensure_ascii=False) + "\n")
                generated_total += len(variations)
                print(f"  [synth] episode {ep['id']} → {len(variations)} variations")
            except Exception as e:
                print(f"  [synth] episode {ep['id']} failed: {e}")

    print(f"[synth] Done. Total synthetic records written: {generated_total}")
    print(f"[synth] Output: {OUT_PATH}")


if __name__ == "__main__":
    main()
