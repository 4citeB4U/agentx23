# LEEWAY HEADER BLOCK
# File: scripts/migrate_to_vercel_memory_lake.py
# Purpose: Migrate local Agent Lee memory surfaces into canonical Vercel Memory Lake endpoints
# Security: LEEWAY-CORE-2026 compliant
# Performance: Batch-safe, idempotent-friendly migration utility

import argparse
import json
import os
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

import httpx

BASE_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = BASE_DIR / "workspace"

DEFAULTS = {
    "memory": WORKSPACE_DIR / "memory.json",
    "episodes": WORKSPACE_DIR / "episodes.db",
    "missions": WORKSPACE_DIR / "mission_queue.json",
    "synthetic": WORKSPACE_DIR / "synthetic.jsonl",
    "adapters": WORKSPACE_DIR / "adapters.json",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path):
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8", errors="replace") as f:
        return json.load(f)


def iter_jsonl(path: Path):
    if not path.exists():
        return
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except Exception:
                continue


def post_json(client: httpx.Client, base_url: str, api_key: str, route: str, payload: dict, dry_run: bool = False) -> tuple[bool, str]:
    if dry_run:
        return True, "dry-run"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-memory-key"] = api_key
        headers["authorization"] = f"Bearer {api_key}"
    try:
        r = client.post(f"{base_url}{route}", json=payload, headers=headers)
        if r.is_success:
            return True, str(r.status_code)
        return False, f"{r.status_code} {r.text[:180]}"
    except Exception as e:
        return False, str(e)


def migrate_memory_nodes(client: httpx.Client, base_url: str, api_key: str, path: Path, dry_run: bool):
    data = load_json(path)
    if not data:
        return {"attempted": 0, "ok": 0, "failed": 0}

    rows = data if isinstance(data, list) else [data]
    ok = 0
    failed = 0
    for idx, item in enumerate(rows):
        payload = {
            "type": "memory",
            "title": str((item or {}).get("title") or f"memory-{idx+1}"),
            "summary": str((item or {}).get("content") or (item or {}).get("summary") or ""),
            "tags": (item or {}).get("tags") or ["agentlee", "memory"],
            "metadata": item or {},
        }
        success, _ = post_json(client, base_url, api_key, "/api/memory/node", payload, dry_run=dry_run)
        ok += int(success)
        failed += int(not success)
    return {"attempted": len(rows), "ok": ok, "failed": failed}


def migrate_episodes(client: httpx.Client, base_url: str, api_key: str, db_path: Path, dry_run: bool, limit: int):
    if not db_path.exists():
        return {"attempted": 0, "ok": 0, "failed": 0}

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, timestamp, domain, adapter_used, execution_mode,
               structured_output, output_payload, reward_score, correctness
        FROM episodes
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = cur.fetchall()
    conn.close()

    ok = 0
    failed = 0
    for row in rows:
        structured_output = {}
        output_payload = {}
        try:
            structured_output = json.loads(row["structured_output"] or "{}")
        except Exception:
            structured_output = {}
        try:
            output_payload = json.loads(row["output_payload"] or "{}")
        except Exception:
            output_payload = {}

        payload = {
            "episode_id": row["id"],
            "intent": structured_output.get("intent", "unknown"),
            "analysis": structured_output.get("analysis", ""),
            "plan": structured_output.get("plan", []),
            "final_answer": structured_output.get("final_answer") or output_payload.get("final_answer") or "",
            "confidence": float(structured_output.get("confidence", row["correctness"] or 0.0) or 0.0),
            "reward": float(row["reward_score"] or 0.0),
            "source": "episodes.db",
            "domain": row["domain"],
            "adapter": row["adapter_used"],
            "execution_mode": row["execution_mode"],
            "created_at": row["timestamp"],
        }
        success, _ = post_json(client, base_url, api_key, "/api/memory/episode", payload, dry_run=dry_run)
        ok += int(success)
        failed += int(not success)

    return {"attempted": len(rows), "ok": ok, "failed": failed}


