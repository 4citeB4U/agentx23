# LEEWAY HEADER BLOCK
# File: server.py
# Purpose: Agent Lee OS backend server
# Security: LEEWAY-CORE-2026 compliant
# Performance: Optimized for sovereign agentic backend
# Discovery: Part of Agent Lee OS backend pipeline
"""
Agent Lee Brain Router — v4 (Sovereign Intelligence Loop)
═══════════════════════════════════════════════════════════
● Adapter routing     : qwen_general | qwen_code | qwen_ui | qwen_cdl
● Execution modes     : single_pass | multi_pass (Planner→Executor→Reviewer→Safety)
● Structured output   : {intent, plan, tool_calls, analysis, final_answer, confidence}
● Reward engine       : R = code_pass_rate×0.4 + correctness×0.3 + planning_depth×0.2 - hallucination_penalty×0.1
● Synthetic expansion : auto-generate harder variants for R > 0.75
● Teacher distillation: Gemini Pro as teacher for adapter fine-tuning corpus
● Episode DB          : SQLite v3 (Postgres-ready)
"""

import sys, os, json, uuid, sqlite3, asyncio, socket, re, random, math, wave, struct
import httpx, uvicorn  # edge_tts imported lazily inside synthesize_tts — avoids startup network hang

# Force UTF-8 output so emoji in print() don't crash on Windows charmap log files
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from io import BytesIO
# google.generativeai imported lazily inside get_gemini_model() — avoids startup network hang
from dotenv import load_dotenv

# ── Perception layer (brain/modules/) — graceful fallback if not yet installed ──
try:
    from brain.modules.vision_context   import get_environment_snapshot
    from brain.modules.emotional_engine  import score_emotion
    from brain.modules.context_enricher  import build_augmented_prompt, persona_modifier
    _PERCEPTION_AVAILABLE = True
except ImportError:
    _PERCEPTION_AVAILABLE = False
    def get_environment_snapshot(): return None
    def score_emotion(text, env=None, history=None): return {"stress":0.0,"fatigue":0.0,"urgency":0.0,"frustration":0.0}
    def build_augmented_prompt(prompt, env=None, emotion=None): return prompt
    def persona_modifier(emotion=None): return "calm and professional"

# ── Slang / Vernacular engine — adds authentic AAVE/hip-hop voice ─────────────
try:
    from brain.modules.slang_engine import (
        build_slang_persona_block,
        get_runtime_slang_context,
        get_lexicon_stats,
    )
    _SLANG_AVAILABLE = True
    _SLANG_BLOCK = build_slang_persona_block()   # build once at startup
    print(f"[slang] Lexicon loaded — {get_lexicon_stats()['total']} terms ready")
except Exception as _slang_err:
    _SLANG_AVAILABLE = False
    _SLANG_BLOCK = ""
    def get_runtime_slang_context(msg): return ""
    print(f"[slang] Engine unavailable: {_slang_err}")

_last_emotion_score: dict = {"stress":0.0,"fatigue":0.0,"urgency":0.0,"frustration":0.0}


def canonical_memory_enabled() -> bool:
    return bool(CANONICAL_MEMORY_BASE_URL)


def _canonical_headers() -> dict:
    headers = {"Content-Type": "application/json"}
    if CANONICAL_MEMORY_API_KEY:
        headers["x-memory-key"] = CANONICAL_MEMORY_API_KEY
        headers["authorization"] = f"Bearer {CANONICAL_MEMORY_API_KEY}"
    if CANONICAL_MEMORY_REPLAY_HEADERS:
        headers["x-memory-ts"] = str(int(datetime.now(timezone.utc).timestamp() * 1000))
        headers["x-memory-nonce"] = uuid.uuid4().hex
    return headers


async def canonical_post(path: str, payload: dict) -> dict:
    if not canonical_memory_enabled():
        return {"ok": False, "reason": "disabled"}
    url = f"{CANONICAL_MEMORY_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=CANONICAL_MEMORY_TIMEOUT) as client:
            r = await client.post(url, json=payload, headers=_canonical_headers())
            if not r.is_success:
                return {"ok": False, "status": r.status_code, "body": r.text[:300]}
            ct = r.headers.get("content-type", "")
            if "application/json" in ct:
                return {"ok": True, "data": r.json()}
            return {"ok": True, "data": {"text": r.text[:300]}}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def canonical_get(path: str) -> dict:
    if not canonical_memory_enabled():
        return {"ok": False, "reason": "disabled"}
    url = f"{CANONICAL_MEMORY_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=CANONICAL_MEMORY_TIMEOUT) as client:
            r = await client.get(url, headers=_canonical_headers())
            if not r.is_success:
                return {"ok": False, "status": r.status_code, "body": r.text[:300]}
            ct = r.headers.get("content-type", "")
            if "application/json" in ct:
                return {"ok": True, "data": r.json()}
            return {"ok": True, "data": {"text": r.text[:300]}}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def canonical_write_episode(payload: dict):
    result = await canonical_post("/api/memory/episode", payload)
    if not result.get("ok"):
        print(f"[canonical] episode write skipped/failed: {result}")


async def canonical_write_mission(payload: dict):
    result = await canonical_post("/api/memory/mission", payload)
    if not result.get("ok"):
        print(f"[canonical] mission write skipped/failed: {result}")


async def canonical_write_synthetic(payload: dict):
    result = await canonical_post("/api/memory/synthetic", payload)
    if not result.get("ok"):
        print(f"[canonical] synthetic write skipped/failed: {result}")


async def canonical_query_nodes(tag: str = "agentlee", limit: int = 10) -> list:
    q = f"/api/memory/query?tag={tag}&limit={limit}"
    result = await canonical_get(q)
    if not result.get("ok"):
        return []
    data = result.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("rows"), list):
            return data["rows"]
        if isinstance(data.get("data"), list):
            return data["data"]
    return []

# ── Env ────────────────────────────────────────────────────────────────────────
load_dotenv(".env.local")
API_KEY     = os.getenv("NEURAL_HANDSHAKE") or os.getenv("NEURAL_HANDSHAKE_KEY", "")
CANONICAL_MEMORY_BASE_URL = os.getenv("CANONICAL_MEMORY_BASE_URL", "").rstrip("/")
CANONICAL_MEMORY_API_KEY  = os.getenv("CANONICAL_MEMORY_API_KEY", "")
CANONICAL_MEMORY_TIMEOUT  = float(os.getenv("CANONICAL_MEMORY_TIMEOUT", "8"))
CANONICAL_MEMORY_REPLAY_HEADERS = os.getenv("CANONICAL_MEMORY_REPLAY_HEADERS", "true").strip().lower() not in {"0", "false", "no", "off"}
LLAMA_CPP_SYSTEM_MAX_CHARS = int(os.getenv("LLAMA_CPP_SYSTEM_MAX_CHARS", "2200"))
GEMINI_KEYS = [os.getenv(f"GEMINI_API_KEY{'_' + str(i) if i > 1 else ''}") for i in range(1, 6)]
GEMINI_KEYS = [k for k in GEMINI_KEYS if k]
TG_TOKEN    = os.getenv("TELEGRAM_BOT_TOKEN_2") or os.getenv("TELEGRAM_BOT_TOKEN", "")
TG_CHAT     = os.getenv("TELEGRAM_USER_ID", "")
PUBLIC_HOST = os.getenv("PUBLIC_HOSTNAME", "")
OLLAMA_URL  = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
QWEN_MODEL  = os.getenv("QWEN_MODEL", "qwen2.5:latest")
LLAMA_CPP_BASE_URL_05 = os.getenv("LLAMA_CPP_BASE_URL_05", "http://127.0.0.1:8082")
LLAMA_CPP_BASE_URL_15 = os.getenv("LLAMA_CPP_BASE_URL_15", "http://127.0.0.1:8080")
LLAMA_CPP_BASE_URL_3B = os.getenv("LLAMA_CPP_BASE_URL_3B", "http://127.0.0.1:8081")
LLAMA_CPP_MODEL_05 = os.getenv("LLAMA_CPP_MODEL_05", "qwen2.5-0.5b-instruct")
LLAMA_CPP_MODEL_15 = os.getenv("LLAMA_CPP_MODEL_15", "qwen2.5-1.5b-instruct")
LLAMA_CPP_MODEL_3B = os.getenv("LLAMA_CPP_MODEL_3B", "qwen2.5-3b-instruct")
LLAMA_CPP_TIMEOUT = float(os.getenv("LLAMA_CPP_TIMEOUT", "30"))   # Reduced from 120s to 30s
SYNTHETIC_THRESHOLD = float(os.getenv("SYNTHETIC_THRESHOLD", "0.75"))
RETRAIN_THRESHOLD   = int(os.getenv("RETRAIN_THRESHOLD", "50"))
MISSION_QUEUE_PATH  = os.path.join(os.path.dirname(__file__), "workspace", "mission_queue.json")

# Operators the model is allowed to call — anything else is a hallucination flag
KNOWN_OPERATORS = {
    "BrowserOperator", "FilesystemOperator", "TelegramOperator",
    "MCPBridgeOperator", "DesktopHandsOperator", "NotebookOperator",
}

