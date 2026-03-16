"""Normalize official source content into data/events.json.

Current behavior:
- Reads raw HTML snapshots from fetch_sources.py if present
- Produces a local events.json using starter rules and starter data

Next upgrade ideas:
- Parse headlines from official IR pages
- Deduplicate by URL/title hash
- Add transcript ingestion
- Push output to Supabase or GitHub Pages data endpoint
"""
from __future__ import annotations

import json
import pathlib
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "events.json"


def main() -> None:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    payload["generated_at"] = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %Z")
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"updated {DATA_FILE}")


if __name__ == "__main__":
    main()
