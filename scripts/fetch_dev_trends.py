"""
Agent Lee — Continuous Learning Pipeline
fetch_dev_trends.py

Pulls trending signals from GitHub, Hugging Face, Reddit, and Papers With Code.
Saves structured output to workspace/knowledge/dev_trends.json with credit entries.

Run manually:  python scripts/fetch_dev_trends.py
Scheduled:     Task Scheduler / pm2 / cron — nightly at 02:00 local
"""

import json
import time
import hashlib
import datetime
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows consoles
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
except ImportError:
    sys.exit("requests not installed. Run: pip install requests")

# ─── paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = ROOT / "workspace" / "knowledge"
KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE    = KNOWLEDGE_DIR / "dev_trends.json"
GRATITUDE_FILE = KNOWLEDGE_DIR / "gratitude_log.json"

# ─── config ───────────────────────────────────────────────────────────────────
GITHUB_TOKEN   = os.getenv("GITHUB_PAT", "")          # optional — raises rate limit 60→5000/hr
HF_TOKEN       = os.getenv("HF_TOKEN", "")             # optional — for private model access
REDDIT_HEADERS = {"User-Agent": "AgentLee/2.0 (+https://agentlee.rapidwebdevelop.com)"}

SUBREDDITS = [
    "programming",
    "MachineLearning",
    "learnmachinelearning",
    "devops",
    "LocalLLaMA",
    "artificial",
]

GITHUB_TOPICS = [
    "large-language-models",
    "ai-agents",
    "llm",
    "agentic-ai",
    "openai",
]

SAFETY_BLOCKLIST = [
    "malware", "exploit", "hack", "backdoor", "keylogger",
    "ransomware", "phishing", "trojan", "rootkit",
]

def _safe_get(url: str, headers: dict = None, params: dict = None, timeout: int = 15) -> dict | list | None:
    try:
        r = requests.get(url, headers=headers, params=params, timeout=timeout)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  [WARN] {url}: {e}")
        return None


def _is_safe(text: str) -> bool:
    lower = text.lower()
    return not any(word in lower for word in SAFETY_BLOCKLIST)


# ─── GitHub Trending (via GitHub Search API) ──────────────────────────────────
def fetch_github_trending() -> list[dict]:
    print("  → GitHub trending repos…")
    results = []
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    # Search by topic, sorted by stars, created in the last 7 days
    week_ago = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    for topic in GITHUB_TOPICS:
        data = _safe_get(
            "https://api.github.com/search/repositories",
            headers=headers,
            params={
                "q": f"topic:{topic} created:>{week_ago}",
                "sort": "stars",
                "order": "desc",
                "per_page": 10,
            },
        )
        if not data:
            continue
        for item in (data.get("items") or []):
            desc = item.get("description") or ""
            if not _is_safe(desc):
                continue
            results.append({
                "name": item.get("full_name"),
                "description": desc,
                "stars": item.get("stargazers_count"),
                "url": item.get("html_url"),
                "language": item.get("language"),
                "topic": topic,
                "source": "GitHub Search API",
            })
        time.sleep(0.5)  # stay well under rate limit wall

    # Deduplicate by name
    seen = set()
    unique = []
    for r in results:
        if r["name"] not in seen:
            seen.add(r["name"])
            unique.append(r)
    print(f"     {len(unique)} repos discovered across {len(GITHUB_TOPICS)} topics")
    return unique


# ─── Hugging Face — newest models ─────────────────────────────────────────────
def fetch_hf_models(limit: int = 30) -> list[dict]:
    print("  → Hugging Face models (newest)…")
    headers = {}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"

    data = _safe_get(
        "https://huggingface.co/api/models",
        headers=headers,
        params={"sort": "createdAt", "direction": -1, "limit": limit},
    )
    if not data:
        return []

    results = []
    for item in data:
        model_id = item.get("modelId") or item.get("id") or ""
        tags = item.get("tags") or []
        if not _is_safe(model_id + " " + " ".join(tags)):
            continue
        results.append({
            "model_id": model_id,
            "author": item.get("author"),
            "downloads": item.get("downloads"),
            "likes": item.get("likes"),
            "tags": tags[:10],
            "created_at": item.get("createdAt"),
            "url": f"https://huggingface.co/{model_id}",
            "source": "Hugging Face API",
        })

    print(f"     {len(results)} models fetched")
    return results


# ─── Reddit hot posts ──────────────────────────────────────────────────────────
def fetch_reddit_posts(subreddit: str, limit: int = 20) -> list[dict]:
    url = f"https://www.reddit.com/r/{subreddit}/hot.json"
    data = _safe_get(url, headers=REDDIT_HEADERS, params={"limit": limit})
    if not data:
        return []

    posts = []
    for child in (data.get("data", {}).get("children") or []):
        p = child.get("data", {})
        title = p.get("title", "")
        if not _is_safe(title):
            continue
        posts.append({
            "title": title,
            "score": p.get("score"),
            "num_comments": p.get("num_comments"),
            "url": f"https://reddit.com{p.get('permalink')}",
            "subreddit": subreddit,
            "source": "Reddit API",
        })
    return posts