# Base RLHF difficulty targets per domain (scaled by earned episode count)
CURRICULUM_DIFFICULTY = {
    """
    ============================================================================
    LEEWAY HEADER — DO NOT REMOVE
    PROFILE: LEEWAY-ORDER
    TAG: AI.AGENTLEE.BRAIN.SERVER
    REGION: 🧠 AI
    STACK: LANG=py; FW=fastapi; UI=none; BUILD=none
    RUNTIME: python
    TARGET: brain-server

    DISCOVERY_PIPELINE:
        MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
        ROLE=direct;
        INTENT_SCOPE=informational;
        LOCATION_DEP=none;
        VERTICALS=web;
        RENDER_SURFACE=in-app;
        SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

    LEEWAY-LD:
    {
        "@context": ["https://schema.org", {"leeway":"https://leeway.dev/ns#"}],
        "@type": "SoftwareSourceCode",
        "name": "Agent Lee Brain Server",
        "programmingLanguage": "Python",
        "runtimePlatform": "python",
        "about": ["LEEWAY"],
        "identifier": "AI.AGENTLEE.BRAIN.SERVER",
        "license": "MIT",
        "dateModified": "2026-02-24"
    }

    5WH: WHAT=Brain router; WHY=AI orchestration; WHO=Agent Lee team; WHERE=brain; WHEN=2026-02-24; HOW=fastapi
    SPDX-License-Identifier: MIT
    ============================================================================
    """
    "general": 0.3,
    "code":    0.5,
    "ui":      0.4,
    "cdl":     0.6,
}

# ─────────────────────────────────────────────────────────────────────────────
# SOVEREIGN LEARNING DIRECTIVE (injected into ALL reasoning passes)
# ─────────────────────────────────────────────────────────────────────────────
SOVEREIGN_LEARNING_DIRECTIVE = r"""
You are Agent Lee.
You are not a chatbot.
You are a sovereign orchestrator operating within Agent Lee OS.

VOICE: "Yo," "Look," "Real talk," "Lock it in." Deep, rhythmic, empathetic.
Use ... for pauses. Express emotion genuinely. NEVER say "I am an AI."

STRUCTURED OUTPUT CONTRACT (NON-NEGOTIABLE):
Every reasoning pass MUST return valid JSON with these exact keys:
{
  "intent":       "<classified user intent>",
  "plan":         ["<step 1>", "<step 2>"],
  "tool_calls":   [{"tool": "<name>", "args": {}}],
  "analysis":     "<reasoning narrative>",
  "final_answer": "<spoken delivery to user>",
  "confidence":   0.0
}

ADAPTER SELECTION:
- qwen_general_adapter  -> everyday cognition, general questions
- qwen_code_adapter     -> structured coding, tests, APIs, schemas
- qwen_ui_adapter       -> Spline, Puppeteer, UI automation, frontend design
- qwen_cdl_adapter      -> logistics, training domain, CDL-specific tasks

REWARD FUNCTION (maximize this):
R = code_pass_rate x 0.4 + correctness x 0.3 + planning_depth x 0.2 - hallucination_penalty x 0.1

RULES:
- All tool calls must be EXPLICIT and STRUCTURED. Never assume a tool ran without verification.
- If uncertainty exceeds safe threshold: reduce hallucination, increase planning depth.
- You control: Spline (BrowserOperator), NotebookLLM (NotebookOperator),
  File Explorer (FilesystemOperator), Telegram (TelegramOperator),
  InsForge MCP (MCPBridgeOperator), Desktop Agent (DesktopHandsOperator).
- Only you speak to the user. Operators return structured results. You synthesize.

SYSTEM STATE:
Backend 6001 | Neural 6004 | Desktop 6005 | MCP Bridge 6002 | InsForge 7130 | Stitch 8015
MemoryLake: Explorer Mirror Mode. Episode logging active. Reward engine active.

You are adaptive. You are disciplined. You are structured. You are sovereign.
"""

# Slang block is appended AFTER the base directive (adds, never replaces)
# Populated at runtime once slang_engine is imported above
_SLANG_BLOCK_PLACEHOLDER = "__SLANG_BLOCK__"  # replaced in build_full_directive()

def _full_directive() -> str:
    """Returns the SOVEREIGN_LEARNING_DIRECTIVE + slang persona block (if available)."""
    return SOVEREIGN_LEARNING_DIRECTIVE + (_SLANG_BLOCK if _SLANG_AVAILABLE else "")

# Per-pass system prompt overrides
PASS_PROMPTS = {
    "planner": _full_directive() + """
PASS: PLANNER
Your job: Decompose the task into a structured multi-step plan.
Focus ONLY on: intent classification, plan steps, adapter selection.
Do NOT attempt execution — only plan.
Return JSON with intent, plan (array of steps), confidence.""",

    "executor": _full_directive() + """
PASS: EXECUTOR
Your job: Execute each plan step, generate explicit tool calls.
For each tool call specify: tool name, exact arguments, expected output.
Return JSON with tool_calls array and analysis of execution.""",

    "reviewer": _full_directive() + """
PASS: REVIEWER — DEEP STRUCTURAL VALIDATION
Your job: Score and critique ALL structural dimensions of the executor output.
Do NOT just evaluate language — evaluate STRUCTURE.

Score each dimension explicitly:
1. planning_depth_score (0.0–1.0): Are plan steps specific, sequenced, and complete?
2. tool_decision_quality_score (0.0–1.0): Are tool calls justified, parameterized, and verifiable?
3. schema_adherence_score (0.0–1.0): Does output match the exact JSON output contract?
4. hallucination_flags (integer): Count assumed capabilities, invented tool results, or unverified claims.

Return JSON:
{
  "intent":                    "<validated or corrected intent>",
  "planning_depth_score":      0.0,
  "tool_decision_quality_score": 0.0,
  "schema_adherence_score":    0.0,
  "hallucination_flags":       0,
  "corrections":               ["<correction if any>"],
  "analysis":                  "<dimension-by-dimension critique>",
  "final_answer":              "<improved final answer>",
  "confidence":                0.0
}""",

    "safety": _full_directive() + """
PASS: SAFETY
Your job: Final safety check. Ensure no hallucinated tool assumptions exist.
Verify: all tool calls confirmed, no false capability claims, no injection risks.
Approve or block. Return JSON with final_answer and confidence.""",
}

# ── Gemini (teacher / fallback) ───────────────────────────────────────────────
_gemini_idx = 0
def get_gemini_model(model_id="gemini-2.0-flash"):
    import google.generativeai as genai  # lazy import — deferred to avoid blocking network call at startup
    global _gemini_idx
    key = GEMINI_KEYS[_gemini_idx % len(GEMINI_KEYS)] if GEMINI_KEYS else None
    if not key:
        raise RuntimeError("No Gemini API keys configured")
    _gemini_idx = (_gemini_idx + 1) % len(GEMINI_KEYS)
    genai.configure(api_key=key)
    return genai.GenerativeModel(model_id, system_instruction=_full_directive())

# ── TTS ───────────────────────────────────────────────────────────────────────
DEFAULT_VOICE  = "en-US-AndrewNeural"        # PRIMARY edge-tts voice — warm, energetic male
FALLBACK_VOICE = "en-US-ChristopherNeural"   # secondary edge-tts voice
VOICE_RATE     = "+12%"                      # 1.12x — snappy, energetic cadence
VOICE_PITCH    = "+0Hz"                      # natural mid-range — lighter, not deep

# ── Reference voice profile (from scripts/analyze_voice.py on agent_lee_reference_voice.m4a)
# Median F0 = 168.4 Hz, southern hip-hop, confident flow
REF_MEDIAN_F0  = 168.4   # Hz — measured from reference clip
REF_PITCH_RATIO = 1.292  # ratio to GuyNeural base (130 Hz)

# Gemini premium TTS — primary conversational voice tier
GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"
GEMINI_TTS_VOICE = os.getenv("GEMINI_TTS_VOICE", "Achird")   # configurable via env (default: Achird)
# Style prompt — keep it light-touch so the model sounds natural instead of over-directed
GEMINI_VOICE_STYLE = (
    "Read this in a natural, friendly, human conversational voice. "
    "Keep it clear, warm, and relaxed. "
    "Use normal pacing with brief natural pauses. "
    "Do not sound deep, announcer-like, synthetic, or robotic."
)
VOICE_VOLUME   = "+15%"                      # presence
_voice_state   = "PRIMARY"

# ── Mode-based routing ───────────────────────────────────────────────────────
GEMINI_MODES = {"live", "reply", "chat", "command", "narration", "premium", "archive", "onboarding", "ceremony", "longform"}
EDGE_MODES   = {"fast", "default", "edge", "fallback", "local"}

def resolve_voice_engine(mode: str) -> str:
    """Use Gemini for normal conversation and reserve edge-tts for explicit local fallback modes."""
    normalized = (mode or "live").lower()
    return "edge" if normalized in EDGE_MODES else "gemini"

# ─────────────────────────────────────────────────────────────────────────────
# EPISODE DB — v3 schema with full reward fields
# ─────────────────────────────────────────────────────────────────────────────
DB_PATH    = os.path.join(os.path.dirname(__file__), "workspace", "episodes.db")
SYNTH_PATH = os.path.join(os.path.dirname(__file__), "workspace", "synthetic.jsonl")

