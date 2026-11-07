/* PO / Proc Ops: KPI header, pipeline flow, carrier tiles, multi-PO filter, per-row status bar
   Tabs: Carrier tracking · Follow-ups · Awaiting PO · PR → PO mapping · GRN */
var PO_TABS = [
  { id: 'expediting', label: 'Carrier tracking & status bar', icon: 'truck' },
  { id: 'followups', label: 'Follow-ups', icon: 'notebook-pen' },
  { id: 'awaiting', label: 'Awaiting PO', icon: 'file-plus' },
  { id: 'mapping', label: 'PR → PO mapping', icon: 'git-merge' },
  { id: 'grn', label: 'GRN', icon: 'package-check' }
];
var PO_PAGE_SIZE = 25;
var PO_SPECIAL_FILTERS = { AWB: 'AWB received', NOAWB: 'Awaiting AWB', FOLLOWUP: 'Follow-up needed', OVERDUE: 'Past committed ETA' };
function awaitingPoLines() {
  return appState.lines.filter(function (l) { return (l.currentStatus === 'NFA APPROVED' || l.currentStatus === 'PO STAGE') && !l.poNumber; });
}
function poMatchesFilter(p, f) {
  if (!f) return true;
  if (f === 'AWB') return !!p.awb;
  if (f === 'NOAWB') return !p.awb;
  if (f === 'FOLLOWUP') return poFlags(p).length > 0;
  if (f === 'OVERDUE') return poFlags(p).some(function (x) { return x.rule === 'D'; });
  return p.stage === f;
}
function avgDays(list, from, to) {
  var v = list.filter(function (p) { return p[from] && p[to]; }).map(function (p) { return daysBetween(p[from], p[to]); });
  return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : 0;
}

