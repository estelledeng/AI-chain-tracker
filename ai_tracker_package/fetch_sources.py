import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw_pages"
RAW_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = [
    {
        "ticker": "NVDA",
        "name": "NVIDIA IR",
        "group": "Core Platform",
        "role": "Platform / AI Factory Architecture",
        "url": "https://investor.nvidia.com/home/default.aspx",
    },
    {
        "ticker": "MU",
        "name": "Micron IR",
        "group": "Memory & Storage",
        "role": "HBM / DRAM / NAND",
        "url": "https://investors.micron.com/",
    },
    {
        "ticker": "SNDK",
        "name": "Sandisk IR",
        "group": "Memory & Storage",
        "role": "NAND / SSD / Inference Storage Tier",
        "url": "https://investor.sandisk.com/",
    },
    {
        "ticker": "ANET",
        "name": "Arista IR",
        "group": "Connectivity & Networking",
        "role": "AI Networking / Scale-out Fabric",
        "url": "https://investors.arista.com/Communications/Press-Releases-and-Events/default.aspx",
    },
    {
        "ticker": "VRT",
        "name": "Vertiv IR",
        "group": "Deployment & Upstream",
        "role": "Power / Cooling / Deployment",
        "url": "https://investors.vertiv.com/overview/default.aspx",
    },
    {
        "ticker": "TSM",
        "name": "TSMC IR",
        "group": "Deployment & Upstream",
        "role": "Foundry / Advanced Packaging",
        "url": "https://investor.tsmc.com/english",
    },
    {
        "ticker": "MRVL",
        "name": "Marvell IR",
        "group": "Connectivity & Networking",
        "role": "Interconnect / Custom Infrastructure",
        "url": "https://investor.marvell.com/",
    },
    {
        "ticker": "ALAB",
        "name": "Astera Labs IR",
        "group": "Connectivity & Networking",
        "role": "Rack-scale Connectivity / AI IO",
        "url": "https://ir.asteralabs.com/news-events/events-presentations/",
    },
    {
        "ticker": "CRDO",
        "name": "Credo IR",
        "group": "Connectivity & Networking",
        "role": "High-speed Interconnect / AI Fabric",
        "url": "https://investors.credosemi.com/overview/default.aspx",
    },
    {
        "ticker": "LITE",
        "name": "Lumentum IR",
        "group": "Connectivity & Networking",
        "role": "Optics / AI Data Center Connectivity",
        "url": "https://investor.lumentum.com/overview/default.aspx",
    },
    {
        "ticker": "COHR",
        "name": "Coherent IR",
        "group": "Connectivity & Networking",
        "role": "Optics / Package Integration",
        "url": "https://www.coherent.com/company/investor-relations",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_")


def fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=40)
    resp.raise_for_status()
    return resp.text


def main():
    results = []
    now = datetime.now(timezone.utc).isoformat()

    for src in SOURCES:
        ticker = src["ticker"]
        filename = f"{ticker.lower()}_{slugify(src['name'])}.html"
        path = RAW_DIR / filename

        try:
            html = fetch_html(src["url"])
            path.write_text(html, encoding="utf-8")
            print(f"saved {ticker} -> {filename}")

            results.append(
                {
                    "ticker": ticker,
                    "name": src["name"],
                    "group": src["group"],
                    "role": src["role"],
                    "url": src["url"],
                    "status": "success",
                    "fetched_at": now,
                    "file": str(path.relative_to(BASE_DIR)),
                    "error": "",
                }
            )
        except Exception as e:
            print(f"failed {ticker}: {e}")
            results.append(
                {
                    "ticker": ticker,
                    "name": src["name"],
                    "group": src["group"],
                    "role": src["role"],
                    "url": src["url"],
                    "status": "failed",
                    "fetched_at": now,
                    "file": "",
                    "error": str(e),
                }
            )

    manifest_path = BASE_DIR / "raw_pages_manifest.json"
    manifest_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"saved manifest -> {manifest_path.name}")


if __name__ == "__main__":
    main()
