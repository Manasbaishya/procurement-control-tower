/* Delivery Follow-Up: rule cards, vendor groups (highest priority + oldest delay first) */
var RULE_INFO = {
  D: { label: 'Rule D · ETA missed', short: 'Committed ETA missed', icon: 'calendar-x', tag: 'Critical', badge: 'Escalate (ETA missed)', cls: 'border-red-200 bg-red-50 text-red-800', card: 'border-red-200 bg-red-50/50', order: 0 },
  A: { label: 'Rule A · AWB not shared', short: 'Chase vendor for AWB', icon: 'file-question', tag: 'Missing AWB', badge: 'Chase vendor for AWB', cls: 'border-amber-200 bg-amber-50 text-amber-800', card: 'border-amber-200 bg-amber-50/50', order: 1 },
  B: { label: 'Rule B · No carrier scan', short: 'Stuck in transit', icon: 'scan-line', tag: 'Transit delay', badge: 'Stuck – no scan', cls: 'border-violet-200 bg-violet-50 text-violet-800', card: 'border-violet-200 bg-violet-50/50', order: 2 },
  C: { label: 'Rule C · Stuck at Guwahati', short: 'At Guwahati hub, not delivered', icon: 'map-pin', tag: 'Guwahati hub', badge: 'Expedite from GAU hub', cls: 'border-sky-200 bg-sky-50 text-sky-800', card: 'border-sky-200 bg-sky-50/50', order: 3 }
};
function flagDelay(po, f) {
  if (f.rule === 'A') return po.daysSincePo;
  if (f.rule === 'D') return Math.floor(daysBetween(po.committedEta, DEMO_TODAY));
  return po.lastScanTime ? Math.floor(daysAgo(po.lastScanTime)) : 0;
}
function topFlag(x) { return x.flags.slice().sort(function (a, b) { return RULE_INFO[a.rule].order - RULE_INFO[b.rule].order; })[0]; }
function lastFollowup(po) { return appState.followUpLog.filter(function (f) { return f.poNumber === po.poNumber; })[0] || null; }
function followupGroups(rule) {
  var groups = {}, order = [];
  getFollowUpLines(rule).forEach(function (x) {
    x.top = topFlag(x); x.delay = flagDelay(x.po, x.top);
    if (!groups[x.po.vendorId]) { groups[x.po.vendorId] = []; order.push(x.po.vendorId); }
    groups[x.po.vendorId].push(x);
  });
  return order.map(function (id) {
    var items = groups[id].sort(function (a, b) { return RULE_INFO[a.top.rule].order - RULE_INFO[b.top.rule].order || b.delay - a.delay; });
    return { vendor: getVendor(id), items: items, critical: items.filter(function (x) { return x.top.rule === 'D'; }).length };
  }).sort(function (a, b) { return b.critical - a.critical || b.items.length - a.items.length; });
}
function renderDeliveryFollowupScreen() {
  var ui = appState.ui, r = appState.settings.rules;
  if (['ALL', 'A', 'B', 'C', 'D'].indexOf(ui.followRule) < 0) ui.followRule = 'ALL';
  var total = getFollowUpLines('ALL').length;
  var thr = { A: 'PO released > ' + r.A + ' d ago, no AWB', B: 'No carrier scan for > ' + r.B + ' d', C: 'At GAU hub > ' + r.C + ' d, not delivered', D: 'Escalate to buyer & vendor head' };
  var cards = '<div class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">' + ['D', 'A', 'B', 'C'].map(function (k) {
    var ri = RULE_INFO[k], n = getFollowUpLines(k).length, on = ui.followRule === k;
    return '<button type="button" class="rounded-xl border p-4 text-left ' + ri.card + (on ? ' ring-2 ring-blue-500' : '') + '" aria-pressed="' + on + '" onclick="setFollowRule(\'' + (on ? 'ALL' : k) + '\')">' +
      '<div class="flex items-center justify-between"><span class="text-[11px] font-bold uppercase tracking-wide">Rule ' + k + ': ' + esc(ri.tag) + '</span><span class="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">' + n + '</span></div>' +
      '<div class="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900">' + icon(ri.icon, 'w-4 h-4') + esc(ri.short) + '</div><div class="text-[11px] text-slate-600">' + esc(thr[k]) + '</div></button>';
  }).join('') + '</div>';
  var chips = chip('All flags', ui.followRule === 'ALL', "setFollowRule('ALL')", total);
  ['D', 'A', 'B', 'C'].forEach(function (k) { chips += chip(RULE_INFO[k].label, ui.followRule === k, "setFollowRule('" + k + "')", getFollowUpLines(k).length); });
  var groups = followupGroups(ui.followRule);
  var html = groups.map(function (g) {
    var v = g.vendor, value = g.items.reduce(function (s, x) { return s + x.po.poValue; }, 0);
    var rows = g.items.map(function (x) {
      var p = x.po, ri = RULE_INFO[x.top.rule], lf = lastFollowup(p);
      return '<tr><td class="' + UI.td + ' font-mono text-xs"><button type="button" class="font-semibold text-blue-700 underline" onclick="openTrackingModal(\'' + p.poNumber + '\')">' + esc(p.poNumber) + '</button><div class="font-sans text-slate-500">PR ' + esc(p.prNumber) + '/' + p.prLine + '</div></td>' +
        '<td class="' + UI.td + ' text-xs"><div class="font-medium text-slate-800">' + esc(p.materialDescription) + '</div><div class="text-slate-500">' + formatNum(p.quantity) + ' ' + esc(p.uom) + ' · ' + formatINRShort(p.poValue) + '</div></td>' +
        '<td class="' + UI.td + ' text-xs"><span class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ' + ri.cls + '">' + icon(ri.icon, 'w-3 h-3') + esc(ri.badge) + '</span>' +
        x.flags.map(function (f) { return '<div class="mt-0.5 text-[11px] text-slate-500">' + f.rule + ': ' + esc(f.text) + '</div>'; }).join('') + '</td>' +
        '<td class="' + UI.td + ' whitespace-nowrap text-sm font-semibold ' + (x.delay > 7 ? 'text-red-700' : 'text-slate-800') + '">' + x.delay + ' d</td>' +
        '<td class="' + UI.td + ' text-xs">' + (p.awb ? '<span class="font-mono text-blue-700">' + esc(p.awb) + '</span><div class="text-slate-500">' + esc(p.carrier) + '</div>' : '<span class="italic text-red-700">Not shared</span>') + '<div class="mt-1">' + shipStatusBar(p) + '</div></td>' +
        '<td class="' + UI.td + ' whitespace-nowrap text-xs">' + (lf ? formatDateTime(lf.timestamp) + '<div class="text-slate-500">' + esc(lf.channel) + '</div>' : (p.followUpCount ? 'Earlier' : 'None')) + '<div class="text-slate-500">Count: ' + (p.followUpCount || 0) + '</div></td>' +
        '<td class="' + UI.td + ' text-xs">' + esc(p.buyer) + '</td>' +
        '<td class="' + UI.td + '"><div class="flex flex-wrap gap-1">' + (!p.awb && can('recordAwb') ? '<button type="button" class="inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600" onclick="openAwbReminderModal(\'' + p.poNumber + '\',\'draft\')">' + icon('bell', 'w-3 h-3') + 'Ask AWB</button>' : '') +
        (can('followup') ? '<button type="button" class="' + UI.btnSm + '" onclick="openFollowupLogModal(\'' + p.poNumber + '\')">' + icon('notebook-pen', 'w-3 h-3') + 'Log</button>' : '') +
        (p.awb ? '<button type="button" class="' + UI.btnSm + '" onclick="openTrackingModal(\'' + p.poNumber + '\')">' + icon('map-pin', 'w-3 h-3') + 'Track</button>' : '') +
        '<button type="button" class="' + UI.btnSm + '" aria-label="Vendor e-mail thread" title="Vendor e-mail thread" onclick="openVendorEmailModal(\'' + p.poNumber + '\')">' + icon('mails', 'w-3 h-3') + '</button></div></td></tr>';
    }).join('');
    return '<section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div class="flex flex-wrap items-center gap-3 bg-slate-900 px-4 py-3 text-white">' +
      '<span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">' + esc((v ? v.name : '?').charAt(0)) + '</span>' +
      '<div class="min-w-0"><div class="text-sm font-semibold">' + esc(v ? v.name : 'Unknown vendor') + ' <span class="font-mono text-xs font-normal text-slate-400">' + esc(v ? v.id : '') + '</span></div>' +
      '<div class="text-xs text-slate-300">' + (v ? esc(v.contactName) + ' · ' + esc(v.dispatchEmail) + ' · ' + esc(v.phone) + ' · ' + esc(v.city) : '') + '</div></div>' +
      '<span class="text-xs text-slate-300">Pending: <b class="text-amber-300">' + g.items.length + '</b>' + (g.critical ? ' · <b class="text-red-300">' + g.critical + ' critical</b>' : '') + ' · ' + formatINRShort(value) + ' at risk</span>' +
      '<span class="ml-auto flex flex-wrap gap-2"><button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20" onclick="copyVendorFollowup(\'' + (v ? v.id : '') + '\')">' + icon('copy', 'w-4 h-4') + 'Copy follow-up e-mail</button>' +
      (can('followup') ? '<button type="button" class="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600" onclick="logVendorReminder(\'' + (v ? v.id : '') + '\')">' + icon('bell', 'w-4 h-4') + 'Log reminder (simulated)</button>' : '') + '</span></div>' +
      tableWrap(ths(['PO / line', 'Material', 'Triggered rule', 'Days delay', 'Courier / AWB', 'Last follow-up', 'Buyer', 'Action']), rows) + '</section>';
  }).join('');
  return pageHeader('Delivery follow-up & expediting queue', '<span class="font-semibold text-red-700">' + icon('circle-alert', 'w-3 h-3 inline') + ' ' + total + ' PO lines need action today</span> · thresholds A ' + r.A + ' d · B ' + r.B + ' d · C ' + r.C + ' d · D = committed ETA passed',
      '<button type="button" class="' + UI.btn + '" onclick="exportFollowupList()">' + icon('download', 'w-4 h-4') + 'Export action list</button>' +
      (can('settings') ? '<button type="button" class="' + UI.btn + '" onclick="navigate(\'settings\')">' + icon('sliders-horizontal', 'w-4 h-4') + 'Rule thresholds</button>' : '')) +
    cards + '<div class="mb-4 flex flex-wrap items-center gap-2"><span class="text-xs font-semibold text-slate-500">Active filter:</span>' + chips + '<span class="ml-auto text-[11px] text-slate-500">Sorted by priority (D → A → B → C), then oldest delay</span></div>' +
    (html ? '<div class="space-y-4">' + html + '</div>' : '<section class="' + UI.card + '">' + emptyState('No POs flagged by this rule.') + '</section>');
}
function setFollowRule(r) { appState.ui.followRule = r; rerender(); }
function vendorFlagged(vendorId) {
  var g = followupGroups(appState.ui.followRule).filter(function (x) { return x.vendor && x.vendor.id === vendorId; })[0];
  if (!g) { showToast('No flagged POs found for this vendor.', 'error'); return null; }
  return g;
}
function copyVendorFollowup(vendorId) {
  var g = vendorFlagged(vendorId); if (!g) return;
  var v = g.vendor;
  var lines = g.items.map(function (x, i) {
    var p = x.po;
    return (i + 1) + '. PO ' + p.poNumber + ' – ' + p.materialDescription + ' (' + formatNum(p.quantity) + ' ' + p.uom + ')' +
      (p.awb ? ', AWB ' + p.awb + ' (' + p.carrier + ')' : ', AWB not shared') + ' – ' + x.flags.map(function (f) { return f.text; }).join('; ');
  });
  var text = 'To: ' + v.dispatchEmail + '\nCc: ' + v.salesEmail + '\nSubject: Delivery follow-up – ' + g.items.length + ' open PO(s) for Tata Electronics, Jagi Road\n\n' +
    'Dear ' + v.contactName + ' / ' + v.name + ' team,\n\nThe following POs need your attention:\n\n' + lines.join('\n') +
    '\n\nPlease share AWB / carrier details where missing and a confirmed delivery date to Jagi Road (via Guwahati GAU hub) by tomorrow.\n\nRegards,\n' + currentUserName() + '\nProcurement, Tata Electronics (Jagi Road)';
  copyText(text).then(function (ok) { showToast(ok ? 'Draft copied – ' + g.items.length + ' PO(s) for ' + v.name : 'Copy blocked by the browser', ok ? 'success' : 'warn'); });
}
function logVendorReminder(vendorId) {
  if (!requirePerm('followup')) return;
  var g = vendorFlagged(vendorId); if (!g) return;
  g.items.forEach(function (x) { recordFollowup(x.po, 'Email', 'Consolidated vendor follow-up (draft copied)', isoDate(addDays(DEMO_TODAY, 2))); });
  showToast('Reminder logged (simulated) on ' + g.items.length + ' PO(s) for ' + g.vendor.name, 'success');
  rerender();
}
function exportFollowupList() {
  var rows = [['Vendor', 'Vendor ID', 'Contact', 'Dispatch e-mail', 'Phone', 'PO', 'PR', 'Line', 'Material', 'Value (INR)', 'Top rule', 'All rules', 'Days delay', 'AWB', 'Carrier', 'Follow-ups', 'Buyer']];
  followupGroups(appState.ui.followRule).forEach(function (g) {
    g.items.forEach(function (x) {
      var p = x.po, v = g.vendor || {};
      rows.push([v.name, v.id, v.contactName, v.dispatchEmail, v.phone, p.poNumber, p.prNumber, p.prLine, p.materialDescription, p.poValue, x.top.rule,
        x.flags.map(function (f) { return f.rule; }).join(' '), x.delay, p.awb, p.carrier, p.followUpCount || 0, p.buyer]);
    });
  });
  downloadCsv('delivery_followup_' + isoDate(DEMO_TODAY) + '.csv', rows);
}
