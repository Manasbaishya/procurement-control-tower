/* Communication thread drawer */
var THREAD_TYPES = ['Query', 'Info request', 'Info provided', 'Update', 'Decision'];
var THREAD_TYPE_STYLE = {
  'Query': ['circle-help', 'bg-blue-50 text-blue-700 border-blue-200'], 'Info request': ['circle-alert', 'bg-amber-50 text-amber-700 border-amber-200'],
  'Info provided': ['circle-check', 'bg-emerald-50 text-emerald-700 border-emerald-200'], 'Update': ['info', 'bg-slate-100 text-slate-700 border-slate-200'],
  'Decision': ['gavel', 'bg-violet-50 text-violet-700 border-violet-200']
};

function openThreadDrawer(lineId) {
  var l = findLine(lineId);
  if (!l) return;
  var msgs = appState.threads[l.id] || [];
  var list = msgs.length ? msgs.map(function (m) {
    var ts = THREAD_TYPE_STYLE[m.type] || THREAD_TYPE_STYLE.Update;
    return '<div class="rounded-lg border border-slate-200 p-3">' +
      '<div class="flex flex-wrap items-center gap-2"><span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ' + ts[1] + '">' + icon(ts[0], 'w-3 h-3') + esc(m.type) + '</span>' +
      (m.status ? '<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ' + (m.status === 'Open' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700') + '">' +
        icon(m.status === 'Open' ? 'circle-dot' : 'circle-check', 'w-3 h-3') + esc(m.status) + '</span>' : '') +
      '<span class="ml-auto text-xs text-slate-500">' + formatDateTime(m.timestamp) + '</span></div>' +
      '<p class="mt-2 text-sm text-slate-800">' + esc(m.text) + '</p>' +
      '<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span>' + icon('user', 'w-3 h-3 inline') + ' ' + esc(m.author) + ' (' + esc(m.role) + ')</span>' +
      (m.assignedTo ? '<span>→ ' + esc(m.assignedTo) + '</span>' : '') +
      (m.attachment ? '<span>' + icon('paperclip', 'w-3 h-3 inline') + ' ' + esc(m.attachment) + '</span>' : '') +
      (m.status === 'Open' ? '<button type="button" class="' + UI.btnSm + ' ml-auto" onclick="markAnswered(\'' + l.id + '\',\'' + m.id + '\')">' + icon('check', 'w-3 h-3') + 'Mark answered</button>' : '') +
      '</div></div>';
  }).join('') : emptyState('No messages on this line yet.');

  var people = [l.user, l.prCreator, l.assignedBuyer, l.userHod].concat(appState.buyers.map(function (b) { return b.name; }))
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  var isUser = appState.role === 'Requester';
  var defType = isUser ? 'Info provided' : 'Query';
  var recips = queryRecipients(l).map(function (r) { return '<span class="whitespace-nowrap">' + esc(r.name) + ' <span class="text-slate-500">(' + esc(r.role) + ', ' + esc(r.email) + ')</span></span>'; }).join('<br>');
  var compose = can('thread') ?
    '<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><div class="grid grid-cols-2 gap-2">' +
    '<div><label class="' + UI.label + '" for="th-type">Type</label><select id="th-type" class="' + UI.input + ' w-full" onchange="threadTypeChanged(this.value)">' + selectOptions(THREAD_TYPES, defType) + '</select></div>' +
    '<div id="th-assign-wrap"' + (isBuyerQueryType(defType) ? ' class="hidden"' : '') + '><label class="' + UI.label + '" for="th-assign">Assign to</label><select id="th-assign" class="' + UI.input + ' w-full">' + selectOptions(people, isUser ? l.assignedBuyer : l.user) + '</select></div>' +
    '<div id="th-auto" class="text-xs' + (isBuyerQueryType(defType) ? '' : ' hidden') + '"><span class="' + UI.label + '">Auto-assigned to</span>' + recips + '</div></div>' +
    (!isUser && QUERY_STAGES.indexOf(l.currentStatus) >= 0 ? '<p id="th-auto-note" class="mt-2 text-[11px] text-blue-700">' + icon('info', 'w-3 h-3 inline') + ' Posting a query moves this line to Info required. When the requester or PR creator replies it moves to Vendor outreach automatically.</p>' : '') +
    '<label class="' + UI.label + ' mt-2" for="th-text">Message</label><textarea id="th-text" rows="3" class="' + UI.input + ' w-full" placeholder="Write a message…"></textarea>' +
    '<div class="mt-2 flex flex-wrap items-center gap-2"><label class="' + UI.btnSm + ' cursor-pointer">' + icon('paperclip', 'w-3 h-3') + 'Attach<input id="th-file" type="file" class="hidden" onchange="document.getElementById(\'th-file-name\').textContent=this.files[0]?this.files[0].name:\'\'"></label>' +
    '<span id="th-file-name" class="text-xs text-slate-500"></span>' +
    '<button type="button" class="' + UI.btnPrimary + ' ml-auto" onclick="postThreadMessage(\'' + l.id + '\')">' + icon('send', 'w-4 h-4') + 'Post</button></div>' +
    '<p class="mt-1 text-[11px] text-slate-500">Posting logs the message in the tower only. Notifications are simulated.</p></div>' : '';

  openDrawer('Thread · ' + l.prNumber + ' / ' + l.line, esc(l.materialDescription),
    '<div class="space-y-2">' + list + '</div>' + compose,
    '<button type="button" class="' + UI.btn + '" onclick="openLineDrawer(\'' + l.id + '\')">' + icon('arrow-left', 'w-4 h-4') + 'Back to line</button>');
}

function postThreadMessage(lineId) {
  if (!requirePerm('thread')) return;
  var l = findLine(lineId);
  if (!l) return;
  var text = fieldVal('th-text').trim();
  if (!text) { showToast('Type a message first.', 'error'); return; }
  var type = fieldVal('th-type');
  if (THREAD_TYPES.indexOf(type) < 0) { showToast('Pick a message type.', 'error'); return; }
  var fileEl = document.getElementById('th-file');
  var att = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0].name : '';
  var me = currentUserName(), isUserSide = appState.role === 'Requester' || me === l.user || me === l.prCreator;
  var prev = l.currentStatus;
  if (isBuyerQueryType(type) && !isUserSide) {
    raiseBuyerQuery(l, text, type, null, att);
    showToast(type + ' sent to ' + recipientsLabel(l) + ' (notification simulated)' + (prev !== l.currentStatus ? ' · line moved to INFO REQUIRED' : ''), 'success');
  } else if (type === 'Info provided' && isUserSide) {
    recordUserReply(l, text, att);
    showToast('Reply logged' + (prev === 'INFO REQUIRED' ? ' · ticket moved to VENDOR OUTREACH' : ''), 'success');
  } else {
    addThreadMessage(l.id, { type: type, text: text, assignedTo: fieldVal('th-assign'), attachment: att, status: isBuyerQueryType(type) ? 'Open' : null });
    logActivity(l, type + ' posted on thread');
    showToast('Message logged (notification simulated)', 'success');
  }
  afterAction(function () { openThreadDrawer(lineId); });
}
function isBuyerQueryType(t) { return t === 'Query' || t === 'Info request'; }
function threadTypeChanged(t) {
  var auto = isBuyerQueryType(t) && appState.role !== 'Requester';
  var w = document.getElementById('th-assign-wrap'), a = document.getElementById('th-auto');
  if (w) w.classList.toggle('hidden', auto);
  if (a) a.classList.toggle('hidden', !auto);
}

function markAnswered(lineId, msgId) {
  var msgs = appState.threads[lineId] || [];
  var m = null;
  for (var i = 0; i < msgs.length; i++) if (msgs[i].id === msgId) m = msgs[i];
  if (!m) { showToast('Message not found.', 'error'); return; }
  m.status = 'Answered';
  var l = findLine(lineId, true);
  if (l) logActivity(l, m.type + ' marked answered');
  showToast('Marked answered', 'success');
  afterAction(function () { openThreadDrawer(lineId); });
}
