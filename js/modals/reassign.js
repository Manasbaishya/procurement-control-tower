/* Reassign modal: suggested pool colleague / backup or any buyer, mandatory reason, scope line / whole PR */
var REASSIGN_REASONS = ['Out of office', 'Category mismatch', 'Workload balancing', 'Specialist requirement', 'Requester escalation', 'Other'];

function openReassignModal(lineId) {
  if (!requirePerm('reassign')) return;
  var l = findLine(lineId);
  if (!l) return;
  var cur = getBuyer(l.assignedBuyer);
  var cat = getCategory(l.category);
  // suggestion: least-loaded active colleague in the same category pool, else the buyer's backup, else the category fallback
  var mates = categoryPool(cat).filter(function (b) { return b.name !== l.assignedBuyer && !b.ooo; }).sort(function (a, b) { return a.openLines - b.openLines; });
  var sugg = mates[0] || getBuyerById(cur ? cur.backup : '') || getBuyer(cat ? cat.fallback : '');
  if (sugg && (sugg.ooo || sugg.name === l.assignedBuyer)) sugg = null;
  var prOpen = linesOfPR(l.prNumber).filter(isOpen).length;
  var opts = appState.buyers.filter(function (b) { return b.name !== l.assignedBuyer; }).map(function (b) {
    var pct = loadPct(b);
    return '<label class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ' + (sugg && b.name === sugg.name ? 'border-blue-300 bg-blue-50' : 'border-slate-200') + '">' +
      '<input type="radio" name="ra-buyer" value="' + b.id + '"' + (sugg && b.name === sugg.name ? ' checked' : '') + (b.ooo ? ' disabled' : '') + '>' +
      '<span class="flex-1 text-sm"><b>' + esc(b.name) + '</b>' + (b.ooo ? oooBadge() : '') + (sugg && b.name === sugg.name ? ' <span class="text-xs font-semibold text-blue-700">· Suggested</span>' : '') +
      '<br><span class="text-xs text-slate-500">' + esc(b.team) + '</span></span>' +
      '<span class="w-28 text-right text-xs"><span class="' + (pct > 100 ? 'text-red-700 font-semibold' : pct > 85 ? 'text-amber-700 font-semibold' : 'text-slate-600') + '">' + b.openLines + ' / ' + b.capacity + ' (' + pct + '%)</span>' +
      '<span class="mt-1 block h-1.5 rounded-full bg-slate-100"><span class="block h-1.5 rounded-full ' + (pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + Math.min(100, pct) + '%"></span></span></span></label>';
  }).join('');
  openModal({
    title: 'Reassign line ' + l.prNumber + ' / ' + l.line,
    subtitle: 'Currently with ' + esc(l.assignedBuyer) + ' · ' + esc(l.category),
    body: '<div class="space-y-2">' + opts + '</div>' +
      '<div class="mt-4 grid gap-3 sm:grid-cols-2"><div><label class="' + UI.label + '" for="ra-reason">Reason (required)</label><select id="ra-reason" class="' + UI.input + ' w-full">' + selectOptions(REASSIGN_REASONS, '', 'Select a reason…') + '</select></div>' +
      '<div><span class="' + UI.label + '">Scope</span><label class="mr-4 text-sm"><input type="radio" name="ra-scope" value="line" checked> This line</label>' +
      '<label class="text-sm"><input type="radio" name="ra-scope" value="pr"> Whole PR (' + prOpen + ' open line' + (prOpen > 1 ? 's' : '') + ')</label></div></div>' +
      '<label class="' + UI.label + ' mt-3" for="ra-note">Note</label><textarea id="ra-note" rows="2" class="' + UI.input + ' w-full" placeholder="Optional context for the new buyer"></textarea>',
    footer: '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Cancel</button><button type="button" class="' + UI.btnPrimary + '" onclick="confirmReassign(\'' + l.id + '\')">' + icon('user-check', 'w-4 h-4') + 'Reassign</button>'
  });
}

function confirmReassign(lineId) {
  if (!requirePerm('reassign')) return;
  var l = findLine(lineId);
  if (!l) return;
  var sel = document.querySelector('input[name="ra-buyer"]:checked');
  if (!sel) { showToast('Choose a buyer.', 'error'); return; }
  var to = getBuyerById(sel.value);
  if (!to) { showToast('Buyer not found.', 'error'); return; }
  var reason = fieldVal('ra-reason');
  if (!reason) { showToast('A reason is required.', 'error'); return; }
  var scopeEl = document.querySelector('input[name="ra-scope"]:checked');
  var scope = scopeEl ? scopeEl.value : 'line';
  var note = fieldVal('ra-note').trim();
  var from = l.assignedBuyer;
  var targets = scope === 'pr' ? linesOfPR(l.prNumber).filter(function (x) { return isOpen(x) && x.assignedBuyer !== to.name; }) : [l];
  targets.forEach(function (t) {
    var prev = t.assignedBuyer;
    t.assignedBuyer = to.name;
    logActivity(t, 'Reassigned ' + prev + ' → ' + to.name + ' (' + reason + ')' + (note ? ': ' + note : ''));
    addThreadMessage(t.id, { type: 'Update', text: 'Line reassigned from ' + prev + ' to ' + to.name + '. Reason: ' + reason + (note ? '. ' + note : ''), assignedTo: to.name });
  });
  appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: 'Reassigned', detail: (scope === 'pr' ? 'PR ' + l.prNumber + ' (' + targets.length + ' lines)' : 'PR ' + l.prNumber + ' line ' + l.line),
    from: from, to: to.name, reason: reason + (note ? ' – ' + note : '') });
  closeModal();
  showToast(targets.length + ' line(s) reassigned to ' + to.name, 'success');
  afterAction(function () { openLineDrawer(lineId); });
}
