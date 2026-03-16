import json
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DOCS_DATA_DIR = BASE_DIR.parent / "docs" / "data"
DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST_PATH = BASE_DIR / "raw_pages_manifest.json"
MARKET_PATH = BASE_DIR / "raw_market.json"

CHAIN_RULES = [
    {"label": "Compute", "keywords": ["gpu", "accelerator", "compute", "blackwell", "rubin", "chip"], "primary": ["NVDA"], "secondary": ["TSM"]},
    {"label": "Memory", "keywords": ["hbm", "dram", "memory hierarchy", "memory bandwidth"], "primary": ["MU"], "secondary": ["NVDA", "TSM"]},
    {"label": "Storage", "keywords": ["context memory", "kv cache", "ssd", "nand", "flash", "storage tier"], "primary": ["SNDK"], "secondary": ["MU", "NVDA"]},
    {"label": "Networking", "keywords": ["scale-out", "network fabric", "interconnect", "ethernet", "rack-scale", "bandwidth"], "primary": ["ANET", "MRVL", "ALAB", "CRDO"], "secondary": ["NVDA"]},
    {"label": "Optics", "keywords": ["optics", "optical", "photonics"], "primary": ["LITE", "COHR"], "secondary": ["CRDO", "ANET"]},
    {"label": "Power / Cooling", "keywords": ["liquid cooling", "rack density", "thermal", "power", "cooling"], "primary": ["VRT"], "secondary": ["NVDA"]},
    {"label": "Foundry / Packaging", "keywords": ["advanced packaging", "cowos", "foundry", "packaging"], "primary": ["TSM"], "secondary": ["NVDA", "MU", "COHR"]}
]

TICKER_GROUPS = {
    "Core Platform": ["NVDA"],
    "Memory & Storage": ["MU", "SNDK"],
    "Connectivity & Networking": ["ANET", "MRVL", "ALAB", "CRDO", "LITE", "COHR"],
    "Deployment & Upstream": ["VRT", "TSM"]
}

