/* Work Allocation: unallocated intake, category chips, manual + auto allocation, OOO transfer, audit log */
function findIntake(id) {
  for (var i = 0; i < appState.unallocated.length; i++) if (appState.unallocated[i].id === id) return appState.unallocated[i];
  return null;
}
function intakeToLine(u, buyerName) {
  return {
    id: u.id, prNumber: u.prNumber, line: u.line, materialNo: u.materialNo, materialDescription: u.materialDescription,
    quantity: u.quantity, uom: u.uom, department: u.department, requestingTeam: u.requestingTeam || 'Other', category: u.category,
    user: u.user, userEmail: u.userEmail, userEmailOriginal: u.userEmailOriginal, userHod: u.userHod,
    prCreator: u.prCreator || u.user, prCreatorEmail: u.prCreatorEmail || u.userEmail, prCreatorEmailOriginal: u.prCreatorEmailOriginal,
    currentStatus: 'PENDING SPECS', daysInStatus: 0, stageSlaDays: 2, nextAction: NEXT_ACTION['PENDING SPECS'], assignedBuyer: buyerName,
    requiredDeliveryDate: u.requiredDeliveryDate, prStatus: u.prStatus, prCreationDate: u.prCreationDate, estimatedValue: u.estimatedValue,
    remindersCount: 0, missingItems: [], buyerNote: '', poNumber: null, receivedQty: 0, storageLocation: '', dock: '', rfq: null,
    activityLog: [{ timestamp: u.receivedAt || nowStamp(), author: u.source || 'SAP intake', role: 'System', action: 'Line received into tower (' + (u.source || 'SAP intake') + ')' }]
      .concat(u.userEmailOriginal ? [{ timestamp: u.receivedAt || nowStamp(), author: 'Email check', role: 'System', action: 'Requester e-mail auto-corrected "' + String(u.userEmailOriginal).trim() + '" → ' + u.userEmail }] : [])
  };
}
/* every intake path (SAP, New Request, Bulk Upload) goes through here: e-mails are cleaned before the line exists */
function addIntake(u) {
  normaliseContactEmails(u, false);
  appState.unallocated.push(u);
  return u;
}
/* moves intake lines into the tower; returns number allocated */
function allocateIntakeLines(ids, buyerName, action, reason, silentAudit) {
  var b = getBuyer(buyerName);
  if (!b) { showToast('Buyer ' + buyerName + ' not found.', 'error'); return 0; }
  var n = 0;
  ids.forEach(function (id) {
    var u = findIntake(id);
    if (!u) return;
    if (findLine(id, true)) { appState.unallocated.splice(appState.unallocated.indexOf(u), 1); return; }
    var l = intakeToLine(u, b.name);
    l.activityLog.push({ timestamp: nowStamp(), author: currentUserName(), role: appState.role, action: action + ' to ' + b.name + (reason ? ' (' + reason + ')' : '') });
    appState.lines.push(l);
    appState.unallocated.splice(appState.unallocated.indexOf(u), 1);
    delete appState.ui.allocSelected[id];
    n++;
  });
  if (!silentAudit && n) {
    appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: action, detail: n + ' line(s)', from: '—', to: b.name, reason: reason || '—' });
  }
  refreshBuyerLoads();
  return n;
}

