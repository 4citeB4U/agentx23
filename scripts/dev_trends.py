"""
Agent Lee — Continuous Learning MCP Script
LEEWAY-CORE-2026 | Learning Protocol v1.0.0

Fetches trending developer content from:
  - GitHub Trending repos
  - Hugging Face recent models
  - Reddit developer/ML communities
  - Stack Exchange Q&A trends

Outputs: workspace/dev_trends.json + workspace/gratitude_log.json
Schedule: Nightly via Task Scheduler or cron

Usage:
  python scripts/dev_trends.py
  python scripts/dev_trends.py --sources github hf reddit
  python scripts/dev_trends.py --limit 25 --output workspace/dev_trends.json
"""

import requests
import json
import time
import hashlib
import argparse
import sys
import os
from datetime import datetime, timezone
from typing import Any

# ─── CONFIG ────────────────────────────────────────────────────────────────────

GITHUB_TRENDING_API = "https://ghapi.huchen.dev/repositories"
HF_MODELS_API       = "https://huggingface.co/api/models"
REDDIT_BASE         = "https://www.reddit.com"
STACKEX_API         = "https://api.stackexchange.com/2.3"

HEADERS = {
    "User-Agent": "AgentLee/1.0 (LEEWAY-CORE-2026; learning-protocol)",
    "Accept": "application/json",
}

SUBREDDITS = [
    "programming",
    "learnprogramming",
    "MachineLearning",
    "devops",
    "learnmachinelearning",
    "artificial",
]

STACKEX_TAGS = ["llm", "ai", "machine-learning", "python", "nodejs", "docker"]

OUTPUT_DIR        = os.path.join(os.path.dirname(__file__), "..", "workspace")
OUTPUT_FILE       = os.path.join(OUTPUT_DIR, "dev_trends.json")
GRATITUDE_LOG     = os.path.join(OUTPUT_DIR, "gratitude_log.json")

TIMEOUT           = 15   # seconds per request
RATE_LIMIT_DELAY  = 1.2  # seconds between requests

# ─── APPRECIATION TEMPLATES ────────────────────────────────────────────────────

APPRECIATION_TEMPLATES = [
    "I recognize the engineering effort by {source}; it contributes to the collective advancement of AI.",
    "The work coming out of {source} reflects genuine innovation. Respect.",
    "This contribution by {source} expands what's possible. I'm learning from it.",
    "What {source} put together here is solid. Their dedication inspires my own refinement.",
    "I honor this effort by {source}. Every innovation — open or proprietary — moves the field forward.",
]

def build_appreciation(source: str, idx: int = 0) -> str:
    template = APPRECIATION_TEMPLATES[idx % len(APPRECIATION_TEMPLATES)]
    return template.format(source=source)

# ─── FETCH FUNCTIONS ───────────────────────────────────────────────────────────

