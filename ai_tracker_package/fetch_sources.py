import json
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw_pages"
RAW_DIR.mkdir(exist_ok=True)

SOURCES = {
    "nvda_home": "https://investor.nvidia.com/home/default.aspx",
    "mu_home": "https://investors.micron.com/",
    "sndk_home": "https://investor.sandisk.com/",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def main():
    results = []

    for name, url in SOURCES.items():
        try:
            html = fetch(url)
            out = RAW_DIR / f"{name}.html"
            out.write_text(html, encoding="utf-8")
            print(f"saved {name} -> {out.name}")
            results.append(
                {
                    "name": name,
                    "url": url,
                    "status": "success",
                    "file": str(out.relative_to(BASE_DIR)),
                }
            )
        except Exception as e:
            print(f"failed {name}: {e}")
            results.append(
                {
                    "name": name,
                    "url": url,
                    "status": "failed",
                    "error": str(e),
                }
            )

    manifest = BASE_DIR / "raw_pages_manifest.json"
    manifest.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"saved manifest -> {manifest.name}")


if __name__ == "__main__":
    main()
