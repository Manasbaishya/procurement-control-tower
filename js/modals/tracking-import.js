/* "Refresh tracking" – paste a carrier CSV feed, parse it and update matching AWBs */
function sampleTrackingFeed() {
  var withAwb = appState.pos.filter(function (p) { return p.awb && p.stage !== 'Delivered'; });
  var rows = ['awb,status,location,scan_time'];
  if (withAwb[0]) rows.push(withAwb[0].awb + ',In Transit,Siliguri Gateway,' + isoDate(DEMO_TODAY) + ' 06:40');
  if (withAwb[1]) rows.push(withAwb[1].awb + ',At Guwahati,Guwahati (GAU) Hub,' + isoDate(DEMO_TODAY) + ' 08:15');
  if (withAwb[2]) rows.push(withAwb[2].awb + ',Delivered,Jagi Road Receiving Dock 2,' + isoDate(DEMO_TODAY) + ' 09:30');
  rows.push('99999999999,In Transit,Kolkata Hub,' + isoDate(DEMO_TODAY) + ' 07:00');
  return rows.join('\n');
}

function openTrackingImportModal() {
  if (!can('importTracking') && !can('recordAwb')) { requirePerm('importTracking'); return; }
  openModal({
    title: 'Refresh tracking from carrier feed', size: 'md',
    subtitle: 'Paste a CSV export from the carrier portal. Columns: awb, status, location, scan_time',
    body: '<textarea id="ti-feed" rows="9" class="' + UI.input + ' w-full font-mono text-xs">' + esc(sampleTrackingFeed()) + '</textarea>' +
      '<p class="mt-2 text-[11px] text-slate-500">Status values: Dispatched, In Transit, At Guwahati, Delivered. Unknown AWBs are reported, never guessed. No carrier API is called.</p>' +
      '<div id="ti-result" class="mt-3"></div>',
    footer: '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Close</button><button type="button" class="' + UI.btnPrimary + '" onclick="applyTrackingFeed()">' + icon('refresh-cw', 'w-4 h-4') + 'Parse & update</button>'
  });
}

function mapFeedStatus(s) {
  s = String(s || '').toLowerCase();
  if (s.indexOf('deliver') >= 0) return 'Delivered';
  if (s.indexOf('guwahati') >= 0 || s.indexOf('gau') >= 0 || s.indexOf('destination hub') >= 0) return 'At Guwahati';
  if (s.indexOf('transit') >= 0 || s.indexOf('hub') >= 0) return 'In Transit';
  if (s.indexOf('dispatch') >= 0 || s.indexOf('pick') >= 0) return 'Dispatched';
  return null;
}

function applyTrackingFeed() {
  var rows = parseCsv(fieldVal('ti-feed'));
  if (rows.length < 2) { showToast('Paste a header row and at least one data row.', 'error'); return; }
  var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
  var iA = head.indexOf('awb'), iS = head.indexOf('status'), iL = head.indexOf('location'), iT = head.indexOf('scan_time');
  if (iA < 0 || iS < 0) { showToast('Header must include awb and status columns.', 'error'); return; }
  var updated = [], unmatched = [], invalid = [];
  rows.slice(1).forEach(function (r, idx) {
    var awb = (r[iA] || '').trim();
    var stage = mapFeedStatus(r[iS]);
    if (!awb || !stage) { invalid.push('Row ' + (idx + 2) + (awb ? ' (' + awb + ')' : '') + ': unknown status "' + esc(r[iS] || '') + '"'); return; }
    var po = appState.pos.filter(function (p) { return p.awb === awb; })[0];
    if (!po) { unmatched.push(awb); return; }
    var loc = iL >= 0 && r[iL] ? r[iL].trim() : stage;
    var t = iT >= 0 && r[iT] ? r[iT].trim().replace(' ', 'T') : nowStamp();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) t = nowStamp();
    po.scans.push({ time: t.slice(0, 16), location: loc, event: stage + ' – carrier feed' });
    po.lastScanTime = t.slice(0, 16); po.currentLocation = loc;
    if (SHIPMENT_STAGES.indexOf(stage) > SHIPMENT_STAGES.indexOf(po.stage)) po.stage = stage;
    if (po.stage === 'Delivered' && !po.deliveredDate) po.deliveredDate = t.slice(0, 10);
    if (po.lineId) { var l = findLine(po.lineId, true); if (l) logActivity(l, 'Tracking feed: ' + stage + ' at ' + loc + ' (AWB ' + awb + ')'); }
    updated.push(po.poNumber + ' → ' + po.stage);
  });
  refreshPOFlags();
  document.getElementById('ti-result').innerHTML =
    '<div class="rounded-lg border border-slate-200 p-3 text-sm">' +
    '<div class="text-emerald-700">' + icon('circle-check', 'w-4 h-4 inline') + ' Updated ' + updated.length + ' PO(s)' + (updated.length ? ': ' + esc(updated.join(', ')) : '') + '</div>' +
    (unmatched.length ? '<div class="mt-1 text-amber-700">' + icon('triangle-alert', 'w-4 h-4 inline') + ' No PO found for AWB: ' + esc(unmatched.join(', ')) + '</div>' : '') +
    (invalid.length ? '<div class="mt-1 text-red-700">' + icon('circle-x', 'w-4 h-4 inline') + ' ' + invalid.join('<br>') + '</div>' : '') + '</div>';
  refreshIcons();
  if (unmatched.length) showToast(unmatched.length + ' AWB(s) not found in the PO list', 'error');
  showToast('Tracking refreshed: ' + updated.length + ' PO(s) updated', updated.length ? 'success' : 'warn');
  rerender(); // re-renders the screen only; the modal (and its result) stays open
}
