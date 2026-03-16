import json
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DOCS_DATA_DIR = BASE_DIR.parent / "docs" / "data"
DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST_PATH = BASE_DIR / "raw_pages_manifest.json"

CHAIN_RULES = [
    {
        "label": "Compute",
        "keywords": ["gpu", "accelerator", "compute", "blackwell", "rubin", "chip"],
        "primary": ["NVDA"],
        "secondary": ["TSM"],
    },
    {
        "label": "Memory",
        "keywords": ["hbm", "dram", "memory hierarchy", "memory bandwidth"],
        "primary": ["MU"],
        "secondary": ["NVDA", "TSM"],
    },
    {
        "label": "Storage",
        "keywords": ["context memory", "kv cache", "ssd", "nand", "flash", "storage tier"],
        "primary": ["SNDK"],
        "secondary": ["MU", "NVDA"],
    },
    {
        "label": "Networking",
        "keywords": ["scale-out", "network fabric", "interconnect", "ethernet", "rack-scale", "bandwidth"],
        "primary": ["ANET", "MRVL", "ALAB", "CRDO"],
        "secondary": ["NVDA"],
    },
    {
        "label": "Optics",
        "keywords": ["optics", "optical", "photonics"],
        "primary": ["LITE", "COHR"],
        "secondary": ["CRDO", "ANET"],
    },
    {
        "label": "Power / Cooling",
        "keywords": ["liquid cooling", "rack density", "thermal", "power", "cooling"],
        "primary": ["VRT"],
        "secondary": ["NVDA"],
    },
    {
        "label": "Foundry / Packaging",
        "keywords": ["advanced packaging", "cowos", "foundry", "packaging"],
        "primary": ["TSM"],
        "secondary": ["NVDA", "MU", "COHR"],
    }
]

def load_manifest():
    if not MANIFEST_PATH.exists():
        return []
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

def detect_event_type(text: str):
    lower = text.lower()
    if any(k in lower for k in ["earnings", "gross margin", "eps", "guidance"]):
        return "Earnings / Call"
    if any(k in lower for k in ["partnership", "collaboration", "agreement"]):
        return "Partnership / Collaboration"
    if any(k in lower for k in ["launch", "roadmap", "introduces", "announces"]):
        return "Product Launch / Roadmap"
    if any(k in lower for k in ["conference", "keynote", "presentation", "gtc"]):
        return "Keynote / Conference"
    return "News / Media"

def classify(text: str):
    lower = text.lower()
    matched = []

    for rule in CHAIN_RULES:
        hits = [k for k in rule["keywords"] if k in lower]
        if hits:
            matched.append((rule, hits))

    chain_buckets = [m[0]["label"] for m in matched]
    primary = []
    secondary = []
    keyword_hits = []

    for rule, hits in matched:
        primary.extend(rule["primary"])
        secondary.extend(rule["secondary"])
        keyword_hits.extend(hits)

    primary = list(dict.fromkeys(primary))
    secondary = [x for x in dict.fromkeys(secondary) if x not in primary]
    keyword_hits = list(dict.fromkeys(keyword_hits))

    sentiment = "bullish" if matched else "mixed"

    factor_impact = {
        "tam": "high" if chain_buckets else "medium",
        "shipment": "medium",
        "gm": "medium",
        "eps": "medium",
        "timing": "medium"
    }

    why = (
        f"This language maps most directly to {', '.join(chain_buckets)}. "
        f"Primary beneficiaries are {', '.join(primary) if primary else 'unclear'}, "
        f"with secondary readthrough into {', '.join(secondary) if secondary else 'unclear'}."
        if chain_buckets else
        "This event does not yet strongly map to a single AI chain bucket."
    )

    return {
        "chain_buckets": chain_buckets,
        "primary_beneficiaries": primary,
        "secondary_beneficiaries": secondary,
        "keyword_hits": keyword_hits,
        "sentiment": sentiment,
        "factor_impact": factor_impact,
        "why_it_matters": why
    }

def build_events(manifest):
    events = []

    for group in manifest:
        if group.get("status") != "success":
            continue

        ticker = group["ticker"]
        source_name = group["name"]

        for idx, item in enumerate(group.get("items", [])[:8], start=1):
            text = item["headline"]
            cls = classify(text)

            events.append({
                "id": f"{ticker.lower()}_{idx}",
                "company": ticker,
                "source_company": ticker,
                "source_type": group.get("source_type", "news"),
                "event_type": detect_event_type(text),
                "type": detect_event_type(text),
                "title": item["headline"],
                "headline": item["headline"],
                "text": item["headline"],
                "raw_text": item["headline"],
                "published_at": group["fetched_at"],
                "datetime": group["fetched_at"],
                "source": source_name,
                "url": item["url"],
                "chain_buckets": cls["chain_buckets"],
                "primary_beneficiaries": cls["primary_beneficiaries"],
                "secondary_beneficiaries": cls["secondary_beneficiaries"],
                "keyword_hits": cls["keyword_hits"],
                "sentiment": cls["sentiment"],
                "factor_impact": cls["factor_impact"],
                "why_it_matters": cls["why_it_matters"],
                "analysis": {
                    "sentiment": cls["sentiment"],
                    "direct_score": 70 if cls["chain_buckets"] else 52,
                    "matched_keywords": cls["keyword_hits"],
                    "factor_impact": cls["factor_impact"],
                    "readthrough": [
                        {
                            "ticker": x,
                            "score": 64 - i * 5,
                            "summary": f"{ticker} event may have readthrough into {x}."
                        }
                        for i, x in enumerate(cls["secondary_beneficiaries"][:3])
                    ]
                }
            })

    return events

