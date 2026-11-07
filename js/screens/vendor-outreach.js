/* Vendor Outreach: RFQ tracking per line */
function outreachLines() {
  return appState.lines.filter(function (l) {
    return (l.currentStatus === 'VENDOR OUTREACH' || l.currentStatus === 'COMMERCIALS') && (appState.role !== 'Buyer' || l.assignedBuyer === currentUserName());
  });
}
function ensureRfq(l) {
  if (!l.rfq) {
    var vs = vendorsForCategory(appState.vendors, l.category).map(function (v) { return v.name; });
    l.rfq = { vendorsContacted: vs.slice(0, 2), quotesReceived: 0, nextStep: 'Chase pending quotes' };
  }
  return l.rfq;
}
function renderVendorOutreachScreen() {
  var list = outreachLines();
  var rows = list.map(function (l) {
    var r = ensureRfq(l);
    var all = r.quotesReceived >= r.vendorsContacted.length;
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '<div class="text-xs text-slate-500">' + esc(l.materialDescription) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(l.category) + '</td><td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + r.vendorsContacted.map(esc).join('<br>') + '</td>' +
      '<td class="' + UI.td + ' text-center"><span class="inline-flex items-center gap-1 text-xs font-semibold ' + (all ? 'text-emerald-700' : 'text-amber-700') + '">' + icon(all ? 'circle-check' : 'hourglass', 'w-3 h-3') + r.quotesReceived + ' / ' + r.vendorsContacted.length + '</span></td>' +
      '<td class="' + UI.td + ' text-right">' + formatINRShort(l.estimatedValue) + '</td><td class="' + UI.td + ' text-xs">' + esc(r.nextStep) + '</td><td class="' + UI.td + '">' + slaBadge(l) + '</td>' +
      '<td class="' + UI.td + '"><div class="flex flex-wrap gap-1">' +
      (can('outreach') ? '<button type="button" class="' + UI.btnSm + '" onclick="logQuote(\'' + l.id + '\')"' + (all ? ' disabled' : '') + '>' + icon('plus', 'w-3 h-3') + 'Log quote</button>' +
        '<button type="button" class="' + UI.btnSm + '" onclick="advanceOutreach(\'' + l.id + '\')">' + icon('arrow-right', 'w-3 h-3') + (l.currentStatus === 'VENDOR OUTREACH' ? 'To commercials' : 'NFA approved') + '</button>' : '') +
      '<button type="button" class="' + UI.btnSm + '" onclick="openLineDrawer(\'' + l.id + '\')">Open</button></div></td></tr>';
  }).join('');
  var quotes = list.reduce(function (s, l) { return s + ensureRfq(l).quotesReceived; }, 0);
  var asked = list.reduce(function (s, l) { return s + ensureRfq(l).vendorsContacted.length; }, 0);
  return pageHeader('Vendor outreach', 'RFQ status for lines in vendor outreach and commercials' + (appState.role === 'Buyer' ? ' · ' + esc(currentUserName()) : ''),
      '<button type="button" class="' + UI.btn + '" onclick="exportOutreach()">' + icon('download', 'w-4 h-4') + 'Export CSV</button>') +
    '<div class="mb-4 grid grid-cols-3 gap-3">' + kpiTile('Lines in RFQ', list.length, formatINRShort(list.reduce(function (s, l) { return s + l.estimatedValue; }, 0)) + ' est. value', 'send', 'blue') +
    kpiTile('Quotes received', quotes + ' / ' + asked, asked ? Math.round(quotes / asked * 100) + '% response rate' : '', 'inbox', 'green') +
    kpiTile('Past SLA', list.filter(function (l) { return slaInfo(l).state === 'breach'; }).length, 'Outreach 3 d · commercials 2.5 d', 'circle-alert', 'red') + '</div>' +
    '<section class="' + UI.card + '">' + (rows ? tableWrap(ths(['Line', 'Category', 'Stage', 'Vendors contacted', 'Quotes', 'Est. value', 'Next step', 'SLA', '']), rows) : emptyState('No lines in vendor outreach.')) + '</section>';
}
function logQuote(lineId) {
  if (!requirePerm('outreach')) return;
  var l = findLine(lineId); if (!l) return;
  var r = ensureRfq(l);
  if (r.quotesReceived >= r.vendorsContacted.length) { showToast('All contacted vendors have quoted.', 'info'); return; }
  r.quotesReceived++;
  var v = r.vendorsContacted[r.quotesReceived - 1];
  r.nextStep = r.quotesReceived >= r.vendorsContacted.length ? 'Compare quotes & move to commercials' : 'Chase pending quotes';
  logActivity(l, 'Quote logged from ' + v);
  showToast('Quote from ' + v + ' logged', 'success');
  rerender();
}
function advanceOutreach(lineId) {
  if (!requirePerm('outreach')) return;
  var l = findLine(lineId); if (!l) return;
  var next = l.currentStatus === 'VENDOR OUTREACH' ? 'COMMERCIALS' : l.currentStatus === 'COMMERCIALS' ? 'NFA APPROVED' : null;
  if (!next) { showToast('Line is not in outreach.', 'error'); return; }
  setLineStatus(l, next, 'from Vendor Outreach');
  if (next === 'COMMERCIALS') l.rfq.nextStep = 'Negotiate & prepare NFA';
  showToast('Line ' + l.prNumber + '/' + l.line + ' moved to ' + next, 'success');
  rerender();
}
function exportOutreach() {
  var rows = [['PR', 'Line', 'Material', 'Category', 'Stage', 'Buyer', 'Vendors contacted', 'Quotes received', 'Est. value (INR)', 'Next step', 'SLA']];
  outreachLines().forEach(function (l) { var r = ensureRfq(l); rows.push([l.prNumber, l.line, l.materialDescription, l.category, l.currentStatus, l.assignedBuyer, r.vendorsContacted.join('; '), r.quotesReceived, l.estimatedValue, r.nextStep, slaInfo(l).label]); });
  downloadCsv('vendor_outreach_' + isoDate(DEMO_TODAY) + '.csv', rows);
}