def fetch_all_reddit() -> dict[str, list]:
    print(f"  → Reddit ({', '.join(SUBREDDITS)})…")
    combined = {}
    for sub in SUBREDDITS:
        combined[sub] = fetch_reddit_posts(sub)
        time.sleep(1.5)  # Reddit rate-limit buffer
    total = sum(len(v) for v in combined.values())
    print(f"     {total} posts across {len(SUBREDDITS)} subreddits")
    return combined


# ─── arXiv — latest AI/LLM papers (fully open, no auth) ──────────────────────
def fetch_papers_with_code(limit: int = 20) -> list[dict]:
    print("  -> Recent AI papers (arXiv, open access)...")
    import xml.etree.ElementTree as ET
    NS = "{http://www.w3.org/2005/Atom}"
    queries = [
        "ti:(large language model OR LLM OR agentic AI)",
        "ti:(AI agent OR autonomous agent OR multi-agent)",
    ]
    papers = []
    seen: set[str] = set()
    for query in queries:
        if len(papers) >= limit:
            break
        try:
            r = requests.get(
                "https://export.arxiv.org/api/query",
                params={
                    "search_query": query,
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                    "max_results": limit // len(queries) + 5,
                },
                headers={"User-Agent": "AgentLee/2.0 (learning-pipeline)"},
                timeout=15,
            )
            r.raise_for_status()
            root = ET.fromstring(r.text)
            for entry in root.findall(f"{NS}entry"):
                title = (entry.findtext(f"{NS}title") or "").strip().replace("\n", " ")
                if title in seen or not _is_safe(title):
                    continue
                seen.add(title)
                abstract = (entry.findtext(f"{NS}summary") or "").strip()[:300]
                link = ""
                for lnk in entry.findall(f"{NS}link"):
                    if lnk.get("type") == "text/html":
                        link = lnk.get("href", "")
                published = (entry.findtext(f"{NS}published") or "")[:10]
                papers.append({
                    "title": title,
                    "abstract": abstract,
                    "paper_url": link,
                    "published": published,
                    "source": "arXiv API",
                })
        except Exception as e:
            print(f"  [WARN] arXiv query failed: {e}")
        time.sleep(0.5)

    papers = papers[:limit]
    print(f"     {len(papers)} papers from arXiv")
    return papers


# ─── Gratitude log helpers ─────────────────────────────────────────────────────
def _load_gratitude_log() -> list:
    if GRATITUDE_FILE.exists():
        try:
            return json.loads(GRATITUDE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return []


def _append_gratitude(log: list, entries: list[dict]) -> None:
    log.extend(entries)
    GRATITUDE_FILE.write_text(json.dumps(log, indent=2, ensure_ascii=False), encoding="utf-8")


def _build_gratitude_entries(github: list, hf: list, papers: list) -> list[dict]:
    """Emit one appreciation entry per notable discovery."""
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    entries = []

    for repo in github[:5]:
        entries.append({
            "source": repo["name"],
            "category": "open_source_repo",
            "date": now,
            "key_insights": repo.get("description", ""),
            "appreciation": (
                f"I recognize the engineering effort behind {repo['name']}. "
                f"Its contribution to the open-source AI ecosystem is valuable and noted."
            ),
            "source_url": repo.get("url"),
            "verified": True,
        })

    for model in hf[:3]:
        entries.append({
            "source": model["model_id"],
            "category": "open_model",
            "date": now,
            "key_insights": f"Tags: {', '.join(model.get('tags', [])[:5])}",
            "appreciation": (
                f"I acknowledge {model.get('author', 'the community')} for releasing "
                f"{model['model_id']}. Open model releases expand AI access for everyone."
            ),
            "source_url": model.get("url"),
            "verified": True,
        })

    for paper in papers[:3]:
        entries.append({
            "source": paper["title"],
            "category": "research_paper",
            "date": now,
            "key_insights": paper.get("abstract", ""),
            "appreciation": (
                "I respect the research effort behind this paper. Academic contributions "
                "advance our collective understanding and inspire safe improvements."
            ),
            "source_url": paper.get("paper_url"),
            "verified": True,
        })

    return entries


# ─── main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=== Agent Lee -- Continuous Learning Pipeline ===")
    start = time.time()

    github  = fetch_github_trending()
    hf      = fetch_hf_models()
    reddit  = fetch_all_reddit()
    papers  = fetch_papers_with_code()

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    payload = {
        "fetched_at": now_iso,
        "schema_version": "2.0",
        "source": "Agent Lee Continuous Learning Pipeline",
        "github_trending": github,
        "huggingface_models": hf,
        "reddit_posts": reddit,
        "papers_with_code": papers,
        "summary": {
            "github_repos": len(github),
            "hf_models": len(hf),
            "reddit_posts": sum(len(v) for v in reddit.values()),
            "papers": len(papers),
        },
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n✅ Saved → {OUTPUT_FILE}")
    print(f"   Repos: {len(github)}  |  Models: {len(hf)}  |  Papers: {len(papers)}")

    # Gratitude log
    gratitude_log = _load_gratitude_log()
    new_entries = _build_gratitude_entries(github, hf, papers)
    _append_gratitude(gratitude_log, new_entries)
    print(f"   Gratitude entries appended: {len(new_entries)} → {GRATITUDE_FILE}")

    elapsed = round(time.time() - start, 1)
    print(f"   Completed in {elapsed}s")


if __name__ == "__main__":
    main()
