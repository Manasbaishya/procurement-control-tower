/* Line drawer: full details, SLA clock, missing items, activity log, actions */
function openLineDrawer(lineId) {
  var l = findLine(lineId);
  if (!l) return;
  var s = slaInfo(l), st = stageByKey(l.currentStatus);
  var pct = Math.min(100, Math.round(s.ratio * 100));
  var bar = s.state === 'breach' ? 'bg-red-500' : s.state === 'risk' ? 'bg-amber-500' : 'bg-emerald-500';
  var clock = st && st.sla ?
    '<div class="rounded-lg border border-slate-200 p-3"><div class="flex items-center justify-between text-sm"><span class="font-semibold text-slate-700">' + icon('timer', 'w-4 h-4 inline') + ' SLA clock</span>' + slaBadge(l) + '</div>' +
    '<div class="mt-2 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full ' + bar + '" style="width:' + pct + '%"></div></div>' +
    '<div class="mt-1 text-xs text-slate-500">' + formatNum(l.daysInStatus, 1) + ' of ' + st.sla + ' days used in ' + esc(st.label) +
    (s.remaining >= 0 ? ' · ' + formatNum(s.remaining, 1) + ' d left' : ' · ' + formatNum(-s.remaining, 1) + ' d over') +
    ' · ' + (st.controllable ? 'Buyer-controllable stage' : 'Not buyer-controllable') + '</div></div>' :
    '<div class="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">' + icon('minus', 'w-4 h-4 inline') + ' No SLA in this stage.</div>';

  var missing = l.missingItems.length ?
    '<div class="rounded-lg border border-amber-200 bg-amber-50 p-3"><div class="text-sm font-semibold text-amber-800">' + icon('triangle-alert', 'w-4 h-4 inline') + ' Missing from requester</div><ul class="mt-1 list-disc pl-5 text-sm text-amber-900">' +
    l.missingItems.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul><div class="mt-1 text-xs text-amber-700">Reminders sent: ' + l.remindersCount + '</div></div>' : '';

  var log = l.activityLog.slice().reverse().map(function (a) {
    return '<li class="relative border-l border-slate-200 pb-3 pl-4"><span class="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500"></span>' +
      '<div class="text-sm text-slate-800">' + esc(a.action) + '</div><div class="text-xs text-slate-500">' + esc(a.author) + ' · ' + esc(a.role) + ' · ' + formatDateTime(a.timestamp) + '</div></li>';
  }).join('');

  var statusOpts = STAGES.map(function (x) { return { value: x.key, label: x.label }; });
  var actions = '';
  if (can('changeStatus')) {
    actions += '<div class="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-3"><div><label class="' + UI.label + '" for="ld-status">Change status</label>' +
      '<select id="ld-status" class="' + UI.input + '">' + selectOptions(statusOpts, l.currentStatus) + '</select></div>' +
      '<button type="button" class="' + UI.btnPrimary + '" onclick="applyLineStatus(\'' + l.id + '\')">' + icon('check', 'w-4 h-4') + 'Apply</button></div>';
  }
  var qCount = openQueryCount(l.id);
  var body =
    '<div class="flex flex-wrap items-center gap-2">' + statusBadge(l.currentStatus) + slaBadge(l) +
    (qCount ? '<span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">' + icon('message-square', 'w-3 h-3') + qCount + ' open quer' + (qCount > 1 ? 'ies' : 'y') + '</span>' : '') + '</div>' +
    '<p class="mt-3 text-sm font-semibold text-slate-900">' + esc(l.materialDescription) + '</p>' +
    '<dl class="mt-3 grid grid-cols-2 gap-3">' +
    kv('PR / line', esc(l.prNumber) + ' / ' + l.line) + kv('Material no.', esc(l.materialNo)) +
    kv('Quantity', formatNum(l.quantity) + ' ' + esc(l.uom)) + kv('Est. value', formatCurrency(l.estimatedValue)) +
    kv('Category', esc(l.category)) + kv('Department · team', esc(l.department) + ' · ' + esc(l.requestingTeam || '—')) +
    kv('Requester', esc(l.user) + '<br><span class="text-xs text-slate-500">' + esc(requesterEmail(l)) + '</span>' + emailFixNote(l.userEmailOriginal)) +
    kv('PR creator', esc(l.prCreator || l.user) + '<br><span class="text-xs text-slate-500">' + esc(l.prCreatorEmail || l.userEmail) + '</span>' + emailFixNote(l.prCreatorEmailOriginal)) +
    kv('HOD', esc(l.userHod)) + kv('Next action', esc(l.nextAction)) +
    kv('Assigned buyer', esc(l.assignedBuyer) + (getBuyer(l.assignedBuyer) && getBuyer(l.assignedBuyer).ooo ? oooBadge() : '')) +
    kv('PR created', formatDate(l.prCreationDate) + ' · ' + esc(l.prStatus)) + kv('Need-by date (NBD)', formatDate(l.requiredDeliveryDate)) +
    kv('PO number', l.poNumber ? '<button type="button" class="text-blue-700 underline" onclick="openTrackingModal(\'' + l.poNumber + '\')">' + esc(l.poNumber) + '</button>' : '—') +
    kv('Received', l.receivedQty ? formatNum(l.receivedQty) + ' of ' + formatNum(l.quantity) : '—') +
    '</dl>' +
    (l.buyerNote ? '<div class="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">' + icon('sticky-note', 'w-4 h-4 inline') + ' ' + esc(l.buyerNote) + '</div>' : '') +
    '<div class="mt-4 space-y-3">' + clock + missing + actions + '</div>' +
    '<h3 class="mt-5 mb-2 text-sm font-semibold text-slate-700">' + icon('list-checks', 'w-4 h-4 inline') + ' Procurement stage tracker</h3>' + stageTracker(l) +
    clarificationPanel(l) +
    '<h3 class="mt-5 mb-2 text-sm font-semibold text-slate-700">' + icon('history', 'w-4 h-4 inline') + ' Vendor history for this material</h3>' + vendorHistoryTable(l.materialNo, 10) +
    '<h3 class="mt-5 mb-2 text-sm font-semibold text-slate-700">Activity log</h3><ul class="ml-1.5">' + log + '</ul>';

  var footer = '<button type="button" class="' + UI.btn + '" onclick="openThreadDrawer(\'' + l.id + '\')">' + icon('message-square', 'w-4 h-4') + 'Open communication thread</button>';
  if (can('reassign') && isOpen(l)) footer += '<button type="button" class="' + UI.btn + '" onclick="openReassignModal(\'' + l.id + '\')">' + icon('user-check', 'w-4 h-4') + 'Reassign</button>';
  openDrawer('Line ' + l.prNumber + ' / ' + l.line, esc(l.category) + ' · ' + esc(l.assignedBuyer), body, footer);
}

