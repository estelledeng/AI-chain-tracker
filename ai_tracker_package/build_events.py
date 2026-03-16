import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DOCS_DATA = BASE_DIR.parent / "docs" / "data"
DOCS_DATA.mkdir(parents=True, exist_ok=True)

manifest_file = BASE_DIR / "raw_pages_manifest.json"

items = []
if manifest_file.exists():
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    for row in manifest:
        items.append(
            {
                "id": row.get("name"),
                "company": row.get("name", "").split("_")[0].upper(),
                "title": row.get("name", ""),
                "source_type": "official_source_fetch",
                "published_at": "",
                "source_url": row.get("url", ""),
                "status": row.get("status", ""),
                "summary": row.get("error", "") if row.get("status") == "failed" else f"Fetched from {row.get('url', '')}",
                "keywords": [],
                "linked_tickers": [],
                "signal": "mixed",
                "factor_impact": {
                    "market_size": "medium",
                    "delivery_speed": "medium",
                    "gross_margin": "medium",
                    "eps": "medium",
                },
            }
        )

output = {
    "updated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    "events": items,
}

out_file = DOCS_DATA / "events.json"
out_file.write_text(json.dumps(output, indent=2), encoding="utf-8")
print(f"saved -> {out_file}")
