/* AWB reminder modal – tab 1: draft request for AWB + carrier, tab 2: record AWB */
function awbRequestDraft(po) {
  var v = getVendor(po.vendorId);
  return 'To: ' + (v ? v.dispatchEmail : po.vendorEmail) + '\n' +
    'Subject: AWB & carrier details required – PO ' + po.poNumber + ' (Tata Electronics, Jagi Road)\n\n' +
    'Dear ' + po.vendor + ' dispatch team,\n\n' +
    'PO ' + po.poNumber + ' dated ' + formatDate(po.poDate) + ' (' + po.materialDescription + ', ' + formatNum(po.quantity) + ' ' + po.uom + ') was awarded ' + po.daysSincePo + ' days ago.\n' +
    'We have not yet received dispatch details. Please share:\n' +
    '  1. AWB / docket number\n  2. Carrier name\n  3. Dispatch date and pickup location\n\n' +
    'Consignee: Tata Electronics, Jagi Road Semiconductor Site, Assam – via Guwahati (GAU) hub.\n' +
    'Committed ETA on PO: ' + formatDate(po.committedEta) + '.\n\n' +
    'Regards,\n' + currentUserName() + '\nProcurement, Tata Electronics (Jagi Road)';
}

function openAwbReminderModal(poNumber, tab) {
  if (!requirePerm('recordAwb')) return;
  var po = findPO(poNumber);
  if (!po) return;
  tab = tab === 'record' ? 'record' : 'draft';
  var tabs = '<div class="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1" role="tablist">' +
    '<button type="button" role="tab" aria-selected="' + (tab === 'draft') + '" class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium ' + (tab === 'draft' ? 'bg-white shadow text-slate-900' : 'text-slate-600') + '" onclick="openAwbReminderModal(\'' + po.poNumber + '\',\'draft\')">' + icon('mail', 'w-4 h-4 inline') + ' Request AWB & carrier</button>' +
    '<button type="button" role="tab" aria-selected="' + (tab === 'record') + '" class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium ' + (tab === 'record' ? 'bg-white shadow text-slate-900' : 'text-slate-600') + '" onclick="openAwbReminderModal(\'' + po.poNumber + '\',\'record\')">' + icon('clipboard-check', 'w-4 h-4 inline') + ' Record AWB</button></div>';
  var vend = getVendor(po.vendorId);
  var strip = '<div class="-mx-5 -mt-4 mb-4 flex flex-wrap gap-x-5 gap-y-1 border-b border-amber-100 bg-amber-50/60 px-5 py-2.5 text-xs text-slate-700">' +
    '<span><b>Material:</b> ' + esc(po.materialDescription) + ' · ' + formatNum(po.quantity) + ' ' + esc(po.uom) + '</span>' +
    '<span><b>Committed ETA:</b> ' + formatDate(po.committedEta) + '</span>' +
    '<span class="' + (po.daysSincePo > appState.settings.rules.A ? 'font-semibold text-red-700' : '') + '"><b>PO age:</b> ' + po.daysSincePo + ' d</span>' +
    '<span><b>Reminders logged:</b> ' + (po.followUpCount || 0) + '</span>' +
    '<span>' + (po.awb ? icon('circle-check', 'w-3 h-3 inline text-emerald-600') + ' AWB shared' : icon('circle-alert', 'w-3 h-3 inline text-amber-600') + ' AWB pending') + '</span></div>';
  var body, footer;
  if (tab === 'draft') {
    body = strip + tabs +
      '<div class="mb-3 grid gap-3 sm:grid-cols-2"><div class="rounded-lg border border-slate-200 p-2.5"><div class="' + UI.label + '">Dispatch e-mail recipient</div><div class="font-mono text-sm">' + esc(vend ? vend.dispatchEmail : po.vendorEmail) + '</div></div>' +
      '<div class="rounded-lg border border-slate-200 p-2.5"><div class="' + UI.label + '">Escalation contact / mobile</div><div class="text-sm">' + esc(vend ? vend.contactName + ' · ' + vend.phone : '—') + '</div></div></div>' +
      '<label class="' + UI.label + '" for="awb-draft">E-mail draft (edit before copying)</label><textarea id="awb-draft" rows="12" class="' + UI.input + ' w-full font-mono text-xs">' + esc(awbRequestDraft(po)) + '</textarea>' +
      '<label class="' + UI.label + ' mt-3" for="awb-wa">WhatsApp / SMS text</label><textarea id="awb-wa" rows="3" class="' + UI.input + ' w-full text-xs">' + esc(awbWhatsappDraft(po)) + '</textarea>' +
      '<p class="mt-2 text-[11px] text-slate-500">' + icon('info', 'w-3 h-3 inline') + ' Nothing is sent from the prototype. Copy a draft into e-mail or WhatsApp, then log the reminder so it counts towards follow-ups.</p>';
    footer = '<button type="button" class="' + UI.btn + '" onclick="copyAwbDraft()">' + icon('copy', 'w-4 h-4') + 'Copy e-mail draft</button>' +
      '<button type="button" class="' + UI.btn + '" onclick="copyAwbWhatsapp()">' + icon('message-circle', 'w-4 h-4') + 'Copy WhatsApp text</button>' +
      '<button type="button" class="' + UI.btnPrimary + '" onclick="logAwbReminder(\'' + po.poNumber + '\')">' + icon('bell', 'w-4 h-4') + 'Log reminder (simulated)</button>';
  } else {
    if (po.awb) {
      body = strip + tabs + '<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">' + icon('circle-check', 'w-4 h-4 inline') + ' AWB ' + esc(po.awb) + ' (' + esc(po.carrier) + ') is already recorded for this PO.</div>';
      footer = '<button type="button" class="' + UI.btn + '" onclick="openTrackingModal(\'' + po.poNumber + '\')">' + icon('map-pin', 'w-4 h-4') + 'Track</button>';
    } else {
      var v = getVendor(po.vendorId);
      body = strip + tabs + '<div class="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900">' + icon('circle-check', 'w-3 h-3 inline') +
        ' Vendor replied by call, WhatsApp or e-mail? Enter the details here. The PO moves to <b>Dispatched</b>, the status bar updates and tracking starts.</div>' +
        '<div class="grid gap-3 sm:grid-cols-2">' +
        '<div><label class="' + UI.label + '" for="awb-no">AWB / docket no. (required)</label><input id="awb-no" class="' + UI.input + ' w-full font-mono" placeholder="e.g. 81234567890"></div>' +
        '<div><label class="' + UI.label + '" for="awb-carrier">Carrier</label><select id="awb-carrier" class="' + UI.input + ' w-full">' + selectOptions(appState.carriers.map(function (c) { return { value: c.id, label: c.name }; }), 'bluedart') + '</select></div>' +
        '<div><label class="' + UI.label + '" for="awb-date">Dispatch date</label><input id="awb-date" type="date" class="' + UI.input + ' w-full" value="' + isoDate(DEMO_TODAY) + '" max="' + isoDate(DEMO_TODAY) + '" min="' + esc(po.poDate) + '"></div>' +
        '<div><label class="' + UI.label + '" for="awb-loc">Current location</label><input id="awb-loc" class="' + UI.input + ' w-full" value="' + esc((v ? v.city : '') + ' (vendor pickup)') + '"></div>' +
        '<div class="sm:col-span-2"><label class="' + UI.label + '" for="awb-event">First scan event</label><input id="awb-event" class="' + UI.input + ' w-full" value="Dispatched – LR shared with Proc Ops, in transit to Guwahati (GAU)"></div></div>' +
        '<p class="mt-3 text-xs text-slate-500">Saving moves the PO to <b>Dispatched</b>, adds a pickup scan event and starts tracking to Guwahati (GAU).</p>';
      footer = '<button type="button" class="' + UI.btn + '" onclick="closeModal()">Cancel</button><button type="button" class="' + UI.btnPrimary + '" onclick="saveAwb(\'' + po.poNumber + '\')">' + icon('save', 'w-4 h-4') + 'Save AWB</button>';
    }
  }
  openModal({ title: 'AWB & carrier · PO ' + po.poNumber, subtitle: esc(po.vendor) + ' · awarded ' + formatDate(po.poDate) + ' (' + po.daysSincePo + ' d ago)', body: body, footer: footer });
}

