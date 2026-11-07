/* User Pending Actions: lines waiting on requester clarification */
function pendingInfoLines() {
  return appState.lines.filter(function (l) {
    return l.currentStatus === 'INFO REQUIRED' && (appState.role !== 'Buyer' || l.assignedBuyer === currentUserName());
  }).sort(function (a, b) { return b.daysInStatus - a.daysInStatus; });
}
function escalationNote(l) {
  var esc24 = appState.settings.escalation;
  if (!esc24.enabled) return { text: 'Escalation off', icon: 'bell-off', cls: 'text-slate-500' };
  var hours = l.daysInStatus * 24;
  if (hours >= esc24.hours) return { text: 'Escalated to HOD ' + l.userHod + ' (' + esc24.hours + 'h rule)', icon: 'triangle-alert', cls: 'text-red-700' };
  return { text: 'Escalates to ' + l.userHod + ' in ' + Math.ceil(esc24.hours - hours) + 'h', icon: 'clock', cls: 'text-amber-700' };
}
function renderUserPendingScreen() {
  var list = pendingInfoLines();
  var escalated = list.filter(function (l) { return escalationNote(l).cls === 'text-red-700'; }).length;
  var rows = list.map(function (l) {
    var e = escalationNote(l);
    var nextIn = Math.max(0, Math.round((1 - (l.daysInStatus % 1)) * 24));
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '<div class="text-xs text-slate-500">' + esc(l.materialDescription) + '</div></td>' +
      '<td class="' + UI.td + ' text-xs">' + queryRecipients(l).map(function (r) { return esc(r.name) + ' <span class="text-slate-500">(' + esc(r.role) + ')</span><div class="text-[11px] text-slate-500">' + esc(r.email) + '</div>'; }).join('') +
      '<div class="text-slate-500">HOD: ' + esc(l.userHod) + '</div></td>' +
      '<td class="' + UI.td + '"><ul class="list-disc pl-4 text-xs">' + l.missingItems.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></td>' +
      '<td class="' + UI.td + ' text-right">' + formatNum(l.daysInStatus, 1) + ' d</td><td class="' + UI.td + ' text-center">' + l.remindersCount + '</td>' +
      '<td class="' + UI.td + ' text-xs">in ' + nextIn + 'h</td>' +
      '<td class="' + UI.td + ' text-xs ' + e.cls + '">' + icon(e.icon, 'w-3 h-3 inline') + ' ' + esc(e.text) + '</td>' +
      '<td class="' + UI.td + '"><div class="flex flex-wrap gap-1">' +
      (can('remind') ? '<button type="button" class="' + UI.btnSm + '" onclick="sendInfoReminder(\'' + l.id + '\')">' + icon('bell', 'w-3 h-3') + 'Remind (simulated)</button>' : '') +
      '<button type="button" class="' + UI.btnSm + '" onclick="openThreadDrawer(\'' + l.id + '\')">' + icon('message-square', 'w-3 h-3') + 'Thread</button>' +
      '<button type="button" class="' + UI.btnSm + '" onclick="openLineDrawer(\'' + l.id + '\')">Open</button></div></td></tr>';
  }).join('');
  return pageHeader('User pending actions', 'Lines blocked on requester clarification' + (appState.role === 'Buyer' ? ' · ' + esc(currentUserName()) + '’s lines' : ' · all buyers')) +
    '<div class="mb-4 grid grid-cols-3 gap-3">' + kpiTile('Waiting on requester', list.length, 'INFO REQUIRED lines', 'circle-help', 'amber') +
    kpiTile('Escalated to HOD', escalated, appState.settings.escalation.enabled ? 'After ' + appState.settings.escalation.hours + 'h without reply' : 'Escalation disabled in Settings', 'triangle-alert', 'red') +
    kpiTile('Reminders sent', list.reduce(function (s, l) { return s + l.remindersCount; }, 0), 'Logged, delivery simulated', 'bell', 'slate') + '</div>' +
    '<section class="' + UI.card + '">' + (rows ? tableWrap(ths(['Line', 'Assigned to (requester + PR creator)', 'Missing items', 'Waiting', 'Reminders', 'Next reminder', 'Escalation', '']), rows) : emptyState('No lines waiting on requesters.')) + '</section>';
}
function sendInfoReminder(lineId) {
  if (!requirePerm('remind')) return;
  var l = findLine(lineId);
  if (!l) return;
  if (l.currentStatus !== 'INFO REQUIRED') { showToast('Line is no longer waiting on the requester.', 'error'); return; }
  l.remindersCount++;
  var to = queryRecipients(l);
  logActivity(l, 'Reminder #' + l.remindersCount + ' logged to ' + to.map(function (r) { return r.name + ' <' + r.email + '>'; }).join(' and ') + ' (simulated)');
  addThreadMessage(l.id, { type: 'Info request', text: 'Reminder #' + l.remindersCount + ': please share ' + l.missingItems.join(', ') + '.', assignedTo: recipientsLabel(l), status: 'Open' });
  showToast('Reminder logged (simulated) to ' + recipientsLabel(l), 'success');
  rerender();
}
