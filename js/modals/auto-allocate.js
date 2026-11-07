/* Auto-allocate: keep PR lines together, skip OOO, least-loaded buyer in the category pool (else category fallback) */
function computeAutoAllocation(intake) {
  refreshBuyerLoads();
  var projected = {};
  appState.buyers.forEach(function (b) { projected[b.name] = b.openLines; });
  var groups = [], byPr = {};
  intake.forEach(function (u) {
    if (!byPr[u.prNumber]) { byPr[u.prNumber] = { prNumber: u.prNumber, lines: [] }; groups.push(byPr[u.prNumber]); }
    byPr[u.prNumber].lines.push(u);
  });
  return groups.map(function (g) {
    // dominant category of the PR decides the buyer pool
    var counts = {};
    g.lines.forEach(function (u) { counts[u.category] = (counts[u.category] || 0) + 1; });
    var catName = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var cat = getCategory(catName);
    var reasons = [];
    var candidates = [];
    if (cat && cat.active) {
      categoryPool(cat).forEach(function (b) { if (!b.ooo) candidates.push(b); else reasons.push(b.name + ' is OOO – skipped'); });
      if (!candidates.length) {
        var fb = getBuyer(cat.fallback);
        if (fb && !fb.ooo) { candidates.push(fb); reasons.push('Whole pool unavailable → fallback ' + fb.name); }
      }
    } else reasons.push('Category rule inactive');
    if (!candidates.length) {
      candidates = appState.buyers.filter(function (b) { return !b.ooo; });
      reasons.push('Fallback to least-loaded active buyer');
    }
    var chosen = candidates.slice().sort(function (a, b) { return projected[a.name] - projected[b.name]; })[0];
    if (candidates.length > 1) {
      reasons.push('Least loaded in pool (' + candidates.slice().sort(function (a, b) { return projected[a.name] - projected[b.name]; })
        .map(function (b) { return b.name + ' ' + projected[b.name]; }).join(', ') + ')');
    } else if (cat && cat.buyers.length === 1 && chosen.name === cat.buyers[0]) {
      reasons.push('Single-buyer category');
    }
    var before = projected[chosen.name];
    projected[chosen.name] += g.lines.length;
    return { prNumber: g.prNumber, lineIds: g.lines.map(function (u) { return u.id; }), category: catName, buyer: chosen.name,
      loadBefore: before, loadAfter: projected[chosen.name], reason: reasons.join(' · ') };
  });
}

function openAutoAllocateModal() {
  if (!requirePerm('autoAllocate')) return;
  if (!appState.unallocated.length) { showToast('No unallocated lines to allocate.', 'info'); return; }
  var plan = computeAutoAllocation(appState.unallocated);
  window.__autoPlan = plan;
  var rows = plan.map(function (p) {
    return '<tr><td class="' + UI.td + ' font-mono text-xs">' + esc(p.prNumber) + '</td><td class="' + UI.td + '">' + p.lineIds.length + '</td><td class="' + UI.td + '">' + esc(p.category) + '</td>' +
      '<td class="' + UI.td + ' font-semibold">' + esc(p.buyer) + '</td><td class="' + UI.td + ' text-xs">' + p.loadBefore + ' → ' + p.loadAfter + ' / ' + BUYER_CAPACITY + '</td>' +
      '<td class="' + UI.td + ' text-xs text-slate-500">' + esc(p.reason) + '</td></tr>';
  }).join('');
  var total = plan.reduce(function (s, p) { return s + p.lineIds.length; }, 0);
  openModal({
    title: 'Auto-allocate preview', size: 'lg',
    subtitle: total + ' lines in ' + plan.length + ' PRs · PR lines stay together · OOO buyers skipped · least-loaded buyer in the category pool',
    body: tableWrap(ths(['PR', 'Lines', 'Category', 'Buyer', 'Load (open lines)', 'Why']), rows),
    footer: '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Cancel</button><button type="button" class="' + UI.btnPrimary + '" onclick="applyAutoAllocation()">' + icon('zap', 'w-4 h-4') + 'Apply allocation</button>'
  });
}

function applyAutoAllocation() {
  if (!requirePerm('autoAllocate')) return;
  var plan = window.__autoPlan;
  if (!plan || !plan.length) { showToast('Nothing to apply – open the preview again.', 'error'); return; }
  var n = 0;
  plan.forEach(function (p) {
    n += allocateIntakeLines(p.lineIds, p.buyer, 'Auto-allocated', p.reason, true);
  });
  appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: 'Auto-allocated', detail: n + ' lines across ' + plan.length + ' PRs', from: '—', to: 'Multiple', reason: '1-click rule run' });
  window.__autoPlan = null;
  closeModal();
  showToast('Auto-allocated ' + n + ' lines', 'success');
  rerender();
}
