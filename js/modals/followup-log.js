/* Log follow-up modal (channel, notes, next date) */
var FOLLOWUP_CHANNELS = ['Email', 'Phone call', 'WhatsApp', 'Vendor portal', 'In person'];

function openFollowupLogModal(poNumber) {
  if (!requirePerm('followup')) return;
  var po = findPO(poNumber);
  if (!po) return;
  var v = getVendor(po.vendorId);
  var flags = poFlags(po);
  openModal({
    title: 'Log follow-up · PO ' + po.poNumber, size: 'sm',
    subtitle: esc(po.vendor) + (v ? ' · ' + esc(v.dispatchEmail) + ' · ' + esc(v.phone) : ''),
    body: (flags.length ? '<div class="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">' + flags.map(function (f) { return icon('flag', 'w-3 h-3 inline') + ' Rule ' + f.rule + ': ' + esc(f.text); }).join('<br>') + '</div>' : '') +
      '<label class="' + UI.label + '" for="fu-channel">Channel</label><select id="fu-channel" class="' + UI.input + ' w-full">' + selectOptions(FOLLOWUP_CHANNELS, 'Email') + '</select>' +
      '<label class="' + UI.label + ' mt-3" for="fu-notes">Notes (required)</label><textarea id="fu-notes" rows="3" class="' + UI.input + ' w-full" placeholder="e.g. Vendor confirmed dispatch tomorrow via Blue Dart"></textarea>' +
      '<label class="' + UI.label + ' mt-3" for="fu-next">Next follow-up date</label><input id="fu-next" type="date" class="' + UI.input + ' w-full" value="' + isoDate(addDays(DEMO_TODAY, 2)) + '" min="' + isoDate(DEMO_TODAY) + '">' +
      '<p class="mt-2 text-[11px] text-slate-500">This records the follow-up in the tower only. Nothing is sent (simulated).</p>',
    footer: '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Cancel</button><button type="button" class="' + UI.btnPrimary + '" onclick="saveFollowupLog(\'' + po.poNumber + '\')">' + icon('save', 'w-4 h-4') + 'Log follow-up</button>'
  });
}

function recordFollowup(po, channel, notes, nextDate) {
  po.followUpCount = (po.followUpCount || 0) + 1;
  po.nextFollowUp = nextDate || '';
  appState.followUpLog.unshift({ timestamp: nowStamp(), poNumber: po.poNumber, vendor: po.vendor, channel: channel, notes: notes,
    nextDate: nextDate || '', by: currentUserName(), rules: poFlags(po).map(function (f) { return f.rule; }).join(', ') });
  if (po.lineId) { var l = findLine(po.lineId, true); if (l) logActivity(l, 'Vendor follow-up logged (' + channel + ', simulated) on PO ' + po.poNumber); }
}

function saveFollowupLog(poNumber) {
  if (!requirePerm('followup')) return;
  var po = findPO(poNumber);
  if (!po) return;
  var notes = fieldVal('fu-notes').trim();
  if (!notes) { showToast('Add a note about the follow-up.', 'error'); return; }
  recordFollowup(po, fieldVal('fu-channel'), notes, fieldVal('fu-next'));
  closeModal();
  showToast('Follow-up logged (simulated) for PO ' + po.poNumber, 'success');
  rerender();
}