function renderWorkAllocationScreen() {
  var ui = appState.ui;
  var counts = {};
  appState.unallocated.forEach(function (u) { counts[u.category] = (counts[u.category] || 0) + 1; });
  if (ui.allocCategory !== 'ALL' && !getCategoryById(ui.allocCategory)) ui.allocCategory = 'ALL';
  var chips = chip('All categories', ui.allocCategory === 'ALL', "setAllocCategory('ALL')", appState.unallocated.length);
  appState.categories.forEach(function (c) {
    chips += '<button type="button" class="' + UI.chip + ' ' + (ui.allocCategory === c.id ? UI.chipOn : UI.chipOff) + ' flex-col !items-start !rounded-lg text-left" onclick="setAllocCategory(\'' + c.id + '\')" aria-pressed="' + (ui.allocCategory === c.id) + '">' +
      '<span class="font-semibold">' + esc(c.name) + ' (' + (counts[c.name] || 0) + ')</span>' +
      '<span class="text-[10px] opacity-80">' + esc(poolLabel(c)) + '</span></button>';
  });
  var cat = getCategoryById(ui.allocCategory);
  var list = appState.unallocated.filter(function (u) { return !cat || u.category === cat.name; });
  var allSel = list.length && list.every(function (u) { return ui.allocSelected[u.id]; });
  var selCount = Object.keys(ui.allocSelected).filter(function (k) { return ui.allocSelected[k] && findIntake(k); }).length;
  var rows = list.map(function (u) {
    var c = getCategory(u.category);
    return '<tr class="' + (ui.allocSelected[u.id] ? 'bg-blue-50/50' : '') + '"><td class="' + UI.td + '"><input type="checkbox" aria-label="Select ' + u.id + '" ' + (ui.allocSelected[u.id] ? 'checked' : '') + ' onchange="toggleAllocSel(\'' + u.id + '\',this.checked)"></td>' +
      '<td class="' + UI.td + '">' + lineRef(u) + '</td><td class="' + UI.td + '">' + esc(u.materialDescription) + '<div class="text-xs text-slate-500">' + esc(u.materialNo) + ' · ' + formatNum(u.quantity) + ' ' + esc(u.uom) + '</div></td>' +
      '<td class="' + UI.td + '">' + esc(u.category) + '<div class="text-xs text-slate-500">Pool: ' + esc(c ? c.buyers.join(', ') : '—') + '</div></td>' +
      '<td class="' + UI.td + '">' + esc(u.user) + '<div class="text-xs text-slate-500">' + esc(u.department) + ' · ' + esc(u.requestingTeam || '—') + '</div>' +
      '<div class="text-[11px] text-slate-500">' + esc(u.userEmail) + (u.userEmailOriginal ? ' <span class="text-emerald-700" title="Auto-corrected from ' + esc(String(u.userEmailOriginal).trim()) + '">' + icon('wand-sparkles', 'w-3 h-3 inline') + ' corrected</span>' : '') + '</div></td>' +
      '<td class="' + UI.td + ' text-right">' + formatINRShort(u.estimatedValue) + '</td><td class="' + UI.td + ' text-xs">' + formatDateTime(u.receivedAt) + '</td></tr>';
  }).join('');
  var buyerOpts = appState.buyers.map(function (b) { return { value: b.id, label: b.name + (b.ooo ? ' (OOO)' : '') + ' · ' + b.openLines + '/' + b.capacity }; });

  var buyers = appState.buyers.map(function (b) {
    var pct = loadPct(b);
    return '<li class="flex items-center gap-3 py-2"><div class="flex-1"><div class="text-sm font-medium text-slate-800">' + esc(b.name) + (b.ooo ? oooBadge() : '') + '</div>' +
      '<div class="mt-1 h-1.5 rounded-full bg-slate-100"><div class="h-1.5 rounded-full ' + (pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<div class="mt-0.5 text-[11px] text-slate-500">' + b.openLines + ' / ' + b.capacity + ' open (' + pct + '%) · backup ' + esc((getBuyerById(b.backup) || {}).name || '—') + '</div></div>' +
      (can('allocate') ? '<button type="button" class="' + UI.btnSm + '" onclick="openBulkBackupModal(\'' + b.id + '\')"' + (b.openLines ? '' : ' disabled') + '>' + icon('arrow-right-left', 'w-3 h-3') + 'OOO transfer</button>' : '') + '</li>';
  }).join('');

  var audit = appState.auditLog.slice(0, 15).map(function (a) {
    return '<tr><td class="' + UI.td + ' whitespace-nowrap text-xs">' + formatDateTime(a.timestamp) + '</td><td class="' + UI.td + '">' + esc(a.action) + '</td><td class="' + UI.td + ' text-xs">' + esc(a.detail) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(a.from) + '</td><td class="' + UI.td + ' text-xs">' + esc(a.to) + '</td><td class="' + UI.td + ' text-xs">' + esc(a.reason) + '</td><td class="' + UI.td + ' text-xs">' + esc(a.actor) + '</td></tr>';
  }).join('');

  return pageHeader('Work allocation', appState.unallocated.length + ' unallocated intake lines from SAP intake, New Request and Bulk Upload',
      can('autoAllocate') ? '<button type="button" class="' + UI.btnPrimary + '" onclick="openAutoAllocateModal()"' + (appState.unallocated.length ? '' : ' disabled') + '>' + icon('zap', 'w-4 h-4') + 'Auto-allocate all (1-click)</button>' :
        '<span class="text-xs text-slate-500">' + icon('lock', 'w-3 h-3 inline') + ' Auto-allocate is a PMO Admin action</span>') +
    '<div class="mb-4 flex flex-wrap gap-2">' + chips + '</div>' +
    '<div class="grid gap-5 xl:grid-cols-3"><section class="' + UI.card + ' xl:col-span-2">' +
    '<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3"><label class="flex items-center gap-2 text-sm"><input type="checkbox" ' + (allSel ? 'checked' : '') + ' onchange="toggleAllocAll(this.checked)"> Select all shown</label>' +
    '<span class="text-xs text-slate-500">' + selCount + ' selected</span><span class="ml-auto flex items-center gap-2">' +
    '<label class="sr-only" for="alloc-buyer">Buyer</label><select id="alloc-buyer" class="' + UI.input + '">' + selectOptions(buyerOpts, '', 'Choose buyer…') + '</select>' +
    '<button type="button" class="' + UI.btn + '" onclick="allocateSelected()"' + (can('allocate') ? '' : ' disabled') + '>' + icon('user-check', 'w-4 h-4') + 'Allocate selected to…</button></span></div>' +
    (rows ? tableWrap('<th class="' + UI.th + '"></th>' + ths(['PR / line', 'Material', 'Category · buyer pool', 'Requester · team', 'Est. value', 'Received']), rows) : emptyState('All intake lines are allocated.')) +
    '</section><section class="' + UI.card + ' p-4"><h2 class="text-sm font-semibold text-slate-800">Buyer load</h2><ul class="divide-y divide-slate-100">' + buyers + '</ul></section></div>' +
    '<section class="' + UI.card + ' mt-5"><h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">' + icon('history', 'w-4 h-4 inline') + ' Allocation audit log</h2>' +
    tableWrap(ths(['When', 'Action', 'Detail', 'From', 'To', 'Reason', 'By']), audit) + '</section>';
}
function setAllocCategory(id) { appState.ui.allocCategory = id; rerender(); }
function toggleAllocSel(id, on) { if (!findIntake(id)) { showToast('Intake line ' + id + ' not found.', 'error'); return; } appState.ui.allocSelected[id] = !!on; rerender(); }
function toggleAllocAll(on) {
  var cat = getCategoryById(appState.ui.allocCategory);
  appState.unallocated.forEach(function (u) { if (!cat || u.category === cat.name) appState.ui.allocSelected[u.id] = !!on; });
  rerender();
}
function allocateSelected() {
  if (!requirePerm('allocate')) return;
  var b = getBuyerById(fieldVal('alloc-buyer'));
  if (!b) { showToast('Choose a buyer first.', 'error'); return; }
  var ids = Object.keys(appState.ui.allocSelected).filter(function (k) { return appState.ui.allocSelected[k] && findIntake(k); });
  if (!ids.length) { showToast('Select at least one line.', 'error'); return; }
  if (b.ooo) showToast(b.name + ' is Out of Office – allocated anyway.', 'warn');
  var n = allocateIntakeLines(ids, b.name, 'Manual allocation', 'Selected by ' + currentUserName());
  showToast('Allocated ' + n + ' line(s) to ' + b.name, 'success');
  rerender();
}
