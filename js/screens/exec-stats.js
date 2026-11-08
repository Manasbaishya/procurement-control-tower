/* =====================================================================
   Exec Stats – leadership dashboard. All charts are hand-drawn inline
   SVG built as strings, so a re-render replaces (never appends) them.
   ===================================================================== */
var CATEGORY_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04', '#4f46e5', '#0d9488', '#be123c',
  '#9333ea', '#65a30d', '#0284c7', '#c2410c', '#15803d', '#a21caf', '#b45309', '#1d4ed8', '#047857', '#6d28d9'];
var OTHER_COLOR = '#94a3b8';
var STAGE_BLUES = ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e3a8a'];
var CYCLE_PARTS = [['approval', 'PR approval', '#bfdbfe'], ['sourcing', 'Sourcing / RFQ', '#60a5fa'], ['commercials', 'Commercials & NFA', '#2563eb'], ['release', 'PO release', '#1e3a8a']];
var AGE_BUCKETS = [['0–7 d', 0, 7], ['8–15 d', 8, 15], ['16–30 d', 16, 30], ['31–60 d', 31, 60], ['60+ d', 61, 99999]];
var EXEC_LAST = 24; // monthIdx of the current month (Nov 2026)

function categoryColor(name) {
  for (var i = 0; i < appState.categories.length; i++) if (appState.categories[i].name === name) return CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  return OTHER_COLOR;
}
function execMonthKeys(from, to) {
  var out = [];
  for (var i = from; i <= to; i++) { var d = new Date(2024, 10 + i, 1); out.push(d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1)); }
  return out;
}
function execScope() {
  var ui = appState.ui, P = ui.execPeriod;
  return { P: P, cur: [EXEC_LAST - P + 1, EXEC_LAST], prev: [Math.max(0, EXEC_LAST - 2 * P + 1), EXEC_LAST - P], cat: ui.execCategory, buyer: ui.execBuyer };
}
function execRecs(range, sc, opts) {
  opts = opts || {};
  var cat = opts.cat !== undefined ? opts.cat : sc.cat;
  return appState.execRecords.filter(function (r) {
    return r.monthIdx >= range[0] && r.monthIdx <= range[1] && (!cat || r.category === cat) && (!sc.buyer || r.buyer === sc.buyer);
  });
}
function execLines(sc) {
  return appState.lines.filter(function (l) { return isOpen(l) && (!sc.cat || l.category === sc.cat) && (!sc.buyer || l.assignedBuyer === sc.buyer); });
}
function sumBy(rs, f) { var s = 0; for (var i = 0; i < rs.length; i++) s += f(rs[i]); return s; }
function avgBy(rs, f) { return rs.length ? sumBy(rs, f) / rs.length : 0; }
function niceMax(v) {
  if (v <= 0) return 1;
  var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/* ---------- KPI maths ---------- */
function execKpis(sc) {
  var cur = execRecs(sc.cur, sc), prev = execRecs(sc.prev, sc);
  var all = appState.execRecords.filter(function (r) { return (!sc.cat || r.category === sc.cat) && (!sc.buyer || r.buyer === sc.buyer); });
  function openAt(end) { return sumBy(all.filter(function (r) { return r.monthIdx <= end && r.grnMonth > end; }), function (r) { return r.poValue; }); }
  function savings(rs) { var e = sumBy(rs, function (r) { return r.prEstimate; }); return e ? (e - sumBy(rs, function (r) { return r.poValue; })) / e * 100 : 0; }
  function ontime(rs) { var d = rs.filter(function (r) { return r.grnMonth <= EXEC_LAST; }); return d.length ? d.filter(function (r) { return r.onTime; }).length / d.length * 100 : 0; }
  var fyStart = 17; // Apr 2026
  return {
    spend: { cur: sumBy(cur, function (r) { return r.poValue; }), prev: sumBy(prev, function (r) { return r.poValue; }),
      ytd: sumBy(all.filter(function (r) { return r.monthIdx >= fyStart; }), function (r) { return r.poValue; }) },
    open: { cur: openAt(EXEC_LAST), prev: openAt(EXEC_LAST - sc.P) },
    cycle: { cur: avgBy(cur, function (r) { return r.cycleTotal; }), prev: avgBy(prev, function (r) { return r.cycleTotal; }) },
    ontime: { cur: ontime(cur), prev: ontime(prev) },
    savings: { cur: savings(cur), prev: savings(prev) },
    pastSla: { cur: cur.filter(function (r) { return r.slaBreached; }).length, prev: prev.filter(function (r) { return r.slaBreached; }).length,
      openNow: execLines(sc).filter(function (l) { return slaInfo(l).state === 'breach'; }).length },
    count: cur.length
  };
}
function deltaHtml(cur, prev, better, kind) {
  if (!prev && kind !== 'pp' && kind !== 'd') return '<span class="text-xs text-slate-400">no prior data</span>';
  var diff = cur - prev, up = diff > 0, flat = Math.abs(diff) < 1e-9;
  var txt = kind === 'pp' ? formatNum(Math.abs(diff), 1) + ' pp' : kind === 'd' ? formatNum(Math.abs(diff), 1) + ' d' : formatNum(Math.abs(diff / prev * 100), 1) + '%';
  var good = better === 'neutral' || flat ? null : (better === 'up') === up;
  var cls = good === null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-red-700';
  return '<span class="text-xs font-semibold ' + cls + '">' + (flat ? '■ ' : up ? '▲ ' : '▼ ') + txt + '</span> <span class="text-xs text-slate-400">vs prior ' + appState.ui.execPeriod + 'M</span>';
}
function execKpiTile(label, value, delta, sub, iconName) {
  return '<div class="' + UI.card + ' p-4"><div class="flex items-center justify-between"><span class="text-xs font-semibold uppercase tracking-wide text-slate-500">' + esc(label) + '</span>' + icon(iconName, 'w-4 h-4 text-slate-400') + '</div>' +
    '<div class="mt-2 text-2xl font-bold text-slate-900">' + value + '</div><div class="mt-1">' + delta + '</div>' + (sub ? '<div class="mt-1 text-xs text-slate-500">' + sub + '</div>' : '') + '</div>';
}

/* ---------- chart card wrapper with Table toggle ---------- */
function execCard(id, title, subtitle, chartHtml, tableHtml, extra, span) {
  var asTable = !!appState.ui.execTables[id];
  return '<section class="' + UI.card + ' ' + (span || '') + '" id="exec-' + id + '"><div class="flex flex-wrap items-start gap-2 border-b border-slate-200 px-4 py-3"><div class="min-w-0 flex-1"><h2 class="text-sm font-semibold text-slate-800">' + esc(title) + '</h2>' +
    (subtitle ? '<p class="text-[11px] text-slate-500">' + subtitle + '</p>' : '') + '</div>' + (extra || '') +
    '<button type="button" class="' + UI.btnSm + '" aria-pressed="' + asTable + '" onclick="execToggleTable(\'' + id + '\')">' + icon(asTable ? 'chart-no-axes-column' : 'table', 'w-3 h-3') + (asTable ? 'Chart' : 'Table') + '</button></div>' +
    '<div class="exec-chart relative p-4">' + (asTable ? tableHtml : chartHtml) + '</div></section>';
}
function miniTable(head, rows) {
  return tableWrap(ths(head), rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<td class="' + UI.td + (i ? ' text-right whitespace-nowrap' : '') + ' text-xs">' + c + '</td>'; }).join('') + '</tr>'; }).join(''));
}

/* ---------- 1. Spend by category, month on month (line chart) ---------- */
function execSpendSeries(sc) {
  var months = execMonthKeys(sc.cur[0], sc.cur[1]);
  var recs = execRecs(sc.cur, sc);
  var totals = {};
  recs.forEach(function (r) { totals[r.category] = (totals[r.category] || 0) + r.poValue; });
  var top = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, 7);
  var series = top.map(function (c) { return { name: c, color: categoryColor(c), values: months.map(function () { return 0; }) }; });
  var other = { name: 'Other', color: OTHER_COLOR, values: months.map(function () { return 0; }) };
  var monthTotal = months.map(function () { return 0; });
  recs.forEach(function (r) {
    var mi = r.monthIdx - sc.cur[0], k = top.indexOf(r.category);
    (k >= 0 ? series[k] : other).values[mi] += r.poValue;
    monthTotal[mi] += r.poValue;
  });
  if (other.values.some(function (v) { return v > 0; })) series.push(other);
  return { months: months, series: series, monthTotal: monthTotal };
}
function execLineChart(sc) {
  var d = execSpendSeries(sc), share = appState.ui.execMode === 'share';
  var W = 760, H = 300, pl = 66, pr = 16, pt = 14, pb = 34, n = d.months.length;
  var step = n > 1 ? (W - pl - pr) / (n - 1) : 0;
  var vals = d.series.map(function (s) { return s.values.map(function (v, i) { return share ? (d.monthTotal[i] ? v / d.monthTotal[i] * 100 : 0) : v; }); });
  var max = niceMax(Math.max.apply(null, [1].concat([].concat.apply([], vals))));
  function x(i) { return pl + (n > 1 ? i * step : (W - pl - pr) / 2); }
  function y(v) { return pt + (H - pt - pb) * (1 - v / max); }
  var g = '';
  for (var t = 0; t <= 4; t++) {
    var tv = max * t / 4;
    g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" stroke="#e2e8f0"/>' +
      '<text x="' + (pl - 8) + '" y="' + (y(tv) + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' + (share ? Math.round(tv) + '%' : esc(formatINRShort(tv))) + '</text>';
  }
  d.months.forEach(function (m, i) { g += '<text x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="11" fill="#64748b">' + esc(monthLabel(m)) + '</text>'; });
  d.series.forEach(function (s, k) {
    var pts = vals[k].map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
    g += '<polyline fill="none" stroke="' + s.color + '" stroke-width="' + (s.name === 'Other' ? 2 : 2.4) + '" ' + (s.name === 'Other' ? 'stroke-dasharray="5 4" ' : '') + 'points="' + pts + '"><title>' + esc(s.name) + '</title></polyline>';
    vals[k].forEach(function (v, i) { g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="2.6" fill="' + s.color + '"/>'; });
  });
  window.__execLine = { months: d.months, series: d.series.map(function (s, k) { return { name: s.name, color: s.color, values: vals[k] }; }), share: share, W: W, pl: pl, step: step, n: n };
  g += '<line id="exl-cross" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#334155" stroke-dasharray="3 3" visibility="hidden"/>' +
    '<rect x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '" fill="transparent" onmousemove="execLineHover(evt)" onmouseleave="execLineLeave()"/>';
  var legend = '<ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">' + d.series.map(function (s) {
    return '<li class="flex items-center gap-1.5"><span class="inline-block h-0.5 w-4" style="background:' + s.color + (s.name === 'Other' ? ';border-top:2px dashed ' + s.color + ';background:none' : '') + '"></span>' + esc(s.name) + '</li>';
  }).join('') + '</ul>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="Spend by category month on month">' + g + '</svg>' +
    '<div id="exl-tip" class="chart-tooltip hidden rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-lg"></div>' + legend;
}
function execLineTable(sc) {
  var d = execSpendSeries(sc), share = appState.ui.execMode === 'share';
  return miniTable(['Category'].concat(d.months.map(monthLabel)).concat(['Total']), d.series.map(function (s) {
    var tot = sumBy(s.values, function (v) { return v; });
    return [esc(s.name)].concat(s.values.map(function (v, i) { return share ? formatNum(d.monthTotal[i] ? v / d.monthTotal[i] * 100 : 0, 1) + '%' : formatINRShort(v); }))
      .concat([share ? formatNum(tot / (sumBy(d.monthTotal, function (v) { return v; }) || 1) * 100, 1) + '%' : formatINRShort(tot)]);
  }));
}
function execLineHover(evt) {
  var d = window.__execLine; if (!d || !d.n) return;
  var svg = evt.currentTarget.ownerSVGElement, box = svg.getBoundingClientRect();
  var scale = d.W / box.width, vx = (evt.clientX - box.left) * scale;
  var i = d.n > 1 ? Math.max(0, Math.min(d.n - 1, Math.round((vx - d.pl) / d.step))) : 0;
  var cx = d.n > 1 ? d.pl + i * d.step : d.pl + (d.W - d.pl - 16) / 2;
  var cross = document.getElementById('exl-cross'), tip = document.getElementById('exl-tip');
  if (!cross || !tip) return;
  cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
  var rows = d.series.map(function (s) { return { s: s, v: s.values[i] }; }).sort(function (a, b) { return b.v - a.v; });
  tip.innerHTML = '<div class="mb-1 font-semibold text-slate-800">' + esc(monthLabel(d.months[i])) + '</div>' + rows.map(function (r) {
    return '<div class="flex items-center justify-between gap-3"><span class="flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full" style="background:' + r.s.color + '"></span>' + esc(r.s.name) + '</span><b>' + (d.share ? formatNum(r.v, 1) + '%' : esc(formatINRShort(r.v))) + '</b></div>';
  }).join('');
  tip.classList.remove('hidden');
  var px = cx / scale, host = tip.parentNode.getBoundingClientRect();
  var left = px + 16 + (box.left - host.left);
  if (left + tip.offsetWidth > host.width) left = px - tip.offsetWidth - 8 + (box.left - host.left);
  tip.style.left = Math.max(4, left) + 'px';
  tip.style.top = (box.top - host.top + 8) + 'px';
}
function execLineLeave() {
  var c = document.getElementById('exl-cross'), t = document.getElementById('exl-tip');
  if (c) c.setAttribute('visibility', 'hidden');
  if (t) t.classList.add('hidden');
}

/* ---------- 2. Top 10 vendors ---------- */
function execVendorData(sc) {
  var cat = appState.ui.execVendorCategory || sc.cat;
  var recs = execRecs(sc.cur, sc, { cat: cat });
  var by = {}, total = 0;
  recs.forEach(function (r) { by[r.vendor] = (by[r.vendor] || 0) + r.poValue; total += r.poValue; });
  var list = Object.keys(by).map(function (v) { return { name: v, value: by[v], share: total ? by[v] / total * 100 : 0 }; }).sort(function (a, b) { return b.value - a.value; });
  var top = list.slice(0, 10);
  // single-source risk: one vendor > 70% of a category's spend in the period
  var risk = [];
  appState.categories.forEach(function (c) {
    if (cat && c.name !== cat) return;
    var rs = execRecs(sc.cur, sc, { cat: c.name });
    var t = sumBy(rs, function (r) { return r.poValue; });
    if (!t) return;
    var vb = {};
    rs.forEach(function (r) { vb[r.vendor] = (vb[r.vendor] || 0) + r.poValue; });
    Object.keys(vb).forEach(function (v) { if (vb[v] / t > 0.7) risk.push({ category: c.name, vendor: v, share: vb[v] / t * 100 }); });
  });
  return { cat: cat, top: top, total: total, topShare: total ? sumBy(top, function (x) { return x.value; }) / total * 100 : 0, risk: risk };
}
function execVendorChart(d) {
  if (!d.top.length) return emptyState('No spend for these filters.');
  var W = 460, rowH = 26, pl = 160, pr = 104, H = d.top.length * rowH + 8;
  var max = d.top[0].value;
  var g = d.top.map(function (v, i) {
    var w = (W - pl - pr) * v.value / max, y = 4 + i * rowH;
    return '<text x="' + (pl - 8) + '" y="' + (y + 16) + '" text-anchor="end" font-size="12" fill="#334155">' + esc(v.name) + '</text>' +
      '<rect x="' + pl + '" y="' + (y + 4) + '" width="' + Math.max(2, w) + '" height="16" rx="3" fill="#2563eb"><title>' + esc(v.name + ': ' + formatINRShort(v.value) + ' (' + formatNum(v.share, 1) + '%)') + '</title></rect>' +
      '<text x="' + (pl + w + 6) + '" y="' + (y + 16) + '" font-size="11" fill="#334155">' + esc(formatINRShort(v.value)) + ' · ' + formatNum(v.share, 1) + '%</text>';
  }).join('');
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="Top 10 vendors by spend">' + g + '</svg>' + execVendorFoot(d);
}
function execVendorFoot(d) {
  return '<p class="mt-2 text-[11px] text-slate-600">Top-10 share: <b>' + formatNum(d.topShare, 1) + '%</b> of ' + esc(formatINRShort(d.total)) + (d.cat ? ' in ' + esc(d.cat) : '') + '.</p>' +
    (d.risk.length ? '<p class="mt-1 text-[11px] text-amber-800">' + icon('triangle-alert', 'w-3 h-3 inline') + ' Single-source risk in <b>' + d.risk.length + '</b> categor' + (d.risk.length > 1 ? 'ies' : 'y') + ' (one vendor &gt; 70%): ' +
      d.risk.slice().sort(function (a, b) { return b.share - a.share; }).slice(0, 4).map(function (r) { return esc(r.category) + ' – ' + esc(r.vendor) + ' ' + Math.round(r.share) + '%'; }).join(' · ') +
      (d.risk.length > 4 ? ' · +' + (d.risk.length - 4) + ' more (see Table)' : '') + '</p>' :
      '<p class="mt-1 text-[11px] text-emerald-700">' + icon('circle-check', 'w-3 h-3 inline') + ' No category depends on one vendor for more than 70% of spend.</p>');
}

/* ---------- 3. Category status & ageing ---------- */
function execCategoryStatus(sc) {
  var lines = execLines(sc);
  var rows = {};
  lines.forEach(function (l) {
    if (!rows[l.category]) rows[l.category] = { name: l.category, counts: PIPELINE_STAGES.map(function () { return 0; }), hold: 0, total: 0, breach: 0, days: 0, oldest: 0 };
    var r = rows[l.category], k = PIPELINE_STAGES.indexOf(l.currentStatus);
    if (k >= 0) r.counts[k]++; else r.hold++;
    r.total++; r.days += l.daysInStatus;
    if (slaInfo(l).state === 'breach') r.breach++;
    r.oldest = Math.max(r.oldest, Math.floor(daysAgo(l.prCreationDate)));
  });
  return Object.keys(rows).map(function (k) { return rows[k]; }).sort(function (a, b) { return b.total - a.total; });
}
function execCategoryChart(rows) {
  if (!rows.length) return emptyState('No open lines for these filters.');
  var W = 760, rowH = 22, pl = 200, pr = 40, H = rows.length * rowH + 6;
  var max = Math.max.apply(null, rows.map(function (r) { return r.total; }));
  var g = rows.map(function (r, i) {
    var y = 3 + i * rowH, x = pl, out = '<text x="' + (pl - 8) + '" y="' + (y + 14) + '" text-anchor="end" font-size="11" fill="#334155">' + esc(r.name) + '</text>';
    r.counts.forEach(function (c, k) {
      if (!c) return;
      var w = (W - pl - pr) * c / max;
      out += '<rect x="' + x + '" y="' + (y + 3) + '" width="' + w + '" height="15" fill="' + STAGE_BLUES[k] + '" stroke="#fff" stroke-width="0.5"><title>' + esc(r.name + ' · ' + stageByKey(PIPELINE_STAGES[k]).label + ': ' + c) + '</title></rect>' +
        (w > 16 ? '<text x="' + (x + w / 2) + '" y="' + (y + 14) + '" text-anchor="middle" font-size="9.5" fill="' + (k >= 4 ? '#fff' : '#1e3a8a') + '">' + c + '</text>' : '');
      x += w;
    });
    if (r.hold) { var hw = (W - pl - pr) * r.hold / max; out += '<rect x="' + x + '" y="' + (y + 3) + '" width="' + hw + '" height="15" fill="#cbd5e1"><title>On hold: ' + r.hold + '</title></rect>'; x += hw; }
    return out + '<text x="' + (x + 6) + '" y="' + (y + 14) + '" font-size="11" fill="#334155">' + r.total + '</text>';
  }).join('');
  var legend = '<ul class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">' + PIPELINE_STAGES.map(function (k, i) {
    return '<li class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-sm border border-slate-200" style="background:' + STAGE_BLUES[i] + '"></span>' + (i + 1) + '. ' + esc(stageByKey(k).label) + '</li>';
  }).join('') + '<li class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:#cbd5e1"></span>On hold</li></ul>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="Open lines by category and stage">' + g + '</svg>' + legend;
}
function execSlaHealth(rows) {
  return miniTable(['Category', 'Open', 'Past SLA', 'Compliance', 'Avg days in stage', 'Oldest (d)'], rows.map(function (r) {
    var c = Math.round((r.total - r.breach) / r.total * 100);
    return [esc(r.name), r.total, r.breach, (c < 85 ? '<span class="font-semibold text-red-700">⚠ ' + c + '%</span>' : '<span class="text-emerald-700">✓ ' + c + '%</span>'), formatNum(r.days / r.total, 1), r.oldest];
  }));
}

/* ---------- 4. PR → PO cycle time (stacked columns) ---------- */
function execCycleData(sc) {
  var months = execMonthKeys(sc.cur[0], sc.cur[1]), recs = execRecs(sc.cur, sc);
  return months.map(function (m, i) {
    var rs = recs.filter(function (r) { return r.monthIdx === sc.cur[0] + i; });
    var parts = CYCLE_PARTS.map(function (p) { return avgBy(rs, function (r) { return r.cycle[p[0]]; }); });
    return { month: m, parts: parts, total: sumBy(parts, function (v) { return v; }), n: rs.length };
  });
}
function execCycleChart(data) {
  var W = 760, H = 270, pl = 40, pr = 70, pt = 12, pb = 30, n = data.length;
  var max = niceMax(Math.max.apply(null, [8].concat(data.map(function (d) { return d.total; }))) * 1.05);
  function y(v) { return pt + (H - pt - pb) * (1 - v / max); }
  var slot = (W - pl - pr) / n, bw = Math.min(46, slot * 0.6), g = '';
  for (var t = 0; t <= 4; t++) { var tv = max * t / 4; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" stroke="#e2e8f0"/><text x="' + (pl - 6) + '" y="' + (y(tv) + 4) + '" text-anchor="end" font-size="11" fill="#64748b">' + formatNum(tv, 0) + ' d</text>'; }
  data.forEach(function (d, i) {
    var x = pl + i * slot + (slot - bw) / 2, acc = 0;
    d.parts.forEach(function (v, k) {
      g += '<rect x="' + x + '" y="' + y(acc + v) + '" width="' + bw + '" height="' + Math.max(0, y(acc) - y(acc + v)) + '" fill="' + CYCLE_PARTS[k][2] + '"><title>' + esc(monthLabel(d.month) + ' · ' + CYCLE_PARTS[k][1] + ': ' + formatNum(v, 1) + ' d') + '</title></rect>';
      acc += v;
    });
    g += '<text x="' + (x + bw / 2) + '" y="' + (y(acc) - 4) + '" text-anchor="middle" font-size="10" fill="' + (d.total > 7 ? '#b91c1c' : '#334155') + '">' + (d.total > 7 ? '▲' : '') + formatNum(d.total, 1) + '</text>' +
      '<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#64748b">' + esc(monthLabel(d.month)) + '</text>';
  });
  g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(7) + '" y2="' + y(7) + '" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (W - pr + 4) + '" y="' + (y(7) + 4) + '" font-size="11" fill="#dc2626">7-day target</text>';
  var legend = '<ul class="mt-2 flex flex-wrap gap-x-3 text-[11px] text-slate-600">' + CYCLE_PARTS.map(function (p) { return '<li class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-sm" style="background:' + p[2] + '"></span>' + esc(p[1]) + '</li>'; }).join('') +
    '<li class="flex items-center gap-1"><span class="inline-block w-4 border-t-2 border-dashed border-red-600"></span>Target</li></ul>';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="PR to PO cycle time by month">' + g + '</svg>' + legend;
}

/* ---------- 5. Backlog ageing ---------- */
function execAgeing(sc) {
  var lines = execLines(sc);
  return AGE_BUCKETS.map(function (b) {
    var ls = lines.filter(function (l) { var a = Math.floor(daysAgo(l.prCreationDate)); return a >= b[1] && a <= b[2]; });
    return { label: b[0], n: ls.length, value: sumBy(ls, function (l) { return l.estimatedValue; }), old: b[1] > 30 };
  });
}
function execAgeingChart(data) {
  var W = 460, H = 230, pl = 36, pr = 10, pt = 18, pb = 30;
  var max = niceMax(Math.max.apply(null, [1].concat(data.map(function (d) { return d.n; }))));
  function y(v) { return pt + (H - pt - pb) * (1 - v / max); }
  var slot = (W - pl - pr) / data.length, bw = slot * 0.6, g = '';
  for (var t = 0; t <= 4; t++) { var tv = max * t / 4; g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(tv) + '" y2="' + y(tv) + '" stroke="#e2e8f0"/><text x="' + (pl - 6) + '" y="' + (y(tv) + 4) + '" text-anchor="end" font-size="10" fill="#64748b">' + Math.round(tv) + '</text>'; }
  data.forEach(function (d, i) {
    var x = pl + i * slot + (slot - bw) / 2;
    g += '<rect x="' + x + '" y="' + y(d.n) + '" width="' + bw + '" height="' + (y(0) - y(d.n)) + '" rx="3" fill="' + (d.old ? '#dc2626' : '#3b82f6') + '"><title>' + esc(d.label + ': ' + d.n + ' lines, ' + formatINRShort(d.value)) + '</title></rect>' +
      '<text x="' + (x + bw / 2) + '" y="' + (y(d.n) - 5) + '" text-anchor="middle" font-size="11" font-weight="600" fill="' + (d.old ? '#b91c1c' : '#334155') + '">' + (d.old && d.n ? '⚠ ' : '') + d.n + '</text>' +
      '<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="' + (d.old ? '#b91c1c' : '#64748b') + '">' + esc(d.label) + '</text>';
  });
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full" role="img" aria-label="Backlog ageing buckets">' + g + '</svg>' +
    '<p class="mt-1 text-[11px] text-slate-500">Age since PR creation, open lines. Red with ⚠ = older than 30 days.</p>';
}

/* ---------- 6. Buyer performance ---------- */
function execBuyerRows(sc) {
  var recs = execRecs(sc.cur, sc);
  return appState.buyers.filter(function (b) { return !sc.buyer || b.name === sc.buyer; }).map(function (b) {
    var open = appState.lines.filter(function (l) { return isOpen(l) && l.assignedBuyer === b.name && (!sc.cat || l.category === sc.cat); });
    var rs = recs.filter(function (r) { return r.buyer === b.name; });
    var del = rs.filter(function (r) { return r.grnMonth <= EXEC_LAST; });
    return { b: b, open: open.length, load: loadPct(b), cycle: avgBy(rs, function (r) { return r.cycleTotal; }), ontime: del.length ? del.filter(function (r) { return r.onTime; }).length / del.length * 100 : 0,
      past: open.filter(function (l) { return slaInfo(l).state === 'breach'; }).length, spend: sumBy(rs, function (r) { return r.poValue; }), pos: rs.length };
  });
}
function execBuyerTable(sc) {
  var s = appState.ui.execSort, rows = execBuyerRows(sc);
  rows.sort(function (a, b) { var x = s.key === 'name' ? a.b.name : a[s.key], y = s.key === 'name' ? b.b.name : b[s.key]; return (x < y ? -1 : x > y ? 1 : 0) * s.dir; });
  var cols = [['name', 'Buyer'], ['open', 'Open lines'], ['load', 'Load %'], ['cycle', 'Avg cycle'], ['ontime', 'On-time %'], ['past', 'Past SLA'], ['spend', 'Spend']];
  var head = cols.map(function (c) {
    return '<th class="' + UI.th + (c[0] !== 'name' ? ' text-right' : '') + '"><button type="button" class="inline-flex items-center gap-1 uppercase" onclick="execSortBy(\'' + c[0] + '\')">' + esc(c[1]) +
      (s.key === c[0] ? (s.dir > 0 ? ' ▲' : ' ▼') : '') + '</button></th>';
  }).join('');
  var body = rows.map(function (r) {
    var hot = r.load > 85;
    return '<tr><td class="' + UI.td + ' text-sm font-medium">' + esc(r.b.name) + (r.b.ooo ? oooBadge() : '') + '</td><td class="' + UI.td + ' text-right">' + r.open + '</td>' +
      '<td class="' + UI.td + ' text-right ' + (hot ? 'font-semibold text-amber-700 bg-amber-50' : '') + '">' + (hot ? '⚠ ' : '') + r.load + '%</td>' +
      '<td class="' + UI.td + ' text-right ' + (r.cycle > 7 ? 'text-red-700' : '') + '">' + formatNum(r.cycle, 1) + ' d</td><td class="' + UI.td + ' text-right">' + formatNum(r.ontime, 0) + '%</td>' +
      '<td class="' + UI.td + ' text-right">' + r.past + '</td><td class="' + UI.td + ' text-right whitespace-nowrap">' + formatINRShort(r.spend) + '</td></tr>';
  }).join('');
  return '<div class="overflow-x-auto"><table class="min-w-full divide-y divide-slate-200"><thead><tr>' + head + '</tr></thead><tbody class="divide-y divide-slate-100">' + body + '</tbody></table></div>' +
    '<p class="px-4 py-2 text-[11px] text-slate-500">Amber with ⚠ = load above 85% of the 90-line capacity. Click a header to sort.</p>';
}

/* ---------- 7. Delivery risk tiles ---------- */
function execDeliveryRisk(sc) {
  var out = {};
  ['A', 'B', 'D'].forEach(function (k) {
    var ps = getFollowUpLines(k).filter(function (x) { return (!sc.cat || x.po.category === sc.cat) && (!sc.buyer || x.po.buyer === sc.buyer); });
    out[k] = { n: ps.length, value: sumBy(ps, function (x) { return x.po.poValue; }) };
  });
  return out;
}

/* ---------- screen ---------- */
function execHeader() {
  return pageHeader('Exec stats', 'Leadership view · Tata Electronics, Jagi Road · <span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">' + icon('flask-conical', 'w-3 h-3') + 'Sample data</span>');
}
function execTabs() {
  var t = appState.ui.execTab;
  return '<div class="mb-4 flex gap-1 border-b border-slate-200" role="tablist">' + [['overview', 'Overview', 'gauge'], ['arc', 'ARC Recommendations', 'file-signature']].map(function (x) {
    var on = t === x[0];
    return '<button type="button" role="tab" aria-selected="' + on + '" class="-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ' + (on ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800') + '" onclick="setExecTab(\'' + x[0] + '\')">' + icon(x[2], 'w-4 h-4') + x[1] + '</button>';
  }).join('') + '</div>';
}
function renderExecStatsScreen() {
  if (appState.ui.execTab === 'arc') return execHeader() + execTabs() + renderArcSection();
  var ui = appState.ui, sc = execScope(), k = execKpis(sc);
  var periodBtns = [3, 6, 12].map(function (p) {
    return '<button type="button" class="px-3 py-1.5 text-sm font-medium ' + (ui.execPeriod === p ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50') + '" aria-pressed="' + (ui.execPeriod === p) + '" onclick="setExecPeriod(' + p + ')">' + p + 'M</button>';
  }).join('');
  var catOpts = appState.categories.map(function (c) { return { value: c.id, label: c.name }; });
  var curCat = getCategory(ui.execCategory), curVendCat = getCategory(ui.execVendorCategory);
  var filters = '<div class="' + UI.card + ' mb-4 flex flex-wrap items-end gap-3 p-3">' +
    '<div><span class="' + UI.label + '">Period</span><div class="inline-flex overflow-hidden rounded-lg border border-slate-300 divide-x divide-slate-300">' + periodBtns + '</div></div>' +
    '<div><label class="' + UI.label + '" for="ex-cat">Category</label><select id="ex-cat" class="' + UI.input + '" onchange="setExecFilter(\'execCategory\',this.value)">' + selectOptions(catOpts, curCat ? curCat.id : '', 'All categories') + '</select></div>' +
    '<div><label class="' + UI.label + '" for="ex-buyer">Buyer</label><select id="ex-buyer" class="' + UI.input + '" onchange="setExecFilter(\'execBuyer\',this.value)">' + selectOptions(appState.buyers.map(function (b) { return { value: b.id, label: b.name }; }), (getBuyer(ui.execBuyer) || {}).id || '', 'All buyers') + '</select></div>' +
    '<span class="text-xs text-slate-500">' + k.count + ' awarded POs in ' + esc(monthLabel(execMonthKeys(sc.cur[0], sc.cur[0])[0])) + ' – ' + esc(monthLabel(execMonthKeys(sc.cur[1], sc.cur[1])[0])) + '</span>' +
    '<button type="button" class="' + UI.btn + ' ml-auto" onclick="exportExecSummary()">' + icon('download', 'w-4 h-4') + 'Export Exec Summary (CSV)</button></div>';

  var kpis = '<div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">' +
    execKpiTile('Spend (period)', esc(formatINRShort(k.spend.cur)), deltaHtml(k.spend.cur, k.spend.prev, 'neutral'), 'FY YTD (from Apr): ' + esc(formatINRShort(k.spend.ytd)), 'indian-rupee') +
    execKpiTile('Open commitments', esc(formatINRShort(k.open.cur)), deltaHtml(k.open.cur, k.open.prev, 'down'), 'PO value not yet GRN’d', 'file-clock') +
    execKpiTile('PR → PO cycle', formatNum(k.cycle.cur, 1) + ' d', deltaHtml(k.cycle.cur, k.cycle.prev, 'down', 'd'), (k.cycle.cur <= 7 ? '✓ within' : '⚠ above') + ' 7-day target', 'timer') +
    execKpiTile('Vendor on-time', formatNum(k.ontime.cur, 1) + '%', deltaHtml(k.ontime.cur, k.ontime.prev, 'up', 'pp'), 'Delivered on or before committed ETA', 'truck') +
    execKpiTile('Negotiated savings', formatNum(k.savings.cur, 1) + '%', deltaHtml(k.savings.cur, k.savings.prev, 'up', 'pp'), 'PR estimate vs PO value', 'badge-percent') +
    execKpiTile('Lines past SLA', formatNum(k.pastSla.cur), deltaHtml(k.pastSla.cur, k.pastSla.prev, 'down'), k.pastSla.openNow + ' open lines past SLA today', 'circle-alert') + '</div>';

  var modeToggle = '<div class="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs">' +
    '<button type="button" class="px-2 py-1 ' + (ui.execMode === 'value' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600') + '" aria-pressed="' + (ui.execMode === 'value') + '" onclick="setExecMode(\'value\')">₹</button>' +
    '<button type="button" class="px-2 py-1 ' + (ui.execMode === 'share' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600') + '" aria-pressed="' + (ui.execMode === 'share') + '" onclick="setExecMode(\'share\')">% share</button></div>';
  var vd = execVendorData(sc);
  var vendSel = '<select class="' + UI.input + ' text-xs" aria-label="Vendor chart category" onchange="setExecFilter(\'execVendorCategory\',this.value)">' + selectOptions(catOpts, curVendCat ? curVendCat.id : '', curCat ? 'Same as filter (' + curCat.name + ')' : 'All categories') + '</select>';
  var catRows = execCategoryStatus(sc);
  var cyc = execCycleData(sc);
  var age = execAgeing(sc);
  var risk = execDeliveryRisk(sc);
  var riskTiles = '<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">' + [['A', 'AWB not shared', 'file-question'], ['B', 'No carrier scan', 'scan-line'], ['D', 'Committed ETA missed', 'calendar-x']].map(function (r) {
    return '<button type="button" class="' + UI.card + ' p-4 text-left hover:border-red-300" onclick="execGoRule(\'' + r[0] + '\')"><div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Rule ' + r[0] + ' · ' + esc(r[1]) + '</span>' + icon(r[2], 'w-4 h-4 text-red-500') + '</div>' +
      '<div class="mt-2 text-2xl font-bold text-slate-900">' + risk[r[0]].n + ' <span class="text-sm font-normal text-slate-500">POs</span></div><div class="text-xs text-red-700">' + esc(formatINRShort(risk[r[0]].value)) + ' at risk</div>' +
      '<div class="mt-1 text-[11px] text-blue-700">Open in Delivery Follow-Up ' + icon('arrow-right', 'w-3 h-3 inline') + '</div></button>';
  }).join('') + '</div>';

  return execHeader() + execTabs() +
    filters + kpis +
    '<div class="grid gap-4 xl:grid-cols-5">' +
    execCard('spend', 'Spend by category, month on month', 'Top 7 categories + Other · hover for values', execLineChart(sc), execLineTable(sc), modeToggle, 'xl:col-span-3') +
    execCard('vendors', 'Top 10 vendors by spend', esc(vd.cat || 'All categories') + ' · ' + sc.P + 'M', execVendorChart(vd),
      miniTable(['Vendor', 'Spend', 'Share'], vd.top.map(function (v) { return [esc(v.name), formatINRShort(v.value), formatNum(v.share, 1) + '%']; })) + execVendorFoot(vd) +
      (vd.risk.length ? '<div class="mt-2">' + miniTable(['Single-source category', 'Vendor', 'Share'], vd.risk.map(function (r) { return [esc(r.category), esc(r.vendor), Math.round(r.share) + '%']; })) + '</div>' : ''), vendSel, 'xl:col-span-2') +
    execCard('catstatus', 'Category status & ageing', 'Open lines by stage (light → dark = earlier → later stage)', execCategoryChart(catRows),
      miniTable(['Category'].concat(PIPELINE_STAGES.map(function (s) { return stageByKey(s).label; })).concat(['On hold', 'Total']), catRows.map(function (r) { return [esc(r.name)].concat(r.counts).concat([r.hold, r.total]); })), '', 'xl:col-span-3') +
    '<section class="' + UI.card + ' xl:col-span-2"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">Category SLA health</h2><p class="text-[11px] text-slate-500">⚠ = compliance below 85%</p></div><div class="max-h-[26rem] overflow-y-auto">' + (catRows.length ? execSlaHealth(catRows) : emptyState('No open lines.')) + '</div></section>' +
    execCard('cycle', 'PR → PO cycle time', 'Average days per stage group, by month of PO award', execCycleChart(cyc),
      miniTable(['Month'].concat(CYCLE_PARTS.map(function (p) { return p[1]; })).concat(['Total', 'POs']), cyc.map(function (d) { return [esc(monthLabel(d.month))].concat(d.parts.map(function (v) { return formatNum(v, 1); })).concat([formatNum(d.total, 1), d.n]); })), '', 'xl:col-span-3') +
    execCard('ageing', 'Backlog ageing', 'Open lines by age bucket', execAgeingChart(age),
      miniTable(['Bucket', 'Lines', 'Est. value'], age.map(function (a) { return [(a.old ? '⚠ ' : '') + esc(a.label), a.n, formatINRShort(a.value)]; })), '', 'xl:col-span-2') +
    '<section class="' + UI.card + ' xl:col-span-3"><div class="border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">Buyer performance</h2></div>' + execBuyerTable(sc) + '</section>' +
    '<section class="xl:col-span-2"><h2 class="mb-2 text-sm font-semibold text-slate-800">Delivery risk</h2>' + riskTiles + '</section>' +
    '</div>';
}
function setExecPeriod(p) { if ([3, 6, 12].indexOf(p) < 0) return; appState.ui.execPeriod = p; rerender(); }
function setExecFilter(key, id) {
  var v = '';
  if (key === 'execBuyer') { var b = getBuyerById(id); v = b ? b.name : ''; }
  else { var c = getCategoryById(id); v = c ? c.name : ''; }
  appState.ui[key] = v; rerender();
}
function setExecMode(m) { appState.ui.execMode = m === 'share' ? 'share' : 'value'; rerender(); }
function execToggleTable(id) { appState.ui.execTables[id] = !appState.ui.execTables[id]; rerender(); }
function execSortBy(key) {
  var s = appState.ui.execSort;
  if (s.key === key) s.dir = -s.dir; else { s.key = key; s.dir = key === 'name' ? 1 : -1; }
  rerender();
}
function execGoRule(r) { appState.ui.followRule = r; navigate('delivery-followup'); }
function exportExecSummary() {
  var sc = execScope(), k = execKpis(sc), ui = appState.ui;
  var rows = [['Exec summary – Procurement Control Tower (sample data)'], ['Period', ui.execPeriod + ' months'], ['Category filter', ui.execCategory || 'All'], ['Buyer filter', ui.execBuyer || 'All'], [],
    ['KPI', 'Current', 'Prior period'],
    ['Spend (INR)', Math.round(k.spend.cur), Math.round(k.spend.prev)], ['FY YTD spend (INR)', Math.round(k.spend.ytd), ''],
    ['Open commitments (INR)', Math.round(k.open.cur), Math.round(k.open.prev)], ['PR to PO cycle (days)', k.cycle.cur.toFixed(1), k.cycle.prev.toFixed(1)],
    ['Vendor on-time %', k.ontime.cur.toFixed(1), k.ontime.prev.toFixed(1)], ['Negotiated savings %', k.savings.cur.toFixed(1), k.savings.prev.toFixed(1)],
    ['Lines past SLA', k.pastSla.cur, k.pastSla.prev], [], ['Top vendors', 'Spend (INR)', 'Share %']];
  execVendorData(sc).top.forEach(function (v) { rows.push([v.name, Math.round(v.value), v.share.toFixed(1)]); });
  rows.push([], ['Category', 'Spend in period (INR)']);
  var d = execSpendSeries(sc);
  d.series.forEach(function (s) { rows.push([s.name, Math.round(sumBy(s.values, function (v) { return v; }))]); });
  rows.push([], ['Delivery risk rule', 'POs', 'Value at risk (INR)']);
  var risk = execDeliveryRisk(sc);
  ['A', 'B', 'D'].forEach(function (r) { rows.push(['Rule ' + r, risk[r].n, Math.round(risk[r].value)]); });
  downloadCsv('exec_summary_' + isoDate(DEMO_TODAY) + '.csv', rows);
}
