/* Master Data & Capacity: capacity tracker, workload rebalancer, category allocation rules */
var REBALANCE_ORDER = ['PENDING SPECS', 'VENDOR OUTREACH', 'COMMERCIALS', 'INFO REQUIRED', 'ON HOLD'];
function rebalanceDefaults() {
  var ui = appState.ui;
  var sorted = appState.buyers.slice().sort(function (a, b) { return b.openLines - a.openLines; });
  if (!getBuyerById(ui.rebalanceFrom)) ui.rebalanceFrom = sorted[0].id;
  var to = getBuyerById(ui.rebalanceTo);
  if (!to || to.ooo || to.id === ui.rebalanceFrom) {
    var cand = sorted.slice().reverse().filter(function (b) { return !b.ooo && b.id !== ui.rebalanceFrom; })[0];
    ui.rebalanceTo = cand ? cand.id : '';
  }
}
function rebalanceCandidates(from) {
  // movable = early-stage, buyer-controllable lines (never in-flight POs)
  return openLinesOf(from.name).filter(function (l) { return REBALANCE_ORDER.indexOf(l.currentStatus) >= 0; })
    .sort(function (a, b) { return REBALANCE_ORDER.indexOf(a.currentStatus) - REBALANCE_ORDER.indexOf(b.currentStatus); });
}
function rebalancePlan() {
  var ui = appState.ui, from = getBuyerById(ui.rebalanceFrom), to = getBuyerById(ui.rebalanceTo);
  if (!from || !to || from.id === to.id) return null;
  var cands = rebalanceCandidates(from);
  var n = Math.min(cands.length, Math.round(from.openLines * ui.rebalancePct / 100));
  return { from: from, to: to, lines: cands.slice(0, n), movable: cands.length };
}
function renderRebalancePreview() {
  var el = document.getElementById('rb-preview');
  if (!el) return;
  var p = rebalancePlan();
  document.getElementById('rb-pct-label').textContent = appState.ui.rebalancePct + '%';
  if (!p) { el.innerHTML = '<p class="text-sm text-red-700">Pick two different buyers.</p>'; return; }
  var n = p.lines.length;
  function bar(b, after) {
    var pct = Math.round(after / b.capacity * 100);
    return '<div class="text-xs"><div class="flex justify-between"><span class="font-medium">' + esc(b.name) + '</span><span>' + b.openLines + ' → <b class="' + (pct > 100 ? 'text-red-700' : pct > 85 ? 'text-amber-700' : 'text-emerald-700') + '">' + after + '</b> / ' + b.capacity + ' (' + pct + '%)</span></div>' +
      '<div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full ' + (pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + Math.min(100, pct) + '%"></div></div></div>';
  }
  el.innerHTML = '<p class="mb-2 text-sm text-slate-700">Moves <b>' + n + '</b> early-stage line(s) (' + p.movable + ' movable; in-flight POs stay put).</p>' +
    '<div class="space-y-2">' + bar(p.from, p.from.openLines - n) + bar(p.to, p.to.openLines + n) + '</div>';
}
function renderMasterDataScreen() {
  rebalanceDefaults();
  var ui = appState.ui;
  var cap = appState.buyers.map(function (b) {
    var pct = loadPct(b), over = pct > 100;
    return '<tr class="' + (over ? 'bg-red-50/60' : '') + '"><td class="' + UI.td + ' font-medium">' + esc(b.name) + (b.ooo ? oooBadge() : '') + '<div class="text-xs font-normal text-slate-500">' + esc(b.team) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(b.mainCategory) + '</td><td class="' + UI.td + ' text-xs">' + esc((getBuyerById(b.backup) || {}).name || '—') + '</td>' +
      '<td class="' + UI.td + ' w-56"><div class="flex items-center gap-2"><div class="h-2 flex-1 rounded-full bg-slate-100"><div class="h-2 rounded-full ' + (over ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<span class="w-24 text-right text-xs ' + (over ? 'font-bold text-red-700' : pct > 85 ? 'font-semibold text-amber-700' : '') + '">' + (over ? icon('circle-alert', 'w-3 h-3 inline') + ' ' : '') + b.openLines + '/' + b.capacity + ' · ' + pct + '%</span></div>' + (over ? '<div class="text-[11px] text-red-700">Overloaded by ' + (b.openLines - b.capacity) + ' lines</div>' : '') + '</td>' +
      '<td class="' + UI.td + ' text-right text-xs">' + formatNum(b.avgCycleDays, 1) + ' d</td>' +
      '<td class="' + UI.td + '"><label class="inline-flex items-center gap-2 text-xs"><input type="checkbox" ' + (b.ooo ? 'checked' : '') + ' onchange="toggleBuyerOoo(\'' + b.id + '\',this.checked)"> Out of office</label></td></tr>';
  }).join('');
  var buyerOpts = appState.buyers.map(function (b) { return { value: b.id, label: b.name + (b.ooo ? ' (OOO)' : '') + ' · ' + b.openLines }; });
  var rules = appState.categories.map(function (c) {
    var pool = categoryPool(c).map(function (b) {
      return '<span class="mb-1 mr-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs">' + esc(b.name) + (b.ooo ? ' <span class="text-orange-700">(OOO)</span>' : '') +
        '<button type="button" class="text-slate-400 hover:text-red-600" aria-label="Remove ' + esc(b.name) + ' from ' + esc(c.name) + '" onclick="removePoolBuyer(\'' + c.id + '\',\'' + b.id + '\')">' + icon('x', 'w-3 h-3') + '</button></span>';
    }).join('');
    var addOpts = appState.buyers.filter(function (b) { return c.buyers.indexOf(b.name) < 0; }).map(function (b) { return { value: b.id, label: b.name }; });
    var fbOpts = appState.buyers.map(function (b) { return { value: b.id, label: b.name + (b.ooo ? ' (OOO)' : '') }; });
    return '<tr class="' + (c.active ? '' : 'bg-slate-50 text-slate-400') + '"><td class="' + UI.td + ' text-sm font-medium">' + esc(c.name) + '</td>' +
      '<td class="' + UI.td + '">' + pool + '<select class="' + UI.input + ' mt-1 text-xs" aria-label="Add buyer to ' + esc(c.name) + '" onchange="addPoolBuyer(\'' + c.id + '\',this.value)">' + selectOptions(addOpts, '', '+ Add buyer…') + '</select></td>' +
      '<td class="' + UI.td + '"><select class="' + UI.input + ' text-xs" aria-label="Fallback for ' + esc(c.name) + '" onchange="setCategoryFallback(\'' + c.id + '\',this.value)">' + selectOptions(fbOpts, (getBuyer(c.fallback) || {}).id) + '</select></td>' +
      '<td class="' + UI.td + ' text-xs">' + appState.lines.filter(function (l) { return isOpen(l) && l.category === c.name; }).length + '</td>' +
      '<td class="' + UI.td + '"><label class="inline-flex items-center gap-2 text-xs"><input type="checkbox" ' + (c.active ? 'checked' : '') + ' onchange="toggleCategoryActive(\'' + c.id + '\',this.checked)"> ' + (c.active ? 'Active' : 'Inactive') + '</label></td></tr>';
  }).join('');
  return pageHeader('Master data & capacity', appState.buyers.length + ' buyers · 90 open lines each · ' + appState.categories.length + ' categories with buyer pools · changes apply live to allocation') +
    '<section class="' + UI.card + '"><h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">Buyer capacity tracker</h2>' +
    tableWrap(ths(['Buyer', 'Category', 'Backup', 'Load (90-line limit)', 'Avg cycle', 'Availability']), cap) + '</section>' +
    '<div class="mt-5 grid gap-5 xl:grid-cols-5"><section class="' + UI.card + ' p-4 xl:col-span-2"><h2 class="text-sm font-semibold text-slate-800">' + icon('scale', 'w-4 h-4 inline') + ' Workload rebalancer</h2>' +
    '<div class="mt-3 grid grid-cols-2 gap-3"><div><label class="' + UI.label + '" for="rb-from">From</label><select id="rb-from" class="' + UI.input + ' w-full" onchange="setRebalance(\'rebalanceFrom\',this.value)">' + selectOptions(buyerOpts, ui.rebalanceFrom) + '</select></div>' +
    '<div><label class="' + UI.label + '" for="rb-to">To</label><select id="rb-to" class="' + UI.input + ' w-full" onchange="setRebalance(\'rebalanceTo\',this.value)">' + selectOptions(buyerOpts, ui.rebalanceTo) + '</select></div></div>' +
    '<label class="' + UI.label + ' mt-3" for="rb-pct">Share of open lines to move: <span id="rb-pct-label">' + ui.rebalancePct + '%</span></label>' +
    '<input id="rb-pct" type="range" min="0" max="50" step="5" value="' + ui.rebalancePct + '" class="w-full" oninput="appState.ui.rebalancePct=Number(this.value);renderRebalancePreview()">' +
    '<div id="rb-preview" class="mt-3 rounded-lg border border-slate-200 p-3"></div>' +
    '<button type="button" class="' + UI.btnPrimary + ' mt-3" onclick="applyRebalance()">' + icon('check', 'w-4 h-4') + 'Apply rebalance</button></section>' +
    '<section class="' + UI.card + ' xl:col-span-3"><h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">Category allocation rules</h2>' +
    tableWrap(ths(['Category', 'Buyer pool (least-loaded gets new work)', 'Fallback buyer', 'Open lines', 'Rule']), rules) + '</section></div>';
}
function initMasterData() { renderRebalancePreview(); }
function toggleBuyerOoo(id, on) {
  if (!requirePerm('masterData')) return;
  var b = getBuyerById(id); if (!b) { showToast('Buyer not found.', 'error'); return; }
  b.ooo = !!on;
  appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: on ? 'Marked OOO' : 'Back in office', detail: b.name, from: '—', to: '—', reason: 'Master data' });
  showToast(b.name + (on ? ' marked Out of Office – new intake goes to others in the pool' : ' is available again'), 'success');
  rerender();
}
function setRebalance(key, id) { if (!getBuyerById(id)) { showToast('Buyer not found.', 'error'); return; } appState.ui[key] = id; renderRebalancePreview(); }
function applyRebalance() {
  if (!requirePerm('masterData')) return;
  var p = rebalancePlan();
  if (!p) { showToast('Pick two different buyers.', 'error'); return; }
  if (!p.lines.length) { showToast('Nothing to move at this percentage.', 'info'); return; }
  if (p.to.ooo) { showToast(p.to.name + ' is Out of Office.', 'error'); return; }
  var before = p.from.openLines;
  p.lines.forEach(function (l) {
    l.assignedBuyer = p.to.name;
    logActivity(l, 'Rebalanced ' + p.from.name + ' → ' + p.to.name);
    addThreadMessage(l.id, { type: 'Update', text: 'Line moved to ' + p.to.name + ' (workload rebalance).', assignedTo: p.to.name });
  });
  appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: 'Rebalanced', detail: p.lines.length + ' lines (' + appState.ui.rebalancePct + '%)', from: p.from.name + ' (' + before + ')', to: p.to.name, reason: 'Workload rebalancer' });
  showToast('Moved ' + p.lines.length + ' lines from ' + p.from.name + ' to ' + p.to.name, 'success');
  rerender();
}
function poolTarget(catId, buyerId) {
  if (!requirePerm('masterData')) return null;
  var c = getCategoryById(catId), b = getBuyerById(buyerId);
  if (!c || !b) { showToast('Category or buyer not found.', 'error'); rerender(); return null; }
  return { c: c, b: b };
}
function addPoolBuyer(catId, buyerId) {
  var t = poolTarget(catId, buyerId); if (!t) return;
  if (t.c.buyers.indexOf(t.b.name) >= 0) { showToast(t.b.name + ' is already in ' + t.c.name + '.', 'info'); return; }
  t.c.buyers.push(t.b.name);
  showToast(t.b.name + ' added to the ' + t.c.name + ' pool', 'success');
  rerender();
}
function removePoolBuyer(catId, buyerId) {
  var t = poolTarget(catId, buyerId); if (!t) return;
  if (t.c.buyers.length <= 1) { showToast('A category needs at least one buyer in its pool.', 'error'); return; }
  t.c.buyers = t.c.buyers.filter(function (n) { return n !== t.b.name; });
  showToast(t.b.name + ' removed from the ' + t.c.name + ' pool (existing lines stay with them)', 'success');
  rerender();
}
function setCategoryFallback(catId, buyerId) {
  var t = poolTarget(catId, buyerId); if (!t) return;
  t.c.fallback = t.b.name;
  showToast(t.c.name + ': fallback buyer set to ' + t.b.name, 'success');
  rerender();
}
function toggleCategoryActive(catId, on) {
  if (!requirePerm('masterData')) return;
  var c = getCategoryById(catId); if (!c) { showToast('Category not found.', 'error'); return; }
  c.active = !!on;
  showToast(c.name + ' rule ' + (on ? 'activated' : 'deactivated'), 'success');
  rerender();
}
