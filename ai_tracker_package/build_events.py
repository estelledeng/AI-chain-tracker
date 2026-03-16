import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent
DOCS_DATA_DIR = BASE_DIR.parent / "docs" / "data"
DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST_PATH = BASE_DIR / "raw_pages_manifest.json"

KEYWORD_MAP = {
    "AI factory": ["ai factory", "ai factories"],
    "inference economics": ["inference economics", "inference"],
    "memory hierarchy": ["memory hierarchy"],
    "HBM": ["hbm", "high bandwidth memory"],
    "context memory": ["context memory"],
    "KV cache": ["kv cache"],
    "gross margin": ["gross margin"],
    "shipments": ["shipment", "shipments"],
    "design win": ["design win", "design wins"],
    "pricing discipline": ["pricing discipline"],
    "scale-out": ["scale-out", "scale out"],
    "network fabric": ["network fabric", "fabric"],
    "liquid cooling": ["liquid cooling"],
    "advanced packaging": ["advanced packaging", "cowos", "packaging"],
    "optics": ["optics", "optical", "photonics"],
}

ROLE_BY_TICKER = {
    "NVDA": "Platform / AI Factory Architecture",
    "MU": "HBM / DRAM / NAND",
    "SNDK": "NAND / SSD / Inference Storage Tier",
    "ANET": "AI Networking / Scale-out Fabric",
    "VRT": "Power / Cooling / Deployment",
    "TSM": "Foundry / Advanced Packaging",
    "MRVL": "Interconnect / Custom Infrastructure",
    "ALAB": "Rack-scale Connectivity / AI IO",
    "CRDO": "High-speed Interconnect / AI Fabric",
    "LITE": "Optics / AI Data Center Connectivity",
    "COHR": "Optics / Package Integration",
}


def load_manifest():
    if not MANIFEST_PATH.exists():
        return []
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def extract_page_signals(html: str):
    soup = BeautifulSoup(html, "html.parser")

    title = clean_text(soup.title.get_text()) if soup.title else "Untitled page"

    headings = []
    for tag_name in ["h1", "h2", "h3"]:
        for tag in soup.find_all(tag_name)[:8]:
            txt = clean_text(tag.get_text())
            if txt and len(txt) > 4:
                headings.append(txt)

    paragraphs = []
    for p in soup.find_all(["p", "li"])[:20]:
        txt = clean_text(p.get_text())
        if txt and len(txt) > 20:
            paragraphs.append(txt)

    body_text = " ".join([title] + headings + paragraphs[:8])
    body_text = clean_text(body_text)

    matched_keywords = []
    lower = body_text.lower()
    for label, variants in KEYWORD_MAP.items():
        if any(v in lower for v in variants):
            matched_keywords.append(label)

    return {
        "page_title": title,
        "summary": body_text[:320] if body_text else title,
        "matched_keywords": matched_keywords,
    }


def sentiment_from_keywords(keywords):
    positive = {
        "AI factory",
        "inference economics",
        "memory hierarchy",
        "HBM",
        "design win",
        "pricing discipline",
        "scale-out",
        "network fabric",
        "liquid cooling",
        "advanced packaging",
        "optics",
    }
    if any(k in positive for k in keywords):
        return "bullish"
    return "mixed"


def direct_score_from_keywords(keywords):
    score = 52
    weight = {
        "AI factory": 8,
        "inference economics": 7,
        "memory hierarchy": 7,
        "HBM": 8,
        "context memory": 7,
        "KV cache": 6,
        "gross margin": 6,
        "shipments": 5,
        "design win": 7,
        "pricing discipline": 6,
        "scale-out": 7,
        "network fabric": 7,
        "liquid cooling": 8,
        "advanced packaging": 7,
        "optics": 7,
    }
    for k in keywords:
        score += weight.get(k, 0)
    return min(score, 90)


def factor_impact_from_keywords(keywords):
    return {
        "market_size": "high" if any(k in keywords for k in ["AI factory", "scale-out", "network fabric", "optics"]) else "medium",
        "delivery_speed": "high" if any(k in keywords for k in ["liquid cooling", "shipments", "design win"]) else "medium",
        "gross_margin": "high" if any(k in keywords for k in ["HBM", "gross margin", "pricing discipline", "advanced packaging"]) else "medium",
        "eps": "high" if any(k in keywords for k in ["HBM", "gross margin", "pricing discipline"]) else "medium",
    }