function renderPoOpsScreen() {
  var ui = appState.ui, pos = appState.pos;
  if (!PO_TABS.some(function (t) { return t.id === ui.poTab; })) ui.poTab = 'expediting';
  var c = {}; SHIPMENT_STAGES.forEach(function (s) { c[s] = 0; });
  pos.forEach(function (p) { c[p.stage]++; });
  var withAwb = pos.filter(function (p) { return p.awb; }).length;
  var follow = pos.filter(function (p) { return poFlags(p).length; }).length;
  var overdue = pos.filter(function (p) { return poMatchesFilter(p, 'OVERDUE'); }).length;
  function tile(key, label, value, sub, tone) {
    var on = ui.poStageFilter === key;
    var tones = { red: 'border-red-300 bg-red-50/60', amber: 'border-amber-300 bg-amber-50/60' };
    return '<button type="button" class="' + UI.card + ' p-3 text-left hover:border-blue-300 ' + (on ? 'ring-2 ring-blue-500 ' : '') + (tones[tone] || '') + '" aria-pressed="' + on + '" onclick="setPoStageFilter(\'' + key + '\')">' +
      '<div class="text-[11px] font-semibold uppercase tracking-wide ' + (tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-500') + '">' + esc(label) + '</div>' +
      '<div class="mt-1 text-xl font-bold text-slate-900">' + value + '</div><div class="text-[11px] text-slate-500">' + sub + '</div></button>';
  }
  var tiles = '<div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">' +
    tile('', 'POs awarded', formatNum(pos.length), 'Total released', '') +
    tile('AWB', 'AWB / LR received', formatNum(withAwb) + ' <span class="text-sm font-normal text-slate-500">(' + Math.round(withAwb / pos.length * 100) + '%)</span>', formatNum(pos.length - withAwb) + ' pending AWB', '') +
    tile('FOLLOWUP', 'Follow-up needed', formatNum(follow), 'Rules A–D (' + icon('flag', 'w-3 h-3 inline') + ' flagged)', 'red') +
    tile('In Transit', 'In transit', formatNum(c['Dispatched'] + c['In Transit']), c['Dispatched'] + ' just dispatched', '') +
    tile('At Guwahati', 'At Guwahati', formatNum(c['At Guwahati']), 'GAU hub', '') +
    tile('Delivered', 'Delivered (site)', formatNum(c['Delivered']), 'Received at Jagi Road', '') +
    tile('OVERDUE', 'Overdue lines', formatNum(overdue), 'Past committed ETA', 'amber') + '</div>';

  var colors = { 'PO Awarded': '#2563eb', 'Dispatched': '#6366f1', 'In Transit': '#0ea5e9', 'At Guwahati': '#8b5cf6', 'Delivered': '#10b981' };
  var flow = '<section class="' + UI.card + ' mb-4 p-4"><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="text-sm font-semibold text-slate-800">' + icon('route', 'w-4 h-4 inline') + ' End-to-end shipment pipeline (' + pos.length + ' POs)</h2>' +
    '<span class="text-xs text-slate-500">Avg PO → dispatch: <b>' + formatNum(avgDays(pos, 'poDate', 'dispatchDate'), 1) + ' d</b> · Avg dispatch → delivery: <b>' + formatNum(avgDays(pos, 'dispatchDate', 'deliveredDate'), 1) + ' d</b></span></div>' +
    '<div class="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Shipment stage mix">' + SHIPMENT_STAGES.map(function (s) {
      return c[s] ? '<span title="' + esc(s + ': ' + c[s]) + '" style="width:' + (c[s] / pos.length * 100) + '%;background:' + colors[s] + '"></span>' : '';
    }).join('') + '</div>' +
    '<ul class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">' + SHIPMENT_STAGES.map(function (s) {
      return '<li class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-full" style="background:' + colors[s] + '"></span>' + esc(s) + ' <b>' + c[s] + '</b></li>';
    }).join('') + '</ul></section>';

  var tabs = '<div class="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist">' + PO_TABS.map(function (t, i) {
    var n = t.id === 'expediting' ? filteredPOs().length : t.id === 'awaiting' ? awaitingPoLines().length : t.id === 'followups' ? appState.followUpLog.length : t.id === 'grn' ? grnLines().length : '';
    return '<button type="button" role="tab" aria-selected="' + (ui.poTab === t.id) + '" class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ' + (ui.poTab === t.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50') + '" onclick="setPoTab(\'' + t.id + '\')">' +
      (i + 1) + '. ' + esc(t.label) + (n !== '' ? ' <span class="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">' + n + '</span>' : '') + '</button>';
  }).join('') + '</div>';
  var body = ui.poTab === 'expediting' ? renderPoExpediting() : ui.poTab === 'followups' ? renderPoFollowups() : ui.poTab === 'awaiting' ? renderPoAwaiting() : ui.poTab === 'mapping' ? renderPoMapping() : renderPoGrn();
  return pageHeader('PO release, carrier tracking & logistics', pos.length + ' awarded PO lines · inbound via Guwahati (GAU) to Jagi Road · tracking as of ' + formatDate(DEMO_TODAY) + ' (sample feed)',
      '<button type="button" class="' + UI.btnPrimary + '" onclick="openTrackingImportModal()">' + icon('refresh-cw', 'w-4 h-4') + 'Refresh tracking</button>' +
      '<button type="button" class="' + UI.btn + '" onclick="exportPoList()">' + icon('download', 'w-4 h-4') + 'Export</button>') + tiles + flow + tabs + body;
}
function initPoOps() { if (appState.ui.poTab === 'expediting') renderPoTable(); }
function setPoTab(t) { appState.ui.poTab = t; rerender(); }
function setPoStageFilter(s) {
  if (s && !PO_SPECIAL_FILTERS[s] && SHIPMENT_STAGES.indexOf(s) < 0) { showToast('Unknown filter.', 'error'); return; }
  appState.ui.poTab = 'expediting'; appState.ui.poStageFilter = appState.ui.poStageFilter === s ? '' : s; appState.ui.poPage = 0; rerender();
}

/* ---------- Carrier tracking tab ---------- */
function renderPoExpediting() {
  var ui = appState.ui;
  ui.poMulti = ui.poMulti || [];
  var carriers = '<div class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">' + appState.carriers.map(function (c) {
    var ps = appState.pos.filter(function (p) { return p.carrierId === c.id; });
    var active = ps.filter(function (p) { return ['Dispatched', 'In Transit', 'At Guwahati'].indexOf(p.stage) >= 0; }).length;
    var on = ui.poCarrier === c.id;
    return '<button type="button" class="' + UI.card + ' p-3 text-left hover:border-blue-300 ' + (on ? 'ring-2 ring-blue-500' : '') + '" aria-pressed="' + on + '" onclick="setPoCarrier(\'' + c.id + '\')">' +
      '<div class="text-sm font-semibold text-slate-800">' + esc(c.name) + '</div><div class="mt-1 text-lg font-bold text-blue-700">' + ps.length + ' <span class="text-xs font-normal text-slate-500">lines</span></div>' +
      '<div class="text-[11px] text-slate-500">Active transit: ' + active + '</div></button>';
  }).join('') + '</div>';
  var quick = appState.pos.filter(function (p) { return poFlags(p).length && ui.poMulti.indexOf(p.poNumber) < 0; }).slice(0, 4);
  var stageOpts = SHIPMENT_STAGES.map(function (s) { return { value: s, label: s }; }).concat(Object.keys(PO_SPECIAL_FILTERS).map(function (k) { return { value: k, label: PO_SPECIAL_FILTERS[k] }; }));
  var active = [];
  if (ui.poStageFilter) active.push('Stage: ' + (PO_SPECIAL_FILTERS[ui.poStageFilter] || ui.poStageFilter));
  if (ui.poCarrier) active.push('Carrier: ' + (getCarrierByName(ui.poCarrier) || {}).name);
  if (ui.poMulti.length) active.push(ui.poMulti.length + ' selected PO(s)');
  return carriers +
    '<section class="' + UI.card + ' mb-3 p-3"><div class="flex flex-wrap items-end gap-3"><div class="min-w-[14rem] flex-1"><label class="' + UI.label + '" for="po-search">Search (PO, AWB, vendor, material, PR – comma-separate several POs)</label>' +
    '<div class="relative">' + icon('search', 'w-4 h-4 absolute left-2.5 top-2.5 text-slate-400') + '<input id="po-search" class="' + UI.input + ' w-full pl-8" placeholder="e.g. 4500100012, 4500100025" value="' + esc(ui.poSearch) + '" oninput="setPoSearch(this.value)"></div></div>' +
    '<div><label class="' + UI.label + '" for="po-stage">Stage</label><select id="po-stage" class="' + UI.input + '" onchange="appState.ui.poStageFilter=this.value;appState.ui.poPage=0;rerender()">' +
    selectOptions(stageOpts, ui.poStageFilter, 'All stages') + '</select></div>' +
    (active.length ? '<button type="button" class="' + UI.btn + '" onclick="resetPoFilters()">' + icon('x', 'w-4 h-4') + 'Reset all filters</button>' : '') + '</div>' +
    '<div class="mt-3 flex flex-wrap items-center gap-2 text-xs"><span class="font-semibold text-slate-600">Filter POs:</span>' +
    ui.poMulti.map(function (n) { return '<span class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-blue-800">PO ' + esc(n) + '<button type="button" aria-label="Remove PO ' + esc(n) + '" onclick="removePoMulti(\'' + esc(n) + '\')">' + icon('x', 'w-3 h-3') + '</button></span>'; }).join('') +
    quick.map(function (p) { return '<button type="button" class="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-slate-700 hover:bg-slate-50" onclick="addPoMulti(\'' + p.poNumber + '\')">+ PO ' + esc(p.poNumber) + '</button>'; }).join('') +
    '<span class="flex items-center gap-1"><label class="sr-only" for="po-multi">Add PO numbers</label><input id="po-multi" class="' + UI.input + ' w-56 text-xs" placeholder="Add POs (paste several)" onkeydown="if(event.key===\'Enter\')addPoMulti(this.value)">' +
    '<button type="button" class="' + UI.btnSm + '" onclick="addPoMulti(fieldVal(\'po-multi\'))">' + icon('filter', 'w-3 h-3') + 'Select multiple POs</button></span></div>' +
    (active.length ? '<p class="mt-2 text-[11px] text-blue-700">' + icon('filter', 'w-3 h-3 inline') + ' Active: ' + esc(active.join(' · ')) + '</p>' : '') + '</section>' +
    '<section id="po-table" class="' + UI.card + '"></section>';
}
function setPoCarrier(id) { appState.ui.poCarrier = appState.ui.poCarrier === id ? '' : id; appState.ui.poPage = 0; rerender(); }
function resetPoFilters() { var u = appState.ui; u.poSearch = ''; u.poStageFilter = ''; u.poCarrier = ''; u.poMulti = []; u.poPage = 0; rerender(); }
function parsePoList(text) { return String(text || '').split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s; }); }
function addPoMulti(text) {
  var ui = appState.ui, added = 0, unknown = [];
  parsePoList(text).forEach(function (n) {
    if (!findPO(n, true)) { unknown.push(n); return; }
    if (ui.poMulti.indexOf(n) < 0) { ui.poMulti.push(n); added++; }
  });
  if (unknown.length) showToast('PO not found: ' + unknown.join(', '), 'error');
  if (!added && !unknown.length) { showToast('Enter one or more PO numbers.', 'error'); return; }
  ui.poPage = 0; rerender();
}
function removePoMulti(n) { appState.ui.poMulti = (appState.ui.poMulti || []).filter(function (x) { return x !== n; }); rerender(); }
function filteredPOs() {
  var ui = appState.ui, raw = ui.poSearch.trim().toLowerCase(), st = ui.poStageFilter;
  var multiSearch = parsePoList(raw).filter(function (s) { return /^\d{10}$/.test(s); });
  return appState.pos.filter(function (p) {
    if (!poMatchesFilter(p, st)) return false;
    if (ui.poCarrier && p.carrierId !== ui.poCarrier) return false;
    if (ui.poMulti && ui.poMulti.length && ui.poMulti.indexOf(p.poNumber) < 0) return false;
    if (multiSearch.length > 1) return multiSearch.indexOf(p.poNumber) >= 0;
    if (raw && (p.poNumber + ' ' + p.awb + ' ' + p.vendor + ' ' + p.materialDescription + ' ' + p.prNumber + ' ' + p.carrier).toLowerCase().indexOf(raw) < 0) return false;
    return true;
  });
}
function latestStatusCell(p) {
  if (!p.awb) {
    var f = poFlags(p).some(function (x) { return x.rule === 'A'; });
    return '<div class="text-xs font-medium ' + (f ? 'text-red-700' : 'text-slate-700') + '">' + (f ? 'Follow-up needed: ' : '') + 'AWB not shared yet</div><div class="text-[11px] text-slate-500">' + esc(p.vendor) + ' · ' + p.daysSincePo + ' d since PO</div>';
  }
  var s = p.scans[p.scans.length - 1];
  return '<div class="text-xs font-medium text-slate-800">' + esc(s ? s.event : p.stage) + '</div><div class="text-[11px] text-slate-500">' + esc(p.currentLocation) + ' · ' + formatDateTime(p.lastScanTime) + '</div>';
}
function renderPoTable() {
  var el = document.getElementById('po-table');
  if (!el) return;
  var ui = appState.ui, list = filteredPOs();
  var pages = Math.max(1, Math.ceil(list.length / PO_PAGE_SIZE));
  if (ui.poPage >= pages) ui.poPage = pages - 1;
  if (ui.poPage < 0) ui.poPage = 0;
  var rows = list.slice(ui.poPage * PO_PAGE_SIZE, (ui.poPage + 1) * PO_PAGE_SIZE).map(function (p) {
    var f = poFlags(p), etaMissed = f.some(function (x) { return x.rule === 'D'; });
    return '<tr><td class="' + UI.td + ' font-mono text-xs"><button type="button" class="font-semibold text-blue-700 underline" onclick="openTrackingModal(\'' + p.poNumber + '\')">' + esc(p.poNumber) + '</button><div class="font-sans text-slate-500">PR ' + esc(p.prNumber) + '/' + p.prLine + '</div></td>' +
      '<td class="' + UI.td + ' min-w-[11rem] text-xs"><div class="font-medium text-slate-800">' + esc(p.materialDescription) + '</div><div class="text-slate-500">' + formatNum(p.quantity) + ' ' + esc(p.uom) + ' · ' + formatINRShort(p.poValue) + '</div></td>' +
      '<td class="' + UI.td + ' max-w-[11rem] text-xs"><div class="truncate font-medium" title="' + esc(p.vendor) + '">' + esc(p.vendor) + '</div><div class="truncate text-slate-500" title="' + esc(p.vendorEmail) + '">' + esc(p.vendorEmail) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs whitespace-nowrap">' + (p.awb ? icon('truck', 'w-3 h-3 inline') + ' ' + esc(p.carrier) : '<span class="text-amber-700">Pending AWB</span>') + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + (p.awb ? '<button type="button" class="font-mono text-blue-700 underline" onclick="openTrackingModal(\'' + p.poNumber + '\')">' + esc(p.awb) + '</button>' :
        '<span class="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-800">Pending AWB</span>' + (can('recordAwb') ? '<div class="mt-1"><button type="button" class="' + UI.btnSm + '" onclick="openAwbReminderModal(\'' + p.poNumber + '\',\'draft\')">' + icon('mail', 'w-3 h-3') + 'Ask AWB & carrier</button></div>' : '')) + '</td>' +
      '<td class="' + UI.td + ' text-xs whitespace-nowrap">' + (p.dispatchDate ? formatDate(p.dispatchDate) : '—') + '</td>' +
      '<td class="' + UI.td + '">' + shipStatusBar(p) + '</td>' +
      '<td class="' + UI.td + ' min-w-[12rem]">' + latestStatusCell(p) + '</td>' +
      '<td class="' + UI.td + ' text-xs whitespace-nowrap ' + (etaMissed ? 'font-semibold text-red-700' : '') + '">' + (etaMissed ? '⚠ ' : '') + formatDate(p.committedEta) +
      (f.length ? '<div class="mt-1">' + f.map(function (x) { return '<span class="mr-0.5 inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1 font-normal text-red-700" title="' + esc(x.text) + '">' + icon('flag', 'w-3 h-3') + x.rule + '</span>'; }).join('') + '</div>' : '') + '</td>' +
      '<td class="' + UI.td + '"><div class="flex gap-1">' +
      (can('followup') ? '<button type="button" class="' + UI.btnSm + '" onclick="' + (p.awb ? 'openFollowupLogModal' : 'openAwbReminderModal') + '(\'' + p.poNumber + '\'' + (p.awb ? '' : ',\'draft\'') + ')">' + icon('bell', 'w-3 h-3') + 'Remind</button>' : '') +
      '<button type="button" class="' + UI.btnSm + '" onclick="openTrackingModal(\'' + p.poNumber + '\')">' + icon('map-pin', 'w-3 h-3') + 'Track</button>' +
      '<button type="button" class="' + UI.btnSm + '" aria-label="Vendor e-mail thread" title="Vendor e-mail thread" onclick="openVendorEmailModal(\'' + p.poNumber + '\')">' + icon('mails', 'w-3 h-3') + '</button></div></td></tr>';
  }).join('');
  el.innerHTML = '<div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">' + icon('truck', 'w-4 h-4 inline') + ' Shipment tracking queue (' + list.length + ' of ' + appState.pos.length + ' PO lines)</h2>' +
    '<p class="text-[11px] text-slate-500">Click a PO, AWB or status bar for the scan timeline and the carrier link.</p></div>' +
    (rows ? tableWrap(ths(['PO / line', 'Material', 'Vendor', 'Carrier', 'AWB / LR no.', 'Dispatched', 'Shipment status', 'Latest courier status & location', 'Committed ETA', 'Action']), rows) : emptyState('No POs match these filters.')) +
    pager(ui.poPage, list.length, PO_PAGE_SIZE, 'setPoPage');
  refreshIcons();
}
function setPoSearch(v) { appState.ui.poSearch = v; appState.ui.poPage = 0; renderPoTable(); }
function setPoPage(p) { appState.ui.poPage = p; renderPoTable(); }
function exportPoList() {
  var rows = [['PO', 'PR', 'Line', 'Vendor', 'Vendor e-mail', 'Material', 'Qty', 'UoM', 'PO value (INR)', 'Stage', 'Carrier', 'AWB', 'Dispatch date', 'Last scan', 'Location', 'Committed ETA', 'Flags', 'Follow-ups']];
  filteredPOs().forEach(function (p) {
    rows.push([p.poNumber, p.prNumber, p.prLine, p.vendor, p.vendorEmail, p.materialDescription, p.quantity, p.uom, p.poValue, p.stage, p.carrier, p.awb, p.dispatchDate, p.lastScanTime, p.currentLocation, p.committedEta,
      poFlags(p).map(function (f) { return f.rule; }).join(' '), p.followUpCount || 0]);
  });
  downloadCsv('po_tracking_' + isoDate(DEMO_TODAY) + '.csv', rows);
}

/* ---------- other tabs ---------- */
function renderPoFollowups() {
  var rows = appState.followUpLog.map(function (f) {
    return '<tr><td class="' + UI.td + ' text-xs whitespace-nowrap">' + formatDateTime(f.timestamp) + '</td><td class="' + UI.td + ' font-mono text-xs"><button type="button" class="text-blue-700 underline" onclick="openTrackingModal(\'' + f.poNumber + '\')">' + esc(f.poNumber) + '</button></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(f.vendor) + '</td><td class="' + UI.td + ' text-xs">' + esc(f.channel) + '</td><td class="' + UI.td + ' text-xs">' + esc(f.notes) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(f.rules || '—') + '</td><td class="' + UI.td + ' text-xs">' + (f.nextDate ? formatDate(f.nextDate) : '—') + '</td><td class="' + UI.td + ' text-xs">' + esc(f.by) + '</td></tr>';
  }).join('');
  var due = appState.pos.filter(function (p) { return p.followUpCount > 0 && p.stage !== 'Delivered'; }).length;
  return '<section class="' + UI.card + '"><div class="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">' + appState.followUpLog.length + ' follow-ups logged this session · ' + due + ' open POs have earlier follow-ups. All logged (simulated) – nothing is sent.</div>' +
    (rows ? tableWrap(ths(['When', 'PO', 'Vendor', 'Channel', 'Notes', 'Rules', 'Next', 'By']), rows) : emptyState('No follow-ups logged yet. Use Delivery Follow-Up or the Remind button on a PO.')) + '</section>';
}
function renderPoAwaiting() {
  var list = awaitingPoLines();
  var rows = list.map(function (l) {
    var v = l.rfq && l.rfq.vendorsContacted.length ? l.rfq.vendorsContacted[0] : (vendorsForCategory(appState.vendors, l.category)[0] || {}).name;
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.materialDescription) + '</td><td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(v || '—') + '</td><td class="' + UI.td + ' text-right">' + formatINRShort(l.estimatedValue) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.assignedBuyer) + '</td><td class="' + UI.td + '">' + slaBadge(l) + '</td>' +
      '<td class="' + UI.td + '">' + (can('createPO') ? '<button type="button" class="' + UI.btnPrimarySm + '" onclick="createFormalPO(\'' + l.id + '\')">' + icon('file-plus', 'w-3 h-3') + 'Create PO</button>' : '') + '</td></tr>';
  }).join('');
  return '<section class="' + UI.card + '">' + (rows ? tableWrap(ths(['Line', 'Material', 'Status', 'L1 vendor', 'Est. value', 'Buyer', 'SLA', '']), rows) : emptyState('No approved lines waiting for a PO.')) +
    '<p class="px-4 py-2 text-[11px] text-slate-500">Creating a PO here records it in the tower only (simulated – no SAP posting).</p></section>';
}
function createFormalPO(lineId) {
  if (!requirePerm('createPO')) return;
  var l = findLine(lineId); if (!l) return;
  if (l.poNumber) { showToast('Line already has PO ' + l.poNumber, 'error'); return; }
  var vName = l.rfq && l.rfq.vendorsContacted.length ? l.rfq.vendorsContacted[0] : null;
  var v = (vName && getVendorByName(vName)) || vendorsForCategory(appState.vendors, l.category)[0] || appState.vendors[0];
  var no = String(4500100000 + appState.pos.length + 1);
  while (findPO(no, true)) no = String(Number(no) + 1);
  appState.pos.push({ poNumber: no, seq: appState.pos.length + 1, stage: 'PO Awarded', vendorId: v.id, vendor: v.name, vendorEmail: v.dispatchEmail, buyer: l.assignedBuyer, category: l.category,
    prNumber: l.prNumber, prLine: l.line, lineId: l.id, materialDescription: l.materialDescription, quantity: l.quantity, uom: l.uom, poValue: Math.round(l.estimatedValue * 0.95),
    poDate: isoDate(DEMO_TODAY), daysSincePo: 0, carrier: '', carrierId: '', awb: '', dispatchDate: '', currentLocation: v.city + ' (vendor)', lastScanTime: '', scans: [],
    committedEta: isoDate(addDays(DEMO_TODAY, 12)), followUpCount: 0, isStuck: false, isOverdue: false, deliveredDate: '' });
  l.poNumber = no;
  if (l.currentStatus === 'NFA APPROVED') setLineStatus(l, 'PO STAGE', 'PO ' + no + ' created');
  else logActivity(l, 'PO ' + no + ' created (simulated, not posted to SAP)');
  addThreadMessage(l.id, { type: 'Update', text: 'PO ' + no + ' created with ' + v.name + '. Awaiting AWB.', assignedTo: l.user });
  showToast('PO ' + no + ' created for ' + l.prNumber + '/' + l.line + ' (simulated)', 'success');
  rerender();
}
function renderPoMapping() {
  var list = appState.lines.filter(function (l) { return l.poNumber; });
  var rows = list.slice(0, 200).map(function (l) {
    var p = findPO(l.poNumber, true);
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.materialDescription) + '</td><td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td>' +
      '<td class="' + UI.td + ' font-mono text-xs">' + icon('arrow-right', 'w-3 h-3 inline text-slate-400') + ' ' + esc(l.poNumber) + '</td><td class="' + UI.td + ' text-xs">' + esc(p ? p.vendor : '—') + '</td>' +
      '<td class="' + UI.td + '">' + (p ? shipStatusBar(p) : '—') + '</td><td class="' + UI.td + ' text-right">' + (p ? formatINRShort(p.poValue) : '—') + '</td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnSm + '" onclick="openTrackingModal(\'' + l.poNumber + '\')">Track</button></td></tr>';
  }).join('');
  return '<section class="' + UI.card + '"><div class="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">' + list.length + ' tower lines are mapped to a PO' + (list.length > 200 ? ' (first 200 shown)' : '') + '.</div>' +
    (rows ? tableWrap(ths(['PR / line', 'Material', 'Line status', 'PO', 'Vendor', 'Shipment', 'PO value', '']), rows) : emptyState('No mappings yet.')) + '</section>';
}
function renderPoGrn() {
  var n = grnLines().length;
  return '<section class="' + UI.card + ' p-5"><p class="text-sm text-slate-700">' + n + ' line(s) are delivered at Jagi Road and need a GRN or closure.</p>' +
    '<button type="button" class="' + UI.btnPrimary + ' mt-3" onclick="navigate(\'grn\')">' + icon('package-check', 'w-4 h-4') + 'Open GRN / Closure</button></section>';
}
