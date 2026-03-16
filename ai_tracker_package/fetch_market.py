import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests
import yfinance as yf

BASE_DIR = Path(__file__).resolve().parent
OUT_PATH = BASE_DIR / "raw_market.json"
STORAGE_HISTORY = BASE_DIR / "storage_price_history.json"
CUSTOM_TICKER_PATH = BASE_DIR.parent / "docs" / "data" / "custom_companies.json"

BASE_TICKERS = ["NVDA", "MU", "SNDK", "ANET", "VRT", "TSM", "MRVL", "ALAB", "CRDO", "LITE", "COHR"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )
}


def load_custom_tickers():
    if not CUSTOM_TICKER_PATH.exists():
        return []
    try:
        data = json.loads(CUSTOM_TICKER_PATH.read_text(encoding="utf-8"))
        return [str(x).upper().strip() for x in data if str(x).strip()]
    except Exception:
        return []


def load_storage_history():
    if not STORAGE_HISTORY.exists():
        return []
    try:
        return json.loads(STORAGE_HISTORY.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_storage_history(storage_block):
    history = load_storage_history()
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "storage": storage_block
    })
    history = history[-120:]
    STORAGE_HISTORY.write_text(json.dumps(history, indent=2), encoding="utf-8")


def fetch_yf_snapshot(ticker: str):
    try:
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

    except Exception as e:
        return {
            "ticker": ticker,
            "price": None,
            "change_pct": None,
            "series": [],
            "status": f"error: {e}"
        }


def extract_trendforce_latest_price(text: str):
    """
    只在更像“价格字段”的上下文里找数字。
    找不到就返回 None，宁可空，不乱报。
    """
    if not text:
        return None

    lower = text.lower()

    patterns = [
        r"(?:spot price|contract price|average price|latest price|price trend)[^0-9]{0,50}(\d+(?:\.\d+)?)",
        r"(?:usd|us\$|\$)\s*(\d+(?:\.\d+)?)",
        r"(\d+(?:\.\d+)?)\s*(?:usd|us\$)",
    ]

    candidates = []
    for pattern in patterns:
        for m in re.finditer(pattern, lower, re.IGNORECASE):
            try:
                val = float(m.group(1))
                candidates.append(val)
            except Exception:
                pass

    # 过滤太小的数字，避免再抓到 1 / 2 / 10 这种导航数字
    candidates = [x for x in candidates if x >= 50]

    if not candidates:
        return None

    # 取第一个较合理值
    return candidates[0]


def extract_growth_pct(text: str, label: str):
    """
    尝试从页面中抽 weekly / monthly growth。
    抽不到就返回 None。
    """
    if not text:
        return None

    patterns = [
        rf"{label}[^%\-0-9]{{0,50}}(-?\d+(?:\.\d+)?)\s*%",
        rf"{label.replace('ly', '')}[^%\-0-9]{{0,50}}(-?\d+(?:\.\d+)?)\s*%",
    ]

    lower = text.lower()
    for pattern in patterns:
        m = re.search(pattern, lower, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                pass

    return None


def compute_growth_from_history(history, key: str, latest_price):
    """
    如果页面上没有直接给 weekly/monthly，就尝试基于我们自己的历史库算。
    """
    if latest_price is None:
        return None, None

    weekly = None
    monthly = None

    if len(history) >= 7:
        prev_week = history[-7]["storage"].get(key, {}).get("latest_price")
        if prev_week not in (None, 0):
            weekly = round((latest_price - prev_week) / prev_week * 100, 2)

    if len(history) >= 30:
        prev_month = history[-30]["storage"].get(key, {}).get("latest_price")
        if prev_month not in (None, 0):
            monthly = round((latest_price - prev_month) / prev_month * 100, 2)

    return weekly, monthly


def fetch_trendforce_storage():
    urls = {
        "dram": "https://www.trendforce.com/price/dram",
        "nand": "https://www.trendforce.com/price/flash",
    }

    history = load_storage_history()
    out = {}

    for key, url in urls.items():
        try:
            resp = requests.get(url, headers=HEADERS, timeout=40)
            resp.raise_for_status()
            text = resp.text

            latest_price = extract_trendforce_latest_price(text)

            weekly_growth = extract_growth_pct(text, "weekly")
            monthly_growth = extract_growth_pct(text, "monthly")

            # 页面没直接给，就用我们自己的历史算
            hist_weekly, hist_monthly = compute_growth_from_history(history, key, latest_price)
            if weekly_growth is None:
                weekly_growth = hist_weekly
            if monthly_growth is None:
                monthly_growth = hist_monthly

            out[key] = {
                "source": "TrendForce",
                "url": url,
                "latest_price": latest_price,
                "weekly_growth_pct": weekly_growth,
                "monthly_growth_pct": monthly_growth,
                "status": "ok" if latest_price is not None or weekly_growth is not None or monthly_growth is not None else "ok_but_unparsed"
            }

        except Exception as e:
            out[key] = {
                "source": "TrendForce",
                "url": url,
                "latest_price": None,
                "weekly_growth_pct": None,
                "monthly_growth_pct": None,
                "status": f"blocked: {e}"
            }

    return out


def main():
    custom_tickers = load_custom_tickers()
    tickers = list(dict.fromkeys(BASE_TICKERS + custom_tickers))

    ticker_rows = [fetch_yf_snapshot(t) for t in tickers]
    storage = fetch_trendforce_storage()

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "tickers": ticker_rows,
        "storage_prices": storage,
        "custom_tickers": custom_tickers
    }

    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    save_storage_history(storage)
    print(f"saved -> {OUT_PATH}")


if __name__ == "__main__":
    main()
