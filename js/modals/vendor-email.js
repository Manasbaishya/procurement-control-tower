/* Vendor email chain (simulated – no mailbox is connected) */
function vendorEmailChain(po) {
  var v = getVendor(po.vendorId);
  var to = v ? v.dispatchEmail : po.vendorEmail;
  var chain = [{ from: po.buyer, to: to, time: po.poDate + 'T11:00', subject: 'PO ' + po.poNumber + ' released – Tata Electronics, Jagi Road',
    body: 'Please find PO ' + po.poNumber + ' for ' + po.materialDescription + ' (' + formatNum(po.quantity) + ' ' + po.uom + '). Deliver to Jagi Road site via Guwahati (GAU). Committed ETA ' + formatDate(po.committedEta) + '.' }];
  chain.push({ from: po.vendor + ' dispatch', to: po.buyer, time: isoDateTime(addDays(parseDate(po.poDate), 0.9)), subject: 'RE: PO ' + po.poNumber,
    body: 'Acknowledged. Material under preparation.' });
  appState.followUpLog.filter(function (f) { return f.poNumber === po.poNumber; }).slice().reverse().forEach(function (f) {
    chain.push({ from: f.by, to: to, time: f.timestamp, subject: 'Follow-up: PO ' + po.poNumber + ' (' + f.channel + ', logged)', body: f.notes });
  });
  if (po.awb) chain.push({ from: po.vendor + ' dispatch', to: po.buyer, time: po.dispatchDate + 'T18:00', subject: 'Dispatch details – PO ' + po.poNumber,
    body: 'Dispatched via ' + po.carrier + ', AWB ' + po.awb + ' from ' + (v ? v.city : 'vendor') + '.' });
  return chain.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
}

function openVendorEmailModal(poNumber) {
  var po = findPO(poNumber);
  if (!po) return;
  var v = getVendor(po.vendorId);
  var items = vendorEmailChain(po).map(function (m) {
    var mine = m.from.indexOf('dispatch') < 0;
    return '<div class="rounded-lg border p-3 ' + (mine ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white') + '">' +
      '<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>' + icon(mine ? 'send' : 'inbox', 'w-3 h-3 inline') + ' <b class="text-slate-700">' + esc(m.from) + '</b> → ' + esc(m.to) + '</span><span>' + formatDateTime(m.time) + '</span></div>' +
      '<div class="mt-1 text-sm font-semibold text-slate-800">' + esc(m.subject) + '</div><p class="mt-1 text-sm text-slate-700">' + esc(m.body) + '</p></div>';
  }).join('');
  openModal({
    title: 'Vendor email chain · PO ' + po.poNumber, size: 'md',
    subtitle: esc(po.vendor) + (v ? ' · ' + esc(v.dispatchEmail) + ' · ' + esc(v.phone) : '') + ' · simulated, no mailbox connected',
    body: '<div class="space-y-2">' + items + '</div>',
    footer: '<button type="button" class="' + UI.btn + '" onclick="copyVendorReply(\'' + po.poNumber + '\')">' + icon('copy', 'w-4 h-4') + 'Copy reply draft</button>' +
      (can('followup') ? '<button type="button" class="' + UI.btn + '" onclick="openFollowupLogModal(\'' + po.poNumber + '\')">' + icon('notebook-pen', 'w-4 h-4') + 'Log follow-up</button>' : '') +
      '<button type="button" class="' + UI.btnPrimary + '" onclick="closeModal()">Done</button>'
  });
}

function copyVendorReply(poNumber) {
  var po = findPO(poNumber);
  if (!po) return;
  var text = 'Subject: RE: PO ' + po.poNumber + ' – status update required\n\nDear ' + po.vendor + ' team,\n\nPlease confirm the current status of PO ' + po.poNumber +
    (po.awb ? ' (AWB ' + po.awb + ', ' + po.carrier + ')' : '') + ' and the revised ETA to Tata Electronics, Jagi Road via Guwahati (GAU).\n\nRegards,\n' + currentUserName();
  copyText(text).then(function (ok) { showToast(ok ? 'Draft copied to clipboard' : 'Copy blocked by the browser', ok ? 'success' : 'warn'); });
}
