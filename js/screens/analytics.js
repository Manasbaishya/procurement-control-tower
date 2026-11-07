/* Analytics: cycle time by category, buyer load vs capacity, buyer × stage latency heatmap, SLA compliance */
function renderAnalyticsScreen() {
  var recent = appState.execRecords.filter(function (r) { return r.monthIdx >= 19; });
  var byCat = appState.categories.map(function (c) {
    var rs = recent.filter(function (r) { return r.category === c.name; });
    return { name: c.name, avg: rs.length ? rs.reduce(function (s, r) { return s + r.cycleTotal; }, 0) / rs.length : 0, n: rs.length };
  }).sort(function (a, b) { return b.avg - a.avg; });
  var maxC = Math.max.apply(null, byCat.map(function (x) { return x.avg; }).concat([8]));
  var catBars = byCat.map(function (x) {
    var over = x.avg > 7;
    return '<div class="grid grid-cols-[11rem_1fr_4.5rem] items-center gap-2 py-0.5 text-xs"><span class="truncate text-slate-700" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' +
      '<span class="relative h-3.5 rounded bg-slate-100"><span class="absolute inset-y-0 left-0 rounded ' + (over ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + (x.avg / maxC * 100) + '%"></span>' +
      '<span class="absolute inset-y-[-3px] w-0.5 bg-slate-700" style="left:' + (7 / maxC * 100) + '%" title="7-day target"></span></span>' +
      '<span class="text-right ' + (over ? 'font-semibold text-amber-700' : 'text-slate-600') + '">' + (over ? '▲ ' : '') + formatNum(x.avg, 1) + ' d</span></div>';
  }).join('');

  var buyerBars = appState.buyers.slice().sort(function (a, b) { return b.openLines - a.openLines; }).map(function (b) {
    var pct = loadPct(b);
    return '<div class="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 py-1 text-xs"><span class="text-slate-700">' + esc(b.name) + (b.ooo ? oooBadge() : '') + '</span>' +
      '<span class="relative h-4 rounded bg-slate-100"><span class="absolute inset-y-0 left-0 rounded ' + (pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-blue-500') + '" style="width:' + Math.min(100, pct / 1.2) + '%"></span>' +
      '<span class="absolute inset-y-[-3px] w-0.5 bg-slate-700" style="left:' + (100 / 1.2) + '%" title="90-line capacity"></span></span>' +
      '<span class="text-right ' + (pct > 100 ? 'font-semibold text-red-700' : pct > 85 ? 'font-semibold text-amber-700' : 'text-slate-600') + '">' + (pct > 100 ? icon('circle-alert', 'w-3 h-3 inline') + ' ' : '') + b.openLines + ' / ' + b.capacity + '</span></div>';
  }).join('');

  var head = '<th class="' + UI.th + '">Buyer</th>' + PIPELINE_STAGES.map(function (k) { return '<th class="' + UI.th + ' text-center">' + esc(stageByKey(k).label) + '</th>'; }).join('');
  var heat = appState.buyers.map(function (b) {
    return '<tr><td class="' + UI.td + ' whitespace-nowrap text-xs font-medium">' + esc(b.name) + '</td>' + PIPELINE_STAGES.map(function (k) {
      var ls = appState.lines.filter(function (l) { return l.assignedBuyer === b.name && l.currentStatus === k; });
      if (!ls.length) return '<td class="' + UI.td + ' heat-cell text-center text-xs text-slate-300">—</td>';
      var avg = ls.reduce(function (s, l) { return s + l.daysInStatus; }, 0) / ls.length;
      var ratio = avg / stageByKey(k).sla;
      var bg = ratio > 1 ? 'bg-red-100 text-red-800' : ratio > 0.75 ? 'bg-amber-100 text-amber-800' : ratio > 0.4 ? 'bg-blue-100 text-blue-800' : 'bg-blue-50 text-blue-700';
      return '<td class="' + UI.td + ' heat-cell text-center text-xs ' + bg + '" title="' + ls.length + ' lines, SLA ' + stageByKey(k).sla + ' d">' + (ratio > 1 ? '⚠ ' : '') + formatNum(avg, 1) + ' d<div class="text-[10px] opacity-70">' + ls.length + ' ln</div></td>';
    }).join('') + '</tr>';
  }).join('');

  var overall = slaCompliance(appState.lines);
  var perStage = PIPELINE_STAGES.map(function (k) {
    var ls = appState.lines.filter(function (l) { return l.currentStatus === k; });
    var ok = ls.filter(function (l) { return slaInfo(l).state !== 'breach'; }).length;
    var pct = ls.length ? Math.round(ok / ls.length * 100) : 100;
    return '<div class="flex items-center justify-between py-1 text-xs"><span class="text-slate-600">' + esc(stageByKey(k).label) + '</span><span class="' + (pct < 85 ? 'font-semibold text-red-700' : 'text-slate-700') + '">' + (pct < 85 ? icon('circle-alert', 'w-3 h-3 inline') + ' ' : '') + pct + '%</span></div>';
  }).join('');

  return pageHeader('Analytics', 'Operational analytics on sample data · cycle times from the last 6 months of awarded POs') +
    '<div class="grid gap-5 xl:grid-cols-2">' +
    '<section class="' + UI.card + ' p-4"><h2 class="mb-1 text-sm font-semibold text-slate-800">Average PR → PO cycle time by category</h2><p class="mb-2 text-[11px] text-slate-500">Black marker = 7-day target · ▲ above target</p>' + catBars + '</section>' +
    '<div class="space-y-5"><section class="' + UI.card + ' p-4"><h2 class="mb-1 text-sm font-semibold text-slate-800">Buyer open lines vs 90-line capacity</h2><p class="mb-2 text-[11px] text-slate-500">Marker = capacity · amber above 85% · red above 100%</p>' + buyerBars + '</section>' +
    '<section class="' + UI.card + ' p-4"><div class="flex items-center justify-between"><h2 class="text-sm font-semibold text-slate-800">Overall SLA compliance</h2><span class="text-2xl font-bold ' + (overall >= 90 ? 'text-emerald-700' : 'text-red-700') + '">' + overall + '%</span></div>' +
    '<p class="mb-2 text-[11px] text-slate-500">Open lines within stage SLA · target 90%</p><div class="grid grid-cols-2 gap-x-6">' + perStage + '</div></section></div></div>' +
    '<section class="' + UI.card + ' mt-5"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">Buyer × stage latency (avg days in status)</h2><p class="text-[11px] text-slate-500">⚠ and red = average over stage SLA · amber = above 75% of SLA</p></div>' +
    '<div class="overflow-x-auto"><table class="min-w-full"><thead><tr>' + head + '</tr></thead><tbody class="divide-y divide-slate-100">' + heat + '</tbody></table></div></section>';
}
