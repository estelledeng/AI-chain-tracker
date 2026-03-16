import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests
import yfinance as yf

BASE_DIR = Path(__file__).resolve().parent
OUT_PATH = BASE_DIR / "raw_market.json"
STORAGE_HISTORY = BASE_DIR / "storage_price_history.json"

TICKERS = ["NVDA", "MU", "SNDK", "ANET", "VRT", "TSM", "MRVL", "ALAB", "CRDO", "LITE", "COHR"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )
}

def fetch_yf_snapshot(ticker: str):
    tk = yf.Ticker(ticker)
    hist = tk.history(period="1d", interval="5m", auto_adjust=False)
    if hist.empty:
        return {
            "ticker": ticker,
            "price": None,
            "change_pct": None,
            "series": [],
            "status": "no_data"
        }

    closes = hist["Close"].dropna().tolist()
    opens = hist["Open"].dropna().tolist()

    latest = closes[-1] if closes else None
    first_open = opens[0] if opens else None
    change_pct = None
    if latest is not None and first_open not in (None, 0):
        change_pct = round((latest - first_open) / first_open * 100, 2)

    return {
        "ticker": ticker,
        "price": round(float(latest), 2) if latest is not None else None,
        "change_pct": change_pct,
        "series": [round(float(x), 2) for x in closes[-78:]],
        "status": "ok"
    }

def safe_float_from_text(text: str):
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*%", text)
    if not m:
        return None
    return float(m.group(1))

def fetch_trendforce_storage():
    urls = {
        "dram": "https://www.trendforce.com/price/dram",
        "nand": "https://www.trendforce.com/price/flash",
    }
    out = {}

    for key, url in urls.items():
        try:
            resp = requests.get(url, headers=HEADERS, timeout=40)
            resp.raise_for_status()
            text = resp.text

            weekly = None
            monthly = None

            wk = re.search(r"(weekly[^%]{0,80}?-?\d+(?:\.\d+)?\s*%)", text, re.IGNORECASE)
            mo = re.search(r"(monthly[^%]{0,80}?-?\d+(?:\.\d+)?\s*%)", text, re.IGNORECASE)

            if wk:
                weekly = safe_float_from_text(wk.group(1))
            if mo:
                monthly = safe_float_from_text(mo.group(1))

            out[key] = {
                "source": "TrendForce",
                "url": url,
                "weekly_growth_pct": weekly,
                "monthly_growth_pct": monthly,
                "status": "ok"
            }
        except Exception as e:
            out[key] = {
                "source": "TrendForce",
                "url": url,
                "weekly_growth_pct": None,
                "monthly_growth_pct": None,
                "status": f"blocked: {e}"
            }

    return out

def save_storage_history(storage_block):
    history = []
    if STORAGE_HISTORY.exists():
        try:
            history = json.loads(STORAGE_HISTORY.read_text(encoding="utf-8"))
        except Exception:
            history = []

    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "storage": storage_block
    })

    history = history[-120:]
    STORAGE_HISTORY.write_text(json.dumps(history, indent=2), encoding="utf-8")

def main():
    tickers = [fetch_yf_snapshot(t) for t in TICKERS]
    storage = fetch_trendforce_storage()

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "tickers": tickers,
        "storage_prices": storage
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    save_storage_history(storage)
    print(f"saved -> {OUT_PATH}")

if __name__ == "__main__":
    main()
