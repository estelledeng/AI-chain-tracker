"""Fetch official source pages for NVDA / MU / SNDK.

This script pulls official IR/news pages and stores raw HTML snapshots locally.
It is intentionally conservative: official source pages first, no scraping of paywalled media.
"""
from __future__ import annotations

import pathlib
import requests

SOURCES = {
    "nvda_home": "https://investor.nvidia.com/home/default.aspx",
    "nvda_events": "https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx",
    "mu_home": "https://investors.micron.com/",
    "mu_news": "https://investors.micron.com/latest-news",
    "sndk_home": "https://investor.sandisk.com/",
    "sndk_news": "https://investor.sandisk.com/news-events/news-releases",
}

OUTPUT_DIR = pathlib.Path("raw_pages")
OUTPUT_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AIChainTracker/1.0; +https://example.local)",
}


def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def main() -> None:
    for name, url in SOURCES.items():
        html = fetch(url)
        out = OUTPUT_DIR / f"{name}.html"
        out.write_text(html, encoding="utf-8")
        print(f"saved {name} -> {out}")


if __name__ == "__main__":
    main()