TICKER_ROLES = {
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

def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def detect_event_type(text: str):
    lower = text.lower()
    if any(k in lower for k in ["earnings", "gross margin", "eps", "guidance", "results"]):
        return "Earnings / Call"
    if any(k in lower for k in ["partnership", "collaboration", "agreement", "working with"]):
        return "Partnership / Collaboration"
    if any(k in lower for k in ["launch", "roadmap", "introduces", "announces", "new platform", "new product"]):
        return "Product Launch / Roadmap"
    if any(k in lower for k in ["conference", "keynote", "presentation", "gtc", "event"]):
        return "Keynote / Conference"
    return "News / Media"

def classify(text: str):
    lower = text.lower()
    matched_rules = []

    for rule in CHAIN_RULES:
        hits = [k for k in rule["keywords"] if k in lower]
        if hits:
            matched_rules.append((rule, hits))

    chain_buckets = [x[0]["label"] for x in matched_rules]
    primary = []
    secondary = []
    keyword_hits = []

    for rule, hits in matched_rules:
        primary.extend(rule["primary"])
        secondary.extend(rule["secondary"])
        keyword_hits.extend(hits)

    primary = list(dict.fromkeys(primary))
    secondary = [x for x in dict.fromkeys(secondary) if x not in primary]
    keyword_hits = list(dict.fromkeys(keyword_hits))

    sentiment = "bullish" if chain_buckets else "mixed"

    factor_impact = {
        "tam": "high" if chain_buckets else "medium",
        "shipment": "medium",
        "gm": "medium",
        "eps": "medium",
        "timing": "medium"
    }

    why = (
        f"This event maps most directly to {', '.join(chain_buckets)}. "
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

    for src in manifest:
        if src.get("status") != "success":
            continue

        ticker = src["ticker"]
        if ticker == "SECTOR":
            continue

        for idx, item in enumerate(src.get("items", [])[:8], start=1):
            headline = item.get("headline", "").strip()
            if len(headline) < 18:
                continue

            cls = classify(headline)
            event_type = detect_event_type(headline)

            events.append({
                "id": f"{ticker.lower()}_{idx}",
                "company": ticker,
                "source_company": ticker,
                "source_kind": src.get("group", "official"),
                "event_type": event_type,
                "type": event_type,
                "title": headline,
                "headline": headline,
                "text": headline,
                "raw_text": headline,
                "published_at": src.get("fetched_at"),
                "datetime": src.get("fetched_at"),
                "source": src.get("name"),
                "url": item.get("url"),
                "chain_buckets": cls["chain_buckets"],
                "primary_beneficiaries": cls["primary_beneficiaries"],
                "secondary_beneficiaries": cls["secondary_beneficiaries"],
                "keyword_hits": cls["keyword_hits"],
                "sentiment": cls["sentiment"],
                "factor_impact": cls["factor_impact"],
                "why_it_matters": cls["why_it_matters"],
                "analysis": {
                    "sentiment": cls["sentiment"],
                    "direct_score": 70 if cls["chain_buckets"] else 50,
                    "matched_keywords": cls["keyword_hits"],
                    "factor_impact": cls["factor_impact"],
                    "readthrough": [
                        {
                            "ticker": x,
                            "score": 64 - i * 6,
                            "summary": f"{ticker} event may have readthrough into {x}."
                        }
                        for i, x in enumerate(cls["secondary_beneficiaries"][:3])
                    ]
                }
            })

    events.sort(key=lambda x: x.get("datetime", ""), reverse=True)
    return events[:80]

def build_dashboard_scores(events, market):
    latest_by_ticker = {}
    for e in events:
        latest_by_ticker[e["company"]] = e

    market_map = {x["ticker"]: x for x in market.get("tickers", [])}

    rows = []
    for group_name, tickers in TICKER_GROUPS.items():
        for t in tickers:
            direct_score = latest_by_ticker[t]["analysis"]["direct_score"] if t in latest_by_ticker else 45
            mk = market_map.get(t, {})
            rows.append({
                "ticker": t,
                "score": direct_score,
                "role": TICKER_ROLES[t],
                "group": group_name,
                "price": mk.get("price"),
                "change_pct": mk.get("change_pct"),
                "series": mk.get("series", [])
            })
    return rows

def build_source_configs(manifest):
    rows = []
    for src in manifest:
        rows.append({
            "name": src["name"],
            "type": "Industry source" if src.get("group") == "industry" else "Company source",
            "status": "Live connected" if src["status"] == "success" else "Fetch blocked",
            "endpoint": f"/api/sources/{src['ticker'].lower()}",
            "url": src["source_url"],
            "group": src.get("group", "official")
        })

    rows.append({
        "name": "Transcript parser",
        "type": "Keynote / earnings call / analyst Q&A parsing",
        "status": "Needs parser",
        "endpoint": "/api/transcripts/parse",
        "url": "#",
        "group": "tool"
    })
    return rows

def build_eps_bridge():
    return {
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
        ],
        "ANET": [
            {"label": "Scale-out cluster demand", "effect": "+ Revenue", "note": "Bigger AI clusters increase switching and fabric spend."},
            {"label": "AI network attach", "effect": "+ Mix", "note": "Higher-value AI networking can lift margin mix."}
        ],
        "VRT": [
            {"label": "Liquid cooling adoption", "effect": "+ Revenue", "note": "Denser AI racks raise cooling and thermal-management demand."},
            {"label": "Power infrastructure content", "effect": "+ TAM", "note": "AI-ready data center builds expand electrical wallet share."}
        ],
        "TSM": [
            {"label": "Advanced packaging demand", "effect": "+ Revenue", "note": "AI ramps increase packaging and foundry utilization."},
            {"label": "Capacity tightness", "effect": "+ / - Timing", "note": "Tight supply supports price but can limit volume."}
        ],
        "MRVL": [
            {"label": "AI interconnect demand", "effect": "+ Revenue", "note": "System-level connectivity ramps increase custom infrastructure demand."},
            {"label": "Custom silicon relevance", "effect": "+ Mix", "note": "Higher-value infrastructure chips can support margin quality."}
        ],
        "ALAB": [
            {"label": "Rack-scale design wins", "effect": "+ Revenue", "note": "As rack becomes the unit of compute, attach opportunities rise."},
            {"label": "AI IO content growth", "effect": "+ TAM", "note": "Richer connectivity layers increase platform relevance."}
        ],
        "CRDO": [
            {"label": "High-speed interconnect demand", "effect": "+ Revenue", "note": "AI fabric growth supports cable and interconnect content."},
            {"label": "Bandwidth bottlenecks", "effect": "+ Mix", "note": "More demanding clusters support richer product mix."}
        ],
        "LITE": [
            {"label": "Optics demand", "effect": "+ Revenue", "note": "AI data center scaling supports optical module and photonics demand."},
            {"label": "Bandwidth scaling", "effect": "+ TAM", "note": "Larger AI systems need denser and faster optical connectivity."}
        ],
        "COHR": [
            {"label": "Optics and integration demand", "effect": "+ Revenue", "note": "AI growth drives optics and package integration relevance."},
            {"label": "Advanced packaging tie-in", "effect": "+ Mix", "note": "Deeper system integration supports higher-value positioning."}
        ]
    }

def build_alerts():
    return [
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
    ]

def build_watchlist():
    out = []
    for group_name, tickers in TICKER_GROUPS.items():
        for t in tickers:
            out.append({
                "ticker": t,
                "role": TICKER_ROLES[t],
                "phase": group_name
            })
    return out

def main():
    manifest = load_json(MANIFEST_PATH, [])
    market = load_json(MARKET_PATH, {"tickers": [], "storage_prices": {}})

    events = build_events(manifest)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dashboard_scores": build_dashboard_scores(events, market),
        "source_configs": build_source_configs(manifest),
        "alerts": build_alerts(),
        "eps_bridge": build_eps_bridge(),
        "extended_watchlist": build_watchlist(),
        "events": events,
        "market": market,
        "ticker_groups": TICKER_GROUPS
    }

    out_path = DOCS_DATA_DIR / "events.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    market_out = DOCS_DATA_DIR / "market.json"
    market_out.write_text(json.dumps(market, indent=2), encoding="utf-8")

    print(f"saved -> {out_path}")
    print(f"saved -> {market_out}")

if __name__ == "__main__":
    main()
