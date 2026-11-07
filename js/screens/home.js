/* Home: KPI tiles, pipeline by stage, action-required list */
function scopeLines() {
  if (appState.role === 'Requester') return appState.lines.filter(function (l) { return l.user === currentUserName(); });
  return appState.lines;
}
function slaCompliance(lines) {
  var withSla = lines.filter(function (l) { return isOpen(l) && slaInfo(l).state !== 'na'; });
  if (!withSla.length) return 100;
  return Math.round(withSla.filter(function (l) { return slaInfo(l).state !== 'breach'; }).length / withSla.length * 100);
}
function actionRequiredLines(lines) {
  return lines.filter(function (l) {
    if (!isOpen(l)) return false;
    var s = slaInfo(l);
    return (l.currentStatus === 'INFO REQUIRED' && (l.remindersCount >= 2 || s.state === 'breach')) ||
      (l.currentStatus === 'ON HOLD') || (s.state === 'breach' && !(stageByKey(l.currentStatus) || {}).controllable);
  }).sort(function (a, b) { return slaInfo(b).ratio - slaInfo(a).ratio; });
}

function renderHomeScreen() {
  var lines = scopeLines();
  var open = lines.filter(isOpen);
  function cnt(st) { return lines.filter(function (l) { return l.currentStatus === st; }).length; }
  var compliance = slaCompliance(lines);
  var target = 90;
  var kpis = '<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">' +
    kpiTile('Total active', formatNum(open.length), formatINRShort(open.reduce(function (s, l) { return s + l.estimatedValue; }, 0)) + ' est. value', 'layers', 'blue', "homeGo('')") +
    kpiTile('Info required', formatNum(cnt('INFO REQUIRED')), 'Waiting on requesters', 'circle-help', 'amber', "homeGo('INFO REQUIRED')") +
    kpiTile('PO stage', formatNum(cnt('PO STAGE') + cnt('NFA APPROVED')), cnt('NFA APPROVED') + ' NFA approved · ' + cnt('PO STAGE') + ' PO stage', 'file-check', 'violet', "homeGo('PO STAGE')") +
    kpiTile('In transit', formatNum(cnt('IN-TRANSIT')), 'To Guwahati (GAU) → Jagi Road', 'truck', 'cyan', "homeGo('IN-TRANSIT')") +
    kpiTile('GRN closed', formatNum(cnt('GRN COMPLETED') + cnt('CLOSED')), cnt('CLOSED') + ' closed · ' + cnt('GRN COMPLETED') + ' GRN done', 'package-check', 'green', "homeGo('CLOSED')") +
    kpiTile('SLA target', compliance + '%', (compliance >= target ? icon('circle-check', 'w-3 h-3 inline text-emerald-600') + ' meets ' : icon('circle-alert', 'w-3 h-3 inline text-red-600') + ' below ') + target + '% target', 'target', compliance >= target ? 'green' : 'red') +
    '</div>';

  var max = 1;
  PIPELINE_STAGES.forEach(function (k) { max = Math.max(max, cnt(k)); });
  var pipe = PIPELINE_STAGES.map(function (k, i) {
    var st = stageByKey(k), n = cnt(k);
    var br = lines.filter(function (l) { return l.currentStatus === k && slaInfo(l).state === 'breach'; }).length;
    return '<button type="button" class="group grid w-full grid-cols-[9rem_1fr_5.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50" onclick="homeGoIdx(' + i + ')">' +
      '<span class="flex items-center gap-2 text-sm text-slate-700">' + icon(st.icon, 'w-4 h-4 text-slate-400') + esc(st.label) + '</span>' +
      '<span class="h-5 rounded bg-slate-100"><span class="flex h-5 items-center rounded bg-blue-500 px-2 text-[11px] font-semibold text-white" style="min-width:2rem;width:' + Math.max(4, n / max * 100) + '%">' + n + '</span></span>' +
      '<span class="text-right text-xs ' + (br ? 'text-red-700' : 'text-slate-400') + '">' + (br ? icon('circle-alert', 'w-3 h-3 inline') + ' ' + br + ' breached' : 'SLA ' + st.sla + ' d') + '</span></button>';
  }).join('');

  var act = actionRequiredLines(lines).slice(0, 12);
  var actRows = act.map(function (l) {
    var why = l.currentStatus === 'ON HOLD' ? 'On hold' : l.remindersCount >= 2 ? 'Escalated · ' + l.remindersCount + ' reminders' : 'Blocked · SLA breached';
    return '<tr><td class="' + UI.td + '">' + lineRef(l) + '<div class="text-xs text-slate-500">' + esc(l.materialDescription) + '</div></td>' +
      '<td class="' + UI.td + '">' + statusBadge(l.currentStatus) + '</td><td class="' + UI.td + '">' + slaBadge(l) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(why) + '</td><td class="' + UI.td + ' text-xs">' + esc(l.assignedBuyer) + '</td>' +
      '<td class="' + UI.td + '"><button type="button" class="' + UI.btnSm + '" onclick="openLineDrawer(\'' + l.id + '\')">Open</button></td></tr>';
  }).join('');

  return pageHeader(appState.role === 'Requester' ? 'My requests' : 'Control tower overview',
    'Every PR line from intake to GRN closure · ' + esc(SITE.plant) + ' · as of ' + formatDate(DEMO_TODAY)) +
    kpis +
    '<div class="mt-5 grid gap-5 2xl:grid-cols-5">' +
    '<section class="' + UI.card + ' p-4 2xl:col-span-2"><h2 class="mb-2 text-sm font-semibold text-slate-800">Pipeline by stage</h2>' + pipe +
    '<p class="mt-2 text-[11px] text-slate-500">Click a stage to open All Requests filtered to it.</p></section>' +
    '<section class="' + UI.card + ' 2xl:col-span-3"><div class="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">' + icon('triangle-alert', 'w-4 h-4 inline text-amber-600') + ' Action required: blocked / escalated lines</h2>' +
    '<span class="text-xs text-slate-500">' + actionRequiredLines(lines).length + ' lines</span></div>' +
    (act.length ? tableWrap(ths(['Line', 'Status', 'SLA', 'Why', 'Buyer', '']), actRows) : emptyState('Nothing blocked right now.')) + '</section></div>';
}
function homeGo(status) {
  appState.ui.allStatus = status; appState.ui.allPage = 0; appState.ui.allSearch = ''; appState.ui.allBuyer = ''; appState.ui.allCategory = '';
  navigate('all-requests');
}
function homeGoIdx(i) { if (!PIPELINE_STAGES[i]) { showToast('Unknown stage', 'error'); return; } homeGo(PIPELINE_STAGES[i]); }
