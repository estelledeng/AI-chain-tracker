import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw_pages"
RAW_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}

SOURCES = [
    # Official company event/news sources
    {"ticker": "NVDA", "name": "NVIDIA Newsroom", "group": "official", "url": "https://nvidianews.nvidia.com/news"},
    {"ticker": "MU", "name": "Micron News Releases", "group": "official", "url": "https://investors.micron.com/news-releases"},
    {"ticker": "SNDK", "name": "Sandisk News Releases", "group": "official", "url": "https://investor.sandisk.com/news-releases"},
    {"ticker": "ANET", "name": "Arista Press Releases", "group": "official", "url": "https://investors.arista.com/Communications/Press-Releases-and-Events/default.aspx"},
    {"ticker": "VRT", "name": "Vertiv News", "group": "official", "url": "https://investors.vertiv.com/news/news-details/default.aspx"},
    {"ticker": "TSM", "name": "TSMC Press Center", "group": "official", "url": "https://pr.tsmc.com/english"},
    {"ticker": "MRVL", "name": "Marvell Press Releases", "group": "official", "url": "https://investor.marvell.com/news-events/press-releases"},
    {"ticker": "ALAB", "name": "Astera Events & Presentations", "group": "official", "url": "https://ir.asteralabs.com/news-events/events-presentations/"},
    {"ticker": "CRDO", "name": "Credo News", "group": "official", "url": "https://investors.credosemi.com/news-events/news"},
    {"ticker": "LITE", "name": "Lumentum News Releases", "group": "official", "url": "https://investor.lumentum.com/news-releases"},
    {"ticker": "COHR", "name": "Coherent News", "group": "official", "url": "https://www.coherent.com/news"},

    # Industry / ecosystem sources
    {"ticker": "SECTOR", "name": "TrendForce News", "group": "industry", "url": "https://www.trendforce.com/news/"},
    {"ticker": "SECTOR", "name": "TrendForce Prices DRAM", "group": "industry", "url": "https://www.trendforce.com/price/dram"},
    {"ticker": "SECTOR", "name": "TrendForce Prices NAND", "group": "industry", "url": "https://www.trendforce.com/price/flash"}
]

def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=40)
    resp.raise_for_status()
    return resp.text

def absolutize(base_url: str, href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        parts = re.match(r"(https?://[^/]+)", base_url)
        if parts:
            return parts.group(1) + href
    return base_url.rstrip("/") + "/" + href.lstrip("/")

def extract_items(html: str, base_url: str):
    soup = BeautifulSoup(html, "html.parser")
    items = []

    for a in soup.find_all("a", href=True):
        text = " ".join(a.get_text(" ", strip=True).split())
        href = a["href"].strip()

        if len(text) < 24:
            continue

        url = absolutize(base_url, href)

        items.append({
            "headline": text[:220],
            "url": url
        })

    seen = set()
    cleaned = []
    for item in items:
        key = (item["headline"], item["url"])
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(item)

    return cleaned[:14]

def main():
    now = datetime.now(timezone.utc).isoformat()
    out = []

    for src in SOURCES:
        try:
            html = fetch(src["url"])
            slug = re.sub(r"[^a-z0-9]+", "_", src["name"].lower()).strip("_")
            page_file = RAW_DIR / f"{slug}.html"
            page_file.write_text(html, encoding="utf-8")

            items = extract_items(html, src["url"])

            out.append({
                "ticker": src["ticker"],
                "name": src["name"],
                "group": src["group"],
                "source_url": src["url"],
                "status": "success",
                "fetched_at": now,
                "items": items
            })
        except Exception as e:
            out.append({
                "ticker": src["ticker"],
                "name": src["name"],
                "group": src["group"],
                "source_url": src["url"],
                "status": "blocked",
                "fetched_at": now,
                "error": str(e),
                "items": []
            })

    manifest_path = BASE_DIR / "raw_pages_manifest.json"
    manifest_path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"saved -> {manifest_path}")

if __name__ == "__main__":
    main()
