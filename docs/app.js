const state = {
  data: null,
  filteredEvents: [],
  selectedId: null
};

const els = {
  companyFilter: document.getElementById('companyFilter'),
  searchInput: document.getElementById('searchInput'),
  feed: document.getElementById('feed'),
  detail: document.getElementById('detail'),
  scoreCards: document.getElementById('scoreCards'),
  systemStatus: document.getElementById('systemStatus'),
  feedCount: document.getElementById('feedCount'),
  dataStamp: document.getElementById('dataStamp'),
  refreshBtn: document.getElementById('refreshBtn'),
  manualInput: document.getElementById('manualInput'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  clearAnalyzeBtn: document.getElementById('clearAnalyzeBtn'),
  analyzerOutput: document.getElementById('analyzerOutput'),
  bridgePanel: document.getElementById('bridgePanel'),
  alertsPanel: document.getElementById('alertsPanel'),
  sourcesPanel: document.getElementById('sourcesPanel'),
  watchlistPanel: document.getElementById('watchlistPanel')
};

const CHAIN_RULES = [
  {
    label: 'Compute',
    keywords: ['gpu', 'accelerator', 'compute', 'blackwell', 'rubin', 'chip', 'training cluster'],
    primary: ['NVDA'],
    secondary: ['TSM'],
    factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' }
  },
  {
    label: 'Memory',
    keywords: ['hbm', 'dram', 'memory bandwidth', 'memory capacity', 'memory hierarchy'],
    primary: ['MU'],
    secondary: ['NVDA', 'TSM'],
    factors: { tam: 'high', shipment: 'high', gm: 'high', eps: 'high', timing: 'medium' }
  },
  {
    label: 'Storage',
    keywords: ['context memory', 'kv cache', 'storage tier', 'nand', 'ssd', 'flash', 'tiered memory'],
    primary: ['SNDK'],
    secondary: ['MU', 'NVDA'],
    factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' }
  },
  {
    label: 'Networking',
    keywords: ['scale-out', 'network fabric', 'switching', 'ethernet', 'interconnect', 'rack-scale', 'bandwidth bottleneck'],
    primary: ['ANET', 'MRVL', 'ALAB', 'CRDO'],
    secondary: ['NVDA'],
    factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' }
  },
  {
    label: 'Optics',
    keywords: ['optics', 'optical', 'photonics', 'co-packaged optics', 'optical interconnect'],
    primary: ['LITE', 'COHR'],
    secondary: ['CRDO', 'ANET'],
    factors: { tam: 'medium', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'medium' }
  },
  {
    label: 'Power / Cooling',
    keywords: ['liquid cooling', 'rack density', 'thermal bottleneck', 'power constraint', 'cooling', 'power infrastructure'],
    primary: ['VRT'],
    secondary: ['NVDA'],
    factors: { tam: 'high', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'high' }
  },
  {
    label: 'Foundry / Packaging',
    keywords: ['advanced packaging', 'cowos', 'foundry', 'yield', 'packaging capacity', 'packaging tightness'],
    primary: ['TSM'],
    secondary: ['NVDA', 'MU', 'COHR'],
    factors: { tam: 'medium', shipment: 'medium', gm: 'medium', eps: 'medium', timing: 'high' }
  }
];

const EVENT_TYPE_RULES = [
  { type: 'Keynote / Conference', keywords: ['gtc', 'keynote', 'conference', 'presentation', 'on stage'] },
  { type: 'Earnings / Call', keywords: ['earnings', 'guidance', 'gross margin', 'eps', 'conference call', 'analyst q&a'] },
  { type: 'Partnership / Collaboration', keywords: ['partnership', 'collaboration', 'strategic agreement', 'working with'] },
  { type: 'Product Launch / Roadmap', keywords: ['launch', 'roadmap', 'introduces', 'announces', 'new platform', 'new product'] },
  { type: 'Supply Chain / Capacity', keywords: ['capacity', 'shipment', 'lead time', 'supply', 'ramp', 'packaging tightness'] },
  { type: 'News / Media', keywords: ['reuters', 'bloomberg', 'reported', 'according to'] }
];

function badgeClass(sentiment) {
  if (sentiment === 'bullish') return 'green';
  if (sentiment === 'bearish') return 'red';
  return 'amber';
}

function cap(s = '') {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function scoreBoxHtml(score) {
  return `
    <div class="score-bar"><span style="width:${score}%"></span></div>
    <div class="score-value">${score}</div>
  `;
}

function ensureCompanyFilterOptions(events) {
  const existing = Array.from(els.companyFilter.options).map(o => o.value);
  const tickers = [...new Set((events || []).map(e => e.company).filter(Boolean))];
  tickers.forEach(ticker => {
    if (!existing.includes(ticker)) {
      const option = document.createElement('option');
      option.value = ticker;
      option.textContent = ticker;
      els.companyFilter.appendChild(option);
    }
  });
}

async function loadData() {
  try {
    const response = await fetch(`data/events.json?ts=${Date.now()}`);
    const data = await response.json();

    state.data = {
      generated_at: data.generated_at || '',
      dashboard_scores: Array.isArray(data.dashboard_scores) ? data.dashboard_scores : [],
      source_configs: Array.isArray(data.source_configs) ? data.source_configs : [],
      events: Array.isArray(data.events) ? data.events : [],
      alerts: Array.isArray(data.alerts) ? data.alerts : [],
      eps_bridge: data.eps_bridge || {},
      extended_watchlist: Array.isArray(data.extended_watchlist) ? data.extended_watchlist : []
    };

    els.dataStamp.textContent = state.data.generated_at
      ? `Updated ${state.data.generated_at}`
      : 'Live data loaded';

    ensureCompanyFilterOptions(state.data.events);
    renderStaticPanels();
    renderLowerPanels();
    applyFilters();
  } catch (err) {
    console.error(err);
    els.dataStamp.textContent = 'Failed to load data';
    els.scoreCards.innerHTML = '<div class="muted">No live score data.</div>';
    els.systemStatus.innerHTML = '<div class="muted">No live source status.</div>';
    els.feed.innerHTML = '<div class="muted">No live events.</div>';
    els.detail.innerHTML = '<div class="muted">No event selected.</div>';
    els.bridgePanel.innerHTML = '<div class="muted">No EPS bridge data.</div>';
    els.alertsPanel.innerHTML = '<div class="muted">No alert rules.</div>';
    els.sourcesPanel.innerHTML = '<div class="muted">No source details.</div>';
    els.watchlistPanel.innerHTML = '<div class="muted">No watchlist data.</div>';
  }
}

function renderStaticPanels() {
  const scores = state.data.dashboard_scores || [];
  const sources = state.data.source_configs || [];

  els.scoreCards.innerHTML = scores.length
    ? scores.map(item => `
        <div class="score-card">
          <div class="ticker">${item.ticker}</div>
          ${scoreBoxHtml(item.score || 0)}
          <div class="muted">${item.role || ''}</div>
        </div>
      `).join('')
    : '<div class="muted">No live score data.</div>';

  els.systemStatus.innerHTML = sources.length
    ? sources.map(src => `
        <div class="status-row">
          <div>
            <div><strong>${src.name || ''}</strong></div>
            <div class="muted">${src.type || ''}</div>
          </div>
          <div class="badge ${src.status === 'Live connected' ? 'green' : 'amber'}">
            ${src.status || 'Unknown'}
          </div>
        </div>
      `).join('')
    : '<div class="muted">No live source status.</div>';
}

function renderLowerPanels() {
  const bridge = state.data.eps_bridge || {};
  const alerts = state.data.alerts || [];
  const sources = state.data.source_configs || [];
  const watchlist = state.data.extended_watchlist || [];

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

  state.filteredEvents = (state.data.events || []).filter(event => {
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
        <span class="badge blue">${event.company || event.source_company || ''}</span>
        <span class="muted">${event.datetime || event.published_at || ''}</span>
      </div>
      <div class="feed-title">${event.title || event.headline || ''}</div>
      <div class="feed-text">${event.text || event.raw_text || ''}</div>
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
          <span class="badge blue">${event.company || event.source_company || ''}</span>
          <span class="badge">${event.type || event.event_type || 'Event'}</span>
          <span class="badge ${badgeClass(analysis.sentiment || event.sentiment || 'mixed')}">${cap(analysis.sentiment || event.sentiment || 'mixed')}</span>
        </div>
        <div class="detail-title">${event.title || event.headline || ''}</div>
        <div class="detail-text">${event.text || event.raw_text || ''}</div>
        <div class="muted" style="margin-top:10px">
          Source:
          ${event.url ? `<a href="${event.url}" target="_blank" rel="noreferrer">${event.source || event.url}</a>` : (event.source || 'N/A')}
        </div>
      </div>
      <div class="score-card" style="min-width:180px">
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
      <div class="muted">${event.why_it_matters || 'No explanation generated yet.'}</div>
    </div>

    <div class="factor-grid">
      ${factorHtml || '<div class="muted">No factor data.</div>'}
    </div>

    <div class="section-title" style="margin-top:20px">Cross-ticker readthrough</div>
    <div class="readthrough">${readthroughHtml}</div>
  `;
}

function detectEventType(text) {
  const lower = text.toLowerCase();
  for (const rule of EVENT_TYPE_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.type;
  }
  return 'General event / commentary';
}

function analyzeManualEvent(text) {
  const lower = text.toLowerCase();

  const matchedBuckets = CHAIN_RULES.filter(rule =>
    rule.keywords.some(k => lower.includes(k))
  );

  const chainBuckets = matchedBuckets.map(r => r.label);
  const primary = [...new Set(matchedBuckets.flatMap(r => r.primary))];
  const secondary = [...new Set(matchedBuckets.flatMap(r => r.secondary))];
  const keywordHits = [...new Set(matchedBuckets.flatMap(r => r.keywords.filter(k => lower.includes(k))))];

  let sentiment = 'mixed';
  if (keywordHits.length >= 2) sentiment = 'bullish';

  const factorImpact = {
    tam: 'medium',
    shipment: 'medium',
    gm: 'medium',
    eps: 'medium',
    timing: 'medium'
  };

  matchedBuckets.forEach(rule => {
    Object.entries(rule.factors).forEach(([k, v]) => {
      if (v === 'high') factorImpact[k] = 'high';
    });
  });

  let why = 'This language does not yet strongly map to a single AI chain bucket.';
  if (chainBuckets.length) {
    why = `The language most directly maps to ${chainBuckets.join(', ')}. Primary beneficiaries are ${primary.join(', ') || 'unclear'}, with secondary readthrough into ${secondary.join(', ') || 'unclear'}.`;
  }

  return {
    eventType: detectEventType(text),
    sentiment,
    chainBuckets,
    primary,
    secondary,
    keywordHits,
    factorImpact,
    why
  };
}

function renderAnalyzerResult(result, rawText) {
  if (!result) {
    els.analyzerOutput.innerHTML = '<div class="muted">No manual event analyzed yet.</div>';
    return;
  }

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
      <div class="analyzer-title">Input text</div>
      <div class="muted">${rawText}</div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Chain buckets</div>
      <div class="keywords">
        ${result.chainBuckets.length ? result.chainBuckets.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No bucket matched</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Primary beneficiaries</div>
      <div class="keywords">
        ${result.primary.length ? result.primary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No primary beneficiary matched</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Secondary readthrough</div>
      <div class="keywords">
        ${result.secondary.length ? result.secondary.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No secondary readthrough matched</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Keyword hits</div>
      <div class="keywords">
        ${result.keywordHits.length ? result.keywordHits.map(x => `<span class="keyword">${x}</span>`).join('') : '<span class="muted">No keyword hits</span>'}
      </div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Why it matters</div>
      <div class="muted">${result.why}</div>
    </div>

    <div class="analyzer-section">
      <div class="analyzer-title">Financial bridge</div>
      <div class="factor-grid">${factorHtml}</div>
    </div>
  `;
}

function bindAnalyzer() {
  if (!els.analyzeBtn) return;

  els.analyzeBtn.addEventListener('click', () => {
    const text = els.manualInput.value.trim();
    if (!text) {
      renderAnalyzerResult(null, '');
      return;
    }
    renderAnalyzerResult(analyzeManualEvent(text), text);
  });

  els.clearAnalyzeBtn.addEventListener('click', () => {
    els.manualInput.value = '';
    renderAnalyzerResult(null, '');
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
els.refreshBtn.addEventListener('click', loadData);

bindAnalyzer();
initTabs();
loadData();
