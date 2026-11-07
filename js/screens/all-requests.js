/* All Requests: search, filters, CSV export */
var ALL_PAGE_SIZE = 50;
function filteredAllLines() {
  var ui = appState.ui, q = ui.allSearch.trim().toLowerCase();
  return scopeLines().filter(function (l) {
    if (ui.allStatus && l.currentStatus !== ui.allStatus) return false;
    if (ui.allBuyer && l.assignedBuyer !== ui.allBuyer) return false;
    if (ui.allCategory && l.category !== ui.allCategory) return false;
    if (q) {
      var hay = (l.prNumber + ' ' + l.line + ' ' + l.materialNo + ' ' + l.materialDescription + ' ' + l.user + ' ' + (l.prCreator || '') + ' ' + (l.requestingTeam || '') + ' ' + l.assignedBuyer + ' ' + l.category + ' ' + (l.poNumber || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });
}
function renderAllRequestsScreen() {
  var ui = appState.ui;
  return pageHeader('All requests', appState.role === 'Requester' ? 'Lines raised by ' + esc(currentUserName()) : 'Every PR line in the tower',
      '<button type="button" class="' + UI.btn + '" onclick="exportAllRequests()">' + icon('download', 'w-4 h-4') + 'Export CSV</button>') +
    '<div class="' + UI.card + ' mb-3 flex flex-wrap items-end gap-3 p-3">' +
    '<div class="min-w-[14rem] flex-1"><label class="' + UI.label + '" for="ar-search">Search</label><div class="relative">' + icon('search', 'w-4 h-4 absolute left-2.5 top-2.5 text-slate-400') +
    '<input id="ar-search" class="' + UI.input + ' w-full pl-8" placeholder="PR, material, requester, buyer, PO…" value="' + esc(ui.allSearch) + '" oninput="setAllSearch(this.value)"></div></div>' +
    '<div><label class="' + UI.label + '" for="ar-status">Status</label><select id="ar-status" class="' + UI.input + '" onchange="setAllFilter(\'allStatus\',this.value)">' +
    selectOptions(STAGES.map(function (s) { return { value: s.key, label: s.label }; }), ui.allStatus, 'All statuses') + '</select></div>' +
    '<div><label class="' + UI.label + '" for="ar-buyer">Buyer</label><select id="ar-buyer" class="' + UI.input + '" onchange="setAllFilter(\'allBuyer\',this.value)">' +
    selectOptions(appState.buyers.map(function (b) { return b.name; }), ui.allBuyer, 'All buyers') + '</select></div>' +
    '<div><label class="' + UI.label + '" for="ar-cat">Category</label><select id="ar-cat" class="' + UI.input + '" onchange="setAllFilter(\'allCategory\',this.value)">' +
    selectOptions(appState.categories.map(function (c) { return c.name; }), ui.allCategory, 'All categories') + '</select></div>' +
    '<button type="button" class="' + UI.btn + '" onclick="clearAllFilters()">' + icon('x', 'w-4 h-4') + 'Clear</button></div>' +
    '<section id="ar-table" class="' + UI.card + '"></section>';
}
function initAllRequests() { renderAllRequestsTable(); }
function renderAllRequestsTable() {
  var el = document.getElementById('ar-table');
  if (!el) return;
  var list = filteredAllLines(), ui = appState.ui;
  var pages = Math.max(1, Math.ceil(list.length / ALL_PAGE_SIZE));
  if (ui.allPage >= pages) ui.allPage = pages - 1;
  if (ui.allPage < 0) ui.allPage = 0;
  var rows = list.slice(ui.allPage * ALL_PAGE_SIZE, (ui.allPage + 1) * ALL_PAGE_SIZE).map(function (l) {
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '</td><td class="' + UI.td + '">' + esc(l.materialDescription) + '<div class="text-xs text-slate-500">' + esc(l.materialNo) + ' · ' + formatNum(l.quantity) + ' ' + esc(l.uom) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(l.category) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.user) + '<div class="text-slate-500">' + esc(l.requestingTeam || '—') + ' · NBD ' + formatDate(l.requiredDeliveryDate) + '</div></td><td class="' + UI.td + ' text-xs">' + esc(l.assignedBuyer) + '</td>' +
      '<td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td><td class="' + UI.td + '">' + slaBadge(l) + '</td>' +
      '<td class="' + UI.td + ' text-right">' + formatINRShort(l.estimatedValue) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.poNumber || '—') + '</td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnSm + '" onclick="openLineDrawer(\'' + l.id + '\')">Open</button></td></tr>';
  }).join('');
  el.innerHTML = (rows ? tableWrap(ths(['PR / line', 'Material', 'Category', 'Requester · team', 'Buyer', 'Status', 'SLA', 'Est. value', 'PO', '']), rows) : emptyState('No lines match.')) +
    pager(ui.allPage, list.length, ALL_PAGE_SIZE, 'setAllPage');
  refreshIcons();
}
function setAllSearch(v) { appState.ui.allSearch = v; appState.ui.allPage = 0; renderAllRequestsTable(); }
function setAllFilter(key, v) { appState.ui[key] = v; appState.ui.allPage = 0; renderAllRequestsTable(); }
function setAllPage(p) { appState.ui.allPage = p; renderAllRequestsTable(); }
function clearAllFilters() { var u = appState.ui; u.allSearch = ''; u.allStatus = ''; u.allBuyer = ''; u.allCategory = ''; u.allPage = 0; rerender(); }
function exportAllRequests() {
  var rows = [['PR', 'Line', 'Material No', 'Description', 'Qty', 'UoM', 'Category', 'Department', 'Requesting team', 'Requester', 'Requester e-mail', 'PR creator', 'PR creator e-mail', 'Buyer', 'Status', 'Days in status', 'SLA days', 'SLA state', 'Est. value (INR)', 'PO', 'NBD']];
  filteredAllLines().forEach(function (l) {
    rows.push([l.prNumber, l.line, l.materialNo, l.materialDescription, l.quantity, l.uom, l.category, l.department, l.requestingTeam || '', l.user, l.userEmail, l.prCreator || '', l.prCreatorEmail || '', l.assignedBuyer, l.currentStatus,
      l.daysInStatus, l.stageSlaDays || '', slaInfo(l).label, l.estimatedValue, l.poNumber || '', l.requiredDeliveryDate]);
  });
  downloadCsv('all_requests_' + isoDate(DEMO_TODAY) + '.csv', rows);
}
