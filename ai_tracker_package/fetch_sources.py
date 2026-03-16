import json
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
    {
        "ticker": "NVDA",
        "name": "NVIDIA Newsroom",
        "type": "newsroom",
        "url": "https://nvidianews.nvidia.com/news"
    },
    {
        "ticker": "MU",
        "name": "Micron News Releases",
        "type": "press",
        "url": "https://investors.micron.com/news-releases"
    },
    {
        "ticker": "SNDK",
        "name": "Sandisk News Releases",
        "type": "press",
        "url": "https://investor.sandisk.com/news-releases"
    },
    {
        "ticker": "ANET",
        "name": "Arista Press Releases",
        "type": "press",
        "url": "https://investors.arista.com/Communications/Press-Releases-and-Events/default.aspx"
    },
    {
        "ticker": "VRT",
        "name": "Vertiv News",
        "type": "press",
        "url": "https://investors.vertiv.com/news/news-details/default.aspx"
    },
    {
        "ticker": "TSM",
        "name": "TSMC Press Center",
        "type": "press",
        "url": "https://pr.tsmc.com/english"
    },
    {
        "ticker": "MRVL",
        "name": "Marvell Press Releases",
        "type": "press",
        "url": "https://investor.marvell.com/news-events/press-releases"
    },
    {
        "ticker": "ALAB",
        "name": "Astera Labs Events",
        "type": "events",
        "url": "https://ir.asteralabs.com/news-events/events-presentations/"
    },
    {
        "ticker": "CRDO",
        "name": "Credo News",
        "type": "press",
        "url": "https://investors.credosemi.com/news-events/news"
    },
    {
        "ticker": "LITE",
        "name": "Lumentum News",
        "type": "press",
        "url": "https://investor.lumentum.com/news-releases"
    },
    {
        "ticker": "COHR",
        "name": "Coherent News",
        "type": "press",
        "url": "https://www.coherent.com/news"
    }
]

def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=40)
    resp.raise_for_status()
    return resp.text

def extract_items(html: str, base_url: str):
    soup = BeautifulSoup(html, "html.parser")
    items = []

    for a in soup.find_all("a", href=True):
        text = " ".join(a.get_text(" ", strip=True).split())
        href = a["href"]

        if len(text) < 18:
            continue

        if href.startswith("/"):
          href = base_url.rstrip("/") + href

        items.append({
            "headline": text[:220],
            "url": href
        })

    seen = set()
    deduped = []
    for item in items:
        key = (item["headline"], item["url"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped[:12]

def main():
    now = datetime.now(timezone.utc).isoformat()
    all_results = []

    for src in SOURCES:
        try:
            html = fetch(src["url"])
            page_file = RAW_DIR / f"{src['ticker'].lower()}_source.html"
            page_file.write_text(html, encoding="utf-8")

            extracted = extract_items(html, src["url"])
            all_results.append({
                "ticker": src["ticker"],
                "name": src["name"],
                "source_type": src["type"],
                "source_url": src["url"],
                "status": "success",
                "fetched_at": now,
                "items": extracted
            })
        except Exception as e:
            all_results.append({
                "ticker": src["ticker"],
                "name": src["name"],
                "source_type": src["type"],
                "source_url": src["url"],
                "status": "failed",
                "fetched_at": now,
                "error": str(e),
                "items": []
            })

    out = BASE_DIR / "raw_pages_manifest.json"
    out.write_text(json.dumps(all_results, indent=2), encoding="utf-8")
    print(f"saved -> {out}")

if __name__ == "__main__":
    main()
