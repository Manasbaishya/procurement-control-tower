/* Settings: carrier tracking-URL templates, follow-up rule thresholds, escalation */
function renderSettingsScreen() {
  var s = appState.settings, edit = can('settings');
  var carriers = appState.carriers.map(function (c) {
    return '<tr><td class="' + UI.td + ' font-medium whitespace-nowrap">' + esc(c.name) + '</td>' +
      '<td class="' + UI.td + ' w-full"><input class="' + UI.input + ' w-full font-mono text-xs" aria-label="Tracking URL for ' + esc(c.name) + '" value="' + esc(c.template) + '" onchange="setCarrierTemplate(\'' + c.id + '\',this.value)"' + (edit ? '' : ' disabled') + '></td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnSm + '" onclick="testCarrier(\'' + c.id + '\')">' + icon('external-link', 'w-3 h-3') + 'Test</button></td></tr>';
  }).join('');
  function ruleInput(k, label) {
    return '<div><label class="' + UI.label + '" for="rule-' + k + '">' + label + '</label><div class="flex items-center gap-2"><input id="rule-' + k + '" type="number" min="1" max="60" value="' + s.rules[k] + '" class="' + UI.input + ' w-24" onchange="setRule(\'' + k + '\',this.value)"' + (edit ? '' : ' disabled') + '><span class="text-xs text-slate-500">days · flags ' + getFollowUpLines(k).length + ' PO(s) now</span></div></div>';
  }
  return pageHeader('Settings', edit ? 'Changes apply immediately (kept in this browser session only)' : 'Read-only for your role') +
    '<div class="grid gap-5 xl:grid-cols-3"><section class="' + UI.card + ' xl:col-span-2"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">Carrier tracking-URL templates</h2>' +
    '<p class="text-[11px] text-slate-500">Use {AWB} where the airway bill number goes. "Test" opens the link with a sample AWB.</p></div>' + tableWrap(ths(['Carrier', 'Template', '']), carriers) + '</section>' +
    '<div class="space-y-5"><section class="' + UI.card + ' space-y-3 p-4"><h2 class="text-sm font-semibold text-slate-800">Delivery follow-up rules</h2>' +
    ruleInput('A', 'Rule A – AWB not shared more than … after PO') + ruleInput('B', 'Rule B – no carrier scan for more than …') + ruleInput('C', 'Rule C – at Guwahati hub, not delivered, more than …') +
    '<p class="text-xs text-slate-500">Rule D (committed ETA missed) has no threshold. Delivery Follow-Up uses these values live.</p></section>' +
    '<section class="' + UI.card + ' p-4"><h2 class="text-sm font-semibold text-slate-800">Escalation</h2>' +
    '<label class="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" ' + (s.escalation.enabled ? 'checked' : '') + ' onchange="setEscalation(this.checked)"' + (edit ? '' : ' disabled') + '> Escalate unanswered info requests to the requester’s HOD</label>' +
    '<label class="' + UI.label + ' mt-3" for="esc-hours">After (hours)</label><input id="esc-hours" type="number" min="1" max="168" value="' + s.escalation.hours + '" class="' + UI.input + ' w-24" onchange="setEscalationHours(this.value)"' + (edit ? '' : ' disabled') + '>' +
    '<p class="mt-2 text-xs text-slate-500">Escalations are shown in the tower. No email or WhatsApp is sent (simulated).</p></section></div></div>';
}
function setCarrierTemplate(id, v) {
  if (!requirePerm('settings')) return;
  var c = getCarrierByName(id); if (!c) { showToast('Carrier not found.', 'error'); return; }
  v = String(v).trim();
  if (v.indexOf('{AWB}') < 0 || !/^https?:\/\//.test(v)) { showToast('Template must start with http(s):// and contain {AWB}.', 'error'); rerender(); return; }
  c.template = v;
  showToast(c.name + ' template saved', 'success');
}
function testCarrier(id) {
  var c = getCarrierByName(id); if (!c) { showToast('Carrier not found.', 'error'); return; }
  var po = appState.pos.filter(function (p) { return p.carrierId === c.id && p.awb; })[0];
  var url = c.template.split('{AWB}').join(encodeURIComponent(po ? po.awb : '1234567890'));
  var w = window.open(url, '_blank', 'noopener');
  showToast('Opened ' + c.name + ' test link' + (po ? ' with AWB ' + po.awb : '') + (w ? '' : ' (pop-up blocked)'), w ? 'info' : 'warn');
}
function setRule(k, v) {
  if (!requirePerm('settings')) return;
  var n = Math.round(Number(v));
  if (!(n >= 1 && n <= 60)) { showToast('Enter 1–60 days.', 'error'); rerender(); return; }
  appState.settings.rules[k] = n;
  showToast('Rule ' + k + ' threshold set to ' + n + ' days', 'success');
  rerender();
}
function setEscalation(on) { if (!requirePerm('settings')) return; appState.settings.escalation.enabled = !!on; showToast('Escalation ' + (on ? 'on' : 'off'), 'success'); rerender(); }
function setEscalationHours(v) {
  if (!requirePerm('settings')) return;
  var n = Math.round(Number(v));
  if (!(n >= 1 && n <= 168)) { showToast('Enter 1–168 hours.', 'error'); rerender(); return; }
  appState.settings.escalation.hours = n; showToast('Escalation after ' + n + 'h', 'success'); rerender();
}