function stageTracker(l) {
  var seq = PIPELINE_STAGES.concat(['CLOSED']);
  var cur = seq.indexOf(l.currentStatus);
  var note = cur < 0 ? '<p class="mb-2 rounded-lg bg-orange-50 p-2 text-xs text-orange-800">' + icon('circle-pause', 'w-3 h-3 inline') + ' Line is ' + esc(l.currentStatus.toLowerCase()) + ' – stages below are paused.</p>' : '';
  return note + '<ol class="rounded-lg border border-slate-200">' + seq.map(function (k, i) {
    var st = stageByKey(k), done = cur >= 0 && i < cur, now = i === cur;
    return '<li class="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-xs last:border-0 ' + (now ? 'bg-blue-50 font-semibold text-blue-800' : done ? 'text-slate-600' : 'text-slate-400') + '"' + (now ? ' aria-current="step"' : '') + '>' +
      '<span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' + (now ? 'bg-blue-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500') + '">' + (done ? '✓' : i + 1) + '</span>' +
      '<span class="flex-1">' + esc(st.label) + (now ? ' · current (' + formatNum(l.daysInStatus, 1) + ' d)' : done ? ' · done' : '') + '</span>' +
      '<span class="text-[10px] text-slate-400">' + (st.sla ? st.sla + ' d SLA' : '—') + '</span></li>';
  }).join('') + '</ol>';
}
function clarificationPanel(l) {
  if (!can('changeStatus') || (QUERY_STAGES.indexOf(l.currentStatus) < 0 && l.currentStatus !== 'INFO REQUIRED')) return '';
  var e = escalationNote(l);
  var chips = MISSING_ITEM_POOL.map(function (m, i) {
    var on = l.missingItems.indexOf(m) >= 0;
    return '<button type="button" data-clar="' + i + '" aria-pressed="' + on + '" class="clar-chip mb-1 mr-1 rounded-md border px-2 py-1 text-[11px] ' + (on ? 'border-violet-400 bg-violet-100 text-violet-800' : 'border-slate-300 bg-white text-slate-600') + '" onclick="toggleClarChip(this)">' + (on ? '✓ ' : '+ ') + esc(m) + '</button>';
  }).join('');
  return '<section class="mt-5 rounded-lg border border-violet-200 bg-violet-50/40 p-3"><div class="flex items-center justify-between"><h3 class="text-sm font-semibold text-violet-900">' + icon('mail-question', 'w-4 h-4 inline') + ' Clarification / spec request to user</h3>' +
    '<span class="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[11px] text-violet-800">' + l.remindersCount + ' reminder(s) sent</span></div>' +
    '<p class="mt-1 text-[11px] text-slate-600">Goes to ' + queryRecipients(l).map(function (r) { return esc(r.name) + ' (' + esc(r.role) + ', ' + esc(r.email) + ')'; }).join(' and ') + '.</p>' +
    '<div class="mt-2 text-xs font-semibold text-slate-600">Select missing spec items</div><div class="mt-1">' + chips + '</div>' +
    '<label class="' + UI.label + ' mt-2" for="clar-msg">Buyer message</label><textarea id="clar-msg" rows="3" class="' + UI.input + ' w-full text-sm">Please share the approved technical specification / make & model / drawing so we can start the RFQ for ' + esc(l.materialDescription) + '.</textarea>' +
    '<button type="button" class="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800" onclick="sendClarification(\'' + l.id + '\')">' + icon('send', 'w-4 h-4') + 'Send clarification request (simulated)</button>' +
    '<dl class="mt-3 grid grid-cols-3 gap-2 text-[11px]"><div><dt class="text-slate-500">Last sent</dt><dd class="font-medium">' + (function () {
      var asks = (appState.threads[l.id] || []).filter(function (m) { return m.type === 'Info request' || (m.type === 'Query' && m.role !== 'Requester'); });
      return asks.length ? formatDateTime(asks[asks.length - 1].timestamp) : 'None';
    })() + '</dd></div><div><dt class="text-slate-500">Next reminder</dt><dd class="font-medium">' + (l.currentStatus === 'INFO REQUIRED' ? 'In 24h' : 'After request') + '</dd></div>' +
    '<div><dt class="text-slate-500">HOD escalation</dt><dd class="font-medium ' + e.cls + '">' + esc(l.currentStatus === 'INFO REQUIRED' ? e.text : 'After ' + appState.settings.escalation.hours + 'h without reply') + '</dd></div></dl>' +
    '<p class="mt-2 text-[11px] text-slate-500">When the user replies, the ticket moves to Vendor outreach automatically.</p></section>';
}
function toggleClarChip(el) {
  var on = el.getAttribute('aria-pressed') !== 'true';
  el.setAttribute('aria-pressed', on);
  el.className = 'clar-chip mb-1 mr-1 rounded-md border px-2 py-1 text-[11px] ' + (on ? 'border-violet-400 bg-violet-100 text-violet-800' : 'border-slate-300 bg-white text-slate-600');
  el.textContent = (on ? '✓ ' : '+ ') + MISSING_ITEM_POOL[+el.getAttribute('data-clar')];
}
function sendClarification(lineId) {
  if (!requirePerm('changeStatus')) return;
  var l = findLine(lineId); if (!l) return;
  if (QUERY_STAGES.indexOf(l.currentStatus) < 0 && l.currentStatus !== 'INFO REQUIRED') { showToast('Clarifications can only be raised before the PO stage.', 'error'); return; }
  var items = [].map.call(document.querySelectorAll('.clar-chip[aria-pressed="true"]'), function (b) { return MISSING_ITEM_POOL[+b.getAttribute('data-clar')]; });
  var msg = fieldVal('clar-msg').trim();
  if (!items.length && !msg) { showToast('Pick at least one missing item or write a message.', 'error'); return; }
  var text = (msg || 'Please share the items below.') + (items.length ? ' Needed: ' + items.join(', ') + '.' : '');
  var wasInfo = l.currentStatus === 'INFO REQUIRED';
  if (wasInfo) {
    items.forEach(function (i) { if (l.missingItems.indexOf(i) < 0) l.missingItems.push(i); });
    l.remindersCount++;
    addThreadMessage(l.id, { type: 'Info request', text: text, assignedTo: recipientsLabel(l), status: 'Open' });
    logActivity(l, 'Clarification reminder #' + l.remindersCount + ' to ' + recipientsLabel(l) + ' (simulated)');
  } else {
    raiseBuyerQuery(l, text, 'Info request', items);
  }
  showToast('Clarification logged to ' + recipientsLabel(l) + ' (simulated)' + (wasInfo ? '' : ' · line moved to INFO REQUIRED'), 'success');
  afterAction(function () { openLineDrawer(lineId); });
}
function emailFixNote(orig) {
  return orig ? '<div class="text-[11px] text-emerald-700" title="Original: ' + esc(String(orig).trim()) + '">' + icon('wand-sparkles', 'w-3 h-3 inline') + ' auto-corrected from “' + esc(String(orig).trim()) + '”</div>' : '';
}
/* last N purchases of a material: vendor id, name, contact, e-mail, phone, price, lead time */
function vendorHistoryTable(materialNo, n) {
  var h = (appState.materialHistory[materialNo] || []).slice(0, n || 10);
  if (!h.length) return '<p class="text-xs text-slate-500">No previous purchases of this material in the sample history.</p>';
  var rows = h.map(function (x) {
    return '<tr><td class="' + UI.td + ' whitespace-nowrap text-xs">' + formatDate(x.date) + '<div class="font-mono text-[10px] text-slate-400">PO ' + esc(x.poNumber) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs"><span class="font-mono">' + esc(x.vendorId) + '</span><div>' + esc(x.vendorName) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(x.contactName) + '<div class="whitespace-nowrap text-slate-500">' + esc(x.phone) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs"><a class="text-blue-700 underline" href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a></td>' +
      '<td class="' + UI.td + ' whitespace-nowrap text-right text-xs">' + formatCurrency(x.unitPrice) + '<div class="text-slate-500">' + formatNum(x.qty) + ' ' + esc(x.uom) + ' · ' + x.leadTimeDays + ' d LT</div></td></tr>';
  }).join('');
  var vendors = {}; h.forEach(function (x) { vendors[x.vendorId] = (vendors[x.vendorId] || 0) + 1; });
  return '<div class="rounded-lg border border-slate-200">' + tableWrap(ths(['Date / PO', 'Vendor ID', 'Contact', 'E-mail', 'Unit price']), rows) +
    '<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500"><span>Last ' + h.length + ' purchases · ' + Object.keys(vendors).length + ' vendor(s) · sample history</span>' +
    '<button type="button" class="' + UI.btnSm + '" onclick="copyVendorContacts(\'' + esc(materialNo) + '\')">' + icon('copy', 'w-3 h-3') + 'Copy contacts</button></div></div>';
}
function copyVendorContacts(materialNo) {
  var h = appState.materialHistory[materialNo];
  if (!h || !h.length) { showToast('No vendor history for material ' + materialNo + '.', 'error'); return; }
  var seen = {}, out = [];
  h.forEach(function (x) { var k = x.vendorId + x.email; if (!seen[k]) { seen[k] = 1; out.push(x.vendorId + ' · ' + x.vendorName + ' · ' + x.contactName + ' <' + x.email + '> · ' + x.phone); } });
  copyText(out.join('\n')).then(function (ok) { showToast(ok ? 'Copied ' + out.length + ' vendor contact(s)' : 'Copy blocked by the browser', ok ? 'success' : 'warn'); });
}

