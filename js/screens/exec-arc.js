/* =====================================================================
   Exec Stats → ARC Recommendations tab (UI only).
   Logic + CONFIG live in js/arc-recommendations.js (arcAnalyse).
   Data: sample data by default; "Upload PO Data" / "Upload ARC Master"
   replace it for this browser session (parsed client-side, nothing is
   sent anywhere). XLSX read/write uses SheetJS, loaded on first use.
   ===================================================================== */
var ARC_SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
var ARC_PRIORITY_COLORS = { High: '#dc2626', Medium: '#d97706', Low: '#94a3b8' };
var ARC_STATUS_STYLE = {
  'Expired': 'bg-red-100 text-red-800 border-red-200',
  'Renew/Extend': 'bg-amber-100 text-amber-800 border-amber-200',
  'Expiring': 'bg-orange-100 text-orange-800 border-orange-200',
  'Under-utilised': 'bg-violet-100 text-violet-800 border-violet-200',
  'Healthy': 'bg-emerald-100 text-emerald-800 border-emerald-200'
};

/* ---------- data store (sample data unless a file was uploaded) ---------- */
function arcStore() {
  if (!appState.arc) {
    var mock = arcMockData(DEMO_TODAY);
    appState.arc = { mock: mock, po: null, arcs: null, poFile: '', arcFile: '', ver: 0, cache: null, cacheVer: -1 };
  }
  return appState.arc;
}
function arcResult() {
  var s = arcStore();
  if (s.cacheVer !== s.ver) { s.cache = arcAnalyse(s.po || s.mock.po, s.arcs || s.mock.arcs, DEMO_TODAY); s.cacheVer = s.ver; }
  return s.cache;
}
function arcFilteredCandidates(R) {
  var ui = appState.ui, q = (ui.arcSearch || '').trim().toLowerCase();
  var list = R.candidates.filter(function (x) {
    if (ui.arcCategory && x.category !== ui.arcCategory) return false;
    if (q && (x.code + ' ' + x.desc + ' ' + x.category + ' ' + x.vendors.join(' ')).toLowerCase().indexOf(q) < 0) return false;
    return true;
  });
  var s = ui.arcSort;
  return list.slice().sort(function (a, b) {
    var x = a[s.key], y = b[s.key];
    if (typeof x === 'string') { x = x.toLowerCase(); y = y.toLowerCase(); }
    if (s.key === 'priority') { x = ['High', 'Medium', 'Low'].indexOf(a.priority); y = ['High', 'Medium', 'Low'].indexOf(b.priority); }
    return (x < y ? -1 : x > y ? 1 : 0) * s.dir || a.rank - b.rank;
  });
}