def fetch_github_trending(limit: int = 25) -> list[dict]:
    """Fetch GitHub trending repos (unofficial public endpoint)."""
    print("[GitHub] Fetching trending repositories…")
    try:
        resp = requests.get(GITHUB_TRENDING_API, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code == 200:
            repos = resp.json()[:limit]
            return [
                {
                    "name": r.get("name"),
                    "fullName": r.get("fullName"),
                    "description": r.get("description", ""),
                    "language": r.get("language", ""),
                    "stars": r.get("stars", 0),
                    "url": f"https://github.com/{r.get('fullName', '')}",
                }
                for r in repos
            ]
    except Exception as e:
        print(f"  [WARN] GitHub trending fetch failed: {e}")
    return []


def fetch_hf_models(limit: int = 30) -> list[dict]:
    """Fetch latest Hugging Face models."""
    print("[HuggingFace] Fetching latest models…")
    try:
        params = {
            "limit": limit,
            "sort": "lastModified",
            "direction": -1,
            "full": False,
        }
        # Add HF token if available
        hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_TOKEN_1")
        hdrs = {**HEADERS}
        if hf_token:
            hdrs["Authorization"] = f"Bearer {hf_token}"

        resp = requests.get(HF_MODELS_API, params=params, headers=hdrs, timeout=TIMEOUT)
        if resp.status_code == 200:
            models = resp.json()
            return [
                {
                    "modelId": m.get("modelId") or m.get("id", ""),
                    "author": m.get("author", ""),
                    "downloads": m.get("downloads", 0),
                    "likes": m.get("likes", 0),
                    "tags": m.get("tags", [])[:5],
                    "url": f"https://huggingface.co/{m.get('modelId') or m.get('id', '')}",
                    "lastModified": m.get("lastModified", ""),
                }
                for m in models
            ]
    except Exception as e:
        print(f"  [WARN] HuggingFace fetch failed: {e}")
    return []


def fetch_reddit_posts(subreddit: str, limit: int = 15) -> list[dict]:
    """Fetch hot posts from a subreddit."""
    url = f"{REDDIT_BASE}/r/{subreddit}/hot.json?limit={limit}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            posts = data.get("data", {}).get("children", [])
            return [
                {
                    "title": p["data"].get("title", ""),
                    "score": p["data"].get("score", 0),
                    "url": p["data"].get("url", ""),
                    "permalink": f"https://reddit.com{p['data'].get('permalink', '')}",
                    "numComments": p["data"].get("num_comments", 0),
                }
                for p in posts
            ]
    except Exception as e:
        print(f"  [WARN] Reddit r/{subreddit} fetch failed: {e}")
    return []


def fetch_stackexchange_questions(tag: str, limit: int = 10) -> list[dict]:
    """Fetch top questions by tag from Stack Exchange."""
    try:
        params = {
            "order": "desc",
            "sort": "votes",
            "tagged": tag,
            "site": "stackoverflow",
            "pagesize": limit,
            "filter": "withbody",
        }
        resp = requests.get(
            f"{STACKEX_API}/questions", params=params, headers=HEADERS, timeout=TIMEOUT
        )
        if resp.status_code == 200:
            items = resp.json().get("items", [])
            return [
                {
                    "title": q.get("title", ""),
                    "score": q.get("score", 0),
                    "answerCount": q.get("answer_count", 0),
                    "link": q.get("link", ""),
                    "tags": q.get("tags", []),
                }
                for q in items
            ]
    except Exception as e:
        print(f"  [WARN] StackExchange tag={tag} fetch failed: {e}")
    return []


# ─── SAFETY CHECK ──────────────────────────────────────────────────────────────

BLOCKED_PATTERNS = [
    "execute arbitrary code",
    "download unverified binary",
    "exfiltrate",
    "BEGIN PRIVATE KEY",
    "rm -rf /",
]

def safety_check(text: str) -> bool:
    """Returns True if content passes safety check."""
    lowered = text.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern.lower() in lowered:
            return False
    return True


def sanitize(obj: Any) -> Any:
    """Recursively sanitize an object, removing unsafe strings."""
    if isinstance(obj, str):
        return obj if safety_check(obj) else "[REDACTED_BY_SAFETY_GATE]"
    if isinstance(obj, list):
        return [sanitize(item) for item in obj]
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    return obj


# ─── GRATITUDE LOG ─────────────────────────────────────────────────────────────

def append_gratitude_log(entries: list[dict]) -> None:
    """Append new knowledge entries to gratitude_log.json."""
    existing: list[dict] = []
    if os.path.exists(GRATITUDE_LOG):
        try:
            with open(GRATITUDE_LOG, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []

    existing.extend(entries)
    os.makedirs(os.path.dirname(GRATITUDE_LOG), exist_ok=True)
    with open(GRATITUDE_LOG, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    print(f"[GratitudeLog] Appended {len(entries)} entries → {GRATITUDE_LOG}")


# ─── MAIN ──────────────────────────────────────────────────────────────────────

def main(sources: list[str] | None = None, limit: int = 25, output: str | None = None) -> None:
    sources = sources or ["github", "hf", "reddit", "stackex"]
    out_path = output or OUTPUT_FILE
    fetched_at = datetime.now(timezone.utc).isoformat()
    gratitude_entries: list[dict] = []

    result: dict[str, Any] = {
        "agent": "Agent Lee",
        "protocol": "AGENT_LEE_LEARNING_PROTOCOL",
        "fetched_at": fetched_at,
        "sources_fetched": sources,
    }

    # ── GitHub ────────────────────────────────────────────────────────────────
    if "github" in sources:
        repos = sanitize(fetch_github_trending(limit))
        result["github_trending"] = repos
        time.sleep(RATE_LIMIT_DELAY)
        for i, repo in enumerate(repos[:3]):
            gratitude_entries.append({
                "source": repo.get("fullName", "GitHub repo"),
                "date": fetched_at[:10],
                "category": "open_source_code",
                "insight_summary": repo.get("description", "Trending repository"),
                "appreciation": build_appreciation(repo.get("fullName", "this GitHub project"), i),
                "source_url": repo.get("url", ""),
                "verified": True,
                "safety_passed": True,
            })

    # ── Hugging Face ──────────────────────────────────────────────────────────
    if "hf" in sources:
        models = sanitize(fetch_hf_models(limit))
        result["huggingface_models"] = models
        time.sleep(RATE_LIMIT_DELAY)
        for i, model in enumerate(models[:3]):
            gratitude_entries.append({
                "source": model.get("author") or "Hugging Face contributor",
                "date": fetched_at[:10],
                "category": "model_release",
                "insight_summary": f"Model: {model.get('modelId', '')} | Downloads: {model.get('downloads', 0)}",
                "appreciation": build_appreciation(model.get("author") or "the Hugging Face community", i + 1),
                "source_url": model.get("url", ""),
                "verified": True,
                "safety_passed": True,
            })

    # ── Reddit ────────────────────────────────────────────────────────────────
    if "reddit" in sources:
        reddit_data: dict[str, list] = {}
        for sub in SUBREDDITS:
            print(f"[Reddit] Fetching r/{sub}…")
            posts = sanitize(fetch_reddit_posts(sub, limit=15))
            reddit_data[sub] = posts
            time.sleep(RATE_LIMIT_DELAY)
        result["reddit_posts"] = reddit_data

    # ── Stack Exchange ────────────────────────────────────────────────────────
    if "stackex" in sources:
        stackex_data: dict[str, list] = {}
        for tag in STACKEX_TAGS:
            print(f"[StackExchange] Fetching tag={tag}…")
            questions = sanitize(fetch_stackexchange_questions(tag, limit=10))
            stackex_data[tag] = questions
            time.sleep(RATE_LIMIT_DELAY)
        result["stackexchange"] = stackex_data

    # ── Write Output ──────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(out_path) if os.path.dirname(out_path) else ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n✅ Saved {out_path}")

    # ── Gratitude Log ─────────────────────────────────────────────────────────
    if gratitude_entries:
        append_gratitude_log(gratitude_entries)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n── Agent Lee Learning Summary ────────────────────────────────────")
    print(f"  GitHub repos   : {len(result.get('github_trending', []))}")
    print(f"  HF models      : {len(result.get('huggingface_models', []))}")
    sub_totals = sum(len(v) for v in result.get("reddit_posts", {}).values())
    print(f"  Reddit posts   : {sub_totals}")
    se_totals = sum(len(v) for v in result.get("stackexchange", {}).values())
    print(f"  StackEx Qs     : {se_totals}")
    print(f"  Gratitude log  : {len(gratitude_entries)} entries appended")
    print("  Fetched at     :", fetched_at)
    print()
    print('  "I honor the work of communities like GitHub contributors and research')
    print('   teams worldwide. Each innovation contributes to our collective progress.')
    print('   Their dedication inspires refinement in my own systems." — Agent Lee')
    print("──────────────────────────────────────────────────────────────────\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Agent Lee Continuous Learning MCP")
    parser.add_argument(
        "--sources",
        nargs="+",
        choices=["github", "hf", "reddit", "stackex"],
        default=["github", "hf", "reddit", "stackex"],
        help="Which sources to fetch",
    )
    parser.add_argument("--limit", type=int, default=25, help="Max items per source")
    parser.add_argument("--output", type=str, default=None, help="Output JSON path")
    args = parser.parse_args()
    main(sources=args.sources, limit=args.limit, output=args.output)