function applyLineStatus(lineId) {
  if (!requirePerm('changeStatus')) return;
  var l = findLine(lineId);
  if (!l) return;
  var v = fieldVal('ld-status');
  if (!stageByKey(v)) { showToast('Pick a valid status.', 'error'); return; }
  if (v === l.currentStatus) { showToast('Line is already in ' + v + '.', 'info'); return; }
  if (v === 'INFO REQUIRED') {
    // same path as a buyer query: auto-assigned to requester + PR creator
    if (QUERY_STAGES.indexOf(l.currentStatus) >= 0) raiseBuyerQuery(l, 'Clarification requested by buyer – please review the line and reply.', 'Info request');
    else {
      if (!l.missingItems.length) l.missingItems = ['Clarification requested by buyer'];
      setLineStatus(l, v, 'manual');
      addThreadMessage(l.id, { type: 'Info request', text: 'Clarification requested by buyer – please review the line and reply.', assignedTo: recipientsLabel(l), status: 'Open' });
    }
    showToast('Line moved to INFO REQUIRED · query sent to ' + recipientsLabel(l) + ' (simulated)', 'success');
    afterAction(function () { openLineDrawer(lineId); });
    return;
  }
  l.missingItems = [];
  if (v === 'GRN COMPLETED' && !l.receivedQty) { l.receivedQty = l.quantity; l.storageLocation = l.storageLocation || SITE.storageLocations[0]; l.dock = l.dock || SITE.docks[0]; }
  setLineStatus(l, v, 'manual');
  addThreadMessage(l.id, { type: 'Update', text: 'Status changed to ' + v + '.' });
  showToast('Line ' + l.prNumber + '/' + l.line + ' moved to ' + v, 'success');
  afterAction(function () { openLineDrawer(lineId); });
}