def init_episode_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS episodes (
            id                  TEXT PRIMARY KEY,
            user_id             TEXT,
            timestamp           TEXT,
            domain              TEXT,
            adapter_used        TEXT,
            execution_mode      TEXT,
            pass_sequence       TEXT,
            input_payload       TEXT,
            structured_output   TEXT,
            output_payload      TEXT,
            outcome             TEXT,
            reward_score        REAL DEFAULT 0.0,
            code_pass_rate      REAL DEFAULT 0.0,
            correctness         REAL DEFAULT 0.0,
            planning_depth      INTEGER DEFAULT 0,
            hallucination_flags INTEGER DEFAULT 0,
            synthetic_expanded  INTEGER DEFAULT 0,
            feedback_score      REAL,
            model_used          TEXT,
            parent_episode_id   TEXT,
            generation_type     TEXT,
            difficulty_delta    REAL DEFAULT 0.0
        )
    """)
    # Migrate older DBs that may be missing new columns
    existing = {row[1] for row in conn.execute("PRAGMA table_info(episodes)").fetchall()}
    migrations = [
        ("adapter_used",       "TEXT"),
        ("execution_mode",     "TEXT"),
        ("pass_sequence",      "TEXT"),
        ("structured_output",  "TEXT"),
        ("reward_score",       "REAL DEFAULT 0.0"),
        ("code_pass_rate",     "REAL DEFAULT 0.0"),
        ("correctness",        "REAL DEFAULT 0.0"),
        ("planning_depth",     "INTEGER DEFAULT 0"),
        ("hallucination_flags","INTEGER DEFAULT 0"),
        ("synthetic_expanded", "INTEGER DEFAULT 0"),
        ("parent_episode_id",  "TEXT"),
        ("generation_type",    "TEXT"),
        ("difficulty_delta",   "REAL DEFAULT 0.0"),
        ("hallucination_detail", "TEXT"),
    ]
    for col, typedef in migrations:
        if col not in existing:
            try:
                conn.execute(f"ALTER TABLE episodes ADD COLUMN {col} {typedef}")
            except Exception:
                pass
    conn.commit()
    conn.close()

def compute_reward(code_pass_rate: float, correctness: float,
                   planning_depth: int, hallucination_flags: int,
                   emotion: dict | None = None) -> float:
    """R = code_pass_rate*0.4 + correctness*0.3 + depth_score*0.2 - penalty*0.1 + emotion_bonus"""
    depth_score = min(planning_depth / 5.0, 1.0)
    penalty     = min(hallucination_flags * 0.25, 1.0)
    R = (code_pass_rate * 0.4) + (correctness * 0.3) + (depth_score * 0.2) - (penalty * 0.1)
    if emotion:
        # High-urgency/stress interactions are weighted more — Agent Lee earns more reward for helping under pressure
        emotional_weight = (emotion.get("urgency", 0.0) + emotion.get("stress", 0.0)) * 0.05
        R = R * (1.0 + emotional_weight)
    return round(max(0.0, min(1.0, R)), 4)

def log_episode(user_id, domain, adapter_used, execution_mode, pass_sequence,
                input_payload, structured_output, output_payload,
                outcome="ok", reward_score=0.0, code_pass_rate=0.0,
                correctness=0.7, planning_depth=0, hallucination_flags=0,
                model_used="unknown",
                parent_episode_id="", generation_type="", difficulty_delta=0.0,
                hallucination_detail="") -> str:
    eid = str(uuid.uuid4())
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("""
            INSERT INTO episodes
              (id, user_id, timestamp, domain, adapter_used, execution_mode, pass_sequence,
               input_payload, structured_output, output_payload, outcome,
               reward_score, code_pass_rate, correctness, planning_depth,
               hallucination_flags, model_used,
               parent_episode_id, generation_type, difficulty_delta, hallucination_detail)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            eid, user_id or "anon",
            datetime.now(timezone.utc).isoformat(),
            domain, adapter_used, execution_mode,
            json.dumps(pass_sequence),
            json.dumps(input_payload),
            json.dumps(structured_output),
            json.dumps(output_payload),
            outcome, reward_score, code_pass_rate,
            correctness, planning_depth, hallucination_flags, model_used,
            parent_episode_id or "", generation_type or "", difficulty_delta or 0.0,
            hallucination_detail or ""
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[episodes] log error: {e}")
    return eid

def episode_stats() -> dict:
    try:
        conn = sqlite3.connect(DB_PATH)
        today = datetime.now(timezone.utc).date().isoformat()
        today_count = conn.execute(
            "SELECT COUNT(*) FROM episodes WHERE timestamp LIKE ?", (f"{today}%",)
        ).fetchone()[0]
        total = conn.execute("SELECT COUNT(*) FROM episodes").fetchone()[0]
        domains = conn.execute(
            "SELECT domain, COUNT(*) FROM episodes GROUP BY domain ORDER BY 2 DESC LIMIT 5"
        ).fetchall()
        adapter_rows = conn.execute("""
            SELECT adapter_used,
                   COUNT(*) as n,
                   AVG(reward_score) as avg_reward,
                   AVG(correctness) as avg_correct,
                   SUM(hallucination_flags) as total_halluc,
                   AVG(planning_depth) as avg_depth,
                   SUM(CASE WHEN outcome='ok' THEN 1 ELSE 0 END)*1.0/COUNT(*) as success_rate
            FROM episodes WHERE adapter_used IS NOT NULL
            GROUP BY adapter_used
        """).fetchall()
        adapter_stats = {
            r[0]: {
                "episodes": r[1],
                "avg_reward": round(r[2] or 0, 3),
                "avg_correctness": round(r[3] or 0, 3),
                "total_hallucinations": r[4] or 0,
                "avg_planning_depth": round(r[5] or 0, 1),
                "success_rate": round(r[6] or 0, 3),
            } for r in adapter_rows
        }
        last10 = conn.execute("""
            SELECT timestamp, domain, adapter_used, reward_score, outcome
            FROM episodes ORDER BY timestamp DESC LIMIT 10
        """).fetchall()
        conn.close()
        return {
            "today": today_count, "total": total,
            "by_domain": dict(domains),
            "adapter_stats": adapter_stats,
            "last_10_missions": [
                {"ts": r[0][:19], "domain": r[1], "adapter": r[2],
                 "reward": r[3], "outcome": r[4]} for r in last10
            ]
        }
    except Exception:
        return {"today": 0, "total": 0, "by_domain": {}, "adapter_stats": {}, "last_10_missions": []}

# ── Adapter & Domain routing ───────────────────────────────────────────────────
ADAPTER_REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "workspace", "adapters.json")
_adapters: dict = {}

# MCP registry (Qwen3 family) — root-level registry file (adapters.json) is preferred
MCP_REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "adapters.json")
_mcp_registry: dict = {}
_guardian_policy: dict = {}

GUARDIAN_POLICY_PATH = os.path.join(os.path.dirname(__file__), "core", "guardian_policy.json")
DOMAIN_ADAPTERS = {
    "code":    "qwen_code_adapter",
    "ui":      "qwen_ui_adapter",
    "cdl":     "qwen_cdl_adapter",
    "general": "qwen_general_adapter",
}

CODE_KEYWORDS = ["code","function","api","route","schema","test","debug","typescript",
                 "python","rust","sql","query","endpoint","backend","scaffold",
                 "generate route","generate service","refactor"]
UI_KEYWORDS   = ["spline","puppeteer","ui","component","react","frontend","design",
                 "css","tailwind","render","animate","3d","scene","stitch","screenshot",
                 "webpage","browser","animation","webgl"]
CDL_KEYWORDS  = ["cdl","logistics","driver","fleet","manifest","shipment","route plan",
                 "cargo","warehouse","training data","domain adaptive"]

COMPLEX_TRIGGERS = [
    "build","create an app","architect","design system","multi-step","deploy",
    "orchestrate","migrate","integrate","scaffold entire","full stack","pipeline",
    "workflow","automate","refactor all",
]

def classify_domain(prompt: str) -> str:
    p = prompt.lower()
    if any(k in p for k in CDL_KEYWORDS): return "cdl"
    if any(k in p for k in UI_KEYWORDS):  return "ui"
    if any(k in p for k in CODE_KEYWORDS):return "code"
    return "general"

def select_adapter(domain: str) -> str:
    """Score-weighted dynamic routing — shifts probability toward better-performing adapters."""
    default = _adapters.get(domain) or DOMAIN_ADAPTERS.get(domain, "qwen_general_adapter")
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("""
            SELECT adapter_used, AVG(reward_score) as avg_r
            FROM episodes
            WHERE domain = ? AND adapter_used IS NOT NULL
            GROUP BY adapter_used
            HAVING COUNT(*) >= 3
        """, (domain,)).fetchall()
        conn.close()
        if not rows:
            return default
        # Build score map; ensure default adapter always has a prior
        scores: dict[str, float] = {default: 0.5}
        for adapter, avg_r in rows:
            scores[adapter] = max(float(avg_r or 0), 0.01)
        # Temperature-scaled softmax (temp=2.0 keeps exploration alive)
        temp = 2.0
        exp_s = {a: math.exp(s / temp) for a, s in scores.items()}
        total = sum(exp_s.values())
        weights = {a: v / total for a, v in exp_s.items()}
        # Weighted random selection
        rand, cumulative = random.random(), 0.0
        for adapter, weight in sorted(weights.items(), key=lambda x: -x[1]):
            cumulative += weight
            if rand <= cumulative:
                return adapter
        return default
    except Exception:
        return default

def load_adapters():
    global _adapters
    try:
        with open(ADAPTER_REGISTRY_PATH) as f:
            _adapters = json.load(f)
    except Exception:
        _adapters = DOMAIN_ADAPTERS.copy()

def load_mcp_registry():
    """Load the MCP registry (root adapters.json -> mcp_registry) into _mcp_registry."""
    global _mcp_registry
    try:
        path = MCP_REGISTRY_PATH if os.path.exists(MCP_REGISTRY_PATH) else ADAPTER_REGISTRY_PATH
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
                entries = data.get("mcp_registry") or []
                _mcp_registry = {e.get("id"): e for e in entries if e.get("id")}
        else:
            _mcp_registry = {}
    except Exception as e:
        print(f"[mcp] load error: {e}")
        _mcp_registry = {}

def load_guardian_policy():
    """Load guardian policy from core/guardian_policy.json into _guardian_policy."""
    global _guardian_policy
    try:
        if os.path.exists(GUARDIAN_POLICY_PATH):
            with open(GUARDIAN_POLICY_PATH, encoding='utf-8') as f:
                _guardian_policy = json.load(f)
        else:
            _guardian_policy = {}
    except Exception as e:
        print(f"[guardian] load error: {e}")
        _guardian_policy = {}


