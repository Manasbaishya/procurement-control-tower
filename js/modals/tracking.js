/* Shipment tracking modal */
function trackingUrl(po) {
  if (!po || !po.awb) return '';
  var c = getCarrierByName(po.carrierId || po.carrier);
  if (!c || !c.template) return '';
  return c.template.split('{AWB}').join(encodeURIComponent(po.awb));
}
function shipProgress(stage) {
  var idx = SHIPMENT_STAGES.indexOf(stage);
  return '<ol class="grid grid-cols-5 gap-1">' + SHIPMENT_STAGES.map(function (s, i) {
    var done = i <= idx;
    return '<li class="text-center"><div class="h-2 rounded-full ' + (done ? 'bg-blue-600' : 'bg-slate-200') + '"></div>' +
      '<div class="mt-1 flex items-center justify-center gap-1 text-[11px] ' + (i === idx ? 'font-bold text-blue-700' : done ? 'text-slate-700' : 'text-slate-400') + '">' +
      icon(done ? 'circle-check' : 'circle', 'w-3 h-3 shrink-0') + '<span>' + esc(s) + '</span></div></li>';
  }).join('') + '</ol>';
}

/* compact 5-step bar for table rows: PO · LR · Transit · GHY · Site (labels, not colour alone) */
var SHIP_STEP_SHORT = ['PO', 'LR', 'Transit', 'GHY', 'Site'];
function shipStatusBar(po) {
  var idx = SHIPMENT_STAGES.indexOf(po.stage);
  var stuck = po.isStuck || po.isOverdue;
  var dots = SHIP_STEP_SHORT.map(function (s, i) {
    var done = i <= idx, cur = i === idx;
    return '<span class="flex flex-col items-center gap-0.5"><span class="block h-2.5 w-2.5 rounded-full ' +
      (cur ? (stuck ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-blue-600 ring-2 ring-blue-200') : done ? 'bg-blue-600' : 'bg-slate-200') + '"></span>' +
      '<span class="text-[9px] leading-none ' + (cur ? 'font-bold text-slate-900' : done ? 'text-blue-700' : 'text-slate-400') + '">' + s + '</span></span>' +
      (i < 4 ? '<span class="mt-[4px] h-0.5 w-3 self-start ' + (i < idx ? 'bg-blue-600' : 'bg-slate-200') + '"></span>' : '');
  }).join('');
  return '<button type="button" class="flex items-start" title="' + esc(po.stage + (stuck ? ' – needs follow-up' : '')) + '" aria-label="Shipment stage ' + esc(po.stage) + '. Open tracking." onclick="openTrackingModal(\'' + po.poNumber + '\')">' + dots + '</button>';
}

function openTrackingModal(poNumber) {
  var po = findPO(poNumber);
  if (!po) return;
  var url = trackingUrl(po);
  var flags = poFlags(po);
  var scans = po.scans.slice().reverse().map(function (s) {
    return '<tr><td class="' + UI.td + ' whitespace-nowrap">' + formatDateTime(s.time) + '</td><td class="' + UI.td + '">' + esc(s.location) + '</td><td class="' + UI.td + '">' + esc(s.event) + '</td></tr>';
  }).join('');
  openModal({
    title: 'Tracking · PO ' + po.poNumber, size: 'lg',
    subtitle: esc(po.vendor) + ' · ' + esc(po.materialDescription),
    body:
      '<div class="flex flex-wrap items-center gap-2">' + shipBadge(po.stage) +
      flags.map(function (f) { return '<span class="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">' + icon('flag', 'w-3 h-3') + 'Rule ' + f.rule + ': ' + esc(f.text) + '</span>'; }).join('') + '</div>' +
      '<dl class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">' +
      kv('Carrier', esc(po.carrier || '—')) + kv('AWB', po.awb ? '<span class="font-mono">' + esc(po.awb) + '</span>' : '<span class="text-amber-700">Not shared yet</span>') +
      kv('Current location', esc(po.currentLocation)) + kv('Last scan', po.lastScanTime ? formatDateTime(po.lastScanTime) : '—') +
      kv('Dispatched', po.dispatchDate ? formatDate(po.dispatchDate) : '—') + kv('Committed ETA', formatDate(po.committedEta)) +
      kv('Delivered', po.deliveredDate ? formatDate(po.deliveredDate) : '—') + kv('PR / line', esc(po.prNumber) + ' / ' + po.prLine) + '</dl>' +
      '<div class="mt-5">' + shipProgress(po.stage) + '</div>' +
      '<h3 class="mt-5 mb-2 text-sm font-semibold text-slate-700">Scan history</h3>' +
      (scans ? '<div class="rounded-lg border border-slate-200">' + tableWrap(ths(['Time', 'Location', 'Event']), scans) + '</div>' : emptyState('No carrier scans yet – AWB not shared by vendor.')) +
      '<p class="mt-3 text-[11px] text-slate-500">Scans come from sample data or a pasted tracking feed. No carrier API is connected.</p>',
    footer: (url ? '<a class="' + UI.btn + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + icon('external-link', 'w-4 h-4') + 'Open on carrier website</a>' :
      '<span class="text-xs text-slate-500">No carrier link until an AWB is recorded.</span>') +
      (can('recordAwb') && !po.awb ? '<button type="button" class="' + UI.btn + '" onclick="openAwbReminderModal(\'' + po.poNumber + '\',\'record\')">' + icon('plus', 'w-4 h-4') + 'Record AWB</button>' : '') +
      '<button type="button" class="' + UI.btnPrimary + '" onclick="closeModal()">Done</button>'
  });
}
