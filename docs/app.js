const state = {
  data: null,
  filteredEvents: [],
  selectedId: null,
  activeTab: 'bridge'
};

const ALL_TICKERS = [
  'NVDA', 'MU', 'SNDK',
  'ANET', 'VRT', 'TSM',
  'MRVL', 'ALAB', 'CRDO',
  'LITE', 'COHR'
];

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

function cap(s = '') {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function scoreBoxHtml(score) {
  return `<div class="score-bar"><span style="width:${score}%"></span></div><div class="score-value">${score}</div>`;
}

function ensureCompanyFilterOptions() {
  const existingValues = Array.from(els.companyFilter.options).map(o => o.value);
  ALL_TICKERS.forEach(ticker => {
    if (!existingValues.includes(ticker)) {
      const option = document.createElement('option');
      option.value = ticker;
      option.textContent = ticker;
      els.companyFilter.appendChild(option);
    }
  });
}

function defaultDashboardScores() {
  return [
    { ticker: 'NVDA', score: 86, role: 'Platform / AI Factory Architecture' },
    { ticker: 'MU', score: 81, role: 'HBM / DRAM / NAND' },
    { ticker: 'SNDK', score: 78, role: 'NAND / SSD / Inference Storage Tier' },
    { ticker: 'ANET', score: 74, role: 'AI Networking / Scale-out Fabric' },
    { ticker: 'VRT', score: 73, role: 'Power / Cooling / Deployment' },
    { ticker: 'TSM', score: 76, role: 'Foundry / Advanced Packaging' },
    { ticker: 'MRVL', score: 71, role: 'Interconnect / Custom Infrastructure' },
    { ticker: 'ALAB', score: 70, role: 'Rack-scale Connectivity / AI IO' },
    { ticker: 'CRDO', score: 69, role: 'High-speed Interconnect / AI Fabric' },
    { ticker: 'LITE', score: 67, role: 'Optics / AI Data Center Connectivity' },
    { ticker: 'COHR', score: 66, role: 'Optics / Package Integration' }
  ];
}

function defaultSourceConfigs() {
  return [
    {
      name: 'NVIDIA IR',
      type: 'Press releases / events / financial reports',
      status: 'Ready to connect',
      endpoint: '/api/sources/nvda',
      url: 'https://investor.nvidia.com/home/default.aspx'
    },
    {
      name: 'Micron IR',
      type: 'Investor relations / latest news / quarterly results',
      status: 'Ready to connect',
      endpoint: '/api/sources/mu',
      url: 'https://investors.micron.com/'
    },
    {
      name: 'Sandisk IR',
      type: 'Investor relations / news releases / presentations',
      status: 'Ready to connect',
      endpoint: '/api/sources/sndk',
      url: 'https://investor.sandisk.com/'
    },
    {
      name: 'Transcript parser',
      type: 'Keynote / earnings call / analyst Q&A parsing',
      status: 'Needs parser',
      endpoint: '/api/transcripts/parse',
      url: '#'
    }
  ];
}

function defaultAlerts() {
  return [
    {
      title: 'NVDA mentions context memory or KV cache',
      scope: 'NVDA → SNDK / MU',
      condition: 'Trigger when transcript contains context memory, KV cache, memory hierarchy, or AI-native storage.',
      action: 'Send priority alert and recalculate readthrough scores.',
      severity: 'High'
    },
    {
      title: 'MU raises HBM shipment or gross margin commentary',
      scope: 'MU direct / NVDA readthrough',
      condition: 'Trigger when management upgrades HBM volumes, pricing discipline, or GM trajectory.',
      action: 'Update EPS bridge and mark near-term earnings sensitivity higher.',
      severity: 'High'
    },
    {
      title: 'SNDK mentions design wins or customer sampling',
      scope: 'SNDK direct / NVDA architecture fit',
      condition: 'Trigger on design win, sampling, qualification, or production-ramp language.',
      action: 'Promote roadmap item into commercialization watchlist.',
      severity: 'Medium'
    },
    {
      title: 'Networking language shifts toward scale-out or fabric bottlenecks',
      scope: 'ANET / MRVL / ALAB / CRDO / LITE / COHR',
      condition: 'Trigger on scale-out, network fabric, optical interconnect, or bandwidth bottleneck language.',
      action: 'Raise connectivity cluster sensitivity and review cross-readthrough from NVDA.',
      severity: 'High'
    },
    {
      title: 'AI deployment highlights liquid cooling or power constraints',
      scope: 'VRT direct / NVDA readthrough',
      condition: 'Trigger on liquid cooling, AI-ready power, rack density, or thermal bottleneck phrasing.',
      action: 'Increase deployment bottleneck score and power/cooling importance.',
      severity: 'High'
    },
    {
      title: 'Supply chain highlights advanced packaging tightness',
      scope: 'TSM / COHR / NVDA',
      condition: 'Trigger on advanced packaging, supply tightness, CoWoS, or next-gen ramp timing language.',
      action: 'Mark upstream constraint and platform ramp sensitivity higher.',
      severity: 'Medium'
    }
  ];
}

function defaultEPSBridge() {
  return {
    NVDA: [
      { label: 'AI factory / inference demand', effect: '+ Revenue', note: 'Broader system demand expands platform revenue opportunity.' },
      { label: 'Deployment speed', effect: '+ / - Timing', note: 'Faster validated deployment accelerates revenue conversion; delays push timing right.' },
      { label: 'Networking + memory attach', effect: '+ Mix / GM', note: 'Higher full-stack attach can support richer blended margins.' },
      { label: 'Customer concentration', effect: '- Risk', note: 'Demand breadth matters when expectations are already elevated.' }
    ],
    MU: [
      { label: 'HBM shipments', effect: '+ Revenue', note: 'Shipment growth directly lifts AI memory revenue.' },
      { label: 'Pricing discipline', effect: '+ GM', note: 'Constructive pricing improves gross margin and EPS conversion.' },
      { label: 'AI server memory intensity', effect: '+ Mix', note: 'Richer data-center mix can shift profitability upward.' },
      { label: 'Bit supply constraints', effect: '+ / -', note: 'Tight supply can help price but cap volume if too severe.' }
    ],
    SNDK: [
      { label: 'Context memory relevance', effect: '+ Narrative / TAM', note: 'Can re-rate SNDK from commodity NAND to AI storage layer.' },
      { label: 'Design wins / sampling', effect: '+ Revenue timing', note: 'Commercial validation is required for roadmap to become earnings.' },
      { label: 'Tiered memory adoption', effect: '+ Mix', note: 'Higher-value flash use cases can lift product mix and margin quality.' },
      { label: 'HBM substitution risk', effect: '- Risk', note: 'If customers solve more at the HBM/DRAM layer, flash attach may lag.' }
    ],
    ANET: [
      { label: 'Scale-out cluster demand', effect: '+ Revenue', note: 'Bigger AI clusters increase switching and fabric spend.' },
      { label: 'AI network attach', effect: '+ Mix', note: 'Higher-value AI networking can lift margin mix versus standard enterprise traffic.' },
      { label: 'Deployment pacing', effect: '+ / - Timing', note: 'AI capacity build speed directly affects order timing.' },
      { label: 'Competitive intensity', effect: '- Risk', note: 'Networking narratives can shift quickly if architecture preferences change.' }
    ],
    VRT: [
      { label: 'Liquid cooling adoption', effect: '+ Revenue', note: 'Denser AI racks increase cooling and thermal-management opportunity.' },
      { label: 'Power infrastructure content', effect: '+ TAM', note: 'AI-ready data center builds expand electrical and deployment wallet share.' },
      { label: 'Deployment bottlenecks', effect: '+ Pricing / Timing', note: 'Urgent capacity needs can support pricing and faster conversion.' },
      { label: 'Project timing risk', effect: '- Risk', note: 'Large deployments can slip if customer buildouts move slowly.' }
    ],
    TSM: [
      { label: 'Advanced packaging demand', effect: '+ Revenue', note: 'AI ramps increase packaging and foundry utilization.' },
      { label: 'Next-gen platform cadence', effect: '+ Mix', note: 'Leading-edge AI chips support richer margin mix.' },
      { label: 'Capacity tightness', effect: '+ / -', note: 'Tight supply supports pricing but can cap short-term volume.' },
      { label: 'Customer concentration', effect: '- Risk', note: 'A few platform customers can drive a large share of readthrough.' }
    ],
    MRVL: [
      { label: 'AI interconnect demand', effect: '+ Revenue', note: 'System-level connectivity ramps increase custom infrastructure demand.' },
      { label: 'Custom silicon relevance', effect: '+ Mix', note: 'Higher-value infrastructure chips can support margin quality.' },
      { label: 'Cloud capex timing', effect: '+ / - Timing', note: 'Hyperscaler rollout pace shapes conversion.' },
      { label: 'Execution complexity', effect: '- Risk', note: 'Custom design ramps require sustained customer momentum.' }
    ],
    ALAB: [
      { label: 'Rack-scale design wins', effect: '+ Revenue', note: 'As rack becomes the unit of compute, attach opportunities rise.' },
      { label: 'AI IO content growth', effect: '+ TAM', note: 'Richer connectivity layers increase platform relevance.' },
      { label: 'Commercial validation', effect: '+ / - Timing', note: 'Design-win language matters for future revenue timing.' },
      { label: 'Emerging-category volatility', effect: '- Risk', note: 'The story is strong, but the category is still maturing.' }
    ],
    CRDO: [
      { label: 'High-speed interconnect demand', effect: '+ Revenue', note: 'AI fabric growth supports cable and interconnect content.' },
      { label: 'Bandwidth bottlenecks', effect: '+ Mix', note: 'More demanding AI clusters support richer product mix.' },
      { label: 'Hyperscaler adoption', effect: '+ / - Timing', note: 'Customer deployment pace drives quarterly conversion.' },
      { label: 'Competition risk', effect: '- Risk', note: 'Interconnect markets remain highly competitive.' }
    ],
    LITE: [
      { label: 'Optics demand', effect: '+ Revenue', note: 'AI data center scaling supports optical module and photonics demand.' },
      { label: 'Bandwidth scaling', effect: '+ TAM', note: 'Larger AI systems need denser and faster optical connectivity.' },
      { label: 'Design qualification timing', effect: '+ / - Timing', note: 'Optical ramps can take time to convert into production.' },
      { label: 'Customer concentration', effect: '- Risk', note: 'A few large programs can shape the story.' }
    ],
    COHR: [
      { label: 'Optics and integration demand', effect: '+ Revenue', note: 'AI system growth can drive optics and advanced package integration relevance.' },
      { label: 'Advanced packaging tie-in', effect: '+ Mix', note: 'Deeper system integration can support higher-value positioning.' },
      { label: 'Program ramp timing', effect: '+ / - Timing', note: 'Strategic partnerships matter only when they convert into ramps.' },
      { label: 'Execution risk', effect: '- Risk', note: 'Integration-heavy categories carry timing and execution risk.' }
    ]
  };
}

function defaultWatchlist() {
  return [
    { ticker: 'ANET', role: 'Networking / scale-out fabric', phase: 'Added' },
    { ticker: 'VRT', role: 'Power / cooling / deployment bottleneck', phase: 'Added' },
    { ticker: 'MRVL', role: 'Interconnect / custom infrastructure', phase: 'Added' },
    { ticker: 'TSM', role: 'Advanced manufacturing / packaging readthrough', phase: 'Added' },
    { ticker: 'ALAB', role: 'Rack-scale connectivity / AI IO', phase: 'Added' },
    { ticker: 'CRDO', role: 'High-speed interconnect / AI fabric', phase: 'Added' },
    { ticker: 'LITE', role: 'Optics / AI data center connectivity', phase: 'Added' },
    { ticker: 'COHR', role: 'Optics / package integration', phase: 'Added' }
  ];
}

function fallbackEvents() {
  return [
    {
      id: 'e1',
      company: 'NVDA',
      type: 'Keynote',
      datetime: '2026-03-17 03:10 JST',
      title: 'NVIDIA expands AI factory framing and highlights inference economics',
      text: 'Jensen emphasizes AI factory buildout, inference economics, memory hierarchy, and system-level deployment.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 88,
        matched_keywords: ['AI factory', 'inference economics', 'memory hierarchy'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'high',
          gross_margin: 'medium',
          eps: 'high'
        },
        readthrough: [
          { ticker: 'MU', score: 79, summary: 'HBM and memory hierarchy benefit from stronger AI platform intensity.' },
          { ticker: 'SNDK', score: 74, summary: 'Inference storage and context-memory narratives improve.' },
          { ticker: 'ANET', score: 77, summary: 'Scale-out networking demand strengthens alongside AI factories.' },
          { ticker: 'VRT', score: 69, summary: 'Higher deployment density supports cooling and power readthrough.' }
        ]
      }
    },
    {
      id: 'e2',
      company: 'MU',
      type: 'Earnings',
      datetime: '2026-03-19 04:30 JST',
      title: 'Micron reports stronger HBM mix and disciplined pricing',
      text: 'Management highlights HBM shipments, improving gross margin, pricing discipline, and stronger data-center mix.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 84,
        matched_keywords: ['HBM', 'gross margin', 'pricing discipline', 'shipments'],
        factor_impact: {
          market_size: 'medium',
          delivery_speed: 'medium',
          gross_margin: 'high',
          eps: 'high'
        },
        readthrough: [
          { ticker: 'NVDA', score: 71, summary: 'Memory supply and pricing support NVDA platform confidence.' },
          { ticker: 'TSM', score: 58, summary: 'Upstream AI intensity remains constructive.' }
        ]
      }
    },
    {
      id: 'e3',
      company: 'SNDK',
      type: 'Product Update',
      datetime: '2026-03-18 21:00 JST',
      title: 'Sandisk updates high-bandwidth flash roadmap for inference systems',
      text: 'Sandisk discusses design wins, tiered memory relevance, and high-bandwidth flash for inference workloads.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'mixed',
        direct_score: 76,
        matched_keywords: ['design win', 'memory hierarchy', 'context memory'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'NVDA', score: 55, summary: 'Supports the broader inference-memory stack story.' },
          { ticker: 'MU', score: 49, summary: 'Confirms memory-tier expansion, though HBM remains distinct.' }
        ]
      }
    },
    {
      id: 'e4',
      company: 'ANET',
      type: 'Networking Update',
      datetime: '2026-03-19 10:00 JST',
      title: 'Arista highlights AI scale-out demand and stronger network fabric adoption',
      text: 'Management points to scale-out cluster demand, AI network fabric upgrades, and stronger deployment visibility.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 80,
        matched_keywords: ['scale-out', 'network fabric'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'NVDA', score: 63, summary: 'Platform demand broadens from chips to fabric and cluster economics.' },
          { ticker: 'MRVL', score: 74, summary: 'Connectivity readthrough improves for adjacent infrastructure names.' },
          { ticker: 'CRDO', score: 72, summary: 'AI fabric and interconnect demand gets reinforced.' }
        ]
      }
    },
    {
      id: 'e5',
      company: 'VRT',
      type: 'Infrastructure Update',
      datetime: '2026-03-19 14:20 JST',
      title: 'Vertiv stresses liquid cooling and dense AI deployment readiness',
      text: 'Vertiv highlights liquid cooling adoption, AI-ready power infrastructure, and rack-density bottlenecks.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 79,
        matched_keywords: ['liquid cooling', 'AI factory'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'high',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'NVDA', score: 58, summary: 'Dense AI deployment underscores system-level infrastructure needs.' },
          { ticker: 'TSM', score: 42, summary: 'Indirect support via ongoing AI buildout intensity.' }
        ]
      }
    },
    {
      id: 'e6',
      company: 'TSM',
      type: 'Supply Chain Readthrough',
      datetime: '2026-03-20 09:30 JST',
      title: 'Advanced packaging demand remains tight as next-generation AI ramps',
      text: 'Supply chain commentary reinforces advanced packaging, HBM-linked demand, and next-generation platform preparation.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 82,
        matched_keywords: ['advanced packaging', 'HBM'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'NVDA', score: 69, summary: 'Confirms next-gen platform intensity and upstream capacity needs.' },
          { ticker: 'MU', score: 61, summary: 'HBM-linked intensity remains constructive.' },
          { ticker: 'COHR', score: 47, summary: 'Integrated optics and packaging become more relevant.' }
        ]
      }
    },
    {
      id: 'e7',
      company: 'MRVL',
      type: 'Connectivity Update',
      datetime: '2026-03-20 11:45 JST',
      title: 'Marvell leans into AI interconnect and custom infrastructure demand',
      text: 'Marvell discusses scale-out connectivity, custom silicon, and stronger cloud AI interconnect demand.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 77,
        matched_keywords: ['scale-out', 'network fabric'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'ANET', score: 70, summary: 'Networking cluster keeps broadening beyond one winner.' },
          { ticker: 'ALAB', score: 66, summary: 'Rack-scale AI IO relevance improves.' }
        ]
      }
    },
    {
      id: 'e8',
      company: 'ALAB',
      type: 'Rack-scale IO',
      datetime: '2026-03-20 13:00 JST',
      title: 'Astera Labs points to rack-scale AI as the next unit of compute',
      text: 'Astera stresses rack-scale design wins, scale-out IO expansion, and system-level AI connectivity demand.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 78,
        matched_keywords: ['design win', 'scale-out'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'MRVL', score: 67, summary: 'Custom connectivity and system scaling themes strengthen.' },
          { ticker: 'CRDO', score: 63, summary: 'High-speed fabric demand broadens.' }
        ]
      }
    },
    {
      id: 'e9',
      company: 'CRDO',
      type: 'Interconnect Update',
      datetime: '2026-03-20 15:10 JST',
      title: 'Credo sees stronger AI fabric momentum in high-speed interconnect',
      text: 'Credo highlights network fabric upgrades, optics-linked connectivity, and hyperscaler AI scaling demand.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 75,
        matched_keywords: ['network fabric', 'optics'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'ANET', score: 64, summary: 'AI networking buildout remains broad-based.' },
          { ticker: 'LITE', score: 61, summary: 'Optics-linked connectivity gets stronger confirmation.' }
        ]
      }
    },
    {
      id: 'e10',
      company: 'LITE',
      type: 'Optics Update',
      datetime: '2026-03-21 08:40 JST',
      title: 'Lumentum highlights optics demand from AI data center buildouts',
      text: 'Lumentum discusses optics, bandwidth scaling, and AI data center connectivity opportunities tied to next-generation architectures.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 73,
        matched_keywords: ['optics', 'scale-out'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'COHR', score: 68, summary: 'Optics chain sympathy improves.' },
          { ticker: 'CRDO', score: 56, summary: 'Connectivity + optics overlap supports readthrough.' }
        ]
      }
    },
    {
      id: 'e11',
      company: 'COHR',
      type: 'Optics / Packaging',
      datetime: '2026-03-21 09:15 JST',
      title: 'Coherent underscores optics and advanced packaging relevance for AI',
      text: 'Coherent points to optics, advanced packaging, and integration needs as AI architectures scale across larger systems.',
      source: 'Mock feed',
      url: '#',
      analysis: {
        sentiment: 'bullish',
        direct_score: 74,
        matched_keywords: ['optics', 'advanced packaging'],
        factor_impact: {
          market_size: 'high',
          delivery_speed: 'medium',
          gross_margin: 'medium',
          eps: 'medium'
        },
        readthrough: [
          { ticker: 'TSM', score: 62, summary: 'Advanced packaging alignment improves.' },
          { ticker: 'LITE', score: 59, summary: 'Optics ecosystem benefits from broader AI scaling.' }
        ]
      }
    }
  ];
}