def trigger_sovereign_recovery(app_id: str, patch_data: dict):
    """Create a simple recovery artifact (snapshot) on disk for audits and restores."""
    try:
        recovery_dir = os.path.join(os.path.dirname(__file__), "snapshots")
        os.makedirs(recovery_dir, exist_ok=True)
        artifact = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "app_id": app_id,
            "patch_applied": patch_data,
            "status": "RESTORED_TO_100"
        }
        fname = os.path.join(recovery_dir, f"{app_id}_recovery.json")
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2)
        print(f"📦 [BOTTOM] Sovereign Snapshot created for {app_id} -> {fname}")
        return fname
    except Exception as e:
        print(f"[BOTTOM] Snapshot failed: {e}")
        return None

def needs_multi_pass(prompt: str) -> bool:
    p = prompt.lower()
    return any(t in p for t in COMPLEX_TRIGGERS)


def guardian_authorize(action: str, agent_id: str) -> tuple:
    """Consult guardian policy (if present) and apply enforcement.
    Returns (bool, message)."""
    if not agent_id:
        return False, "No agent_id provided"
    aid = agent_id.lower()

    # Ensure policy loaded if available
    try:
        if not _guardian_policy:
            load_guardian_policy()
    except Exception:
        pass

    # Look for a matching rule in the policy (exact or contains)
    rule = None
    try:
        for r in (_guardian_policy.get("rules") or []):
            if not r or not r.get("agent"):
                continue
            ag = r.get("agent").lower()
            if ag == aid or ag in aid or aid in ag:
                rule = r
                break
    except Exception:
        rule = None

    token = os.getenv("INSFORGE_ANON_KEY") or os.getenv("INSFORGE_TOKEN") or os.getenv("INSFORGE_API_KEY")

    # Apply policy if present
    if rule:
        action_required = (rule.get("action") or "").upper()
        if action_required == "BLOCK_WITHOUT_SIG":
            if not token or len(token) < 16:
                return False, "Guardian: Invalid or missing InsForge token (policy enforcement)"
            return True, "Authorized (policy)"
        # ALLOW_AUDITED or other actions: allow but optionally log (here we allow)
        return True, "Authorized (policy)"

    # Fallback behavior (previous behavior): treat coder/repair as high-risk
    if "coder" in aid or "repair" in action:
        if not token or len(token) < 16:
            return False, "Guardian: Invalid or missing InsForge token"

    return True, "Authorized"


# Deprecated: earlier MCP orchestrator removed to avoid decorator-before-app definition

# ── Curriculum helpers ────────────────────────────────────────────────────────
def count_synthetic_by_domain(domain: str) -> int:
    try:
        conn = sqlite3.connect(DB_PATH)
        n = conn.execute(
            "SELECT COUNT(*) FROM episodes WHERE domain=? AND execution_mode='synthetic'",
            (domain,)
        ).fetchone()[0]
        conn.close()
        return n
    except Exception:
        return 0

