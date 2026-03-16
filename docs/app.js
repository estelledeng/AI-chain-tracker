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
  refreshBtn: document.getElementById('refreshBtn')
};

function badgeClass(sentiment) {
  if (sentiment === 'bullish') return 'green';
  if (sentiment === 'bearish') return 'red';
  return 'amber';
}

function cap(s = '') {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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
      events: Array.isArray(data.events) ? data.events : []
    };

    els.dataStamp.textContent = state.data.generated_at
      ? `Updated ${state.data.generated_at}`
      : 'Live data loaded';

    ensureCompanyFilterOptions(state.data.events);
    renderStaticPanels();
    applyFilters();
  } catch (err) {
    console.error(err);
    els.dataStamp.textContent = 'Failed to load data';
    els.scoreCards.innerHTML = '<div class="muted">No live score data.</div>';
    els.systemStatus.innerHTML = '<div class="muted">No live source status.</div>';
    els.feed.innerHTML = '<div class="muted">No live events.</div>';
    els.detail.innerHTML = '<div class="muted">No event selected.</div>';
    if (els.feedCount) els.feedCount.textContent = '0 events';
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

function applyFilters() {
  const company = els.companyFilter.value;
  const q = els.searchInput.value.trim().toLowerCase();

  state.filteredEvents = (state.data.events || []).filter(event => {
    const companyMatch = company === 'ALL' || event.company === company;
    const text = `${event.title || ''} ${event.text || ''}`.toLowerCase();
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
  if (els.feedCount) {
    els.feedCount.textContent = `${state.filteredEvents.length} events`;
  }

  if (!state.filteredEvents.length) {
    els.feed.innerHTML = '<div class="muted">No live events yet.</div>';
    return;
  }

  els.feed.innerHTML = state.filteredEvents.map(event => {
    const analysis = event.analysis || {};
    return `
      <div class="feed-item ${event.id === state.selectedId ? 'active' : ''}" data-id="${event.id}">
        <div class="feed-top">
          <span class="badge blue">${event.company || ''}</span>
          <span class="muted">${event.datetime || ''}</span>
        </div>
        <div class="feed-title">${event.title || ''}</div>
        <div class="feed-text">${event.text || ''}</div>
        <div class="badges" style="margin-top:10px">
          <span class="badge ${badgeClass(analysis.sentiment || 'mixed')}">${cap(analysis.sentiment || 'mixed')}</span>
          <span class="badge">${event.type || 'Event'}</span>
          <span class="badge">Score ${analysis.direct_score || 0}</span>
        </div>
      </div>
    `;
  }).join('');

  Array.from(document.querySelectorAll('.feed-item')).forEach(node => {
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
  const keywords = Array.isArray(analysis.matched_keywords) ? analysis.matched_keywords : [];
  const factorImpact = analysis.factor_impact || {};
  const readthrough = Array.isArray(analysis.readthrough) ? analysis.readthrough : [];

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
          <span class="badge">${event.type || 'Event'}</span>
          <span class="badge ${badgeClass(analysis.sentiment || 'mixed')}">${cap(analysis.sentiment || 'mixed')}</span>
        </div>
        <div class="detail-title">${event.title || ''}</div>
        <div class="detail-text">${event.text || ''}</div>
        <div class="muted" style="margin-top:10px">
          Source:
          ${event.url ? `<a href="${event.url}" target="_blank" rel="noreferrer">${event.source || event.url}</a>` : (event.source || 'N/A')}
        </div>
      </div>
      <div class="score-card" style="min-width:180px">
        <div class="muted">Direct impact</div>
        ${scoreBoxHtml(analysis.direct_score || 0)}
      </div>
    </div>

    <div class="keywords" style="margin-top:14px">
      ${keywords.map(k => `<span class="keyword">${k}</span>`).join('')}
    </div>

    <div class="factor-grid">
      ${factorHtml || '<div class="muted">No factor data.</div>'}
    </div>

    <div class="card-title" style="margin-top:20px">Cross-ticker readthrough</div>
    <div class="readthrough">${readthroughHtml}</div>
  `;
}

els.companyFilter.addEventListener('change', applyFilters);
els.searchInput.addEventListener('input', applyFilters);
els.refreshBtn.addEventListener('click', loadData);

loadData();
