# AI Chain Tracker

A local-first tracker for NVIDIA, Micron, and Sandisk.

## What this package includes

- `index.html` – dashboard frontend
- `app.js` – UI logic; loads `data/events.json`
- `styles.css` – styling
- `data/events.json` – structured events, scores, alerts, EPS bridge, watchlist
- `fetch_sources.py` – fetches official IR source pages
- `build_events.py` – rebuilds or refreshes the local data file
- `.github/workflows/update-data.yml` – scheduled refresh template

## Official source endpoints in this starter

- NVIDIA IR home: `https://investor.nvidia.com/home/default.aspx`
- NVIDIA events: `https://investor.nvidia.com/events-and-presentations/events-and-presentations/default.aspx`
- Micron IR: `https://investors.micron.com/`
- Micron latest news: `https://investors.micron.com/latest-news`
- Sandisk IR: `https://investor.sandisk.com/`
- Sandisk news releases: `https://investor.sandisk.com/news-events/news-releases`

## Run locally

### Option 1: just open the HTML

Double-click `index.html`.

### Option 2: run a tiny local server

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Refresh source snapshots

```bash
pip install -r requirements.txt
python fetch_sources.py
python build_events.py
```

## Turn this into a simple realtime-ish system

- Host the folder on GitHub Pages / Cloudflare Pages / Vercel
- Run the workflow on a schedule
- Let the frontend keep reading the updated `data/events.json`
- Later, replace `build_events.py` with real parsing and scoring logic

## Best next upgrade

1. Parse actual headlines from official IR pages
2. Add transcript ingestion
3. Store data in Supabase instead of flat JSON
4. Add email / Telegram / Slack alerts