function awbWhatsappDraft(po) {
  return 'Tata Electronics (Jagi Road) – PO ' + po.poNumber + ', ' + po.materialDescription + ' (' + formatNum(po.quantity) + ' ' + po.uom + '): please share carrier name, AWB/LR no. and dispatch date today. Committed ETA ' + formatDate(po.committedEta) + '. – ' + currentUserName();
}
function copyAwbWhatsapp() {
  copyText(fieldVal('awb-wa')).then(function (ok) { showToast(ok ? 'WhatsApp text copied – paste it into WhatsApp (nothing sent from here)' : 'Copy blocked by the browser', ok ? 'success' : 'warn'); });
}
function copyAwbDraft() {
  var t = fieldVal('awb-draft');
  copyText(t).then(function (ok) { showToast(ok ? 'Draft copied to clipboard' : 'Copy blocked by the browser – select the text and copy manually', ok ? 'success' : 'warn'); });
}
function logAwbReminder(poNumber) {
  var po = findPO(poNumber);
  if (!po) return;
  recordFollowup(po, 'Email', 'AWB & carrier requested (draft copied)', isoDate(addDays(DEMO_TODAY, 1)));
  closeModal();
  showToast('AWB reminder logged (simulated) for PO ' + po.poNumber, 'success');
  rerender();
}