def readthrough_for(ticker, keywords):
    mapping = {
        "NVDA": ["MU", "SNDK", "ANET", "VRT", "TSM"],
        "MU": ["NVDA", "TSM"],
        "SNDK": ["NVDA", "MU"],
        "ANET": ["NVDA", "MRVL", "CRDO"],
        "VRT": ["NVDA", "TSM"],
        "TSM": ["NVDA", "MU", "COHR"],
        "MRVL": ["ANET", "ALAB", "CRDO"],
        "ALAB": ["MRVL", "CRDO", "ANET"],
        "CRDO": ["ANET", "LITE", "COHR"],
        "LITE": ["COHR", "CRDO"],
        "COHR": ["LITE", "TSM"],
    }
    linked = mapping.get(ticker, [])
    score_base = 58 if keywords else 48
    items = []
    for i, t in enumerate(linked[:3]):
        items.append(
            {
                "ticker": t,
                "score": max(score_base - i * 6, 42),
                "summary": f"Live IR language from {ticker} may have readthrough into {t}.",
            }
        )
    return items


def build_source_configs(manifest):
    rows = []
    for item in manifest:
        status = "Live connected" if item["status"] == "success" else "Fetch blocked"
        rows.append(
            {
                "name": item["name"],
                "type": item["role"],
                "status": status,
                "endpoint": f"/api/sources/{item['ticker'].lower()}",
                "url": item["url"],
            }
        )
    rows.append(
        {
            "name": "Transcript parser",
            "type": "Keynote / earnings call / analyst Q&A parsing",
            "status": "Needs parser",
            "endpoint": "/api/transcripts/parse",
            "url": "#",
        }
    )
    return rows


def build_dashboard_scores(events, manifest):
    latest_by_ticker = {}
    for e in events:
        latest_by_ticker[e["company"]] = e

    scores = []
    for item in manifest:
        ticker = item["ticker"]
        if ticker in latest_by_ticker:
            score = latest_by_ticker[ticker]["analysis"]["direct_score"]
        elif item["status"] == "success":
            score = 58
        else:
            score = 40
        scores.append(
            {
                "ticker": ticker,
                "score": score,
                "role": ROLE_BY_TICKER.get(ticker, item["role"]),
            }
        )
    return scores


def build_events(manifest):
    events = []

    for idx, item in enumerate(manifest, start=1):
        if item["status"] != "success" or not item["file"]:
            continue

        html_path = BASE_DIR / item["file"]
        if not html_path.exists():
            continue

        html = html_path.read_text(encoding="utf-8", errors="ignore")
        parsed = extract_page_signals(html)
        matched_keywords = parsed["matched_keywords"]
        direct_score = direct_score_from_keywords(matched_keywords)

        events.append(
            {
                "id": f"live_{item['ticker'].lower()}_{idx}",
                "company": item["ticker"],
                "type": "IR Update",
                "datetime": item["fetched_at"],
                "title": parsed["page_title"],
                "text": parsed["summary"],
                "source": item["name"],
                "url": item["url"],
                "analysis": {
                    "sentiment": sentiment_from_keywords(matched_keywords),
                    "direct_score": direct_score,
                    "matched_keywords": matched_keywords,
                    "factor_impact": factor_impact_from_keywords(matched_keywords),
                    "readthrough": readthrough_for(item["ticker"], matched_keywords),
                },
            }
        )

    return events


def main():
    manifest = load_manifest()
    events = build_events(manifest)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dashboard_scores": build_dashboard_scores(events, manifest),
        "source_configs": build_source_configs(manifest),
        "alerts": [],
        "eps_bridge": {},
        "extended_watchlist": [
            {"ticker": "ANET", "role": "Networking / scale-out fabric", "phase": "Live source added"},
            {"ticker": "VRT", "role": "Power / cooling / deployment bottleneck", "phase": "Live source added"},
            {"ticker": "MRVL", "role": "Interconnect / custom infrastructure", "phase": "Live source added"},
            {"ticker": "TSM", "role": "Advanced manufacturing / packaging readthrough", "phase": "Live source added"},
            {"ticker": "ALAB", "role": "Rack-scale connectivity / AI IO", "phase": "Live source added"},
            {"ticker": "CRDO", "role": "High-speed interconnect / AI fabric", "phase": "Live source added"},
            {"ticker": "LITE", "role": "Optics / AI data center connectivity", "phase": "Live source added"},
            {"ticker": "COHR", "role": "Optics / package integration", "phase": "Live source added"},
        ],
        "events": events,
    }

    out_path = DOCS_DATA_DIR / "events.json"
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"saved -> {out_path}")


if __name__ == "__main__":
    main()
