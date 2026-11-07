/* User Response Portal (requester / PR creator view): query list + detail, answer each item, submit
   → ticket moves to VENDOR OUTREACH automatically */
function responsePortalLines() {
  return appState.lines.filter(function (l) {
    return l.currentStatus === 'INFO REQUIRED' && (appState.role !== 'Requester' || l.user === currentUserName() || l.prCreator === currentUserName());
  }).sort(function (a, b) { return b.daysInStatus - a.daysInStatus; });
}
function portalLabel(l) {
  var e = escalationNote(l);
  if (e.cls === 'text-red-700') return { text: 'Escalated to HOD', cls: 'text-red-700' };
  if (l.daysInStatus < 1) return { text: 'New query', cls: 'text-slate-600' };
  return { text: 'Action due today', cls: 'text-amber-700' };
}
function renderUserResponseScreen() {
  var list = responsePortalLines(), ui = appState.ui;
  if (!list.some(function (l) { return l.id === ui.portalSelected; })) ui.portalSelected = list.length ? list[0].id : '';
  var me = currentUserName(), meReq = REQUESTERS.filter(function (r) { return r.name === me; })[0];
  var banner = '<section class="mb-4 rounded-xl bg-gradient-to-r from-violet-900 to-indigo-800 p-5 text-white shadow">' +
    '<div class="flex flex-wrap items-start justify-between gap-3"><div><div class="text-[11px] font-semibold uppercase tracking-wide text-violet-200">Tata Electronics · Requester clarification portal</div>' +
    '<h1 class="mt-1 text-xl font-bold">Pending technical & specification queries</h1>' +
    '<p class="mt-1 text-xs text-violet-200">' + (appState.role === 'Requester' ? 'Logged in as <b class="text-white">' + esc(me) + '</b>' + (meReq ? ' (' + esc(meReq.dept) + ') · ' + esc(emailFor(me)) : '') + ' · as requester or PR creator' : 'PMO preview of every open clarification') + '</p></div>' +
    '<span class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">' + icon('circle-dot', 'w-3 h-3 inline text-amber-300') + ' ' + list.length + ' actionable quer' + (list.length === 1 ? 'y' : 'ies') + '</span></div></section>';
  if (!list.length) return banner + '<section class="' + UI.card + '">' + emptyState('Nothing waiting on you. Thank you!') + '</section>';

  var rows = list.map(function (l, i) {
    var sel = l.id === ui.portalSelected, lab = portalLabel(l), d = Math.floor(l.daysInStatus);
    return '<li class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ' + (sel ? 'border-l-4 border-l-violet-600 bg-violet-50/50' : '') + '">' +
      '<span class="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ' + (sel ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600') + '">' + (i + 1) + '</span>' +
      '<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2 text-xs"><span class="font-mono font-semibold text-violet-700">PR ' + esc(l.prNumber) + ' (line ' + l.line + ')</span>' +
      '<span class="rounded border px-1.5 py-0.5 text-[10px] font-semibold ' + (d >= 3 ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800') + '">' + d + ' d pending</span>' +
      '<span class="text-slate-400">' + esc(l.department) + '</span></div>' +
      '<div class="truncate text-sm font-semibold text-slate-900">' + esc(l.materialDescription) + '</div>' +
      '<div class="text-xs text-slate-500">Buyer: <b>' + esc(l.assignedBuyer) + '</b> · Qty ' + formatNum(l.quantity) + ' ' + esc(l.uom) + ' · Est. ' + formatINRShort(l.estimatedValue) +
      (l.user !== me && appState.role === 'Requester' ? ' · you are PR creator' : '') + '</div></div>' +
      '<span class="text-xs font-semibold ' + lab.cls + '">' + (lab.cls === 'text-red-700' ? icon('triangle-alert', 'w-3 h-3 inline') + ' ' : '') + esc(lab.text) + '</span>' +
      (sel ? '<span class="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">Selected</span>' :
        '<button type="button" class="' + UI.btnSm + '" onclick="selectPortalLine(\'' + l.id + '\')">Review & respond</button>') + '</li>';
  }).join('');

  var l = findLine(ui.portalSelected, true);
  var detail = l ? portalDetail(l) : '';
  return banner + '<div class="mx-auto max-w-5xl"><section class="' + UI.card + ' mb-4"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">All clarifications awaiting your input (' + list.length + ')</h2>' +
    '<p class="text-[11px] text-slate-500">Pick a query to see what the buyer asked, then answer each item.</p></div><ul>' + rows + '</ul></section>' + detail + '</div>';
}
function portalDetail(l) {
  var asks = (appState.threads[l.id] || []).filter(function (m) { return (m.type === 'Info request' || m.type === 'Query') && m.status === 'Open' && m.role !== 'Requester'; });
  var ask = asks.length ? asks[asks.length - 1] : null;
  var safe = l.id.replace(/[^A-Za-z0-9]/g, '_');
  return '<section class="' + UI.card + ' p-5" id="portal-detail"><div class="flex flex-wrap items-center justify-between gap-2"><span class="rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-xs text-violet-800">PR ' + esc(l.prNumber) + ' · line ' + l.line + ' · ' + esc(l.department) + '</span>' +
    '<span class="text-xs text-slate-500">Ageing: <b class="text-amber-700">' + formatNum(l.daysInStatus, 1) + ' d in status</b> · Buyer: <b class="text-blue-700">' + esc(l.assignedBuyer) + '</b> · ' + l.remindersCount + ' reminder(s)</span></div>' +
    '<h2 class="mt-2 text-lg font-bold text-slate-900">' + esc(l.materialDescription) + '</h2>' +
    '<p class="text-xs text-slate-500">Category ' + esc(l.category) + ' · Material ' + esc(l.materialNo) + ' · Qty ' + formatNum(l.quantity) + ' ' + esc(l.uom) + ' · NBD ' + formatDate(l.requiredDeliveryDate) +
    ' · Requester ' + esc(l.user) + (l.prCreator && l.prCreator !== l.user ? ' · PR creator ' + esc(l.prCreator) : '') + '</p>' +
    '<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">' + icon('message-square', 'w-4 h-4 inline') + ' <b>Message from ' + esc(l.assignedBuyer) + ':</b> “' + esc(ask ? ask.text : l.buyerNote || 'Please provide the missing details.') + '”</div>' +
    '<div class="mt-4 text-xs font-semibold text-slate-600">Requested items</div><div class="mt-1 flex flex-wrap gap-1">' + l.missingItems.map(function (m) {
      return '<span class="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs text-violet-800">' + icon('circle-help', 'w-3 h-3') + esc(m) + '</span>';
    }).join('') + '</div>' +
    '<div class="mt-4 space-y-3">' + l.missingItems.map(function (m, i) {
      return '<div><label class="' + UI.label + '" for="ur-' + safe + '-' + i + '">' + esc(m) + ' (required)</label><textarea id="ur-' + safe + '-' + i + '" rows="2" class="' + UI.input + ' w-full" placeholder="Your answer"></textarea></div>';
    }).join('') + '</div>' +
    '<label class="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 px-4 py-5 text-center text-xs text-slate-500 hover:border-violet-400">' + icon('paperclip', 'w-5 h-5') +
    '<span class="mt-1">Attach spec / drawing file (file name is logged; nothing is uploaded)</span><span id="ur-fn-' + safe + '" class="mt-1 font-medium text-slate-700"></span>' +
    '<input id="ur-file-' + safe + '" type="file" class="sr-only" onchange="document.getElementById(\'ur-fn-' + safe + '\').textContent=this.files[0]?this.files[0].name:\'\'"></label>' +
    '<div class="mt-4 flex flex-wrap items-center justify-between gap-2"><p class="text-[11px] text-slate-500">' + icon('info', 'w-3 h-3 inline') + ' Submitting sends your answers to ' + esc(l.assignedBuyer) + ' and moves the ticket to Vendor outreach.</p>' +
    '<button type="button" class="' + UI.btnPrimary + '" onclick="submitUserResponse(\'' + l.id + '\')">' + icon('send', 'w-4 h-4') + 'Submit to buyer</button></div></section>';
}
function selectPortalLine(id) {
  if (!findLine(id)) return;
  appState.ui.portalSelected = id;
  rerender();
  var d = document.getElementById('portal-detail');
  if (d && d.scrollIntoView) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function submitUserResponse(lineId) {
  if (!requirePerm('respond')) return;
  var l = findLine(lineId);
  if (!l) return;
  if (l.currentStatus !== 'INFO REQUIRED') { showToast('This line is no longer waiting for information.', 'error'); return; }
  var safe = l.id.replace(/[^A-Za-z0-9]/g, '_');
  var answers = [], missing = [];
  l.missingItems.forEach(function (m, i) {
    var v = fieldVal('ur-' + safe + '-' + i).trim();
    if (!v) missing.push(m); else answers.push(m + ': ' + v);
  });
  if (missing.length) { showToast('Please answer: ' + missing.join(', '), 'error'); return; }
  var f = document.getElementById('ur-file-' + safe);
  var att = f && f.files && f.files[0] ? f.files[0].name : '';
  recordUserReply(l, answers.join(' | '), att);
  l.buyerNote = currentUserName() + ' responded on ' + formatDate(DEMO_TODAY) + (att ? ' with ' + att : '') + '.';
  appState.ui.portalSelected = '';
  showToast('Sent back to ' + l.assignedBuyer + ' · ticket moved to VENDOR OUTREACH', 'success');
  rerender();
}
