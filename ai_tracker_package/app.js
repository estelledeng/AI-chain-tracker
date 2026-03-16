const state = {
  data: null,
  filteredEvents: [],
  selectedId: null,
  activeTab: 'bridge'
};

const els = {
  companyFilter: document.getElementById('companyFilter'),
  searchInput: document.getElementById('searchInput'),
  feed: document.getElementById('feed'),
  detail: document.getElementById('detail'),
  scoreCards: document.getElementById('scoreCards'),
  systemStatus: document.getElementById('systemStatus'),
  bridgePanel: document.getElementById('bridgePanel'),
  alertsPanel: document.getElementById('alertsPanel'),
  sourcesPanel: document.getElementById('sourcesPanel'),
  watchlistPanel: document.getElementById('watchlistPanel'),
  feedCount: document.getElementById('feedCount'),
  dataStamp: document.getElementById('dataStamp'),
  refreshBtn: document.getElementById('refreshBtn')
};

function badgeClass(sentiment) {
  if (sentiment === 'bullish') return 'green';
  if (sentiment === 'bearish') return 'red';
  return 'amber';
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function scoreBoxHtml(score) {
  return `<div class="score-bar"><span style="width:${score}%"></span></div><div class="score-value">${score}</div>`;
}

async function loadData() {
  const response = await fetch(`data/events.json?ts=${Date.now()}`);
  const data = await response.json();
  state.data = data;
  els.dataStamp.textContent = `Updated ${data.generated_at} · Sources: official IR / event pages`;
  renderStaticPanels();
  applyFilters();
}

function renderStaticPanels() {
  const { dashboard_scores, source_configs, alerts, eps_bridge, extended_watchlist } = state.data;
  els.scoreCards.innerHTML = dashboard_scores.map(item => `
    <div class="score-card">
      <div class="ticker">${item.ticker}</div>
      ${scoreBoxHtml(item.score)}
      <div class="muted">${item.role}</div>
    </div>
  `).join('');

  els.systemStatus.innerHTML = source_configs.map(src => `
    <div class="status-row">
      <div>
        <div><strong>${src.name}</strong></div>
        <div class="muted">${src.type}</div>
      </div>
      <div class="badge ${src.status === 'Ready to connect' ? 'green' : 'amber'}">${src.status}</div>
    </div>
  `).join('');

  els.bridgePanel.innerHTML = Object.entries(eps_bridge).map(([ticker, rows]) => `
    <div class="bridge-card">
      <div class="feed-top"><strong>${ticker}</strong><span class="badge blue">Quarterly bridge</span></div>
      <div class="bridge-grid-inner">
        ${rows.map(r => `<div class="factor-box"><strong>${r.label}</strong><div class="badge blue">${r.effect}</div><div class="muted" style="margin-top:8px">${r.note}</div></div>`).join('')}
      </div>
    </div>
  `).join('');

  els.alertsPanel.innerHTML = `<div class="alert-grid">${alerts.map(a => `
    <div class="alert-card">
      <div class="feed-top"><strong>${a.title}</strong><span class="badge ${a.severity === 'High' ? 'red' : 'amber'}">${a.severity}</span></div>
      <div class="muted" style="margin-bottom:10px">${a.scope}</div>
      <div><strong>Condition</strong></div>
      <div class="muted">${a.condition}</div>
      <div style="margin-top:10px"><strong>Action</strong></div>
      <div class="muted">${a.action}</div>
    </div>
  `).join('')}</div>`;

  els.sourcesPanel.innerHTML = `<div class="source-grid">${source_configs.map(s => `
    <div class="source-card">
      <div class="feed-top"><strong>${s.name}</strong><span class="badge ${s.status === 'Ready to connect' ? 'green' : 'amber'}">${s.status}</span></div>
      <div class="muted">${s.type}</div>
      <div style="margin-top:10px"><code>${s.endpoint}</code></div>
      <div style="margin-top:10px"><a href="${s.url}" target="_blank" rel="noreferrer">Open source</a></div>
    </div>
  `).join('')}</div>`;

  els.watchlistPanel.innerHTML = `<div class="watch-grid">${extended_watchlist.map(w => `
    <div class="watch-card">
      <strong>${w.ticker}</strong>
      <div class="muted" style="margin-top:6px">${w.role}</div>
      <div class="badge blue" style="margin-top:10px">${w.phase}</div>
    </div>
  `).join('')}</div>`;
}

function applyFilters() {
  const company = els.companyFilter.value;
  const q = els.searchInput.value.trim().toLowerCase();
  state.filteredEvents = state.data.events.filter(event => {
    const companyMatch = company === 'ALL' || event.company === company;
    const text = `${event.title} ${event.text} ${(event.analysis.matched_keywords || []).join(' ')}`.toLowerCase();
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
  els.feed.innerHTML = state.filteredEvents.map(event => `
    <div class="feed-item ${event.id === state.selectedId ? 'active' : ''}" data-id="${event.id}">
      <div class="feed-top">
        <span class="badge blue">${event.company}</span>
        <span class="muted">${event.datetime}</span>
      </div>
      <div class="feed-title">${event.title}</div>
      <div class="feed-text">${event.text}</div>
      <div class="badges" style="margin-top:10px">
        <span class="badge ${badgeClass(event.analysis.sentiment)}">${cap(event.analysis.sentiment)}</span>
        <span class="badge">${event.type}</span>
        <span class="badge">Score ${event.analysis.direct_score}</span>
      </div>
    </div>
  `).join('');

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
  const factors = Object.entries(event.analysis.factor_impact).map(([k, v]) => `
    <div class="factor-box"><strong>${k.replaceAll('_', ' ')}</strong><div class="badge blue">${v}</div></div>
  `).join('');

  const readthrough = event.analysis.readthrough.map(item => `
    <div class="readthrough-item">
      <div class="readthrough-top">
        <div><strong>${item.ticker}</strong><div class="muted">${item.summary}</div></div>
        <div>
          <div style="font-weight:700; text-align:right; margin-bottom:8px">${item.score}</div>
          <div class="mini-progress"><span style="width:${item.score}%"></span></div>
        </div>
      </div>
    </div>
  `).join('');

  els.detail.innerHTML = `
    <div class="detail-head">
      <div>
        <div class="badges">
          <span class="badge blue">${event.company}</span>
          <span class="badge">${event.type}</span>
          <span class="badge ${badgeClass(event.analysis.sentiment)}">${cap(event.analysis.sentiment)}</span>
        </div>
        <div class="detail-title">${event.title}</div>
        <div class="detail-text">${event.text}</div>
        <div class="muted" style="margin-top:10px">Source: <a href="${event.url}" target="_blank" rel="noreferrer">${event.source}</a></div>
      </div>
      <div class="score-card" style="min-width:180px">
        <div class="muted">Direct impact</div>
        ${scoreBoxHtml(event.analysis.direct_score)}
      </div>
    </div>
    <div class="keywords" style="margin-top:14px">${(event.analysis.matched_keywords || []).map(k => `<span class="keyword">${k}</span>`).join('')}</div>
    <div class="factor-grid">${factors}</div>
    <div class="card-title" style="margin-top:20px">Cross-ticker readthrough</div>
    <div class="readthrough">${readthrough}</div>
  `;
}

function initTabs() {
  Array.from(document.querySelectorAll('.tab')).forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      Array.from(document.querySelectorAll('.tab')).forEach(x => x.classList.toggle('active', x === btn));
      Array.from(document.querySelectorAll('.tab-panel')).forEach(panel => {
        panel.classList.toggle('active', panel.id === `${state.activeTab}Panel`);
      });
    });
  });
}

els.companyFilter.addEventListener('change', applyFilters);
els.searchInput.addEventListener('input', applyFilters);
els.refreshBtn.addEventListener('click', loadData);

initTabs();
loadData().catch(err => {
  console.error(err);
  els.dataStamp.textContent = 'Failed to load data';
});
