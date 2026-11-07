/* GRN / Closure: received vs pending qty, storage location, dock, close line */
function grnLines() {
  return appState.lines.filter(function (l) {
    if (l.currentStatus === 'GRN COMPLETED') return true;
    if (l.currentStatus !== 'IN-TRANSIT' || !l.poNumber) return false;
    var p = findPO(l.poNumber, true);
    return p && p.stage === 'Delivered';
  });
}
function renderGrnScreen() {
  var list = grnLines();
  var rows = list.map(function (l) {
    var p = findPO(l.poNumber, true), pending = l.quantity - (l.receivedQty || 0), safe = l.id.replace(/[^A-Za-z0-9]/g, '_');
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '<div class="text-xs text-slate-500">' + esc(l.materialDescription) + '</div></td>' +
      '<td class="' + UI.td + ' font-mono text-xs">' + esc(l.poNumber || '—') + '<div class="font-sans text-slate-500">' + esc(p ? p.vendor : '') + '</div></td>' +
      '<td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td>' +
      '<td class="' + UI.td + ' text-right">' + formatNum(l.quantity) + ' ' + esc(l.uom) + '</td><td class="' + UI.td + ' text-right">' + formatNum(l.receivedQty || 0) + '</td>' +
      '<td class="' + UI.td + ' text-right ' + (pending > 0 ? 'font-semibold text-amber-700' : 'text-emerald-700') + '">' + (pending > 0 ? formatNum(pending) : icon('check', 'w-3 h-3 inline') + ' 0') + '</td>' +
      '<td class="' + UI.td + '"><select id="grn-sl-' + safe + '" class="' + UI.input + ' text-xs" aria-label="Storage location">' + selectOptions(SITE.storageLocations, l.storageLocation || SITE.storageLocations[0]) + '</select></td>' +
      '<td class="' + UI.td + '"><select id="grn-dock-' + safe + '" class="' + UI.input + ' text-xs" aria-label="Dock">' + selectOptions(SITE.docks, l.dock || SITE.docks[0]) + '</select></td>' +
      '<td class="' + UI.td + '"><div class="flex flex-wrap items-center gap-1">' +
      (pending > 0 ? '<input id="grn-qty-' + safe + '" type="number" min="1" max="' + pending + '" value="' + pending + '" class="' + UI.input + ' w-20 text-xs" aria-label="Quantity received">' +
        '<button type="button" class="' + UI.btnSm + '" onclick="postGrn(\'' + l.id + '\')"' + (can('grn') ? '' : ' disabled') + '>' + icon('package-check', 'w-3 h-3') + 'Post GRN</button>' : '') +
      '<button type="button" class="' + UI.btnPrimarySm + '" onclick="closeGrnLine(\'' + l.id + '\')"' + (pending > 0 || l.currentStatus !== 'GRN COMPLETED' || !can('grn') ? ' disabled title="Receive full quantity first"' : '') + '>' + icon('circle-check', 'w-3 h-3') + 'Close line</button></div></td></tr>';
  }).join('');
  var partial = list.filter(function (l) { return (l.receivedQty || 0) > 0 && l.receivedQty < l.quantity; }).length;
  return pageHeader('GRN / Closure', 'Goods received at ' + esc(SITE.plant) + ' (from Guwahati hub) · GRN posting is simulated, not posted to SAP') +
    '<div class="mb-4 grid grid-cols-3 gap-3">' + kpiTile('Awaiting GRN', list.filter(function (l) { return l.currentStatus === 'IN-TRANSIT'; }).length, 'Delivered, not yet received', 'package', 'blue') +
    kpiTile('Partially received', partial, 'Balance quantity pending', 'package-open', 'amber') +
    kpiTile('Ready to close', list.filter(function (l) { return l.currentStatus === 'GRN COMPLETED' && l.receivedQty >= l.quantity; }).length, 'Full quantity received', 'circle-check', 'green') + '</div>' +
    '<section class="' + UI.card + '">' + (rows ? tableWrap(ths(['Line', 'PO', 'Status', 'Ordered', 'Received', 'Pending', 'Storage location', 'Dock', '']), rows) : emptyState('Nothing waiting for GRN.')) + '</section>';
}
function postGrn(lineId) {
  if (!requirePerm('grn')) return;
  var l = findLine(lineId); if (!l) return;
  var safe = l.id.replace(/[^A-Za-z0-9]/g, '_');
  var qty = Number(fieldVal('grn-qty-' + safe));
  var pending = l.quantity - (l.receivedQty || 0);
  if (!(qty > 0) || qty > pending || Math.floor(qty) !== qty) { showToast('Enter a whole quantity between 1 and ' + pending + '.', 'error'); return; }
  l.receivedQty = (l.receivedQty || 0) + qty;
  l.storageLocation = fieldVal('grn-sl-' + safe) || SITE.storageLocations[0];
  l.dock = fieldVal('grn-dock-' + safe) || SITE.docks[0];
  if (l.currentStatus !== 'GRN COMPLETED') setLineStatus(l, 'GRN COMPLETED', 'GRN posted (simulated)');
  logActivity(l, 'GRN: received ' + qty + ' ' + l.uom + ' at ' + l.dock + ' → ' + l.storageLocation + ' (' + l.receivedQty + '/' + l.quantity + ')');
  showToast('GRN logged: ' + qty + ' ' + l.uom + ' received (' + l.receivedQty + '/' + l.quantity + ')', 'success');
  rerender();
}
function closeGrnLine(lineId) {
  if (!requirePerm('grn')) return;
  var l = findLine(lineId); if (!l) return;
  if (l.currentStatus !== 'GRN COMPLETED' || l.receivedQty < l.quantity) { showToast('Receive the full quantity before closing.', 'error'); return; }
  setLineStatus(l, 'CLOSED', 'GRN verified');
  addThreadMessage(l.id, { type: 'Decision', text: 'Line closed after full GRN at ' + l.dock + '.', assignedTo: l.user });
  showToast('Line ' + l.prNumber + '/' + l.line + ' closed', 'success');
  rerender();
}