/* ---------- small builders ---------- */
function arcPriorityBadge(p) {
  var c = { High: 'bg-red-100 text-red-800 border-red-200', Medium: 'bg-amber-100 text-amber-800 border-amber-200', Low: 'bg-slate-100 text-slate-600 border-slate-200' }[p];
  return '<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + c + '">' + esc(p) + '</span>';
}
function arcStatusBadge(s) { return '<span class="inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + (ARC_STATUS_STYLE[s] || '') + '">' + esc(s) + '</span>'; }
function arcSortTh(key, label, right) {
  var s = appState.ui.arcSort;
  return '<th class="' + UI.th + (right ? ' text-right' : '') + '"><button type="button" class="inline-flex items-center gap-1 uppercase" onclick="arcSortBy(\'' + key + '\')">' + esc(label) +
    (s.key === key ? (s.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
}
function arcSourceLine(kind) {
  var s = arcStore(), file = kind === 'po' ? s.poFile : s.arcFile, R = arcResult();
  var n = kind === 'po' ? R.counts.poLines : R.counts.arcs, skipped = kind === 'po' ? R.counts.poSkipped : R.counts.arcSkipped;
  return file ? '<span class="font-medium text-slate-800">' + icon('file-spreadsheet', 'w-3 h-3 inline text-emerald-600') + ' ' + esc(file) + '</span> · ' + formatNum(n) + ' rows' + (skipped ? ' · <span class="text-amber-700">' + skipped + ' skipped (missing date / qty / value)</span>' : '') :
    '<span class="text-slate-500">Sample data · ' + formatNum(n) + ' rows</span>';
}
function arcUploadButton(kind, label) {
  return '<label class="' + UI.btn + ' cursor-pointer">' + icon('upload', 'w-4 h-4') + esc(label) +
    '<input type="file" class="sr-only" accept=".csv,.xlsx,.xls,text/csv" onchange="arcUpload(\'' + kind + '\',this)"></label>';
}

/* ---------- bubble chart (hand-drawn SVG like the rest of Exec Stats) ---------- */
function arcBubbleChart(list) {
  if (!list.length) return emptyState('No ARC candidates for these filters.');
  var W = 760, H = 330, pl = 88, pr = 24, pt = 20, pb = 40;
  var maxX = niceMax(Math.max.apply(null, list.map(function (x) { return x.poCount; })) * 1.1);
  var maxY = niceMax(Math.max.apply(null, list.map(function (x) { return x.spend; })) * 1.1);
  var maxS = Math.max.apply(null, [1].concat(list.map(function (x) { return x.saving; })));
  function X(v) { return pl + (W - pl - pr) * v / maxX; }
  function Y(v) { return pt + (H - pt - pb) * (1 - v / maxY); }
  var g = '';
  for (var t = 0; t <= 4; t++) {
    var yv = maxY * t / 4, xv = maxX * t / 4;
    g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(yv) + '" y2="' + Y(yv) + '" stroke="#e2e8f0"/>' +
      '<text x="' + (pl - 8) + '" y="' + (Y(yv) + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' + esc(formatINRShort(yv)) + '</text>' +
      '<text x="' + X(xv) + '" y="' + (H - pb + 16) + '" text-anchor="middle" font-size="11" fill="#64748b">' + formatNum(xv, xv % 1 ? 1 : 0) + '</text>';
  }
  g += '<text x="' + ((pl + W - pr) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="#475569">POs in last ' + ARC_CONFIG.lookbackMonths + ' months →</text>' +
    '<text x="14" y="' + ((pt + H - pb) / 2) + '" text-anchor="middle" font-size="11" fill="#475569" transform="rotate(-90 14 ' + ((pt + H - pb) / 2) + ')">Annual spend →</text>';
  list.slice().sort(function (a, b) { return b.saving - a.saving; }).forEach(function (x) {
    var r = 5 + 17 * Math.sqrt(x.saving / maxS), c = ARC_PRIORITY_COLORS[x.priority];
    g += '<circle cx="' + X(x.poCount) + '" cy="' + Y(x.spend) + '" r="' + r.toFixed(1) + '" fill="' + c + '" fill-opacity="0.55" stroke="' + c + '" stroke-width="1.2"><title>' +
      esc('#' + x.rank + ' ' + x.desc + '\n' + x.priority + ' priority · score ' + x.score + '\nSpend ' + formatINRShort(x.spend) + ' · ' + x.poCount + ' POs\nEst. saving ' + formatINRShort(x.saving)) + '</title></circle>' +
      (x.rank <= 5 ? '<text x="' + X(x.poCount) + '" y="' + (Y(x.spend) + 4) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a" pointer-events="none">' + x.rank + '</text>' : '');
  });
  var legend = '<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">' + ['High', 'Medium', 'Low'].map(function (p) {
    return '<li class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:' + ARC_PRIORITY_COLORS[p] + '"></span>' + p + ' priority</li>';
  }).join('') + '<li>Bubble size = est. saving · numbers = top-5 rank · hover for details</li></ul>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="ARC candidates: PO frequency vs annual spend">' + g + '</svg>' + legend;
}

/* ---------- tab ---------- */
function renderArcSection() {
  var R = arcResult(), ui = appState.ui, k = R.kpi, cfg = ARC_CONFIG;
  var s = arcStore();
  var sources = '<section class="' + UI.card + ' mb-4 p-3"><div class="flex flex-wrap items-center gap-2">' +
    arcUploadButton('po', 'Upload PO Data (CSV/XLSX)') + arcUploadButton('arc', 'Upload ARC Master (CSV/XLSX)') +
    '<button type="button" class="' + UI.btnSm + '" onclick="arcDownloadTemplates()">' + icon('file-down', 'w-3 h-3') + 'Column templates</button>' +
    (s.po || s.arcs ? '<button type="button" class="' + UI.btnSm + '" onclick="arcResetData()">' + icon('rotate-ccw', 'w-3 h-3') + 'Back to sample data</button>' : '') +
    '<span class="ml-auto text-[11px] text-slate-500">' + icon('lock', 'w-3 h-3 inline') + ' Files are read in this browser only. Nothing is uploaded.</span></div>' +
    '<div class="mt-2 grid gap-1 text-xs sm:grid-cols-2"><div><b class="text-slate-600">PO data:</b> ' + arcSourceLine('po') + '</div><div><b class="text-slate-600">ARC master:</b> ' + arcSourceLine('arc') + '</div></div>' +
    '<div class="mt-1 text-[11px] text-slate-500">Window ' + formatDate(isoDate(R.window.start)) + ' – ' + formatDate(isoDate(R.window.end)) + ' · ARC status as of ' + formatDate(isoDate(R.today)) +
    ' · Eligible: ≥ ' + cfg.minPoCount + ' POs and ≥ ' + formatCurrency(cfg.minAnnualSpend) + ' spend, not on an active ARC</div></section>';

  var summary = '<section class="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">' + icon('sparkles', 'w-4 h-4 inline text-blue-600') + ' <b>' +
    (k.topN ? 'Top ' + k.topN + ' item' + (k.topN > 1 ? 's' : '') + ' to put on ARC — ' + esc(formatINRShort(k.topSaving)) + ' est. saving, ' + formatNum(k.topEffortHrs) + ' man-hours/year freed.' : 'No items currently qualify for a new ARC.') + '</b>' +
    (k.arcsNeedingAction ? ' <span class="text-blue-800">' + k.arcsNeedingAction + ' existing ARC' + (k.arcsNeedingAction > 1 ? 's need' : ' needs') + ' action.</span>' : '') + '</section>';

  var kpis = '<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">' +
    kpiTile('ARC candidates', formatNum(k.candidates), R.counts.items + ' items analysed · ' + R.counts.excludedActive + ' already on ARC', 'list-checks', 'blue') +
    kpiTile('Addressable spend', esc(formatINRShort(k.addressableSpend)), 'Annual spend on candidate items', 'indian-rupee', 'violet') +
    kpiTile('Est. annual saving', esc(formatINRShort(k.saving)), 'If every unit is bought at the best rate paid', 'piggy-bank', 'green') +
    kpiTile('Effort saved', formatNum(k.effortHrs) + ' hrs/yr', formatNum(cfg.hoursPerPO) + ' hrs per PO avoided', 'timer', 'cyan') +
    kpiTile('ARCs needing action', formatNum(k.arcsNeedingAction), 'of ' + R.health.length + ' existing ARCs', 'triangle-alert', k.arcsNeedingAction ? 'amber' : 'green', "arcScrollTo('arc-health')") + '</div>';

  /* candidates table */
  var list = arcFilteredCandidates(R), shown = ui.arcShowAll ? list : list.slice(0, cfg.topN);
  var cats = [];
  R.candidates.forEach(function (x) { if (cats.indexOf(x.category) < 0) cats.push(x.category); });
  cats.sort();
  if (ui.arcCategory && cats.indexOf(ui.arcCategory) < 0) cats.push(ui.arcCategory);
  var head = arcSortTh('rank', 'Rank', true) + arcSortTh('desc', 'Item') + arcSortTh('category', 'Category') + arcSortTh('spend', 'Annual spend', true) + arcSortTh('poCount', 'POs', true) +
    arcSortTh('vendorCount', 'Vendors', true) + arcSortTh('variancePct', 'Rate var.', true) + arcSortTh('score', 'Score', true) + arcSortTh('saving', 'Est. saving', true) +
    arcSortTh('proposedQty', 'Prop. qty', true) + arcSortTh('priority', 'Priority');
  var body = shown.map(function (x) {
    return '<tr><td class="' + UI.td + ' text-right font-semibold text-slate-900">' + x.rank + '</td>' +
      '<td class="' + UI.td + ' min-w-[12rem]" title="' + esc('Best rate from ' + x.bestVendor + ' · vendors: ' + x.vendors.join(', ')) + '"><div class="font-medium text-slate-900">' + esc(x.desc) + '</div><div class="whitespace-nowrap text-[11px] text-slate-500">' + esc(x.code || '—') + ' · ' + x.monthsActive + '/' + cfg.lookbackMonths + ' mo active</div></td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-xs">' + esc(x.category) + '</td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-right">' + formatCurrency(x.spend) + '</td><td class="' + UI.td + ' text-right">' + x.poCount + '</td>' +
      '<td class="' + UI.td + ' text-right" title="' + esc(x.vendors.join(', ')) + '">' + x.vendorCount + '</td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-right ' + (x.variancePct >= 20 ? 'font-semibold text-red-700' : '') + '">' + formatNum(x.variancePct, 1) + '%</td>' +
      '<td class="' + UI.td + ' text-right"><div class="flex items-center justify-end gap-2"><span class="hidden h-1.5 w-10 overflow-hidden rounded-full bg-slate-200 2xl:inline-block"><span class="block h-full rounded-full" style="width:' + x.score + '%;background:' + ARC_PRIORITY_COLORS[x.priority] + '"></span></span><b>' + x.score + '</b></div></td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-right text-emerald-700">' + formatCurrency(x.saving) + '</td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-right">' + formatNum(x.proposedQty) + ' ' + esc(x.uom) + '</td><td class="' + UI.td + '">' + arcPriorityBadge(x.priority) + '</td></tr>';
  }).join('');
  var candCard = '<section class="' + UI.card + ' mb-4" id="arc-candidates"><div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3"><div class="min-w-0 flex-1"><h2 class="text-sm font-semibold text-slate-800">New ARC candidates</h2>' +
    '<p class="text-[11px] text-slate-500">Ranked by score (0–100). Click a header to sort.</p></div>' +
    '<div class="relative"><label class="sr-only" for="arc-search">Search items</label>' + icon('search', 'w-4 h-4 absolute left-2.5 top-2.5 text-slate-400') +
    '<input id="arc-search" class="' + UI.input + ' w-56 pl-8" placeholder="Search item, code, vendor… (Enter)" value="' + esc(ui.arcSearch || '') + '" onchange="setArcFilter(\'arcSearch\',this.value)" onkeydown="if(event.key===\'Enter\')setArcFilter(\'arcSearch\',this.value)"></div>' +
    '<label class="sr-only" for="arc-cat">Category</label><select id="arc-cat" class="' + UI.input + '" onchange="setArcFilter(\'arcCategory\',this.value)">' + selectOptions(cats, ui.arcCategory || '', 'All categories') + '</select>' +
    '<button type="button" class="' + UI.btn + '" onclick="arcExportCandidates()">' + icon('file-spreadsheet', 'w-4 h-4') + 'Export to Excel</button></div>' +
    (shown.length ? tableWrap(head, body) : emptyState(R.candidates.length ? 'No candidates match these filters.' : 'No item meets the eligibility rules.')) +
    '<div class="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500"><span>Showing ' + shown.length + ' of ' + list.length + (list.length !== R.candidates.length ? ' (filtered from ' + R.candidates.length + ')' : '') + '</span>' +
    (list.length > cfg.topN ? '<button type="button" class="' + UI.btnSm + '" onclick="toggleArcShowAll()">' + (ui.arcShowAll ? 'Show top ' + cfg.topN : 'Show all ' + list.length) + '</button>' : '') +
    '<span class="ml-auto">' + R.counts.belowThreshold + ' item(s) below the PO-count / spend threshold · ' + R.counts.excludedActive + ' on an active ARC (not shown)</span></div></section>';

  /* bubble chart + scoring model */
  var w = cfg.weights;
  var model = '<section class="' + UI.card + ' xl:col-span-2"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">How the score works</h2><p class="text-[11px] text-slate-500">Each factor is scaled 0–1 across eligible items, then weighted</p></div>' +
    '<div class="space-y-2 p-4 text-xs text-slate-700">' + [['Spend', w.spend, 'annual spend'], ['Frequency', w.frequency, 'number of POs'], ['Rate variance', w.rateVariance, '(max − min rate) ÷ avg rate'],
      ['Demand stability', w.stability, 'months with a PO ÷ ' + cfg.lookbackMonths], ['Vendor spread', w.vendorSpread, 'distinct vendors used']].map(function (f) {
      return '<div><div class="flex justify-between"><span><b>' + f[0] + '</b> · ' + esc(f[2]) + '</span><b>' + Math.round(f[1] * 100) + '%</b></div><div class="mt-0.5 h-1.5 rounded-full bg-slate-100"><div class="h-full rounded-full bg-blue-600" style="width:' + (f[1] * 100) + '%"></div></div></div>';
    }).join('') +
    '<ul class="mt-3 list-disc space-y-1 pl-4 text-[11px] text-slate-600"><li>Priority: High ≥ ' + cfg.priority.high + ', Medium ' + cfg.priority.medium + '–' + (cfg.priority.high - 1) + ', Low &lt; ' + cfg.priority.medium + '</li>' +
    '<li>Est. saving = (avg rate − lowest rate paid) × annual qty</li><li>Effort saved = POs × ' + cfg.hoursPerPO + ' hrs</li><li>Proposed committed qty = annual qty × ' + cfg.commitFactor + '</li>' +
    '<li>Tune all of this in <span class="font-mono">ARC_CONFIG</span> (js/arc-recommendations.js)</li></ul></div></section>';
  var bubbleTable = miniTable(['#', 'Item', 'POs', 'Annual spend', 'Est. saving', 'Priority'], list.map(function (x) { return [x.rank, esc(x.desc), x.poCount, formatCurrency(x.spend), formatCurrency(x.saving), esc(x.priority)]; }));
  var charts = '<div class="mb-4 grid gap-4 xl:grid-cols-5">' + execCard('arcbubble', 'Frequency vs spend', 'Top-right = bought often and in volume. Follows the search and category filter.', arcBubbleChart(list), bubbleTable, '', 'xl:col-span-3') + model + '</div>';

  /* health table */
  var hf = ui.arcHealthFilter || '';
  var counts = {};
  R.health.forEach(function (h) { counts[h.status] = (counts[h.status] || 0) + 1; });
  if (hf && !counts[hf]) hf = ui.arcHealthFilter = '';
  var hChips = chip('All', !hf, "setArcHealthFilter('')", R.health.length) + ARC_STATUS_ORDER.filter(function (st) { return counts[st]; }).map(function (st) {
    return chip(st, hf === st, "setArcHealthFilter('" + st + "')", counts[st]);
  }).join('');
  var hRows = R.health.filter(function (h) { return !hf || h.status === hf; }).map(function (h) {
    var pct = h.consumedPct === null ? null : h.consumedPct, bar = pct === null ? '#cbd5e1' : pct >= cfg.health.renewPct ? '#d97706' : h.status === 'Under-utilised' ? '#7c3aed' : '#2563eb';
    var detail = [h.qtyPct !== null ? 'qty ' + formatNum(h.qtyPct, 0) + '%' : '', h.valPct !== null ? 'value ' + formatNum(h.valPct, 0) + '%' : ''].filter(Boolean).join(' · ');
    var days = h.daysLeft < 0 ? '<span class="font-semibold text-red-700">' + formatNum(-h.daysLeft) + ' d ago</span>' : '<span class="' + (h.daysLeft <= cfg.health.expiringDays ? 'font-semibold text-orange-700' : '') + '">' + formatNum(h.daysLeft) + ' d</span>';
    return '<tr><td class="' + UI.td + ' whitespace-nowrap font-mono text-xs">' + esc(h.arcNo) + '</td><td class="' + UI.td + '"><div class="text-sm text-slate-900">' + esc(h.desc) + '</div><div class="text-[11px] text-slate-500">' + esc(h.code) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(h.vendor) + '</td>' +
      '<td class="' + UI.td + ' min-w-[10rem]"><div class="flex items-center gap-2"><div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct || 0) + '"><div class="h-full rounded-full" style="width:' + Math.min(100, pct || 0) + '%;background:' + bar + '"></div></div>' +
      '<b class="w-10 text-right text-xs">' + (pct === null ? '—' : formatNum(pct, 0) + '%') + '</b></div><div class="text-[10px] text-slate-500">' + esc(detail) + ' · ' + formatNum(h.elapsedPct, 0) + '% of validity elapsed</div></td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-xs">' + formatDate(isoDate(h.arc.to)) + '</td><td class="' + UI.td + ' whitespace-nowrap text-right text-xs">' + days + '</td>' +
      '<td class="' + UI.td + '">' + arcStatusBadge(h.status) + (h.flags.length > 1 ? '<div class="mt-0.5 text-[10px] text-slate-500">also ' + esc(h.flags.filter(function (f) { return f !== h.status; }).join(', ')) + '</div>' : '') + '</td></tr>';
  }).join('');
  var healthCard = '<section class="' + UI.card + '" id="arc-health"><div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3"><div class="min-w-0 flex-1"><h2 class="text-sm font-semibold text-slate-800">Existing ARC health</h2>' +
    '<p class="text-[11px] text-slate-500">Renew/Extend ≥ ' + cfg.health.renewPct + '% consumed · Expiring ≤ ' + cfg.health.expiringDays + ' days · Under-utilised &lt; ' + cfg.health.underUtilConsumedPct + '% used after ' + cfg.health.underUtilElapsedPct + '% of validity</p></div>' +
    '<button type="button" class="' + UI.btn + '" onclick="arcExportHealth()">' + icon('file-spreadsheet', 'w-4 h-4') + 'Export to Excel</button></div>' +
    '<div class="flex flex-wrap gap-2 px-4 pt-3">' + hChips + '</div><div class="p-1">' +
    (hRows ? tableWrap(ths(['ARC no', 'Item', 'Vendor', '% consumed', 'Valid to', 'Days left', 'Status']), hRows) : emptyState('No ARC master rows.')) + '</div></section>';

  return sources + summary + kpis + candCard + charts + healthCard;
}

/* ---------- actions ---------- */
function setExecTab(t) { appState.ui.execTab = t === 'arc' ? 'arc' : 'overview'; rerender(); }
function arcSortBy(key) {
  var allowed = ['rank', 'desc', 'category', 'spend', 'poCount', 'vendorCount', 'variancePct', 'score', 'saving', 'proposedQty', 'priority'];
  if (allowed.indexOf(key) < 0) return;
  var s = appState.ui.arcSort;
  if (s.key === key) s.dir = -s.dir; else { s.key = key; s.dir = key === 'rank' || key === 'desc' || key === 'category' || key === 'priority' ? 1 : -1; }
  rerender();
}
function setArcFilter(key, v) {
  if (key !== 'arcSearch' && key !== 'arcCategory') return;
  appState.ui[key] = String(v || '');
  rerender();
}
function toggleArcShowAll() { appState.ui.arcShowAll = !appState.ui.arcShowAll; rerender(); }
function setArcHealthFilter(st) { appState.ui.arcHealthFilter = ARC_STATUS_ORDER.indexOf(st) >= 0 ? st : ''; rerender(); }
function arcScrollTo(id) { var el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function arcResetData() {
  var s = arcStore();
  s.po = null; s.arcs = null; s.poFile = ''; s.arcFile = ''; s.ver++;
  showToast('Back to sample data', 'success');
  rerender();
}

/* ---------- SheetJS (lazy, only for .xlsx read / write) ---------- */
function arcLoadSheetJs(cb) {
  if (window.XLSX) { cb(null); return; }
  var w = window.__arcXlsxWaiters || (window.__arcXlsxWaiters = []);
  w.push(cb);
  if (w.length > 1) return;
  var sc = document.createElement('script');
  sc.src = ARC_SHEETJS_URL;
  sc.onload = function () { var q = window.__arcXlsxWaiters; window.__arcXlsxWaiters = null; q.forEach(function (f) { f(window.XLSX ? null : new Error('SheetJS did not load')); }); };
  sc.onerror = function () { var q = window.__arcXlsxWaiters; window.__arcXlsxWaiters = null; sc.remove(); q.forEach(function (f) { f(new Error('SheetJS could not be loaded (offline?)')); }); };
  document.head.appendChild(sc);
}

/* ---------- upload ---------- */
function arcUpload(kind, input) {
  var f = input && input.files && input.files[0];
  if (!f) return;
  input.value = '';
  var ext = (f.name.split('.').pop() || '').toLowerCase();
  if (['csv', 'xlsx', 'xls'].indexOf(ext) < 0) { showToast('Please choose a .csv or .xlsx file.', 'error'); return; }
  var reader = new FileReader();
  reader.onerror = function () { showToast('Could not read ' + f.name, 'error'); };
  if (ext === 'csv') {
    reader.onload = function () { arcIngest(kind, f.name, parseCsv(String(reader.result))); };
    reader.readAsText(f);
  } else {
    arcLoadSheetJs(function (err) {
      if (err) { showToast('Excel reader could not load (no internet?). Save the sheet as CSV and upload that instead.', 'error'); return; }
      reader.onload = function () {
        try {
          var wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: true });
          arcIngest(kind, f.name, XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }));
        } catch (e) { showToast('Could not read ' + f.name + ': ' + e.message, 'error'); }
      };
      reader.readAsArrayBuffer(f);
    });
  }
}
/* aoa = array of arrays from CSV or the first worksheet */
function arcIngest(kind, fileName, aoa) {
  var isPo = kind === 'po';
  var parsed = arcRowsFromAoa(aoa, isPo ? ARC_PO_COLUMNS : ARC_MASTER_COLUMNS, isPo ? ARC_PO_REQUIRED : ARC_MASTER_REQUIRED);
  if (parsed.error) { showToast(fileName + ': ' + parsed.error, 'error'); return false; }
  var clean = isPo ? arcCleanPo(parsed.rows) : arcCleanMaster(parsed.rows);
  if (!clean.rows.length) { showToast(fileName + ': no usable rows (check dates, qty and values).', 'error'); return false; }
  var s = arcStore();
  if (isPo) { s.po = parsed.rows; s.poFile = fileName; } else { s.arcs = parsed.rows; s.arcFile = fileName; }
  s.ver++;
  showToast('Loaded ' + fileName + ': ' + formatNum(clean.rows.length) + ' rows' + (clean.skipped ? ', ' + clean.skipped + ' skipped' : ''), 'success');
  rerender();
  return true;
}

/* ---------- export ---------- */
function arcDownloadSheet(baseName, sheetName, rows) {
  arcLoadSheetJs(function (err) {
    if (err) { showToast('Excel writer could not load (no internet?), so this is a CSV instead.', 'info'); downloadCsv(baseName + '.csv', rows); return; }
    try {
      var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = rows[0].map(function (h, i) { return { wch: Math.min(48, Math.max(10, String(h).length + 2, i === 1 ? 36 : 0)) }; });
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, baseName + '.xlsx');
      showToast('Downloaded ' + baseName + '.xlsx (' + (rows.length - 1) + ' rows)', 'success');
    } catch (e) { showToast('Excel export failed: ' + e.message + '. Downloading CSV.', 'error'); downloadCsv(baseName + '.csv', rows); }
  });
}
function arcExportCandidates() {
  var R = arcResult(), list = arcFilteredCandidates(R);
  if (!list.length) { showToast('Nothing to export for these filters.', 'error'); return; }
  var rows = [['Rank', 'Item_Code', 'Item_Description', 'Category', 'UoM', 'Annual_Spend_INR', 'PO_Count', 'Total_Qty', 'Vendors', 'Vendor_Names', 'Min_Rate', 'Max_Rate', 'Avg_Rate',
    'Rate_Variance_%', 'Months_Active', 'Score', 'Priority', 'Est_Saving_INR', 'Effort_Saved_Hrs', 'Proposed_Committed_Qty', 'Best_Rate_Vendor']];
  list.forEach(function (x) {
    rows.push([x.rank, x.code, x.desc, x.category, x.uom, Math.round(x.spend), x.poCount, x.qty, x.vendorCount, x.vendors.join('; '), Math.round(x.minRate * 100) / 100, Math.round(x.maxRate * 100) / 100,
      Math.round(x.avgRate * 100) / 100, Math.round(x.variancePct * 10) / 10, x.monthsActive, x.score, x.priority, Math.round(x.saving), x.effortHrs, x.proposedQty, x.bestVendor]);
  });
  arcDownloadSheet('arc_candidates_' + isoDate(DEMO_TODAY), 'ARC candidates', rows);
}
function arcExportHealth() {
  var R = arcResult(), hf = appState.ui.arcHealthFilter;
  var list = R.health.filter(function (h) { return !hf || h.status === hf; });
  if (!list.length) { showToast('No ARCs to export.', 'error'); return; }
  var rows = [['ARC_No', 'Item_Code', 'Item_Description', 'Vendor', 'Consumed_Qty_%', 'Consumed_Value_%', 'Validity_Elapsed_%', 'Valid_From', 'Valid_To', 'Days_Left', 'Status', 'All_Flags']];
  list.forEach(function (h) {
    rows.push([h.arcNo, h.code, h.desc, h.vendor, h.qtyPct === null ? '' : Math.round(h.qtyPct), h.valPct === null ? '' : Math.round(h.valPct), Math.round(h.elapsedPct),
      isoDate(h.arc.from), isoDate(h.arc.to), h.daysLeft, h.status, h.flags.join('; ')]);
  });
  arcDownloadSheet('arc_health_' + isoDate(DEMO_TODAY), 'ARC health', rows);
}
function arcDownloadTemplates() {
  var d = arcStore().mock;
  downloadCsv('arc_po_data_template.csv', [ARC_PO_COLUMNS].concat(d.po.slice(0, 3).map(function (r) { return ARC_PO_COLUMNS.map(function (c) { return r[c]; }); })));
  downloadCsv('arc_master_template.csv', [ARC_MASTER_COLUMNS].concat(d.arcs.slice(0, 3).map(function (r) { return ARC_MASTER_COLUMNS.map(function (c) { return r[c]; }); })));
}