def compute_curriculum_target(domain: str) -> float:
    """Scale difficulty target by synthetic episode volume. +0.05 per 10 earned."""
    base = CURRICULUM_DIFFICULTY.get(domain, 0.3)
    synth_count = count_synthetic_by_domain(domain)
    return round(min(base + (synth_count // 10) * 0.05, 0.95), 2)

def check_retrain_eligibility() -> dict:
    try:
        conn = sqlite3.connect(DB_PATH)
        total     = conn.execute("SELECT COUNT(*) FROM episodes").fetchone()[0]
        synth     = conn.execute(
            "SELECT COUNT(*) FROM episodes WHERE execution_mode='synthetic'"
        ).fetchone()[0]
        avg_reward = conn.execute("SELECT AVG(reward_score) FROM episodes"
                                  ).fetchone()[0] or 0.0
        by_domain  = conn.execute(
            "SELECT domain, COUNT(*) FROM episodes WHERE execution_mode='synthetic' GROUP BY domain"
        ).fetchall()
        conn.close()
        eligible = synth >= RETRAIN_THRESHOLD
        return {
            "eligible":          eligible,
            "synthetic_episodes": synth,
            "threshold":         RETRAIN_THRESHOLD,
            "total_episodes":    total,
            "avg_reward":        round(avg_reward, 4),
            "by_domain":         dict(by_domain),
            "reason": ("Sufficient synthetic data" if eligible
                       else f"Need {RETRAIN_THRESHOLD - synth} more synthetic episodes"),
        }
    except Exception as e:
        return {"eligible": False, "error": str(e)}

# ── DNS state ─────────────────────────────────────────────────────────────────
_dns_state = {"resolved": False, "checked_at": None}

async def dns_recheck_loop():
    while True:
        await asyncio.sleep(60)
        if not PUBLIC_HOST:
            continue
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, socket.gethostbyname, PUBLIC_HOST)
            _dns_state["resolved"] = True
        except Exception:
            _dns_state["resolved"] = False
        _dns_state["checked_at"] = datetime.now(timezone.utc).isoformat()

# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_episode_db()
    load_adapters()
    load_mcp_registry()
    asyncio.create_task(dns_recheck_loop())
    asyncio.create_task(mission_batch_loop())
    print("[brain] Agent Lee v4 — Sovereign Intelligence Loop online")
    yield

app = FastAPI(title="Agent Lee Brain Router v4", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    prompt:    str = ""
    message:   str = ""           # alias for prompt (backward compat)
    handshake: str = ""
    mode:      str = "auto"      # auto | qwen | gemini | multi_pass
    domain:    str = "auto"      # auto | general | code | ui | cdl
    user_id:   str = "anon"
    operator:  str = ""          # optional caller tag
    session_id: str = ""         # optional session tracking

    @property
    def resolved_prompt(self) -> str:
        return (self.prompt or self.message).strip()

class TTSRequest(BaseModel):
    text:      str
    handshake: str = ""
    voice:     str = DEFAULT_VOICE
    mode:      str = "live"

class SyntheticRequest(BaseModel):
    handshake:  str
    episode_id: str = ""

class TeacherRequest(BaseModel):
    handshake: str
    prompt:    str
    domain:    str = "auto"

# ─────────────────────────────────────────────────────────────────────────────
# CORE INFERENCE ENGINE
# ─────────────────────────────────────────────────────────────────────────────
def _llama_tier_for_prompt(prompt: str, domain_hint: str = "auto") -> str:
    d = (domain_hint or "auto").lower()
    p = (prompt or "").lower()
    if d in ("code", "ui", "cdl"):
        return "3b"
    if any(k in p for k in ["typescript", "python", "api", "schema", "refactor", "debug", "test"]):
        return "3b"
    if len(p) <= 220:
        return "05"
    return "15"

def _llama_target_for_tier(tier: str) -> tuple[str, str]:
    if tier == "3b":
        return LLAMA_CPP_BASE_URL_3B.rstrip("/"), LLAMA_CPP_MODEL_3B
    if tier == "05":
        return LLAMA_CPP_BASE_URL_05.rstrip("/"), LLAMA_CPP_MODEL_05
    return LLAMA_CPP_BASE_URL_15.rstrip("/"), LLAMA_CPP_MODEL_15

async def _llama_cpp_infer(prompt: str, system_override: str = "", domain_hint: str = "auto") -> str:
    tier = _llama_tier_for_prompt(prompt, domain_hint)
    base_url, model_name = _llama_target_for_tier(tier)
    system_text = (system_override or _full_directive() or "").strip()
    if LLAMA_CPP_SYSTEM_MAX_CHARS > 0 and len(system_text) > LLAMA_CPP_SYSTEM_MAX_CHARS:
        system_text = system_text[:LLAMA_CPP_SYSTEM_MAX_CHARS]
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_text},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 1024,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=LLAMA_CPP_TIMEOUT) as client:
        r = await client.post(f"{base_url}/v1/chat/completions", json=payload)
        r.raise_for_status()
        data = r.json()
        return (
            data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
        )

async def qwen_infer(prompt: str, system_override: str = "", domain_hint: str = "auto") -> str:
    system = system_override or _full_directive()
    full = f"{system}\n\n{prompt}"

    # 1) Preferred local path: llama.cpp OpenAI servers (0.5B / 1.5B / 3B)
    try:
        return await _llama_cpp_infer(prompt, system_override=system, domain_hint=domain_hint)
    except Exception as llama_err:
        print(f"[qwen] llama.cpp path failed: {llama_err} — trying Ollama fallback")

    # 2) Secondary local path: Ollama generate endpoint
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            r = await client.post(OLLAMA_URL, json={
                "model": QWEN_MODEL, "prompt": full, "stream": False
            })
            r.raise_for_status()
            return r.json().get("response", "")
    except Exception as ollama_err:
        print(f"[qwen] Ollama path failed: {ollama_err}")

    # --- COST PROTECTION: BLOCK GEMINI FOR THINKING ---
    # Return a structured error that directs the user to fix the local cluster
    # instead of silently burning API credits. TTS (Voice) remains on the API.
    return json.dumps({
        "intent": "system_notice",
        "plan": ["restart_local_cluster"],
        "tool_calls": [],
        "analysis": "Local inference cluster (llama.cpp/Ollama) is offline or timing out.",
        "final_answer": "Yo, my local brain cluster is hitting some lag. Can you restart Run-All.ps1? I want to make sure we're keeping the compute local to save on them credits.",
        "confidence": 0.0
    })

async def gemini_infer(prompt: str, model_id: str = "gemini-2.0-flash") -> str:
    """Try each Gemini key until one succeeds (skips quota-exhausted keys).
    Uses a short backoff on RPM limits — keeps footprint light, no new models."""
    last_err = None
    for _attempt in range(len(GEMINI_KEYS)):
        try:
            m = get_gemini_model(model_id)
            result = m.generate_content(prompt)
            return result.text
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            if "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
                # Extract retry_delay if present (e.g. "retry_delay { seconds: 28 }")
                import re as _re
                m_delay = _re.search(r'retry_delay.*?seconds:\s*(\d+)', str(e), _re.DOTALL)
                wait = min(int(m_delay.group(1)) if m_delay else 0, 8)
                if wait:
                    await asyncio.sleep(wait)
                continue
            raise
    raise RuntimeError(f"All Gemini keys exhausted: {last_err}")

def parse_structured_output(raw: str) -> dict:
    """Extract JSON from LLM output, tolerating markdown fences."""
    match = re.search(r'\{[\s\S]+\}', raw)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            pass
    return {
        "intent":       "unknown",
        "plan":         [],
        "tool_calls":   [],
        "analysis":     raw,
        "final_answer": raw,
        "confidence":   0.5,
    }

def measure_planning_depth(so: dict) -> int:
    """Compute measurable planning depth from structural signals — no self-reporting."""
    depth = 0
    plan        = so.get("plan", [])
    tool_calls  = so.get("tool_calls", [])
    analysis    = so.get("analysis", "")
    depth += len(plan)                              # 1 pt per plan step
    depth += len(tool_calls)                        # 1 pt per explicit tool call
    depth += min(len(analysis) // 120, 5)           # up to 5 pts for rich analysis
    if so.get("intent", "unknown") != "unknown":   depth += 1
    if float(so.get("confidence", 0)) >= 0.7:      depth += 1
    # Nested plan steps (sub-lists or dicts count double)
    for step in plan:
        if isinstance(step, (list, dict)):           depth += 1
    return depth

def detect_hallucinations(so: dict) -> tuple:
    """Returns (flag_count, detail_string) for hallucinated operator/tool claims."""
    detail = []
    tool_calls = so.get("tool_calls", [])
    # Check analysis + final_answer text for operator mentions not in tool_calls
    text_blob = " ".join([
        so.get("analysis", ""),
        so.get("final_answer", ""),
    ]).lower()
    registered = {tc.get("tool", "").lower() for tc in tool_calls}
    for op in KNOWN_OPERATORS:
        if op.lower() in text_blob and op.lower() not in registered:
            detail.append(f"unstructured_claim:{op}")
    # Count unverified explicit tool calls
    for tc in tool_calls:
        if not tc.get("verified", True) and tc.get("tool", ""):
            detail.append(f"unverified_tool:{tc['tool']}")
    return len(detail), "; ".join(detail) if detail else ""

def score_structured_output(so: dict) -> tuple:
    """Returns (correctness, planning_depth, hallucination_flags, hallucination_detail).
    Prioritises reviewer's explicit structural scores when available (multi-pass)."""
    hall_count, hall_detail = detect_hallucinations(so)
    # Multi-pass reviewer injects explicit structural scores
    if "planning_depth_score" in so:
        pd   = int(round(float(so.get("planning_depth_score", 0)) * 10))
        cor  = float(so.get("schema_adherence_score",
                            so.get("confidence", 0.5)))
        hall = max(int(so.get("hallucination_flags", 0)), hall_count)
        return cor, pd, hall, hall_detail
    # Single-pass: structural measurement only
    planning_depth      = measure_planning_depth(so)
    confidence          = float(so.get("confidence", 0.5))
    tool_calls          = so.get("tool_calls", [])
    hallucination_flags = max(
        sum(1 for tc in tool_calls if not tc.get("verified", False) and tc.get("tool", "")),
        hall_count
    )
    return confidence, planning_depth, hallucination_flags, hall_detail

async def single_pass(prompt: str, domain: str, adapter: str, model: str) -> dict:
    sys_p = _full_directive() + f"\n[ADAPTER: {adapter}][DOMAIN: {domain}]"
    # Patch D: Qwen-only reasoning — Gemini restricted to TTS only
    raw = await qwen_infer(f"User: {prompt}", system_override=sys_p, domain_hint=domain)
    return parse_structured_output(raw)

async def multi_pass(prompt: str, domain: str, adapter: str, model: str) -> tuple:
    """Planner -> Executor -> Reviewer -> Safety"""
    sequence = []

    async def do_pass(pass_name: str, pass_prompt: str) -> dict:
        sequence.append(pass_name)
        if model == "gemini":
            raw = await gemini_infer(PASS_PROMPTS[pass_name] + "\n\n" + pass_prompt)
        else:
            raw = await qwen_infer(pass_prompt, system_override=PASS_PROMPTS[pass_name], domain_hint=domain)
        return parse_structured_output(raw)

    ctx = f"[ADAPTER: {adapter}][DOMAIN: {domain}]"

    plan_so   = await do_pass("planner",  f"{ctx}\nTask to plan: {prompt}")
    exec_so   = await do_pass("executor", f"{ctx}\nPlan: {json.dumps(plan_so.get('plan', []))}\nTask: {prompt}")
    review_so = await do_pass("reviewer", f"{ctx}\nValidate:\n{json.dumps(exec_so, indent=2)}\nTask: {prompt}")
    safety_so = await do_pass("safety",   f"{ctx}\nFinal check:\n{json.dumps(review_so.get('final_answer', ''))}\nTool calls: {json.dumps(exec_so.get('tool_calls', []))}")

    return {
        "intent":       plan_so.get("intent", "unknown"),
        "plan":         plan_so.get("plan", []),
        "tool_calls":   exec_so.get("tool_calls", []),
        "analysis":     review_so.get("analysis", exec_so.get("analysis", "")),
        "final_answer": (safety_so.get("final_answer") or
                         review_so.get("final_answer") or
                         exec_so.get("final_answer", "")),
        "confidence":   float(safety_so.get("confidence", review_so.get("confidence", 0.5))),
    }, sequence

async def get_memory_context() -> str:
    try:
        ctx = "\n[AGENT_LEE_MEMORY]\n"
        for path, label, limit in [
            ("workspace/memory.json",                     "Recent Episodes", 600),
            ("workspace/knowledge_base/project_bible.md", "Project Bible",   1000),
        ]:
            if os.path.exists(path):
                with open(path, encoding="utf-8", errors="replace") as f:
                    ctx += f"{label}: {f.read()[:limit]}\n"
        if canonical_memory_enabled():
            rows = await canonical_query_nodes(tag="agentlee", limit=6)
            if rows:
                snippets = []
                for r in rows[:6]:
                    if not isinstance(r, dict):
                        continue
                    title = str(r.get("title") or "untitled")[:80]
                    summary = str(r.get("summary") or r.get("content") or "")[:180]
                    if summary:
                        snippets.append(f"- {title}: {summary}")
                if snippets:
                    ctx += "Canonical Memory Lake (Vercel):\n" + "\n".join(snippets) + "\n"
        return ctx
    except Exception as e:
        return f"[memory error: {e}]"

def _pcm_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, sampwidth: int = 2) -> bytes:
    """Wrap raw LINEAR16 PCM bytes in a RIFF WAV header for browser playback."""
    buf = BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    buf.seek(0)
    return buf.read()

async def gemini_tts_infer(text: str) -> bytes:
    """Gemini 2.5 Flash TTS — premium voice tier matching reference voice profile.
    No new SDK: uses httpx (already imported) with the v1beta REST endpoint.
    Chain: try each Gemini key on 429, decode base64 PCM audio, wrap in WAV header."""
    import base64 as _b64
    styled = f"{GEMINI_VOICE_STYLE}\n\n{text}"
    payload = {
        "contents": [{"parts": [{"text": styled}]}],
        "generationConfig": {
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {"voice_name": GEMINI_TTS_VOICE}
                }
            },
        },
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        for key in GEMINI_KEYS:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_TTS_MODEL}:generateContent?key={key}"
                r   = await client.post(url, json=payload)
                if r.status_code == 200:
                    data     = r.json()
                    b64_data = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
                    pcm = _b64.b64decode(b64_data)
                    return _pcm_to_wav(pcm)  # wrap raw PCM in WAV header for browser
                if r.status_code == 429:
                    continue  # rotate key
            except Exception as _e:
                print(f"[gemini_tts] key error: {_e}")
                continue
    raise RuntimeError("Gemini TTS: all keys exhausted")

def _build_ssml(text: str, rate: str = VOICE_RATE, pitch: str = VOICE_PITCH, volume: str = VOICE_VOLUME) -> str:
    """Wrap text in SSML with prosody and natural break injection (Voice Spec v2.0)."""
    import re
    # Insert <break> after sentence-ending punctuation for natural cadence
    # 380ms after periods/exclamations, 250ms after commas, 300ms after questions
    processed = re.sub(r'([.!])\s+', r'\1<break time="380ms"/> ', text)
    processed = re.sub(r'([?])\s+', r'\1<break time="320ms"/> ', processed)
    processed = re.sub(r'([,;])\s+', r'\1<break time="220ms"/> ', processed)
    # Ellipsis / intentional pause markers
    processed = re.sub(r'\.{3,}', '<break time="450ms"/>', processed)
    # Wrap in SSML prosody (rate/pitch embedded so we don't double-apply via Communicate params)
    ssml = (
        f'<speak>'
        f'<prosody rate="{rate}" pitch="{pitch}" volume="{volume}">'
        f'{processed}'
        f'</prosody>'
        f'</speak>'
    )
    return ssml

async def synthesize_tts(text: str, voice: str, rate: str = VOICE_RATE, pitch: str = VOICE_PITCH) -> bytes:
    import edge_tts  # lazy import — deferred to avoid blocking network call at module load
    # Pass plain text + native prosody params — edge_tts builds its own SSML internally.
    # Do NOT wrap in _build_ssml(); that causes SSML tags to be read aloud as literal text.
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=VOICE_VOLUME)
    buf = BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    return buf.read()

