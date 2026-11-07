/* My Work Queue: logged-in buyer's open lines */
function queueBuyerName() {
  if (appState.role === 'Buyer') return ROLE_USERS.Buyer;
  return getBuyer(appState.ui.queueBuyer) ? appState.ui.queueBuyer : ROLE_USERS.Buyer;
}
function renderWorkQueueScreen() {
  var ui = appState.ui, me = queueBuyerName();
  var mine = openLinesOf(me);
  var counts = {};
  mine.forEach(function (l) { counts[l.currentStatus] = (counts[l.currentStatus] || 0) + 1; });
  if (ui.queueStatus !== 'ALL' && !counts[ui.queueStatus]) ui.queueStatus = 'ALL';
  var chips = chip('All', ui.queueStatus === 'ALL', "setQueueStatus(-1)", mine.length);
  STAGES.forEach(function (s, i) { if (counts[s.key]) chips += chip(s.label, ui.queueStatus === s.key, 'setQueueStatus(' + i + ')', counts[s.key]); });
  var withQ = mine.filter(function (l) { return openQueryCount(l.id) > 0; }).length;
  chips += '<span class="mx-1 h-6 w-px bg-slate-200"></span>' + chip('Has open query', ui.queueOpenQuery, 'toggleQueueQuery()', withQ);
  var q = (ui.queueSearch || '').trim().toLowerCase();
  var list = mine.filter(function (l) {
    if (ui.queueStatus !== 'ALL' && l.currentStatus !== ui.queueStatus) return false;
    if (ui.queueOpenQuery && !openQueryCount(l.id)) return false;
    if (ui.queueDept && l.department !== ui.queueDept) return false;
    if (q) {
      var vend = (appState.materialHistory[l.materialNo] || []).map(function (h) { return h.vendorName + ' ' + h.vendorId; }).join(' ');
      if ((l.prNumber + ' ' + l.materialNo + ' ' + l.materialDescription + ' ' + l.user + ' ' + (l.prCreator || '') + ' ' + vend).toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
  var order = { breach: 0, risk: 1, on: 2, na: 3 };
  list.sort(function (a, b) { return order[slaInfo(a).state] - order[slaInfo(b).state] || b.daysInStatus - a.daysInStatus; });
  var sla = { breach: 0, risk: 0, on: 0 };
  mine.forEach(function (l) { var s = slaInfo(l).state; if (sla[s] !== undefined) sla[s]++; });
  var rows = list.map(function (l) {
    var q = openQueryCount(l.id);
    var hist = appState.materialHistory[l.materialNo] || [];
    var open = !!appState.ui.queueHistory[l.id];
    var lastV = hist[0];
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '</td><td class="' + UI.td + '">' + esc(l.materialDescription) + '<div class="text-xs text-slate-500">' + esc(l.materialNo) + ' · ' + esc(l.category) + ' · NBD ' + formatDate(l.requiredDeliveryDate) + '</div>' +
      '<button type="button" class="mt-1 flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-blue-700 hover:underline" aria-expanded="' + open + '" onclick="toggleQueueHistory(\'' + l.id + '\')">' +
      icon(open ? 'chevron-down' : 'chevron-right', 'w-3 h-3 shrink-0') + (open ? 'Hide' : 'Show') + ' vendor history (' + Math.min(10, hist.length) + ')</button>' +
      (lastV ? '<div class="text-[11px] text-slate-500">Last bought from <span class="font-mono">' + esc(lastV.vendorId) + '</span> ' + esc(lastV.vendorName) + '</div>' : '') + '</td>' +
      '<td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td><td class="' + UI.td + ' text-right">' + formatNum(l.daysInStatus, 1) + ' d</td><td class="' + UI.td + '">' + slaBadge(l) + '</td>' +
      '<td class="' + UI.td + '">' + (q ? '<span class="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">' + icon('message-square', 'w-3 h-3') + q + ' open</span>' : '<span class="text-xs text-slate-400">—</span>') + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(l.nextAction) + '</td><td class="' + UI.td + ' text-right">' + formatINRShort(l.estimatedValue) + '</td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnPrimarySm + '" onclick="openLineDrawer(\'' + l.id + '\')">Open</button></td></tr>' +
      (open ? '<tr class="bg-slate-50"><td colspan="9" class="px-3 pb-3 pt-1"><div class="mb-1 text-xs font-semibold text-slate-600">' + icon('history', 'w-3 h-3 inline') + ' Last ' + Math.min(10, hist.length) + ' purchases of ' + esc(l.materialDescription) + ' (' + esc(l.materialNo) + ')</div>' +
        vendorHistoryTable(l.materialNo, 10) + '</td></tr>' : '');
  }).join('');
  var anyOpen = list.some(function (l) { return appState.ui.queueHistory[l.id]; });
  chips += '<span class="ml-auto"></span><button type="button" class="' + UI.btnSm + '" onclick="toggleAllQueueHistory(' + (anyOpen ? 'false' : 'true') + ')">' + icon('history', 'w-3 h-3') + (anyOpen ? 'Collapse vendor history' : 'Expand vendor history (all)') + '</button>';
  var b = getBuyer(me);
  var picker = appState.role !== 'Buyer' ? '<label class="text-xs text-slate-500" for="wq-buyer">Viewing queue of</label><select id="wq-buyer" class="' + UI.input + '" onchange="setQueueBuyer(this.value)">' +
    selectOptions(appState.buyers.map(function (x) { return { value: x.id, label: x.name }; }), b ? b.id : '') + '</select>' : '';
  return pageHeader('My work queue', esc(me) + ' · ' + mine.length + ' open lines · ' + (b ? b.openLines + ' / ' + b.capacity + ' capacity (' + loadPct(b) + '%)' : ''), picker) +
    '<div class="mb-4 grid grid-cols-3 gap-3">' +
    kpiTile('On track', sla.on, 'Within 75% of stage SLA', 'circle-check', 'green') + kpiTile('At risk', sla.risk, '75–100% of stage SLA used', 'clock', 'amber') +
    kpiTile('Breached', sla.breach, 'Over stage SLA', 'circle-alert', 'red') + '</div>' +
    renderPendingQueriesPanel(mine) +
    '<div class="mb-3 flex flex-wrap items-center gap-2">' + chips + '</div>' +
    '<div class="mb-3 flex flex-wrap items-end gap-3"><div class="min-w-[14rem] flex-1"><label class="sr-only" for="wq-search">Search</label><div class="relative">' + icon('search', 'w-4 h-4 absolute left-2.5 top-2.5 text-slate-400') +
    '<input id="wq-search" class="' + UI.input + ' w-full pl-8" placeholder="Search PR, material, requester, vendor… (press Enter)" value="' + esc(ui.queueSearch || '') + '" onchange="setQueueFilter(\'queueSearch\',this.value)" onkeydown="if(event.key===\'Enter\')setQueueFilter(\'queueSearch\',this.value)"></div></div>' +
    '<div><label class="sr-only" for="wq-dept">Department</label><select id="wq-dept" class="' + UI.input + '" onchange="setQueueFilter(\'queueDept\',this.value)">' +
    selectOptions(DEPARTMENTS.filter(function (d) { return mine.some(function (l) { return l.department === d; }); }), ui.queueDept || '', 'Dept: All') + '</select></div>' +
    '<span class="text-xs text-slate-500">' + list.length + ' of ' + mine.length + ' lines</span></div>' +
    '<section class="' + UI.card + '">' + (rows ? tableWrap(ths(['PR / line', 'Material', 'Status', 'In status', 'SLA', 'Queries', 'Next action', 'Est. value', '']), rows) : emptyState('No lines match these filters.')) + '</section>';
}
/* open queries raised TO the buyer (by requesters / PR creators) on their lines, oldest first */
function pendingQueriesFor(lines) {
  var out = [];
  lines.forEach(function (l) {
    (appState.threads[l.id] || []).forEach(function (m) {
      if (m.status === 'Open' && m.role !== 'Buyer' && m.role !== 'PMO Admin') out.push({ l: l, m: m, age: daysAgo(m.timestamp) });
    });
  });
  return out.sort(function (a, b) { return b.age - a.age; });
}
function renderPendingQueriesPanel(lines) {
  var qs = pendingQueriesFor(lines);
  if (!qs.length) return '';
  var rows = qs.slice(0, 8).map(function (x) {
    var d = Math.floor(x.age);
    return '<tr><td class="' + UI.td + '"><span class="rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + (d >= 3 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800') + '">' + (d >= 3 ? '⚠ ' : '') + d + ' d old</span></td>' +
      '<td class="' + UI.td + '">' + lineRef(x.l) + '</td><td class="' + UI.td + ' text-xs font-medium text-slate-800">' + esc(x.l.materialDescription) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(x.m.author) + ' <span class="text-slate-500">(' + esc(x.m.role) + ')</span></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(x.m.type) + '</td><td class="' + UI.td + ' max-w-xs truncate text-xs text-slate-600" title="' + esc(x.m.text) + '">“' + esc(x.m.text) + '”</td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnPrimarySm + '" onclick="openThreadDrawer(\'' + x.l.id + '\')">' + icon('reply', 'w-3 h-3') + 'Reply</button></td></tr>';
  }).join('');
  return '<section class="mb-4 overflow-hidden rounded-xl border border-slate-800 bg-white shadow-sm"><div class="flex flex-wrap items-center gap-2 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">' +
    icon('message-circle-question', 'w-4 h-4 text-amber-300') + 'Pending queries & clarifications (' + qs.length + ')<span class="text-xs font-normal text-slate-400">· oldest queries assigned to you' + (qs.length > 8 ? ' · showing 8' : '') + '</span></div>' +
    tableWrap(ths(['Age', 'PR / line', 'Subject', 'Asked by', 'Type', 'Query', '']), rows) + '</section>';
}
function setQueueFilter(key, v) {
  if (key !== 'queueSearch' && key !== 'queueDept') return;
  if (key === 'queueDept' && v && DEPARTMENTS.indexOf(v) < 0) { showToast('Unknown department.', 'error'); return; }
  appState.ui[key] = v; rerender();
}
function setQueueStatus(i) { appState.ui.queueStatus = i < 0 ? 'ALL' : (STAGES[i] ? STAGES[i].key : 'ALL'); rerender(); }
function toggleQueueQuery() { appState.ui.queueOpenQuery = !appState.ui.queueOpenQuery; rerender(); }
function toggleQueueHistory(lineId) {
  if (!findLine(lineId)) return;
  appState.ui.queueHistory[lineId] = !appState.ui.queueHistory[lineId];
  rerender();
}
function toggleAllQueueHistory(on) {
  var me = queueBuyerName();
  appState.ui.queueHistory = {};
  if (on) openLinesOf(me).forEach(function (l) { appState.ui.queueHistory[l.id] = true; });
  rerender();
}
function setQueueBuyer(id) { var b = getBuyerById(id); if (!b) { showToast('Buyer not found.', 'error'); return; } appState.ui.queueBuyer = b.name; appState.ui.queueStatus = 'ALL'; rerender(); }