def build_dashboard_scores(events):
    latest = {}
    for e in events:
        latest[e["company"]] = e

    tickers = ["NVDA", "MU", "SNDK", "ANET", "VRT", "TSM", "MRVL", "ALAB", "CRDO", "LITE", "COHR"]
    roles = {
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
        "COHR": "Optics / Package Integration"
    }

    out = []
    for t in tickers:
        score = latest[t]["analysis"]["direct_score"] if t in latest else 45
        out.append({
            "ticker": t,
            "score": score,
            "role": roles[t]
        })
    return out

def build_source_configs(manifest):
    rows = []
    for m in manifest:
        rows.append({
            "name": m["name"],
            "type": m.get("source_type", "news"),
            "status": "Live connected" if m["status"] == "success" else "Fetch blocked",
            "endpoint": f"/api/sources/{m['ticker'].lower()}",
            "url": m["source_url"]
        })
    rows.append({
        "name": "Transcript parser",
        "type": "Keynote / earnings call / analyst Q&A parsing",
        "status": "Needs parser",
        "endpoint": "/api/transcripts/parse",
        "url": "#"
    })
    return rows

def main():
    manifest = load_manifest()
    events = build_events(manifest)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dashboard_scores": build_dashboard_scores(events),
        "source_configs": build_source_configs(manifest),
        "alerts": [
            {
                "title": "NVDA mentions context memory or KV cache",
                "scope": "NVDA → SNDK / MU",
                "condition": "Trigger on context memory, KV cache, memory hierarchy, or AI-native storage.",
                "action": "Raise storage / memory readthrough priority.",
                "severity": "High"
            },
            {
                "title": "Networking language shifts toward scale-out or fabric bottlenecks",
                "scope": "ANET / MRVL / ALAB / CRDO / LITE / COHR",
                "condition": "Trigger on scale-out, network fabric, optics, or bandwidth bottleneck language.",
                "action": "Raise connectivity and optics cluster sensitivity.",
                "severity": "High"
            },
            {
                "title": "AI deployment highlights liquid cooling or power constraints",
                "scope": "VRT direct / NVDA readthrough",
                "condition": "Trigger on liquid cooling, power constraints, rack density, or thermal bottlenecks.",
                "action": "Raise deployment bottleneck importance.",
                "severity": "High"
            }
        ],
        "eps_bridge": {
            "NVDA": [
                {"label": "AI factory / inference demand", "effect": "+ Revenue", "note": "Broader system demand expands platform revenue opportunity."},
                {"label": "Deployment speed", "effect": "+ / - Timing", "note": "Faster validated deployment accelerates revenue conversion; delays push timing right."}
            ],
            "MU": [
                {"label": "HBM shipments", "effect": "+ Revenue", "note": "Shipment growth directly lifts AI memory revenue."},
                {"label": "Pricing discipline", "effect": "+ GM", "note": "Constructive pricing improves gross margin and EPS conversion."}
            ],
            "SNDK": [
                {"label": "Context memory relevance", "effect": "+ Narrative / TAM", "note": "Can re-rate SNDK from commodity NAND to AI storage layer."},
                {"label": "Design wins / sampling", "effect": "+ Revenue timing", "note": "Commercial validation is required for roadmap to become earnings."}
            ]
        },
        "extended_watchlist": [
            {"ticker": "ANET", "role": "Networking / scale-out fabric", "phase": "Live source added"},
            {"ticker": "VRT", "role": "Power / cooling / deployment bottleneck", "phase": "Live source added"},
            {"ticker": "MRVL", "role": "Interconnect / custom infrastructure", "phase": "Live source added"},
            {"ticker": "TSM", "role": "Advanced manufacturing / packaging readthrough", "phase": "Live source added"},
            {"ticker": "ALAB", "role": "Rack-scale connectivity / AI IO", "phase": "Live source added"},
            {"ticker": "CRDO", "role": "High-speed interconnect / AI fabric", "phase": "Live source added"},
            {"ticker": "LITE", "role": "Optics / AI data center connectivity", "phase": "Live source added"},
            {"ticker": "COHR", "role": "Optics / package integration", "phase": "Live source added"}
        ],
        "events": events
    }

    out_path = DOCS_DATA_DIR / "events.json"
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"saved -> {out_path}")

if __name__ == "__main__":
    main()