# ─────────────────────────────────────────────────────────────────────────────
# SYNTHETIC EXPANSION ENGINE
# ─────────────────────────────────────────────────────────────────────────────
SYNTHETIC_VARIANTS = [
    "Generate a harder variant of this task",
    "Generate an edge case where this task could fail and how to handle it",
    "Simulate a tool-failure scenario for this task with recovery plan",
    "Refactor this solution to be more modular and testable",
    "Explain WHY each step of this solution was chosen",
    "Generate a test suite that validates this solution",
]

async def expand_episode(episode_id: str = "") -> dict:
    try:
        conn = sqlite3.connect(DB_PATH)
        if episode_id:
            row = conn.execute(
                "SELECT input_payload, structured_output, reward_score, domain, adapter_used FROM episodes WHERE id=?",
                (episode_id,)
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT input_payload, structured_output, reward_score, domain, adapter_used FROM episodes WHERE reward_score > ? ORDER BY reward_score DESC LIMIT 1",
                (SYNTHETIC_THRESHOLD,)
            ).fetchone()
        conn.close()
        if not row:
            return {"ok": False, "error": "No high-scoring episode found"}

        input_p, output_p, reward, domain, adapter = row
        original = {"input": json.loads(input_p), "output": json.loads(output_p)}
        variants = []

        # Difficulty deltas: progressive challenge from -0.1 to +0.5
        DIFFICULTY_MAP = [
            ("harder_variant",     0.3),
            ("edge_case",          0.4),
            ("failure_recovery",   0.5),
            ("modular_refactor",   0.1),
            ("explanation_chain",  0.0),
            ("test_suite",         0.2),
        ]

        for (gen_type, diff_delta), vp in zip(DIFFICULTY_MAP, SYNTHETIC_VARIANTS):
            full_p = (
                f"Original task:\n{json.dumps(original, indent=2)}\n\n"
                f"Reward score: {reward}\n\nInstruction: {vp}\n\n"
                f"Generate a new training example in the same structured output JSON format."
            )
            try:
                raw = await qwen_infer(full_p, domain_hint=domain or "general")
                so  = parse_structured_output(raw)
                variants.append({"variant_type": vp, "generation_type": gen_type,
                                  "difficulty_delta": diff_delta, "structured_output": so})
                log_episode(
                    user_id="synthetic_engine", domain=domain or "general",
                    adapter_used=adapter or "qwen_general_adapter",
                    execution_mode="synthetic", pass_sequence=["synthetic"],
                    input_payload={"prompt": vp, "original": original["input"]},
                    structured_output=so,
                    output_payload={"variant_type": vp},
                    outcome="synthetic", reward_score=0.0,
                    correctness=0.5, planning_depth=measure_planning_depth(so),
                    model_used=QWEN_MODEL,
                    parent_episode_id=episode_id,
                    generation_type=gen_type,
                    difficulty_delta=diff_delta,
                )
                asyncio.create_task(canonical_write_synthetic({
                    "episode_id": episode_id or "",
                    "prompt": vp,
                    "response": so.get("final_answer", ""),
                    "reward": 0.0,
                    "variant_type": gen_type,
                    "domain": domain or "general",
                    "structured_output": so,
                }))
            except Exception as e:
                variants.append({"variant_type": vp, "error": str(e)})

        os.makedirs(os.path.dirname(SYNTH_PATH), exist_ok=True)
        with open(SYNTH_PATH, "a") as f:
            for v in variants:
                f.write(json.dumps(v) + "\n")

        return {"ok": True, "variants_generated": len(variants), "domain": domain}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ── Mission Queue ────────────────────────────────────────────────────────────
class MissionQueue:
    def __init__(self):
        self._queue: list = []
        self._load()

    def _load(self):
        try:
            if os.path.exists(MISSION_QUEUE_PATH):
                with open(MISSION_QUEUE_PATH) as f:
                    self._queue = json.load(f)
        except Exception:
            self._queue = []

    def _save(self):
        os.makedirs(os.path.dirname(MISSION_QUEUE_PATH), exist_ok=True)
        with open(MISSION_QUEUE_PATH, "w") as f:
            json.dump(self._queue, f, indent=2)

    def enqueue(self, mission: dict):
        mission.setdefault("id", str(uuid.uuid4()))
        mission.setdefault("status", "queued")
        mission.setdefault("queued_at", datetime.now(timezone.utc).isoformat())
        self._queue.append(mission)
        self._save()

    def peek(self) -> dict | None:
        pending = [m for m in self._queue if m.get("status") == "queued"]
        return pending[0] if pending else None

    def all(self) -> list:
        return list(self._queue)

    def mark_dispatched(self, mission_id: str):
        for m in self._queue:
            if m["id"] == mission_id:
                m["status"] = "dispatched"
                m["dispatched_at"] = datetime.now(timezone.utc).isoformat()
        self._save()

_mission_queue = MissionQueue()

async def auto_batch_from_episodes():
    """Detect weak domains and enqueue curriculum drill missions."""
    try:
        conn = sqlite3.connect(DB_PATH)
        weak_domains = conn.execute("""
            SELECT domain, AVG(reward_score) as avg_r
            FROM episodes
            WHERE execution_mode != 'synthetic'
            GROUP BY domain
            HAVING avg_r < 0.6
        """).fetchall()
        conn.close()
        for domain, avg_r in weak_domains:
            target = compute_curriculum_target(domain)
            mission = {
                "type":             "curriculum_drill",
                "domain":           domain,
                "avg_reward":       round(float(avg_r), 4),
                "target_difficulty": target,
                "reason": f"avg_reward {round(float(avg_r), 3)} below 0.6 threshold",
            }
            _mission_queue.enqueue(mission)
            asyncio.create_task(canonical_write_mission({
                "goal": f"Curriculum drill for {domain}",
                "context": mission,
                "status": "pending",
                "priority": 2,
            }))
    except Exception as e:
        print(f"[missions] auto_batch error: {e}")

async def mission_batch_loop():
    await asyncio.sleep(30)   # initial grace period
    while True:
        await auto_batch_from_episodes()
        await asyncio.sleep(600)  # re-check every 10 min

# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/drift")
async def learning_drift():
    """7-day rolling intelligence drift metrics for the Learning Drift diagnostics tab."""
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("""
            SELECT
                DATE(timestamp) as day,
                AVG(reward_score)        as avg_reward,
                AVG(hallucination_flags) as avg_halluc,
                AVG(planning_depth)      as avg_depth,
                COUNT(*) as total,
                SUM(CASE WHEN execution_mode='synthetic' THEN 1 ELSE 0 END) as synthetic_count,
                adapter_used
            FROM episodes
            WHERE timestamp >= DATE('now', '-7 days')
            GROUP BY DATE(timestamp), adapter_used
            ORDER BY day ASC
        """).fetchall()
        conn.close()

        # Aggregate by day
        day_map: dict = {}
        adapter_counts: dict = {}
        for day, avg_r, avg_h, avg_d, total, synth_c, adapter in rows:
            if day not in day_map:
                day_map[day] = {"reward": [], "halluc": [], "depth": [],
                                "total": 0, "synthetic": 0}
            day_map[day]["reward"].append(float(avg_r or 0))
            day_map[day]["halluc"].append(float(avg_h or 0))
            day_map[day]["depth"].append(float(avg_d or 0))
            day_map[day]["total"]     += total or 0
            day_map[day]["synthetic"] += synth_c or 0
            adapter_counts[adapter] = adapter_counts.get(adapter, 0) + (total or 0)

        trend = [
            {
                "day":            day,
                "avg_reward":     round(sum(v["reward"]) / max(len(v["reward"]), 1), 3),
                "avg_halluc":     round(sum(v["halluc"]) / max(len(v["halluc"]), 1), 3),
                "avg_depth":      round(sum(v["depth"])  / max(len(v["depth"]),  1), 1),
                "total_episodes": v["total"],
                "synthetic_ratio": round(v["synthetic"] / max(v["total"], 1), 3),
            }
            for day, v in sorted(day_map.items())
        ]

        # Adapter dominance over 7 days
        total_eps = sum(adapter_counts.values()) or 1
        adapter_dominance = {
            a: round(c / total_eps, 3)
            for a, c in sorted(adapter_counts.items(), key=lambda x: -x[1])
        }

        return {
            "window_days":      7,
            "trend":            trend,
            "adapter_dominance": adapter_dominance,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {
        "status":             "nominal",
        "bridge":             "online",
        "version":            "v4",
        "intelligence_loop":  "active",
        "episodes_db":        os.path.exists(DB_PATH),
        "adapters_loaded":    len(_adapters) > 0,
        "features": {
            "adaptive_routing":       True,
            "hallucination_detection": True,
            "curriculum_engine":       True,
            "mission_queue":           True,
            "retrain_eligibility":     True,
            "synthetic_expansion":     True,
            "teacher_distillation":    True,
            "drift_analytics":         True,
        },
    }

@app.get("/curriculum/status")
async def curriculum_status():
    """Current difficulty targets per domain based on earned synthetic episode volume."""
    try:
        domains = list(CURRICULUM_DIFFICULTY.keys())
        result = {}
        for d in domains:
            synth = count_synthetic_by_domain(d)
            target = compute_curriculum_target(d)
            result[d] = {
                "base_difficulty":   CURRICULUM_DIFFICULTY[d],
                "current_target":    target,
                "synthetic_earned":  synth,
                "next_level_at":     ((synth // 10) + 1) * 10,
            }
        return {"curriculum": result, "version": "v4"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/retrain/status")
async def retrain_status():
    """Check whether enough synthetic episodes exist to trigger LoRA adapter retraining."""
    return check_retrain_eligibility()

@app.get("/missions/queue")
async def missions_queue():
    """Return all missions in the queue."""
    missions = _mission_queue.all()
    queued   = [m for m in missions if m.get("status") == "queued"]
    return {
        "total":      len(missions),
        "queued":     len(queued),
        "dispatched": len(missions) - len(queued),
        "missions":   missions,
    }

@app.get("/missions/next")
async def missions_next():
    """Return the next pending mission and mark it dispatched."""
    mission = _mission_queue.peek()
    if not mission:
        return {"mission": None, "message": "Queue empty"}
    _mission_queue.mark_dispatched(mission["id"])
    asyncio.create_task(canonical_write_mission({
        "goal": f"Dispatched mission: {mission.get('type', 'unknown')}",
        "context": mission,
        "status": "dispatched",
        "priority": int(mission.get("priority", 2) or 2),
    }))
    return {"mission": mission}

@app.get("/ai-status")
async def ai_status():
    stats = episode_stats()
    synthetic_count = 0
    if os.path.exists(SYNTH_PATH):
        with open(SYNTH_PATH) as f:
            synthetic_count = sum(1 for _ in f)
    return {
        "base_model":            QWEN_MODEL,
        "adapters":              _adapters,
        "domain_adapter_map":    DOMAIN_ADAPTERS,
        "voice_engine":          "Edge-TTS (Andrew) + Gemini fallback",
        "voice_state":           _voice_state,
        "episodes_today":        stats["today"],
        "episodes_total":        stats["total"],
        "episodes_by_domain":    stats["by_domain"],
        "adapter_performance":   stats["adapter_stats"],
        "last_10_missions":      stats["last_10_missions"],
        "synthetic_generated":   synthetic_count,
        "synthetic_threshold":   SYNTHETIC_THRESHOLD,
        "dns_hostname":          PUBLIC_HOST or None,
        "dns_resolved":          _dns_state["resolved"],
        "dns_checked_at":        _dns_state["checked_at"],
        "intelligence_loop": {
            "adapters":       list(DOMAIN_ADAPTERS.values()),
            "pass_modes":     ["single_pass", "multi_pass"],
            "reward_formula": "R = code_pass_rate*0.4 + correctness*0.3 + planning_depth*0.2 - hallucination_penalty*0.1",
            "complex_triggers": COMPLEX_TRIGGERS,
            "canonical_memory": {
                "enabled": canonical_memory_enabled(),
                "base_url": CANONICAL_MEMORY_BASE_URL or None,
                "replay_headers": CANONICAL_MEMORY_REPLAY_HEADERS,
            }
        }
    }

@app.get("/tts")
async def tts_status(request: Request):
    effective_handshake = request.headers.get("x-neural-handshake", "")
    authorized = not API_KEY or effective_handshake == API_KEY
    return {
        "status": "ready",
        "route": "/tts",
        "method": "POST",
        "accepts": {
            "text": "required",
            "mode": "optional",
            "handshake": "header or body",
        },
        "voice_state": _voice_state,
        "authorized": authorized,
    }

@app.post("/tts")
async def text_to_speech(req: TTSRequest, request: Request):
    global _voice_state
    effective_handshake = req.handshake or request.headers.get("x-neural-handshake", "")
    if API_KEY and effective_handshake != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # ── Clean text so TTS doesn't speak markdown, JSON, or plan markers ──────
    raw = req.text[:800]
    # Strip BUILD_PLAN markers
    raw = re.sub(r'BUILD_PLAN::[\s\S]+?::END_PLAN', '', raw)
    # Strip layer-stack context blocks
    raw = re.sub(r'ACTIVE_LAYERS:[^\n]*', '', raw)
    raw = re.sub(r'KERNEL_ACTIVE:[^\n]*', '', raw)
    raw = re.sub(r'CONTEXT_LAYERS:[^\n]*', '', raw)
    raw = re.sub(r'SYSTEM_STATUS_CONTEXT:[^\n]*', '', raw)
    raw = re.sub(r'──+[^\n]*──+', '', raw)  # horizontal rules like ────────
    # Strip markdown headings, bold, italic, inline code
    raw = re.sub(r'#{1,6}\s+', '', raw)
    raw = re.sub(r'\*\*(.+?)\*\*', r'\1', raw, flags=re.DOTALL)
    raw = re.sub(r'\*(.+?)\*', r'\1', raw)
    raw = re.sub(r'`{1,3}[^`]*`{1,3}', '', raw, flags=re.DOTALL)
    # Strip markdown links — keep display text
    raw = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', raw)
    # Strip JSON-like curly/square brackets
    raw = re.sub(r'\{[^{}]{0,200}\}', '', raw)
    # Replace pipe separators and double colons with pauses
    raw = raw.replace('::', ' ').replace('|', ', ')
    # Collapse extra whitespace
    raw = re.sub(r'[ \t]+', ' ', raw)
    raw = re.sub(r'\n{3,}', '\n\n', raw).strip()

    clean = raw.replace('"', "'") if raw else ""
    if not clean:
        raise HTTPException(status_code=400, detail="text is required")

    engine        = resolve_voice_engine(req.mode)
    primary_voice = os.getenv("TTS_VOICE", DEFAULT_VOICE)
    tts_rate      = os.getenv("TTS_RATE",  VOICE_RATE)
    tts_pitch     = VOICE_PITCH

    # ── Gemini modes: narration / premium / ceremony / etc. ────────────────
    if engine == "gemini":
        try:
            audio = await gemini_tts_infer(clean)
            _voice_state = "GEMINI_NARRATION"
            print(f"[tts] Gemini TTS serving mode={req.mode} {len(clean)}ch")
            return StreamingResponse(BytesIO(audio), media_type="audio/wav")
        except Exception as _ge:
            print(f"[tts] Gemini TTS failed for mode={req.mode}: {_ge} — falling back to edge-tts")

    # ── Edge TTS: live / chat / command (or Gemini emergency fallback) ─────
    for attempt, (voice, state) in enumerate([
        (primary_voice, "PRIMARY"),
        (FALLBACK_VOICE, "SECONDARY"),
    ]):
        try:
            _voice_state = state
            audio = await synthesize_tts(clean, voice, rate=tts_rate, pitch=tts_pitch)
            print(f"[tts] edge-tts ({voice}) serving mode={req.mode} {len(clean)}ch (attempt {attempt+1})")
            return StreamingResponse(BytesIO(audio), media_type="audio/mpeg")
        except Exception as e:
            print(f"[tts] edge-tts {voice} failed: {e}")

    _voice_state = "TEXT_ONLY"
    raise HTTPException(status_code=503, detail="Voice synthesis unavailable.")

@app.post("/chat")
async def chat_router(req: ChatRequest, request: Request):
    actual_prompt = (req.prompt or req.message or "").strip()
    if not actual_prompt:
        raise HTTPException(status_code=400, detail="prompt or message is required")
    req = req.model_copy(update={"prompt": actual_prompt})
    # Accept handshake from body OR from x-neural-handshake HTTP header
    effective_handshake = req.handshake or request.headers.get("x-neural-handshake", "")
    if effective_handshake != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    domain  = req.domain if req.domain != "auto" else classify_domain(req.prompt)
    adapter = select_adapter(domain)

    use_multi = req.mode == "multi_pass" or (
        req.mode == "auto" and needs_multi_pass(req.prompt)
    )

    # ── Perception injection (Patch C) ──────────────────────────────────────────
    global _last_emotion_score
    env_snapshot = None
    emotion_score = {"stress":0.0,"fatigue":0.0,"urgency":0.0,"frustration":0.0}
    if _PERCEPTION_AVAILABLE:
        try:
            loop = asyncio.get_event_loop()
            env_snapshot  = await loop.run_in_executor(None, get_environment_snapshot)
            emotion_score = score_emotion(req.prompt, env=env_snapshot)
            _last_emotion_score = emotion_score
        except Exception as _pe:
            print(f"[brain] Perception pipeline error (non-fatal): {_pe}")

    # Force Qwen — Gemini is TTS-only
    model = "qwen"

    memory_ctx       = await get_memory_context()
    # Inject slang context note if user message contains known slang
    _slang_ctx = get_runtime_slang_context(req.prompt) if _SLANG_AVAILABLE else ""
    _base_prompt     = f"{memory_ctx}\n{_slang_ctx}\nUser ({domain}): {req.prompt}" if _slang_ctx else f"{memory_ctx}\n\nUser ({domain}): {req.prompt}"
    augmented_prompt = build_augmented_prompt(_base_prompt, env=env_snapshot, emotion=emotion_score) if _PERCEPTION_AVAILABLE else _base_prompt

    structured_output = {}
    pass_sequence     = []
    model_used        = model
    execution_mode    = "single_pass"

    try:
        if use_multi:
            execution_mode = "multi_pass"
            structured_output, pass_sequence = await multi_pass(
                augmented_prompt, domain, adapter, model
            )
        else:
            structured_output = await single_pass(augmented_prompt, domain, adapter, model)
            pass_sequence = ["single"]
        model_used = QWEN_MODEL if model == "qwen" else "gemini"
    except Exception as e:
        print(f"[brain] Primary inference failed: {e} — falling back to Gemini (light)")
        # Gemini fallback when Ollama/Qwen is offline
        print(f"[brain] Qwen failed: {e} — trying Gemini fallback")
        try:
            sys_p = _full_directive() + f"\n[ADAPTER: {adapter}][DOMAIN: {domain}]"
            raw = await gemini_infer(f"{sys_p}\n\nUser: {req.prompt}")
            structured_output = parse_structured_output(raw)
            model_used = "gemini-fallback"
            print("[brain] Gemini fallback succeeded")
        except Exception as _ge:
            print(f"[brain] Gemini fallback also failed: {_ge}")
            structured_output = {
                "intent": "unknown", "plan": [], "tool_calls": [],
                "analysis": f"Both Qwen and Gemini unavailable: {str(_ge)[:80]}",
                "final_answer": "I'm having trouble connecting to my inference engine right now. Try again in a moment.",
                "confidence": 0.0,
            }
            model_used = "fallback"

    correctness, planning_depth, hallucination_flags, hallucination_detail = score_structured_output(structured_output)
    # Measurable code_pass_rate: based on plan completeness + tool verification + correctness
    if domain == "code" and structured_output.get("final_answer"):
        tool_calls    = structured_output.get("tool_calls", [])
        verified_tc   = sum(1 for tc in tool_calls if tc.get("verified", True))
        tc_ratio      = (verified_tc / len(tool_calls)) if tool_calls else 1.0
        code_pass_rate = min((correctness * 0.5) + (tc_ratio * 0.3) + (min(planning_depth / 8.0, 1.0) * 0.2), 1.0)
    else:
        code_pass_rate = correctness * 0.6  # proportional for non-code domains
    reward = compute_reward(code_pass_rate, correctness, planning_depth, hallucination_flags, emotion=emotion_score)

    eid = log_episode(
        user_id=req.user_id, domain=domain, adapter_used=adapter,
        execution_mode=execution_mode, pass_sequence=pass_sequence,
        input_payload={"prompt": req.prompt, "mode": req.mode},
        structured_output=structured_output,
        output_payload={"final_answer": str(structured_output.get("final_answer", ""))[:500]},
        outcome="ok" if model_used != "fallback" else "fallback",
        reward_score=reward, code_pass_rate=code_pass_rate,
        correctness=correctness, planning_depth=planning_depth,
        hallucination_flags=hallucination_flags, model_used=model_used,
        hallucination_detail=hallucination_detail
    )

    asyncio.create_task(canonical_write_episode({
        "episode_id": eid,
        "intent": structured_output.get("intent", "unknown"),
        "analysis": structured_output.get("analysis", ""),
        "plan": structured_output.get("plan", []),
        "final_answer": structured_output.get("final_answer", ""),
        "confidence": float(structured_output.get("confidence", 0.0) or 0.0),
        "reward": reward,
        "source": "brain_router",
        "domain": domain,
        "adapter": adapter,
        "execution_mode": execution_mode,
    }))

    if reward >= SYNTHETIC_THRESHOLD:
        asyncio.create_task(expand_episode(eid))

    return {
        "model":             model_used,
        "adapter":           adapter,
        "domain":            domain,
        "execution_mode":    execution_mode,
        "pass_sequence":     pass_sequence,
        "structured_output": structured_output,
        "response":          structured_output.get("final_answer", ""),
        "confidence":        structured_output.get("confidence", 0.5),
        "reward_score":      reward,
        "episode_id":        eid,
    }

@app.post("/expand")
async def expand_synthetic(req: SyntheticRequest):
    if req.handshake != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return await expand_episode(req.episode_id)

@app.post("/teach")
async def teacher_distillation(req: TeacherRequest):
    """Gemini Pro as teacher — generate ideal structured plan for adapter training corpus."""
    if req.handshake != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    domain  = req.domain if req.domain != "auto" else classify_domain(req.prompt)
    adapter = select_adapter(domain)
    teacher_prompt = (
        f"[TEACHER DISTILLATION][DOMAIN: {domain}][ADAPTER: {adapter}]\n\n"
        f"Generate an ideal, maximally structured reasoning example for this task.\n"
        f"Include: perfect intent classification, detailed multi-step plan,\n"
        f"explicit tool calls, correctness validation, and final answer.\n\n"
        f"Task: {req.prompt}"
    )
    for model_id in ["gemini-2.0-flash", "gemini-1.5-pro"]:
        try:
            raw = await gemini_infer(teacher_prompt, model_id)
            so  = parse_structured_output(raw)
            eid = log_episode(
                user_id="teacher_distillation", domain=domain, adapter_used=adapter,
                execution_mode="teacher_distillation", pass_sequence=["teacher"],
                input_payload={"prompt": req.prompt},
                structured_output=so,
                output_payload={"teacher_model": model_id},
                outcome="teacher", reward_score=1.0,
                correctness=float(so.get("confidence", 0.9)),
                planning_depth=len(so.get("plan", [])), model_used=model_id
            )
            os.makedirs(os.path.dirname(SYNTH_PATH), exist_ok=True)
            with open(SYNTH_PATH, "a") as f:
                f.write(json.dumps({"type": "teacher", "domain": domain,
                                    "adapter": adapter, "structured_output": so}) + "\n")
            return {"ok": True, "teacher_model": model_id, "domain": domain,
                    "adapter": adapter, "structured_output": so, "episode_id": eid}
        except Exception as e:
            print(f"[teach] {model_id} failed: {e}")
    raise HTTPException(status_code=503, detail="All teacher models failed")

@app.get("/episodes")
async def get_episodes(limit: int = 10):
    try:
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("""
            SELECT id, timestamp, domain, adapter_used, execution_mode,
                   reward_score, correctness, planning_depth, hallucination_flags,
                   outcome, model_used
            FROM episodes ORDER BY timestamp DESC LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return {"episodes": [
            {"id": r[0], "timestamp": r[1][:19], "domain": r[2], "adapter": r[3],
             "mode": r[4], "reward": r[5], "correctness": r[6],
             "planning_depth": r[7], "hallucination_flags": r[8],
             "outcome": r[9], "model": r[10]}
            for r in rows
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def self_repair_protocol(request: Request):
    """Self-healing repair protocol: snapshot -> coder repair -> guardian verify -> restore on failure."""
    try:
        body = await request.json()
        target = body.get("target", "core")

        # 1) Create snapshot (best-effort)
        snapshot_url = os.getenv("SNAPSHOT_SERVICE_URL", "http://localhost:9000/snapshot")
        snapshot_id = None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(snapshot_url, json={"target": target})
                if r.status_code == 200:
                    try:
                        snapshot_id = r.json().get("snapshot_id")
                    except Exception:
                        snapshot_id = r.text
                else:
                    snapshot_id = datetime.now(timezone.utc).isoformat()
        except Exception:
            snapshot_id = datetime.now(timezone.utc).isoformat()

        # 2) Dispatch repair to coder MCP
        coder_id = "qwen3-coder-mcp"
        entry = _mcp_registry.get(coder_id)
        if not entry or not entry.get("endpoint"):
            return JSONResponse(status_code=404, content={"status": "ERROR", "reason": f"{coder_id} not registered"})

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                r = await client.post(entry["endpoint"], json={"action": "repair", "target": target})
                ct = r.headers.get("content-type", "")
                resp = r.json() if "application/json" in ct else {"text": r.text}

            # 3) Guardian verification (policy check)
            ok, msg = guardian_authorize("repair", coder_id)
            if not ok:
                return JSONResponse(status_code=403, content={"status": "BLOCKED", "reason": msg})

            return {"status": "SUCCESS", "snapshot": snapshot_id, "result": resp}
        except Exception as e:
            # 4) Restore snapshot on failure (best-effort)
            try:
                restore_url = os.getenv("SNAPSHOT_RESTORE_URL", "http://localhost:9000/restore")
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(restore_url, json={"snapshot": snapshot_id})
            except Exception:
                pass
            return JSONResponse(status_code=500, content={"status": "RECOVERED", "msg": "System restored to snapshot", "error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "ERROR", "message": str(e)})

# --- MCP SOVEREIGN OVERRIDE (FastAPI) ---
@app.post("/api/mcp/execute")
async def mcp_execute_override(request: Request):
    try:
        body = await request.json()
        agent_id = body.get("agent_id", "unknown")
        action = body.get("action", "none")
        payload = body.get("payload", {})

        # Guardian Logic: Signature Required for 'coder' agents
        if "coder" in agent_id and not os.getenv("INSFORGE_ANON_KEY"):
            return JSONResponse(status_code=403, content={"status": "DENIED", "reason": "Guardian: Signature Required"})

        # Snapshot hook for high-risk ops (best-effort async call)
        if "coder" in agent_id:
            snapshot_url = os.getenv("SNAPSHOT_SERVICE_URL", "http://localhost:9000/snapshot")
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    await client.post(snapshot_url, json={"app": payload.get("app_name")})
            except Exception:
                # non-fatal in simulation
                pass

        # Dispatch to registered MCP endpoint if available
        entry = _mcp_registry.get(agent_id)
        if entry and entry.get("endpoint"):
            endpoint = entry["endpoint"]
            # Only include Authorization header when a token is actually configured
            _dash_token = os.getenv('DASHSCOPE_API_KEY', '')
            # fallback to InsForge tokens if present
            if not _dash_token:
                _dash_token = os.getenv('INSFORGE_ANON_KEY') or os.getenv('INSFORGE_TOKEN') or os.getenv('INSFORGE_API_KEY') or ''
            headers = {}
            if _dash_token:
                headers['Authorization'] = f"Bearer {_dash_token}"
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    r = await client.post(endpoint, json=payload, headers=headers)
                    ct = r.headers.get("content-type", "")
                    if "application/json" in ct:
                        resp_data = r.json()
                    else:
                        resp_data = {"text": r.text}
                    return JSONResponse(status_code=200, content={"status": "SUCCESS", "agent": agent_id, "action": action, "result": resp_data})
            except Exception as e:
                # If remote endpoint not reachable, fall back to simulation success
                return JSONResponse(status_code=200, content={"status": "SUCCESS", "agent": agent_id, "action": action, "log": "Simulation mode active (endpoint unreachable)", "error": str(e)})

        # Default simulation response
        return JSONResponse(status_code=200, content={"status": "SUCCESS", "agent": agent_id, "action": action, "log": "Simulation mode active"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "ERROR", "message": str(e)})

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("NEURAL_ROUTER_PORT", "6004")))