async function loadData() {
  const response = await fetch(`data/events.json?ts=${Date.now()}`);
  const data = await response.json();

  const normalized = {
    generated_at: data.generated_at || data.updated_at || new Date().toISOString(),
    dashboard_scores: data.dashboard_scores || defaultDashboardScores(),
    source_configs: data.source_configs || defaultSourceConfigs(),
    alerts: data.alerts || defaultAlerts(),
    eps_bridge: data.eps_bridge || defaultEPSBridge(),
    extended_watchlist: data.extended_watchlist || defaultWatchlist(),
    events: A Array.isArray(data.events) ? data.events : []
  };

  state.data = normalized;
  els.dataStamp.textContent = `Updated ${normalized.generated_at} · Sources: official IR / event pages`;
  ensureCompanyFilterOptions();
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
        ${rows.map(r => `
          <div class="factor-box">
            <strong>${r.label}</strong>
            <div class="badge blue">${r.effect}</div>
            <div class="muted" style="margin-top:8px">${r.note}</div>
          </div>
        `).join('')}
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
      <div style="margin-top:10px">${s.url && s.url !== '#' ? `<a href="${s.url}" target="_blank" rel="noreferrer">Open source</a>` : '<span class="muted">No direct URL</span>'}</div>
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
    const text = `${event.title || ''} ${event.text || ''} ${((event.analysis && event.analysis.matched_keywords) || []).join(' ')}`.toLowerCase();
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
        <span class="muted">${event.datetime || ''}</span>
      </div>
      <div class="feed-title">${event.title || ''}</div>
      <div class="feed-text">${event.text || event.summary || ''}</div>
      <div class="badges" style="margin-top:10px">
        <span class="badge ${badgeClass(event.analysis?.sentiment || 'mixed')}">${cap(event.analysis?.sentiment || 'mixed')}</span>
        <span class="badge">${event.type || event.source_type || 'Event'}</span>
        <span class="badge">Score ${event.analysis?.direct_score || 50}</span>
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

function normalizeEventAnalysis(event) {
  const analysis = event.analysis || {};
  return {
    sentiment: analysis.sentiment || event.signal || 'mixed',
    direct_score: analysis.direct_score || 50,
    matched_keywords: analysis.matched_keywords || event.keywords || [],
    factor_impact: analysis.factor_impact || event.factor_impact || {
      market_size: 'medium',
      delivery_speed: 'medium',
      gross_margin: 'medium',
      eps: 'medium'
    },
    readthrough: analysis.readthrough || []
  };
}

function renderDetail() {
  const event = state.filteredEvents.find(e => e.id === state.selectedId);

  if (!event) {
    els.detail.innerHTML = '<div class="muted">No event selected.</div>';
    return;
  }

  const analysis = normalizeEventAnalysis(event);

  const factors = Object.entries(analysis.factor_impact).map(([k, v]) => `
    <div class="factor-box">
      <strong>${k.replaceAll('_', ' ')}</strong>
      <div class="badge blue">${v}</div>
    </div>
  `).join('');

  const readthrough = (analysis.readthrough || []).map(item => `
    <div class="readthrough-item">
      <div class="readthrough-top">
        <div>
          <strong>${item.ticker}</strong>
          <div class="muted">${item.summary}</div>
        </div>
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
          <span class="badge">${event.type || event.source_type || 'Event'}</span>
          <span class="badge ${badgeClass(analysis.sentiment)}">${cap(analysis.sentiment)}</span>
        </div>
        <div class="detail-title">${event.title || ''}</div>
        <div class="detail-text">${event.text || event.summary || ''}</div>
        <div class="muted" style="margin-top:10px">
          Source:
          ${event.url ? `<a href="${event.url}" target="_blank" rel="noreferrer">${event.source || event.url}</a>` : (event.source || 'N/A')}
        </div>
      </div>
      <div class="score-card" style="min-width:180px">
        <div class="muted">Direct impact</div>
        ${scoreBoxHtml(analysis.direct_score)}
      </div>
    </div>
    <div class="keywords" style="margin-top:14px">
      ${(analysis.matched_keywords || []).map(k => `<span class="keyword">${k}</span>`).join('')}
    </div>
    <div class="factor-grid">${factors}</div>
    <div class="card-title" style="margin-top:20px">Cross-ticker readthrough</div>
    <div class="readthrough">${readthrough || '<div class="muted">No readthrough items.</div>'}</div>
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
