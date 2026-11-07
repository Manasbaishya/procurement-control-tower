/* Reports: governance report cards, each downloadable as CSV */
var REPORTS = [
  { id: 'sla', title: 'SLA breach report', icon: 'circle-alert', desc: 'Open lines that have exceeded their stage SLA.' },
  { id: 'load', title: 'Buyer load report', icon: 'users', desc: 'Open lines per buyer against the 90-line capacity.' },
  { id: 'aged', title: 'Aged backlog report', icon: 'hourglass', desc: 'Open lines older than 30 days since PR creation.' },
  { id: 'vendor', title: 'Vendor delivery report', icon: 'truck', desc: 'PO delivery status and follow-up flags per vendor.' }
];
function reportRows(id) {
  if (id === 'sla') {
    var r = [['PR', 'Line', 'Material', 'Category', 'Buyer', 'Status', 'Days in status', 'SLA days', 'Days over', 'Controllable']];
    appState.lines.filter(function (l) { return isOpen(l) && slaInfo(l).state === 'breach'; }).forEach(function (l) {
      var st = stageByKey(l.currentStatus);
      r.push([l.prNumber, l.line, l.materialDescription, l.category, l.assignedBuyer, l.currentStatus, l.daysInStatus, st.sla, Math.round((l.daysInStatus - st.sla) * 10) / 10, st.controllable ? 'Yes' : 'No']);
    });
    return r;
  }
  if (id === 'load') {
    var b = [['Buyer', 'Team', 'Main category', 'Open lines', 'Capacity', 'Load %', 'OOO', 'Backup', 'Avg cycle days']];
    appState.buyers.forEach(function (x) { b.push([x.name, x.team, x.mainCategory, x.openLines, x.capacity, loadPct(x), x.ooo ? 'Yes' : 'No', (getBuyerById(x.backup) || {}).name || '', x.avgCycleDays]); });
    return b;
  }
  if (id === 'aged') {
    var a = [['PR', 'Line', 'Material', 'Category', 'Buyer', 'Status', 'PR created', 'Age (days)', 'Est. value (INR)']];
    appState.lines.filter(function (l) { return isOpen(l) && daysAgo(l.prCreationDate) > 30; }).sort(function (x, y) { return x.prCreationDate < y.prCreationDate ? -1 : 1; }).forEach(function (l) {
      a.push([l.prNumber, l.line, l.materialDescription, l.category, l.assignedBuyer, l.currentStatus, l.prCreationDate, Math.floor(daysAgo(l.prCreationDate)), l.estimatedValue]);
    });
    return a;
  }
  if (id === 'vendor') {
    var v = [['Vendor', 'POs', 'Awarded (no AWB)', 'In transit', 'At Guwahati', 'Delivered', 'Flagged', 'ETA missed', 'Open value (INR)']];
    appState.vendors.forEach(function (vd) {
      var ps = appState.pos.filter(function (p) { return p.vendorId === vd.id; });
      if (!ps.length) return;
      function c(s) { return ps.filter(function (p) { return p.stage === s; }).length; }
      v.push([vd.name, ps.length, c('PO Awarded'), c('Dispatched') + c('In Transit'), c('At Guwahati'), c('Delivered'),
        ps.filter(function (p) { return poFlags(p).length; }).length, ps.filter(function (p) { return p.isOverdue; }).length,
        ps.filter(function (p) { return p.stage !== 'Delivered'; }).reduce(function (s, p) { return s + p.poValue; }, 0)]);
    });
    return v;
  }
  return null;
}
function renderReportsScreen() {
  var cards = REPORTS.map(function (r) {
    var rows = reportRows(r.id);
    var preview = rows.slice(1, 4).map(function (x) { return '<li class="truncate">' + esc(x.slice(0, 3).join(' · ')) + '</li>'; }).join('');
    return '<section class="' + UI.card + ' flex flex-col p-4"><div class="flex items-center gap-2"><span class="rounded-lg bg-blue-50 p-2 text-blue-600">' + icon(r.icon, 'w-5 h-5') + '</span>' +
      '<div><h2 class="text-sm font-semibold text-slate-900">' + esc(r.title) + '</h2><p class="text-xs text-slate-500">' + esc(r.desc) + '</p></div></div>' +
      '<div class="mt-3 text-2xl font-bold text-slate-900">' + (rows.length - 1) + ' <span class="text-sm font-normal text-slate-500">rows</span></div>' +
      '<ul class="mt-2 flex-1 space-y-0.5 text-xs text-slate-600">' + (preview || '<li>No rows</li>') + '</ul>' +
      '<button type="button" class="' + UI.btn + ' mt-3 self-start" onclick="downloadReport(\'' + r.id + '\')">' + icon('download', 'w-4 h-4') + 'Download CSV</button></section>';
  }).join('');
  return pageHeader('Reports', 'Governance reports on sample data · generated in the browser') + '<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">' + cards + '</div>';
}
function downloadReport(id) {
  var rows = reportRows(id);
  if (!rows) { showToast('Report ' + id + ' not found.', 'error'); return; }
  downloadCsv('report_' + id + '_' + isoDate(DEMO_TODAY) + '.csv', rows);
}