function saveAwb(poNumber) {
  if (!requirePerm('recordAwb')) return;
  var po = findPO(poNumber);
  if (!po) return;
  var awb = fieldVal('awb-no').trim().replace(/\s+/g, '');
  if (!/^[A-Za-z0-9-]{6,20}$/.test(awb)) { showToast('Enter a valid AWB (6–20 letters/digits).', 'error'); return; }
  var dupe = appState.pos.filter(function (p) { return p.awb === awb && p.poNumber !== po.poNumber; })[0];
  if (dupe) { showToast('AWB ' + awb + ' is already used on PO ' + dupe.poNumber + '.', 'error'); return; }
  var carrier = getCarrierByName(fieldVal('awb-carrier'));
  if (!carrier) { showToast('Pick a carrier.', 'error'); return; }
  var date = fieldVal('awb-date') || isoDate(DEMO_TODAY);
  var loc = fieldVal('awb-loc').trim() || 'Vendor pickup';
  po.awb = awb; po.carrier = carrier.name; po.carrierId = carrier.id;
  po.dispatchDate = date; po.stage = 'Dispatched';
  var scanTime = date === isoDate(DEMO_TODAY) ? nowStamp() : date + 'T17:00';
  po.scans.push({ time: scanTime, location: loc, event: (fieldVal('awb-event').trim() || 'Picked up from vendor') + ' (AWB recorded manually)' });
  po.lastScanTime = scanTime; po.currentLocation = loc;
  if (po.lineId) {
    var l = findLine(po.lineId, true);
    if (l) {
      if (l.currentStatus === 'PO STAGE' || l.currentStatus === 'NFA APPROVED') setLineStatus(l, 'IN-TRANSIT', 'AWB ' + awb);
      logActivity(l, 'AWB ' + awb + ' (' + carrier.name + ') recorded on PO ' + po.poNumber);
      addThreadMessage(l.id, { type: 'Update', text: 'Dispatched via ' + carrier.name + ', AWB ' + awb + '. Tracking to Guwahati (GAU).', assignedTo: l.user });
    }
  }
  closeModal();
  showToast('AWB recorded · PO ' + po.poNumber + ' moved to Dispatched', 'success');
  rerender();
}
