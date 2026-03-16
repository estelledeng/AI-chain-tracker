const state = {
  data: null,
  filteredEvents: [],
  selectedId: null,
  customCompanies: [],
  customEvents: [],
  manualDraftResult: null,
  manualArchivedEvents: JSON.parse(localStorage.getItem('manualArchivedEvents') || '[]')
};

const els = {
  companyFilter: document.getElementById('companyFilter'),
  searchInput: document.getElementById('searchInput'),
  feed: document.getElementById('feed'),
  detail: document.getElementById('detail'),
  tickerGroups: document.getElementById('tickerGroups'),
  systemStatus: document.getElementById('systemStatus'),
  feedCount: document.getElementById('feedCount'),
  dataStamp: document.getElementById('dataStamp'),
  storagePrices: document.getElementById('storagePrices'),
  refreshBtn: document.getElementById('refreshBtn'),
  manualInput: document.getElementById('manualInput'),
  manualUrlInput: document.getElementById('manualUrlInput'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  saveAnalyzeBtn: document.getElementById('saveAnalyzeBtn'),
  clearAnalyzeBtn: document.getElementById('clearAnalyzeBtn'),
  analyzerOutput: document.getElementById('analyzerOutput'),
  bridgePanel: document.getElementById('bridgePanel'),
  alertsPanel: document.getElementById('alertsPanel'),
  sourcesPanel: document.getElementById('sourcesPanel'),
  watchlistPanel: document.getElementById('watchlistPanel')
};

const CHAIN_RULES = [
  { label: 'Compute', keywords: ['gpu', 'accelerator', 'compute', 'blackwell', 'rubin', 'chip'], primary: ['NVDA'], secondary: ['TSM'], factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' } },
  { label: 'Memory', keywords: ['hbm', 'dram', 'memory hierarchy', 'memory bandwidth'], primary: ['MU'], secondary: ['NVDA', 'TSM'], factors: { tam: 'high', shipment: 'high', gm: 'high', eps: 'high', timing: 'medium' } },
  { label: 'Storage', keywords: ['context memory', 'kv cache', 'ssd', 'nand', 'flash', 'storage tier'], primary: ['SNDK'], secondary: ['MU', 'NVDA'], factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' } },
  { label: 'Networking', keywords: ['scale-out', 'network fabric', 'interconnect', 'ethernet', 'rack-scale', 'bandwidth'], primary: ['ANET', 'MRVL', 'ALAB', 'CRDO'], secondary: ['NVDA'], factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' } },
  { label: 'Optics', keywords: ['optics', 'optical', 'photonics'], primary: ['LITE', 'COHR'], secondary: ['CRDO', 'ANET'], factors: { tam: 'medium', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' } },
  { label: 'Power / Cooling', keywords: ['liquid cooling', 'rack density', 'thermal', 'power', 'cooling'], primary: ['VRT'], secondary: ['NVDA'], factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'high' } },
  { label: 'Foundry / Packaging', keywords: ['advanced packaging', 'cowos', 'foundry', 'packaging'], primary: ['TSM'], secondary: ['NVDA', 'MU', 'COHR'], factors: { tam: 'medium', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'high' } }
];

const EVENT_TYPE_RULES = [
  { type: 'Keynote / Conference', keywords: ['gtc', 'keynote', 'conference', 'presentation', 'on stage'] },
  { type: 'Earnings / Call', keywords: ['earnings', 'guidance', 'gross margin', 'eps', 'conference call', 'analyst q&a', 'results'] },
  { type: 'Partnership / Collaboration', keywords: ['partnership', 'collaboration', 'agreement', 'working with'] },
  { type: 'Product Launch / Roadmap', keywords: ['launch', 'roadmap', 'introduces', 'announces', 'new platform', 'new product'] },
  { type: 'Supply Chain / Capacity', keywords: ['capacity', 'shipment', 'lead time', 'supply', 'ramp', 'packaging tightness'] },
  { type: 'News / Media', keywords: ['reuters', 'bloomberg', 'reported', 'according to', 'news'] }
];

function cap(s = '') {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function badgeClass(sentiment) {
  if (sentiment === 'bullish') return 'green';
  if (sentiment === 'bearish') return 'red';
  return 'amber';
}

function scoreBoxHtml(score) {
  return `
    <div class="score-bar"><span style="width:${score}%"></span></div>
    <div class="score-value">${score}</div>
  `;
}

function sparklineSVG(series = []) {
  if (!series.length) return '<div class="muted">No intraday curve</div>';

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(max - min, 0.0001);

  const points = series.map((v, i) => {
    const x = (i / Math.max(series.length - 1, 1)) * 100;
    const y = 36 - ((v - min) / range) * 32 + 4;
    return `${x},${y}`;
  }).join(' ');

  const up = series[series.length - 1] >= series[0];
  const color = up ? '#16a34a' : '#dc2626';

  return `
    <svg class="sparkline" viewBox="0 0 100 42" preserveAspectRatio="none">
      <polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" />
    </svg>
  `;
}

function ensureCompanyFilterOptions(events) {
  const existing = Array.from(els.companyFilter.options).map(o => o.value);
  const tickers = [...new Set((events || []).map(e => e.company).filter(Boolean))];

  tickers.concat(state.customCompanies.map(x => x.ticker)).forEach(ticker => {
    if (!existing.includes(ticker)) {
      const option = document.createElement('option');
      option.value = ticker;
      option.textContent = ticker;
      els.companyFilter.appendChild(option);
    }
  });
}

function getAllEvents() {
  return [
    ...state.manualArchivedEvents,
    ...state.customEvents,
    ...((state.data && state.data.events) || [])
  ].sort((a, b) => {
    const da = new Date(a.datetime || a.published_at || 0).getTime();
    const db = new Date(b.datetime || b.published_at || 0).getTime();
    return db - da;
  });
}

function renderStoragePrices() {
  const storage = state.data?.market?.storage_prices || {};
  const rows = Object.entries(storage);

  if (!rows.length) {
    els.storagePrices.innerHTML = '<div class="muted">No storage price data.</div>';
    return;
  }

  els.storagePrices.innerHTML = rows.map(([k, v]) => `
    <div class="storage-card">
      <div><strong>${k.toUpperCase()} · ${v.source || 'Source'}</strong></div>
      <div class="muted" style="margin-top:6px">
        Latest: ${v.latest_price ?? 'Unavailable'} · Weekly: ${v.weekly_growth_pct ?? 'Unavailable'}${v.weekly_growth_pct == null ? '' : '%'} · Monthly: ${v.monthly_growth_pct ?? 'Unavailable'}${v.monthly_growth_pct == null ? '' : '%'}
      </div>
      <div class="muted" style="margin-top:4px">
        ${v.status === 'ok' ? 'Parsed from source' : v.status === 'ok_but_unparsed' ? 'Source reachable, numeric price not reliably parsed yet' : (v.status || '')}
      </div>
    </div>
  `).join('');
}

function detectEventType(text) {
  const lower = text.toLowerCase();
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.type;
  }
  return 'General event / commentary';
}

function classify(text) {
  const lower = text.toLowerCase();
  const matchedRules = [];

  for (const rule of CHAIN_RULES) {
    const hits = rule.keywords.filter(k => lower.includes(k));
    if (hits.length) matchedRules.push({ rule, hits });
  }

  const chainBuckets = matchedRules.map(x => x.rule.label);
  const primary = [...new Set(matchedRules.flatMap(x => x.rule.primary))];
  const secondary = [...new Set(matchedRules.flatMap(x => x.rule.secondary))].filter(x => !primary.includes(x));
  const keywordHits = [...new Set(matchedRules.flatMap(x => x.hits))];

  const sentiment = chainBuckets.length ? 'bullish' : 'mixed';
  const factorImpact = {
    tam: chainBuckets.length ? 'high' : 'medium',
    shipment: 'medium',
    gm: 'medium',
    eps: 'medium',
    timing: 'medium'
  };

  const why = chainBuckets.length
    ? `This event maps most directly to ${chainBuckets.join(', ')}. Primary beneficiaries are ${primary.join(', ') || 'unclear'}, with secondary readthrough into ${secondary.join(', ') || 'unclear'}.`
    : 'This event does not yet strongly map to a single AI chain bucket.';

  return {
    chain_buckets: chainBuckets,
    primary_beneficiaries: primary,
    secondary_beneficiaries: secondary,
    keyword_hits: keywordHits,
    sentiment,
    factor_impact: factorImpact,
    why_it_matters: why
  };
}

function defaultCustomScore(changePct) {
  if (changePct == null) return 45;
  if (changePct >= 5) return 60;
  if (changePct >= 2) return 55;
  if (changePct <= -5) return 38;
  if (changePct <= -2) return 42;
  return 48;
}

async function fetchYahooChartSnapshot(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m&includePrePost=false`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`chart fetch failed: ${resp.status}`);
  const data = await resp.json();

  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('no chart result');

  const closesRaw = result?.indicators?.quote?.[0]?.close || [];
  const closes = closesRaw.filter(v => typeof v === 'number');

  if (!closes.length) throw new Error('no intraday close series');

  const meta = result.meta || {};
  const regularPrice = typeof meta.regularMarketPrice === 'number' ? meta.regularMarketPrice : closes[closes.length - 1];
  const previousClose = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : closes[0];

  let changePct = null;
  if (previousClose && previousClose !== 0) {
    changePct = Number((((regularPrice - previousClose) / previousClose) * 100).toFixed(2));
  }

  return {
    ticker,
    price: Number(regularPrice.toFixed(2)),
    change_pct: changePct,
    series: closes.slice(-78).map(x => Number(x.toFixed(2))),
    status: 'front_end_live'
  };
}

async function fetchYahooNews(ticker) {
  const rssUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;

  const resp = await fetch(proxyUrl);
  if (!resp.ok) throw new Error(`rss proxy failed: ${resp.status}`);

  const xmlText = await resp.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');

  const items = Array.from(xml.querySelectorAll('item')).slice(0, 6);
  return items.map((item, idx) => ({
    id: `custom_${ticker.toLowerCase()}_news_${idx + 1}`,
    title: item.querySelector('title')?.textContent?.trim() || `${ticker} Yahoo Finance headline`,
    url: item.querySelector('link')?.textContent?.trim() || '#',
    published: item.querySelector('pubDate')?.textContent?.trim() || new Date().toISOString(),
    source: 'Yahoo Finance News'
  }));
}

function buildTempEventsFromNews(ticker, newsItems, marketSnapshot) {
  return newsItems.map((news, idx) => {
    const cls = classify(news.title);
    const eventType = detectEventType(news.title);

    return {
      id: news.id || `custom_${ticker.toLowerCase()}_${idx + 1}`,
      company: ticker,
      source_company: ticker,
      source_kind: 'front_end_temp_news',
      event_type: eventType,
      type: eventType,
      title: news.title,
      headline: news.title,
      text: news.title,
      raw_text: news.title,
      published_at: news.published,
      datetime: news.published,
      source: news.source || 'Yahoo Finance News',
      url: news.url || '#',
      chain_buckets: cls.chain_buckets,
      primary_beneficiaries: cls.primary_beneficiaries,
      secondary_beneficiaries: cls.secondary_beneficiaries,
      keyword_hits: cls.keyword_hits,
      sentiment: cls.sentiment,
      factor_impact: cls.factor_impact,
      why_it_matters: cls.why_it_matters,
      analysis: {
        sentiment: cls.sentiment,
        direct_score: defaultCustomScore(marketSnapshot?.change_pct),
        matched_keywords: cls.keyword_hits,
        factor_impact: cls.factor_impact,
        readthrough: cls.secondary_beneficiaries.slice(0, 3).map((x, i) => ({
          ticker: x,
          score: 62 - i * 6,
          summary: `${ticker} temporary news may have readthrough into ${x}.`
        }))
      }
    };
  });
}

function buildFallbackSyntheticEvent(ticker, marketSnapshot) {
  const change = marketSnapshot?.change_pct;
  const sentiment = change == null ? 'mixed' : (change >= 0 ? 'bullish' : 'mixed');
  const score = defaultCustomScore(change);

  return [{
    id: `custom_${ticker.toLowerCase()}_synthetic_1`,
    company: ticker,
    source_company: ticker,
    source_kind: 'front_end_generated',
    event_type: 'Generated market snapshot',
    type: 'Generated market snapshot',
    title: `${ticker} temporary market snapshot`,
    headline: `${ticker} temporary market snapshot`,
    text: `${ticker} has been added from front-end search. No Yahoo Finance news was retrieved, so this event is generated from market data only.`,
    raw_text: `${ticker} temporary market snapshot`,
    published_at: new Date().toISOString(),
    datetime: new Date().toISOString(),
    source: 'Front-end generated event',
    url: '#',
    chain_buckets: [],
    primary_beneficiaries: [ticker],
    secondary_beneficiaries: [],
    keyword_hits: [],
    sentiment,
    factor_impact: {
      tam: 'medium',
      shipment: 'medium',
      gm: 'medium',
      eps: 'medium',
      timing: 'medium'
    },
    why_it_matters: `No Yahoo Finance news was retrieved for ${ticker}. This temporary event is generated so the ticker can still be tracked in the current browser session.`,
    analysis: {
      sentiment,
      direct_score: score,
      matched_keywords: [],
      factor_impact: {
        tam: 'medium',
        shipment: 'medium',
        gm: 'medium',
        eps: 'medium',
        timing: 'medium'
      },
      readthrough: []
    }
  }];
}

function upsertCustomCompany(snapshot) {
  const idx = state.customCompanies.findIndex(x => x.ticker === snapshot.ticker);
  const company = {
    ticker: snapshot.ticker,
    role: 'Custom / Added from front-end search',
    group: 'Custom Watchlist',
    price: snapshot.price ?? null,
    change_pct: snapshot.change_pct ?? null,
    series: snapshot.series || [],
    score: defaultCustomScore(snapshot.change_pct)
  };

  if (idx >= 0) state.customCompanies[idx] = company;
  else state.customCompanies.push(company);
}

function upsertCustomEvents(ticker, events) {
  state.customEvents = state.customEvents.filter(e => e.company !== ticker);
  state.customEvents.unshift(...events);
}

async function quickLookupTicker(term) {
  const ticker = term.trim().toUpperCase();
  if (!ticker) return;

  els.dataStamp.textContent = `Looking up ${ticker}...`;

  let marketSnapshot = {
    ticker,
    price: null,
    change_pct: null,
    series: [],
    status: 'lookup_failed'
  };

  try {
    marketSnapshot = await fetchYahooChartSnapshot(ticker);
  } catch (err) {
    console.warn('chart lookup failed', ticker, err);
  }

  upsertCustomCompany(marketSnapshot);

  let customNewsEvents = [];
  try {
    const newsItems = await fetchYahooNews(ticker);
    if (newsItems.length) {
      customNewsEvents = buildTempEventsFromNews(ticker, newsItems, marketSnapshot);
    }
  } catch (err) {
    console.warn('yahoo news failed', ticker, err);
  }

  if (!customNewsEvents.length) {
    customNewsEvents = buildFallbackSyntheticEvent(ticker, marketSnapshot);
  }

  upsertCustomEvents(ticker, customNewsEvents);

  ensureCompanyFilterOptions(getAllEvents());
  renderTickerGroups();
  renderLowerPanels();
  applyFilters();

  els.companyFilter.value = ticker;
  applyFilters();

  els.dataStamp.textContent = state.data?.generated_at
    ? `Updated ${state.data.generated_at} · Added temporary ticker ${ticker}`
    : `Temporary ticker ${ticker} added`;
}

async function fetchUrlContent(url) {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('empty url');

  const tryUrls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`,
    `https://r.jina.ai/http://${trimmed.replace(/^https?:\/\//, '')}`,
    `https://r.jina.ai/http://r.jina.ai/http://${trimmed.replace(/^https?:\/\//, '')}`
  ];

  let lastErr = null;

  for (const u of tryUrls) {
    try {
      const resp = await fetch(u);
      if (!resp.ok) throw new Error(`proxy failed: ${resp.status}`);
      const html = await resp.text();

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = (doc.querySelector('title')?.textContent || '').trim();

      const paragraphs = Array.from(doc.querySelectorAll('p'))
        .map(p => (p.textContent || '').trim())
        .filter(Boolean)
        .filter(t => t.length > 40)
        .slice(0, 10);

      const body = paragraphs.join(' ');
      if (title || body) {
        return {
          title,
          text: body || title
        };
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('url fetch failed');
}

function buildManualArchivedEvent({ text, url, fetchedTitle, analysisResult }) {
  const now = new Date().toISOString();

  return {
    id: `manual_${Date.now()}`,
    company: analysisResult.primary?.[0] || 'MANUAL',
    source_company: analysisResult.primary?.[0] || 'MANUAL',
    source_kind: 'manual_archive',
    event_type: analysisResult.eventType || 'Manual analysis',
    type: analysisResult.eventType || 'Manual analysis',
    title: fetchedTitle || text.slice(0, 120) || 'Manual event',
    headline: fetchedTitle || text.slice(0, 120) || 'Manual event',
    text: text,
    raw_text: text,
    published_at: now,
    datetime: now,
    source: url ? 'Manual URL analysis' : 'Manual text analysis',
    url: url || '#',
    chain_buckets: analysisResult.chainBuckets || [],
    primary_beneficiaries: analysisResult.primary || [],
    secondary_beneficiaries: analysisResult.secondary || [],
    keyword_hits: analysisResult.keywordHits || [],
    sentiment: analysisResult.sentiment || 'mixed',
    factor_impact: analysisResult.factorImpact || {},
    why_it_matters: analysisResult.why || '',
    analysis: {
      sentiment: analysisResult.sentiment || 'mixed',
      direct_score: analysisResult.primary?.length ? 68 : 52,
      matched_keywords: analysisResult.keywordHits || [],
      factor_impact: analysisResult.factorImpact || {},
      readthrough: (analysisResult.secondary || []).slice(0, 3).map((x, i) => ({
        ticker: x,
        score: 62 - i * 6,
        summary: `Manual analyzed event may have readthrough into ${x}.`
      }))
    }
  };
}

function renderStaticPanels() {
  const sources = (state.data && state.data.source_configs) || [];

  els.systemStatus.innerHTML = sources.length
    ? sources.map(src => `
        <div class="status-row">
          <div>
            <div><strong>${src.name || ''}</strong></div>
            <div class="muted">${src.type || ''}</div>
          </div>
          <div class="badge ${src.status === 'Live connected' ? 'green' : 'amber'}">${src.status || 'Unknown'}</div>
        </div>
      `).join('')
    : '<div class="muted">No live source status.</div>';
}

function renderTickerGroups() {
  const scores = (state.data && state.data.dashboard_scores) || [];
  const groups = (state.data && state.data.ticker_groups) || {};
  const scoreMap = Object.fromEntries(scores.map(x => [x.ticker, x]));
  const custom = state.customCompanies;

  let html = '';

  Object.entries(groups).forEach(([groupName, tickers]) => {
    html += `
      <div class="group-block">
        <div class="group-title">${groupName}</div>
        <div class="ticker-row">
          ${tickers.map(t => {
            const item = scoreMap[t] || { ticker: t, role: '', score: 0, price: null, change_pct: null, series: [] };
            const ch = item.change_pct;
            const chClass = ch == null ? 'change-flat' : (ch >= 0 ? 'change-up' : 'change-down');
            const chText = ch == null ? 'N/A' : `${ch}%`;

            return `
              <div class="ticker-card">
                <div class="ticker-top">
                  <div class="ticker-name">${item.ticker}</div>
                  <div class="badge blue">${item.score || 0}</div>
                </div>
                <div class="price-line">
                  <div class="price">${item.price ?? '--'}</div>
                  <div class="${chClass}">${chText}</div>
                </div>
                <div class="muted" style="margin-bottom:8px">${item.role || ''}</div>
                ${sparklineSVG(item.series || [])}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  if (custom.length) {
    html += `
      <div class="group-block">
        <div class="group-title">Custom Watchlist</div>
        <div class="ticker-row">
          ${custom.map(item => {
            const ch = item.change_pct;
            const chClass = ch == null ? 'change-flat' : (ch >= 0 ? 'change-up' : 'change-down');
            const chText = ch == null ? 'N/A' : `${ch}%`;

            return `
              <div class="ticker-card">
                <div class="ticker-top">
                  <div class="ticker-name">${item.ticker}</div>
                  <div class="badge amber">${item.score ?? 45}</div>
                </div>
                <div class="price-line">
                  <div class="price">${item.price ?? '--'}</div>
                  <div class="${chClass}">${chText}</div>
                </div>
                <div class="muted" style="margin-bottom:8px">${item.role}</div>
                ${sparklineSVG(item.series || [])}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  els.tickerGroups.innerHTML = html || '<div class="muted">No grouped tickers yet.</div>';
}

function renderLowerPanels() {
  const bridge = (state.data && state.data.eps_bridge) || {};
  const alerts = (state.data && state.data.alerts) || [];
  const sources = (state.data && state.data.source_configs) || [];
  const watchlist = [
    ...(((state.data && state.data.extended_watchlist) || []).map(x => ({ ...x }))),
    ...state.customCompanies.map(x => ({
      ticker: x.ticker,
      role: x.role,
      phase: 'Front-end temporary custom'
    }))
  ];

  const bridgeEntries = Object.entries(bridge);
  els.bridgePanel.innerHTML = bridgeEntries.length
    ? bridgeEntries.map(([ticker, rows]) => `
        <div class="bridge-card">
          <div class="feed-top">
            <strong>${ticker}</strong>
            <span class="badge blue">Quarterly bridge</span>
          </div>
          <div class="bridge-grid-inner">
            ${(rows || []).map(row => `
              <div class="factor-box">
                <strong>${row.label}</strong>
                <div class="badge blue">${row.effect}</div>
                <div class="muted" style="margin-top:8px">${row.note}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
    : '<div class="muted">No EPS bridge data yet.</div>';

  els.alertsPanel.innerHTML = alerts.length
    ? `<div class="alert-grid">${alerts.map(a => `
        <div class="alert-card">
          <div class="feed-top">
            <strong>${a.title}</strong>
            <span class="badge ${a.severity === 'High' ? 'red' : 'amber'}">${a.severity}</span>
          </div>
          <div class="muted" style="margin-bottom:10px">${a.scope || ''}</div>
          <div><strong>Condition</strong></div>
          <div class="muted">${a.condition || ''}</div>
          <div style="margin-top:10px"><strong>Action</strong></div>
          <div class="muted">${a.action || ''}</div>
        </div>
      `).join('')}</div>`
    : '<div class="muted">No alert rules yet.</div>';

  els.sourcesPanel.innerHTML = sources.length
    ? `<div class="source-grid">${sources.map(s => `
        <div class="source-card">
          <div class="feed-top">
            <strong>${s.name || ''}</strong>
            <span class="badge ${s.status === 'Live connected' ? 'green' : 'amber'}">${s.status || 'Unknown'}</span>
          </div>
          <div class="muted">${s.type || ''}</div>
          <div class="muted" style="margin-top:8px">${s.group || ''}</div>
          <div style="margin-top:10px"><code>${s.endpoint || ''}</code></div>
          <div style="margin-top:10px">
            ${s.url && s.url !== '#' ? `<a href="${s.url}" target="_blank" rel="noreferrer">Open source</a>` : '<span class="muted">No direct URL</span>'}
          </div>
        </div>
      `).join('')}</div>`
    : '<div class="muted">No source list yet.</div>';

  els.watchlistPanel.innerHTML = watchlist.length
    ? `<div class="watch-grid">${watchlist.map(w => `
        <div class="watch-card">
          <strong>${w.ticker}</strong>
          <div class="muted" style="margin-top:6px">${w.role || ''}</div>
          <div class="badge blue" style="margin-top:10px">${w.phase || ''}</div>
        </div>
      `).join('')}</div>`
    : '<div class="muted">No watchlist yet.</div>';
}

function applyFilters() {
  const company = els.companyFilter.value;
  const q = els.searchInput.value.trim().toLowerCase();

  state.filteredEvents = getAllEvents().filter(event => {
    const companyMatch = company === 'ALL' || event.company === company;
    const text = `${event.title || ''} ${event.text || ''} ${event.why_it_matters || ''}`.toLowerCase();
    const queryMatch = !q || text.includes(q);
    return companyMatch && queryMatch;
  });

  if (!state.filteredEvents.some(e => e.id === state.selectedId)) {
    state.selectedId = state.filteredEvents[0]?.id || null;
  }

  renderFeed();
  renderDetail();
}

function renderFeed() {
  els.feedCount.textContent = `${state.filteredEvents.length} events`;

  if (!state.filteredEvents.length) {
    els.feed.innerHTML = '<div class="muted">No live events yet.</div>';
    return;
  }

  els.feed.innerHTML = state.filteredEvents.map(event => `
    <div class="feed-item ${event.id === state.selectedId ? 'active' : ''}" data-id="${event.id}">
      <div class="feed-top">
        <span class="badge blue">${event.company || ''}</span>
        <span class="muted">${event.datetime || ''}</span>
      </div>
      <div class="feed-title">${event.title || ''}</div>
      <div class="feed-text">${event.text || ''}</div>
      <div class="badges" style="margin-top:10px">
        <span class="badge ${badgeClass((event.analysis && event.analysis.sentiment) || event.sentiment || 'mixed')}">${cap((event.analysis && event.analysis.sentiment) || event.sentiment || 'mixed')}</span>
        <span class="badge">${event.type || event.event_type || 'Event'}</span>
        <span class="badge">Score ${(event.analysis && event.analysis.direct_score) || event.direct_score || 0}</span>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.feed-item').forEach(node => {
    node.addEventListener('click', () => {
      state.selectedId = node.dataset.id;
      renderFeed();
      renderDetail();
    });
  });
}

function renderDetail() {
  const event = state.filteredEvents.find(e => e.id === state.selectedId);

  if (!event) {
    els.detail.innerHTML = '<div class="muted">No event selected.</div>';
    return;
  }

  const analysis = event.analysis || {};
  const matchedKeywords = analysis.matched_keywords || event.keyword_hits || [];
  const factorImpact = analysis.factor_impact || event.factor_impact || {};
  const readthrough = analysis.readthrough || [];
  const chainBuckets = event.chain_buckets || [];
  const primary = event.primary_beneficiaries || [];
  const secondary = event.secondary_beneficiaries || [];

  const factorHtml = Object.entries(factorImpact).map(([k, v]) => `
    <div class="factor-box">
      <strong>${k.replaceAll('_', ' ')}</strong>
      <div class="badge blue">${v}</div>
    </div>
  `).join('');

  const readthroughHtml = readthrough.length
    ? readthrough.map(item => `
        <div class="readthrough-item">
          <div class="readthrough-top">
            <div>
              <strong>${item.ticker || ''}</strong>
              <div class="muted">${item.summary || ''}</div>
            </div>
            <div>
              <div style="font-weight:700; text-align:right; margin-bottom:8px">${item.score || 0}</div>
              <div class="mini-progress"><span style="width:${item.score || 0}%"></span></div>
            </div>
          </div>
        </div>
      `).join('')
    : '<div class="muted">No readthrough items.</div>';

  els.detail.innerHTML = `
    <div class="detail-head">
      <div>
        <div class="badges">
          <span class="badge blue">${event.company || ''}</span>
          <span class="badge">${event.type || event.event_type || 'Event'}</span>
          <span class="badge ${badgeClass(analysis.sentiment || event.sentiment || 'mixed')}">${cap(analysis.sentiment || event.sentiment || 'mixed')}</span>
          <span class="badge">${event.source_kind || 'source'}</span>
        </div>
        <div class="detail-title">${event.title || event.headline || ''}</div>
        <div class="detail-text">${event.text || event.raw_text || ''}</div>
        <div class="muted" style="margin-top:10px">
          Source:
          ${event.url ? `<a href="${event.url}" target="_blank" rel="noreferrer">${event.source || event.url}</a>` : (event.source || 'N/A')}
        </div>
      </div>
      <div class="ticker-card" style="min-width:220px">
        <div class="muted">Direct impact</div>
        ${scoreBoxHtml(analysis.direct_score || event.direct_score || 0)}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Chain buckets</div>
      <div class="keywords">
        ${chainBuckets.length ? chainBuckets.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No chain buckets mapped</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Primary beneficiaries</div>
      <div class="keywords">
        ${primary.length ? primary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No primary beneficiaries</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Secondary readthrough</div>
      <div class="keywords">
        ${secondary.length ? secondary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No secondary readthrough</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Keyword hits</div>
      <div class="keywords">
        ${matchedKeywords.length ? matchedKeywords.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No keyword hits</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Why it matters</div>
      <div class="manual-source-box">${event.why_it_matters || 'No explanation generated yet.'}</div>
    </div>

    <div class="factor-grid">
      ${factorHtml || '<div class="muted">No factor data.</div>'}
    </div>

    <div class="section-title" style="margin-top:20px">Cross-ticker readthrough</div>
    <div class="readthrough">${readthroughHtml}</div>
  `;
}

function analyzeManualEvent(text) {
  const cls = classify(text);
  return {
    eventType: detectEventType(text),
    sentiment: cls.sentiment,
    chainBuckets: cls.chain_buckets,
    primary: cls.primary_beneficiaries,
    secondary: cls.secondary_beneficiaries,
    keywordHits: cls.keyword_hits,
    factorImpact: cls.factor_impact,
    why: cls.why_it_matters
  };
}

function renderAnalyzerResult(result, rawText, sourceUrl = '', fetchedTitle = '') {
  if (!result) {
    els.analyzerOutput.innerHTML = '<div class="muted">No manual event analyzed yet.</div>';
    state.manualDraftResult = null;
    return;
  }

  state.manualDraftResult = {
    result,
    rawText,
    sourceUrl,
    fetchedTitle
  };

  const factorHtml = Object.entries(result.factorImpact).map(([k, v]) => `
    <div class="factor-box">
      <strong>${k}</strong>
      <div class="badge blue">${v}</div>
    </div>
  `).join('');

  els.analyzerOutput.innerHTML = `
    <div class="analyzer-section">
      <div class="badges">
        <span class="badge">${result.eventType}</span>
        <span class="badge ${badgeClass(result.sentiment)}">${cap(result.sentiment)}</span>
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Source</div>
      <div class="manual-source-box">
        <div><strong>URL:</strong> ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noreferrer">${sourceUrl}</a>` : 'None'}</div>
        <div style="margin-top:8px;"><strong>Fetched title:</strong> ${fetchedTitle || 'N/A'}</div>
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Input text</div>
      <div class="manual-source-box">${rawText || 'N/A'}</div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-two-col">
        <div class="analyzer-block">
          <div class="analyzer-title">Chain buckets</div>
          <div class="keywords">
            ${result.chainBuckets.length ? result.chainBuckets.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No bucket matched</span>'}
          </div>
        </div>

        <div class="analyzer-block">
          <div class="analyzer-title">Keyword hits</div>
          <div class="keywords">
            ${result.keywordHits.length ? result.keywordHits.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No keyword hits</span>'}
          </div>
        </div>
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-two-col">
        <div class="analyzer-block">
          <div class="analyzer-title">Primary beneficiaries</div>
          <div class="keywords">
            ${result.primary.length ? result.primary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No primary beneficiary matched</span>'}
          </div>
        </div>

        <div class="analyzer-block">
          <div class="analyzer-title">Secondary readthrough</div>
          <div class="keywords">
            ${result.secondary.length ? result.secondary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No secondary readthrough matched</span>'}
          </div>
        </div>
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Why it matters</div>
      <div class="manual-source-box">${result.why}</div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Financial bridge</div>
      <div class="factor-grid">${factorHtml}</div>
    </div>
  `;
}

function buildManualArchivedEvent({ text, url, fetchedTitle, analysisResult }) {
  const now = new Date().toISOString();

  return {
    id: `manual_${Date.now()}`,
    company: analysisResult.primary?.[0] || 'MANUAL',
    source_company: analysisResult.primary?.[0] || 'MANUAL',
    source_kind: 'manual_archive',
    event_type: analysisResult.eventType || 'Manual analysis',
    type: analysisResult.eventType || 'Manual analysis',
    title: fetchedTitle || text.slice(0, 120) || 'Manual event',
    headline: fetchedTitle || text.slice(0, 120) || 'Manual event',
    text: text,
    raw_text: text,
    published_at: now,
    datetime: now,
    source: url ? 'Manual URL analysis' : 'Manual text analysis',
    url: url || '#',
    chain_buckets: analysisResult.chainBuckets || [],
    primary_beneficiaries: analysisResult.primary || [],
    secondary_beneficiaries: analysisResult.secondary || [],
    keyword_hits: analysisResult.keywordHits || [],
    sentiment: analysisResult.sentiment || 'mixed',
    factor_impact: analysisResult.factorImpact || {},
    why_it_matters: analysisResult.why || '',
    analysis: {
      sentiment: analysisResult.sentiment || 'mixed',
      direct_score: analysisResult.primary?.length ? 68 : 52,
      matched_keywords: analysisResult.keywordHits || [],
      factor_impact: analysisResult.factorImpact || {},
      readthrough: (analysisResult.secondary || []).slice(0, 3).map((x, i) => ({
        ticker: x,
        score: 62 - i * 6,
        summary: `Manual analyzed event may have readthrough into ${x}.`
      }))
    }
  };
}

function bindAnalyzer() {
  els.analyzeBtn.addEventListener('click', async () => {
    const typedText = els.manualInput.value.trim();
    const sourceUrl = els.manualUrlInput.value.trim();

    let combinedText = typedText;
    let fetchedTitle = '';

    if (sourceUrl) {
      try {
        const fetched = await fetchUrlContent(sourceUrl);
        fetchedTitle = fetched.title || '';
        combinedText = [typedText, fetched.title, fetched.text].filter(Boolean).join(' ').trim();
      } catch (err) {
        const fallbackText = typedText || sourceUrl;
        const result = analyzeManualEvent(fallbackText);
        renderAnalyzerResult(
          {
            ...result,
            why: `${result.why} URL fetch failed, so the analysis used the typed text or URL string only.`
          },
          fallbackText,
          sourceUrl,
          ''
        );
        return;
      }
    }

    if (!combinedText.trim()) {
      renderAnalyzerResult(null, '', '', '');
      return;
    }

    const result = analyzeManualEvent(combinedText);
    renderAnalyzerResult(result, combinedText, sourceUrl, fetchedTitle);
  });

  els.saveAnalyzeBtn.addEventListener('click', () => {
    if (!state.manualDraftResult) return;

    const archivedEvent = buildManualArchivedEvent({
      text: state.manualDraftResult.rawText,
      url: state.manualDraftResult.sourceUrl,
      fetchedTitle: state.manualDraftResult.fetchedTitle,
      analysisResult: state.manualDraftResult.result
    });

    state.manualArchivedEvents.unshift(archivedEvent);
    localStorage.setItem('manualArchivedEvents', JSON.stringify(state.manualArchivedEvents));

    ensureCompanyFilterOptions(getAllEvents());
    els.companyFilter.value = 'ALL';
    state.selectedId = archivedEvent.id;
    applyFilters();
  });

  els.clearAnalyzeBtn.addEventListener('click', () => {
    els.manualInput.value = '';
    els.manualUrlInput.value = '';
    renderAnalyzerResult(null, '', '', '');
  });
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(`${btn.dataset.tab}Panel`);
      if (target) target.classList.add('active');
    });
  });
}

els.companyFilter.addEventListener('change', applyFilters);
els.searchInput.addEventListener('input', applyFilters);

els.searchInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = els.searchInput.value.trim();
    if (val) {
      await quickLookupTicker(val);
    }
  }
});

els.refreshBtn.addEventListener('click', async () => {
  els.dataStamp.textContent = 'Refreshing...';
  await loadData();
});

bindAnalyzer();
initTabs();
loadData();
setInterval(loadData, 60000);
