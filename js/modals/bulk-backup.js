/* Bulk transfer to backup (OOO): move every open line, old buyer drops by exactly the moved count */
function openBulkBackupModal(buyerId) {
  if (!requirePerm('allocate')) return;
  var b = getBuyerById(buyerId);
  if (!b) { showToast('Buyer not found.', 'error'); return; }
  var open = openLinesOf(b.name);
  var backup = getBuyerById(b.backup);
  var choices = appState.buyers.filter(function (x) { return x.id !== b.id && !x.ooo; });
  var defaultTo = backup && !backup.ooo ? backup.id : (choices[0] ? choices[0].id : '');
  openModal({
    title: 'OOO transfer · ' + b.name,
    subtitle: 'Moves all ' + open.length + ' open lines to a backup buyer',
    size: 'sm',
    body: '<p class="text-sm text-slate-600">' + esc(b.name) + ' has <b>' + open.length + '</b> open lines. Choose who covers them.</p>' +
      '<label class="' + UI.label + ' mt-3" for="bb-to">Transfer to</label><select id="bb-to" class="' + UI.input + ' w-full">' +
      selectOptions(choices.map(function (x) { return { value: x.id, label: x.name + (x.id === b.backup ? ' (backup)' : '') + ' · ' + x.openLines + '/' + x.capacity }; }), defaultTo) + '</select>' +
      '<label class="mt-3 flex items-center gap-2 text-sm"><input id="bb-ooo" type="checkbox" checked> Mark ' + esc(b.name) + ' as Out of Office</label>' +
      '<label class="' + UI.label + ' mt-3" for="bb-reason">Reason</label><input id="bb-reason" class="' + UI.input + ' w-full" value="Out of office">',
    footer: '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Cancel</button><button type="button" class="' + UI.btnPrimary + '" onclick="confirmBulkBackup(\'' + b.id + '\')"' + (choices.length ? '' : ' disabled') + '>' + icon('arrow-right-left', 'w-4 h-4') + 'Transfer ' + open.length + ' lines</button>'
  });
}

function confirmBulkBackup(buyerId) {
  if (!requirePerm('allocate')) return;
  var b = getBuyerById(buyerId);
  var to = getBuyerById(fieldVal('bb-to'));
  if (!b || !to) { showToast('Buyer not found.', 'error'); return; }
  if (to.id === b.id) { showToast('Pick a different buyer.', 'error'); return; }
  var reason = fieldVal('bb-reason').trim() || 'Out of office';
  refreshBuyerLoads();
  var beforeFrom = b.openLines, beforeTo = to.openLines;
  var moving = openLinesOf(b.name);
  moving.forEach(function (l) {
    l.assignedBuyer = to.name;
    logActivity(l, 'Bulk transfer (OOO) ' + b.name + ' → ' + to.name);
    addThreadMessage(l.id, { type: 'Update', text: 'Covered by ' + to.name + ' while ' + b.name + ' is out of office.', assignedTo: to.name });
  });
  if (document.getElementById('bb-ooo') && document.getElementById('bb-ooo').checked) b.ooo = true;
  refreshBuyerLoads();
  var moved = moving.length;
  if (b.openLines !== beforeFrom - moved || to.openLines !== beforeTo + moved) {
    showToast('Load counts did not reconcile – please check.', 'error');
  }
  appState.auditLog.unshift({ timestamp: nowStamp(), actor: currentUserName(), action: 'OOO transfer', detail: moved + ' open lines',
    from: b.name + ' (' + beforeFrom + ' → ' + b.openLines + ')', to: to.name + ' (' + beforeTo + ' → ' + to.openLines + ')', reason: reason });
  closeModal();
  showToast('Moved ' + moved + ' lines from ' + b.name + ' to ' + to.name, 'success');
  rerender();
}
