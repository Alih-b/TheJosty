#!/usr/bin/env python3
"""Report cumulative unique Josty-result URLs and per-round contributions."""
from __future__ import annotations
import json
from collections import defaultdict
from pathlib import Path

LEDGER = Path(__file__).with_name("ledger.jsonl")

rows = [json.loads(line) for line in LEDGER.read_text().splitlines() if line.strip()]
seen: set[str] = set()
by_round: dict[int, dict[str, int]] = defaultdict(lambda: {"queries": 0, "results": 0, "new_unique": 0})
for row in rows:
    round_no = int(row.get("round", 0))
    stats = by_round[round_no]
    stats["queries"] += 1
    urls = {item.get("url") for item in row.get("results", []) if item.get("url")}
    stats["results"] += len(urls)
    stats["new_unique"] += len(urls - seen)
    seen.update(urls)

print(json.dumps({
    "ledger_queries": len(rows),
    "result_entries": sum(v["results"] for v in by_round.values()),
    "unique_source_urls": len(seen),
    "target": 800,
    "remaining": max(0, 800 - len(seen)),
    "by_round": by_round,
}, indent=2, sort_keys=True))