def migrate_missions(client: httpx.Client, base_url: str, api_key: str, path: Path, dry_run: bool):
    data = load_json(path)
    if not data:
        return {"attempted": 0, "ok": 0, "failed": 0}

    rows = data if isinstance(data, list) else [data]
    ok = 0
    failed = 0
    for mission in rows:
        payload = {
            "goal": (mission or {}).get("goal") or (mission or {}).get("type") or "mission",
            "context": mission or {},
            "status": (mission or {}).get("status") or "pending",
            "priority": int((mission or {}).get("priority") or 1),
            "created_at": (mission or {}).get("queued_at") or now_iso(),
        }
        success, _ = post_json(client, base_url, api_key, "/api/memory/mission", payload, dry_run=dry_run)
        ok += int(success)
        failed += int(not success)

    return {"attempted": len(rows), "ok": ok, "failed": failed}


def migrate_synthetic(client: httpx.Client, base_url: str, api_key: str, path: Path, dry_run: bool, limit: int):
    rows = list(iter_jsonl(path))
    if not rows:
        return {"attempted": 0, "ok": 0, "failed": 0}

    rows = rows[:limit]
    ok = 0
    failed = 0
    for row in rows:
        payload = {
            "episode_id": row.get("episode_id") or "",
            "prompt": row.get("prompt") or row.get("instruction") or row.get("variant_type") or "",
            "response": row.get("response") or row.get("output") or json.dumps(row.get("structured_output") or {}),
            "reward": float(row.get("reward") or 0.0),
            "variant_type": row.get("variant_type") or row.get("generation_type") or row.get("source") or "synthetic",
            "created_at": row.get("created_at") or now_iso(),
            "metadata": row,
        }
        success, _ = post_json(client, base_url, api_key, "/api/memory/synthetic", payload, dry_run=dry_run)
        ok += int(success)
        failed += int(not success)

    return {"attempted": len(rows), "ok": ok, "failed": failed}


def migrate_adapters(client: httpx.Client, base_url: str, api_key: str, path: Path, dry_run: bool):
    data = load_json(path)
    if not data:
        return {"attempted": 0, "ok": 0, "failed": 0}

    adapters = data.get("adapters") if isinstance(data, dict) else None
    if not isinstance(adapters, dict):
        return {"attempted": 0, "ok": 0, "failed": 0}

    ok = 0
    failed = 0
    attempted = 0
    for domain, cfg in adapters.items():
        if not isinstance(cfg, dict):
            continue
        attempted += 1
        payload = {
            "domain": domain,
            "path": cfg.get("path") or "",
            "enabled": bool(cfg.get("active", cfg.get("enabled", False))),
            "performance_score": float(cfg.get("performance_score") or 0.0),
            "last_updated": now_iso(),
            "metadata": cfg,
        }
        success, _ = post_json(client, base_url, api_key, "/api/memory/adapter", payload, dry_run=dry_run)
        ok += int(success)
        failed += int(not success)

    return {"attempted": attempted, "ok": ok, "failed": failed}


def main():
    parser = argparse.ArgumentParser(description="Migrate local Agent Lee memory surfaces to Vercel Memory Lake")
    parser.add_argument("--base-url", default=os.getenv("CANONICAL_MEMORY_BASE_URL", ""), help="Canonical memory base URL, e.g. https://your-app.vercel.app")
    parser.add_argument("--api-key", default=os.getenv("CANONICAL_MEMORY_API_KEY", ""), help="Optional API key for memory gateway")
    parser.add_argument("--episode-limit", type=int, default=1000)
    parser.add_argument("--synthetic-limit", type=int, default=5000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.base_url:
        raise SystemExit("Missing --base-url (or CANONICAL_MEMORY_BASE_URL env var)")

    base_url = args.base_url.rstrip("/")
    summary = {}

    with httpx.Client(timeout=15.0) as client:
        summary["memory_nodes"] = migrate_memory_nodes(client, base_url, args.api_key, DEFAULTS["memory"], args.dry_run)
        summary["episodes"] = migrate_episodes(client, base_url, args.api_key, DEFAULTS["episodes"], args.dry_run, args.episode_limit)
        summary["missions"] = migrate_missions(client, base_url, args.api_key, DEFAULTS["missions"], args.dry_run)
        summary["synthetic"] = migrate_synthetic(client, base_url, args.api_key, DEFAULTS["synthetic"], args.dry_run, args.synthetic_limit)
        summary["adapters"] = migrate_adapters(client, base_url, args.api_key, DEFAULTS["adapters"], args.dry_run)

    print(json.dumps({"ok": True, "dry_run": args.dry_run, "summary": summary}, indent=2))


if __name__ == "__main__":
    main()
