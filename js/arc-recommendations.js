/* =====================================================================
   ARC Recommendations engine (ARC = Annual Rate Contract)

   PURE LOGIC – no DOM, no appState. Everything the Exec Stats →
   ARC Recommendations tab shows comes from one call:

       arcAnalyse(poRows, arcRows, today)

   poRows / arcRows are plain objects keyed by the column names in
   ARC_PO_COLUMNS / ARC_MASTER_COLUMNS (exactly what an uploaded CSV/XLSX,
   or later an SAP ME2N / Ariba contract extract, produces). Values may
   be strings ("₹1,23,456", "07-11-2026") or typed – arcNum / arcDate
   clean them. To wire real data later, replace the data source only.

   All tuning lives in ARC_CONFIG below.
   ===================================================================== */
var ARC_CONFIG = {
  lookbackMonths: 12,          // analysis window: the last N calendar months up to the latest PO date (or today if earlier)
  minPoCount: 4,               // eligibility: at least this many POs in the window …
  minAnnualSpend: 500000,      // … AND at least this much spend (₹5,00,000)
  weights: {                   // score weights (must add up to 1). Each factor is min-max normalised across eligible items
    spend: 0.30,               //   annual spend
    frequency: 0.25,           //   PO count
    rateVariance: 0.20,        //   (max rate − min rate) / avg rate
    stability: 0.15,           //   months with a PO / lookbackMonths
    vendorSpread: 0.10         //   distinct vendors (more vendors = more to consolidate)
  },
  priority: { high: 70, medium: 40 },   // High ≥ 70, Medium 40–69, Low < 40
  hoursPerPO: 6,               // buyer effort per PO that an ARC call-off avoids
  commitFactor: 0.85,          // proposed committed qty = annual qty × this
  topN: 20,                    // rows shown by default and used in the exec summary
  health: {
    renewPct: 80,              // Renew/Extend: consumed ≥ 80% of committed qty or value
    expiringDays: 60,          // Expiring: Valid_To within 60 days
    underUtilElapsedPct: 50,   // Under-utilised: more than 50% of validity elapsed …
    underUtilConsumedPct: 20   // … but less than 20% consumed
  },
  mockSeed: 20261108           // fixed seed: sample data is identical on every reload
};

var ARC_PO_COLUMNS = ['PO_No', 'PO_Date', 'Item_Code', 'Item_Description', 'Category', 'Vendor', 'Qty', 'UoM', 'Unit_Rate', 'PO_Value', 'Plant', 'Department'];
var ARC_PO_REQUIRED = ['PO_No', 'PO_Date', 'Vendor', 'Qty'];          // + Item_Code or Item_Description, + Unit_Rate or PO_Value
var ARC_MASTER_COLUMNS = ['ARC_No', 'Item_Code', 'Vendor', 'ARC_Rate', 'Committed_Qty', 'Consumed_Qty', 'Committed_Value', 'Consumed_Value', 'Valid_From', 'Valid_To'];
var ARC_MASTER_REQUIRED = ['ARC_No', 'Item_Code', 'Valid_From', 'Valid_To'];
var ARC_STATUS_ORDER = ['Expired', 'Renew/Extend', 'Expiring', 'Under-utilised', 'Healthy'];
var ARC_DAY = 86400000;

/* ---------- value cleaning ---------- */
function arcNormDesc(s) { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }
function arcNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v || '').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, ''));
  return isFinite(n) ? n : 0;
}
var ARC_MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/* Accepts Date, Excel serial number, YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, DD-Mon-YYYY. Returns local midnight or null. */
function arcDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
    var serial = Number(v);
    if (serial > 20000 && serial < 80000) { var d0 = new Date(Math.round((serial - 25569) * ARC_DAY)); return new Date(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate()); }
    return null;
  }
  var s = String(v).trim().split(/[T\s]/)[0], m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return arcValidDate(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s))) return arcValidDate(arcYear(+m[3]), +m[2] - 1, +m[1]);
  if ((m = /^(\d{1,2})[-/.\s]([A-Za-z]{3})[A-Za-z]*[-/.\s](\d{2,4})$/.exec(s)) && ARC_MON[m[2].toLowerCase()] !== undefined) return arcValidDate(arcYear(+m[3]), ARC_MON[m[2].toLowerCase()], +m[1]);
  return null;
}
function arcYear(y) { return y < 100 ? 2000 + y : y; }
function arcValidDate(y, mo, d) { var x = new Date(y, mo, d); return x.getFullYear() === y && x.getMonth() === mo && x.getDate() === d ? x : null; }
function arcMidnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/* ---------- file rows → objects keyed by canonical column names ----------
   aoa = array of arrays (first non-empty row = header). Header matching
   ignores case, spaces, underscores and punctuation ("PO No", "po_no"). */
function arcKeyOf(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function arcRowsFromAoa(aoa, columns, required) {
  var start = 0;
  while (start < aoa.length && !aoa[start].some(function (c) { return String(c).trim() !== ''; })) start++;
  if (start >= aoa.length) return { rows: [], missing: required.slice(), error: 'The file is empty.' };
  var header = aoa[start].map(arcKeyOf), idx = {};
  columns.forEach(function (c) { var k = header.indexOf(arcKeyOf(c)); if (k >= 0) idx[c] = k; });
  var missing = required.filter(function (c) { return idx[c] === undefined; });
  if (columns === ARC_PO_COLUMNS) {
    if (idx.Item_Code === undefined && idx.Item_Description === undefined) missing.push('Item_Code or Item_Description');
    if (idx.Unit_Rate === undefined && idx.PO_Value === undefined) missing.push('Unit_Rate or PO_Value');
  }
  var rows = [];
  for (var r = start + 1; r < aoa.length; r++) {
    var a = aoa[r];
    if (!a || !a.some(function (c) { return String(c).trim() !== ''; })) continue;
    var o = {};
    columns.forEach(function (c) { o[c] = idx[c] === undefined ? '' : a[idx[c]]; });
    rows.push(o);
  }
  return { rows: rows, missing: missing, error: missing.length ? 'Missing column(s): ' + missing.join(', ') : '' };
}

/* ---------- typed records ---------- */
function arcItemKey(code, desc) {
  var c = String(code || '').trim();
  return c ? 'code:' + c.toUpperCase() : 'desc:' + arcNormDesc(desc);
}
function arcCleanPo(rows) {
  var out = [], skipped = 0;
  rows.forEach(function (r) {
    var date = arcDate(r.PO_Date), qty = arcNum(r.Qty), rate = arcNum(r.Unit_Rate), value = arcNum(r.PO_Value);
    if (!value && qty && rate) value = qty * rate;
    if (!rate && qty && value) rate = value / qty;
    var code = String(r.Item_Code || '').trim(), desc = String(r.Item_Description || '').trim();
    if (!date || !(qty > 0) || !(value > 0) || (!code && !desc)) { skipped++; return; }
    out.push({ poNo: String(r.PO_No || '').trim(), date: date, code: code, desc: desc || code, key: arcItemKey(code, desc), category: String(r.Category || '').trim() || 'Uncategorised',
      vendor: String(r.Vendor || '').trim() || 'Unknown vendor', qty: qty, uom: String(r.UoM || '').trim(), rate: rate, value: value,
      plant: String(r.Plant || '').trim(), department: String(r.Department || '').trim() });
  });
  return { rows: out, skipped: skipped };
}
function arcCleanMaster(rows) {
  var out = [], skipped = 0;
  rows.forEach(function (r) {
    var from = arcDate(r.Valid_From), to = arcDate(r.Valid_To), code = String(r.Item_Code || '').trim();
    if (!from || !to || !code || to < from) { skipped++; return; }
    out.push({ arcNo: String(r.ARC_No || '').trim(), code: code, key: arcItemKey(code, ''), vendor: String(r.Vendor || '').trim(), rate: arcNum(r.ARC_Rate),
      committedQty: arcNum(r.Committed_Qty), consumedQty: arcNum(r.Consumed_Qty), committedValue: arcNum(r.Committed_Value), consumedValue: arcNum(r.Consumed_Value), from: from, to: to });
  });
  return { rows: out, skipped: skipped };
}
function arcIsActive(a, today) { return a.from <= today && a.to >= today; }

/* ---------- LOGIC 1: new ARC candidates ---------- */
function arcWindow(po, today) {
  var latest = po.reduce(function (m, p) { return p.date > m ? p.date : m; }, new Date(0));
  var anchor = latest.getTime() && latest < today ? latest : today;
  return { start: new Date(anchor.getFullYear(), anchor.getMonth() - (ARC_CONFIG.lookbackMonths - 1), 1), end: anchor };
}
function arcMinMax(list, f) {
  var lo = Infinity, hi = -Infinity;
  list.forEach(function (x) { var v = f(x); if (v < lo) lo = v; if (v > hi) hi = v; });
  return function (x) { return hi > lo ? (f(x) - lo) / (hi - lo) : 1; };
}
function arcCandidates(po, arcs, today) {
  var win = arcWindow(po, today), cfg = ARC_CONFIG;
  var activeKeys = {};
  arcs.forEach(function (a) { if (arcIsActive(a, today)) activeKeys[a.key] = a.arcNo; });
  var by = {};
  po.forEach(function (p) {
    if (p.date < win.start || p.date > win.end) return;
    var g = by[p.key] || (by[p.key] = { key: p.key, code: p.code, desc: p.desc, lastDate: p.date, uom: p.uom, cats: {}, vendors: {}, months: {}, pos: {}, spend: 0, qty: 0, minRate: Infinity, maxRate: 0, lines: 0, minVendor: '' });
    g.lines++; g.spend += p.value; g.qty += p.qty; g.pos[p.poNo || ('line' + g.lines)] = 1;
    g.cats[p.category] = (g.cats[p.category] || 0) + p.value;
    g.vendors[p.vendor.toLowerCase()] = p.vendor;
    g.months[p.date.getFullYear() * 12 + p.date.getMonth()] = 1;
    if (p.rate < g.minRate) { g.minRate = p.rate; g.minVendor = p.vendor; }
    if (p.rate > g.maxRate) g.maxRate = p.rate;
    if (p.date >= g.lastDate) { g.lastDate = p.date; g.desc = p.desc; g.uom = p.uom || g.uom; if (!g.code) g.code = p.code; }
  });
  var all = Object.keys(by).map(function (k) {
    var g = by[k], avg = g.qty ? g.spend / g.qty : 0;   // quantity-weighted average rate
    var cat = Object.keys(g.cats).sort(function (a, b) { return g.cats[b] - g.cats[a]; })[0];
    var it = { key: k, code: g.code, desc: g.desc, uom: g.uom, category: cat, spend: g.spend, poCount: Object.keys(g.pos).length, qty: g.qty,
      minRate: g.minRate, maxRate: g.maxRate, avgRate: avg, variancePct: avg ? (g.maxRate - g.minRate) / avg * 100 : 0,
      vendorCount: Object.keys(g.vendors).length, vendors: Object.keys(g.vendors).map(function (v) { return g.vendors[v]; }).sort(), bestVendor: g.minVendor,
      monthsActive: Math.min(cfg.lookbackMonths, Object.keys(g.months).length), activeArc: activeKeys[k] || '' };
    it.reason = it.activeArc ? 'On active ' + it.activeArc : it.poCount < cfg.minPoCount ? 'Fewer than ' + cfg.minPoCount + ' POs' : it.spend < cfg.minAnnualSpend ? 'Spend below threshold' : '';
    it.eligible = !it.reason;
    return it;
  });
  var el = all.filter(function (x) { return x.eligible; });
  var n = {
    spend: arcMinMax(el, function (x) { return x.spend; }), frequency: arcMinMax(el, function (x) { return x.poCount; }),
    rateVariance: arcMinMax(el, function (x) { return x.variancePct; }), stability: arcMinMax(el, function (x) { return x.monthsActive / cfg.lookbackMonths; }),
    vendorSpread: arcMinMax(el, function (x) { return x.vendorCount; })
  };
  el.forEach(function (x) {
    var w = cfg.weights;
    x.factors = { spend: n.spend(x), frequency: n.frequency(x), rateVariance: n.rateVariance(x), stability: n.stability(x), vendorSpread: n.vendorSpread(x) };
    x.score = Math.round(100 * (w.spend * x.factors.spend + w.frequency * x.factors.frequency + w.rateVariance * x.factors.rateVariance + w.stability * x.factors.stability + w.vendorSpread * x.factors.vendorSpread));
    x.saving = Math.max(0, x.avgRate - x.minRate) * x.qty;
    x.effortHrs = x.poCount * cfg.hoursPerPO;
    x.proposedQty = Math.round(x.qty * cfg.commitFactor);
    x.priority = x.score >= cfg.priority.high ? 'High' : x.score >= cfg.priority.medium ? 'Medium' : 'Low';
  });
  el.sort(function (a, b) { return b.score - a.score || b.spend - a.spend; });
  el.forEach(function (x, i) { x.rank = i + 1; });
  return { window: win, all: all, eligible: el, excludedActive: all.filter(function (x) { return x.activeArc; }).length,
    belowThreshold: all.filter(function (x) { return !x.eligible && !x.activeArc; }).length };
}

/* ---------- LOGIC 2: existing ARC health ---------- */
function arcHealth(arcs, today, descByKey) {
  var h = ARC_CONFIG.health;
  return arcs.map(function (a) {
    var qtyPct = a.committedQty > 0 ? a.consumedQty / a.committedQty * 100 : null;
    var valPct = a.committedValue > 0 ? a.consumedValue / a.committedValue * 100 : null;
    var consumed = Math.max(qtyPct === null ? -1 : qtyPct, valPct === null ? -1 : valPct);
    if (consumed < 0) consumed = null;
    var span = Math.max(ARC_DAY, a.to - a.from), elapsedPct = Math.max(0, Math.min(100, (today - a.from) / span * 100));
    var daysLeft = Math.round((a.to - arcMidnight(today)) / ARC_DAY);
    var flags = [];
    if (a.to < arcMidnight(today)) flags.push('Expired');
    if (consumed !== null && consumed >= h.renewPct) flags.push('Renew/Extend');
    if (daysLeft >= 0 && daysLeft <= h.expiringDays) flags.push('Expiring');
    if (daysLeft >= 0 && elapsedPct > h.underUtilElapsedPct && consumed !== null && consumed < h.underUtilConsumedPct) flags.push('Under-utilised');
    var status = flags.length ? ARC_STATUS_ORDER.filter(function (s) { return flags.indexOf(s) >= 0; })[0] : 'Healthy';
    return { arc: a, arcNo: a.arcNo, code: a.code, desc: (descByKey && descByKey[a.key]) || a.code, vendor: a.vendor, qtyPct: qtyPct, valPct: valPct, consumedPct: consumed,
      elapsedPct: elapsedPct, daysLeft: daysLeft, flags: flags, status: status, needsAction: status !== 'Healthy' };
  }).sort(function (x, y) { return ARC_STATUS_ORDER.indexOf(x.status) - ARC_STATUS_ORDER.indexOf(y.status) || x.daysLeft - y.daysLeft; });
}

/* ---------- one call for the whole tab ---------- */
function arcAnalyse(poRows, arcRows, today) {
  today = arcMidnight(today || new Date());
  var po = arcCleanPo(poRows), arcs = arcCleanMaster(arcRows);
  var cand = arcCandidates(po.rows, arcs.rows, today);
  var desc = {};
  cand.all.forEach(function (x) { desc[x.key] = x.desc; });
  var health = arcHealth(arcs.rows, today, desc);
  var top = cand.eligible.slice(0, ARC_CONFIG.topN);
  function sum(list, f) { return list.reduce(function (s, x) { return s + f(x); }, 0); }
  return {
    today: today, window: cand.window, items: cand.all, candidates: cand.eligible, health: health,
    counts: { poLines: po.rows.length, poSkipped: po.skipped, arcs: arcs.rows.length, arcSkipped: arcs.skipped, items: cand.all.length, excludedActive: cand.excludedActive, belowThreshold: cand.belowThreshold },
    kpi: {
      candidates: cand.eligible.length,
      addressableSpend: sum(cand.eligible, function (x) { return x.spend; }),
      saving: sum(cand.eligible, function (x) { return x.saving; }),
      effortHrs: sum(cand.eligible, function (x) { return x.effortHrs; }),
      arcsNeedingAction: health.filter(function (x) { return x.needsAction; }).length,
      topN: top.length, topSaving: sum(top, function (x) { return x.saving; }), topEffortHrs: sum(top, function (x) { return x.effortHrs; })
    }
  };
}

/* ---------- SAMPLE DATA (used when no file is uploaded) ----------
   ~300 PO lines, 40 items, 16 vendors, last 12 months, 10 ARCs.
   Returned as raw rows (string values) so it goes through the same
   cleaning path as an uploaded file. Own seeded RNG, so it never shifts
   the rest of the app's sample data. */
var ARC_MOCK_ITEMS = [
  // code, description, category, UoM, base rate ₹, POs/yr, qty min, qty max, vendor ids, rate spread
  ['30010011', 'Nitrile cleanroom gloves, box of 100', 'Mfg & Ops', 'BOX', 850, 16, 200, 600, ['V100110', 'V100112', 'V100114'], 0.16],
  ['30010012', 'Cleanroom wipers 9x9 in, pack of 150', 'Mfg & Ops', 'PAK', 1450, 12, 100, 300, ['V100110', 'V100111'], 0.12],
  ['30010013', 'ULPA filter 1220 x 610 mm', 'Mfg & Ops', 'EA', 38000, 6, 10, 30, ['V100111', 'V100110'], 0.18],
  ['30010014', 'HEPA pre-filter G4 panel', 'Mfg & Ops', 'EA', 4200, 8, 40, 120, ['V100111', 'V100110'], 0.08],
  ['30010015', 'Ball bearing 6205-2RS', 'Mfg & Ops', 'EA', 420, 10, 100, 400, ['V100107', 'V100112'], 0.2],
  ['30010016', 'Pneumatic cylinder CDQ2B32-20', 'Mfg & Ops', 'EA', 6800, 5, 10, 30, ['V100108'], 0.06],
  ['30010017', 'Solenoid valve SY5120-5DZ', 'Mfg & Ops', 'EA', 3900, 7, 15, 50, ['V100108', 'V100112'], 0.15],
  ['30010018', 'Vacuum pump oil, 20 L can', 'Mfg & Ops', 'CAN', 18500, 9, 6, 20, ['V100106', 'V100112'], 0.11],
  ['30020021', 'IPA electronic grade, 20 L', 'Material', 'CAN', 9200, 15, 20, 60, ['V100105', 'V100114', 'V100101'], 0.18],
  ['30020022', 'Nitrogen gas cylinder 7 m³', 'Material', 'CYL', 1350, 14, 100, 250, ['V100101', 'V100102'], 0.07],
  ['30020023', 'Argon gas cylinder 7 m³', 'Material', 'CYL', 2600, 8, 40, 120, ['V100101', 'V100102'], 0.09],
  ['30020024', 'Sulphuric acid ultra-pure, 2.5 L', 'Material', 'BTL', 3100, 6, 30, 80, ['V100105'], 0.05],
  ['30020025', 'Photoresist thinner, 4 L', 'Material', 'BTL', 14500, 5, 8, 20, ['V100105', 'V100104'], 0.13],
  ['30020026', 'Wafer carrier FOUP 300 mm', 'Material', 'EA', 62000, 4, 5, 15, ['V100105', 'V100104'], 0.1],
  ['30030031', 'Ceramic end effector', 'Equipment', 'EA', 145000, 3, 2, 5, ['V100104', 'V100103'], 0.08],
  ['30030032', 'Turbo pump service kit', 'Equipment', 'SET', 220000, 4, 1, 3, ['V100106', 'V100103'], 0.14],
  ['30030033', 'RF generator spare board', 'Equipment', 'EA', 410000, 2, 1, 2, ['V100103'], 0.04],
  ['30060061', 'Calibration service – torque wrench', 'Other', 'SRV', 3500, 9, 10, 40, ['V100113'], 0.2],
  ['30060062', 'Calibration service – particle counter', 'Other', 'SRV', 28000, 5, 2, 6, ['V100113', 'V100110'], 0.12],
  ['30040041', 'Corrugated carton 5-ply, 600x400x400', 'Indirects', 'EA', 62, 13, 2000, 6000, ['V100114', 'V100112'], 0.22],
  ['30040042', 'ESD bubble wrap roll, 1 m x 100 m', 'Indirects', 'ROLL', 1450, 9, 40, 120, ['V100114'], 0.1],
  ['30040043', 'Safety shoes, ESD', 'Indirects', 'PR', 2350, 7, 50, 150, ['V100112'], 0.12],
  ['30010019', 'Cleanroom coverall, reusable', 'Mfg & Ops', 'EA', 3200, 10, 60, 200, ['V100110', 'V100112'], 0.15],
  ['30040044', 'Housekeeping chemicals kit', 'Indirects', 'SET', 4800, 13, 10, 30, ['V100112'], 0.1],
  ['30040045', 'Office stationery kit', 'Indirects', 'SET', 900, 6, 50, 150, ['V100112'], 0.2],
  ['30040046', 'Drinking water, 20 L can', 'Indirects', 'CAN', 75, 12, 400, 900, ['V100112'], 0.1],
  ['30050051', 'Laptop – i7, 16 GB, 512 GB SSD', 'IT', 'EA', 92000, 6, 5, 20, ['V100115', 'V100116'], 0.07],
  ['30050052', 'Monitor 27 in QHD', 'IT', 'EA', 18500, 5, 10, 30, ['V100115', 'V100116'], 0.09],
  ['30050053', 'Network switch 24-port PoE', 'IT', 'EA', 68000, 3, 2, 6, ['V100109', 'V100115'], 0.06],
  ['30050054', 'Toner cartridge, laser A4', 'IT', 'EA', 6400, 12, 10, 30, ['V100115', 'V100116', 'V100112'], 0.18],
  ['30050055', 'Cat6 cable box, 305 m', 'IT', 'BOX', 9800, 6, 5, 15, ['V100116', 'V100115'], 0.14],
  ['30050056', 'UPS battery 12 V 42 Ah', 'IT', 'EA', 7600, 4, 20, 50, ['V100109', 'V100116'], 0.1],
  ['30010020', 'Mixed-bed DI resin, 25 L bag', 'Mfg & Ops', 'BAG', 21000, 6, 10, 30, ['V100105', 'V100111'], 0.1],
  ['30010021', 'Chiller heat-transfer fluid, 5 kg', 'Mfg & Ops', 'CAN', 48000, 4, 4, 10, ['V100106', 'V100105'], 0.08],
  ['30030034', 'PLC digital I/O module', 'Equipment', 'EA', 34000, 4, 3, 8, ['V100109'], 0.05],
  ['30010022', 'Viton O-ring kit', 'Mfg & Ops', 'KIT', 2800, 9, 20, 60, ['V100112', 'V100106', 'V100107'], 0.24],
  ['30040047', 'Lab coat, ESD', 'Indirects', 'EA', 1150, 3, 50, 100, ['V100112'], 0.08],
  ['30060063', 'Wooden pallet, heat-treated', 'Other', 'EA', 1450, 8, 100, 300, ['V100114', 'V100112'], 0.15],
  ['30060064', 'Fire extinguisher refill', 'Other', 'SRV', 1100, 4, 30, 80, ['V100112'], 0.1],
  ['30060065', 'Forklift battery service', 'Other', 'SRV', 42000, 4, 1, 3, ['V100112', 'V100113'], 0.1]
];
var ARC_MOCK_ARCS = [
  // ARC no, item code, vendor id, valid from, valid to, committed qty, consumed qty
  ['ARC/26/001', '30020022', 'V100101', '2026-01-01', '2026-12-31', 2000, 1760],
  ['ARC/26/002', '30020023', 'V100102', '2026-04-01', '2027-03-31', 900, 420],
  ['ARC/26/003', '30050051', 'V100115', '2025-12-16', '2026-12-15', 100, 62],
  ['ARC/26/004', '30010015', 'V100107', '2026-02-01', '2027-01-31', 4000, 520],
  ['ARC/25/011', '30010020', 'V100105', '2025-06-01', '2026-09-30', 260, 203],
  ['ARC/26/006', '30040043', 'V100112', '2026-07-01', '2027-06-30', 1200, 260],
  ['ARC/26/007', '30010018', 'V100106', '2026-03-01', '2027-02-28', 160, 140],
  ['ARC/25/014', '30050054', 'V100116', '2025-12-01', '2026-11-30', 300, 210],
  ['ARC/26/009', '30060061', 'V100113', '2026-01-01', '2026-12-31', 400, 60],
  ['ARC/25/009', '30010022', 'V100112', '2025-04-01', '2026-03-31', 600, 552]
];
function arcMockData(today) {
  var r = mulberry32(ARC_CONFIG.mockSeed), end = arcMidnight(today || DEMO_TODAY);
  function ri(a, b) { return a + Math.floor(r() * (b - a + 1)); }
  var vname = {};
  VENDOR_SEED.forEach(function (v) { vname[v[0]] = v[1]; });
  var deptFor = { 'Mfg & Ops': ['Fab Maintenance', 'Process Engineering', 'Facilities'], Material: ['Process Engineering', 'Assembly & Test'], Equipment: ['Fab Maintenance', 'Process Engineering'],
    IT: ['IT & Automation'], Indirects: ['Admin', 'EHS', 'Supply Chain', 'HR'], Other: ['Facilities', 'Quality', 'Supply Chain'] };
  var lines = [], M = ARC_CONFIG.lookbackMonths;
  ARC_MOCK_ITEMS.forEach(function (it) {
    var off = {};
    it[8].forEach(function (v, i) { off[v] = i === 0 ? -it[9] * 0.25 : (r() - 0.3) * it[9]; });
    for (var k = 0; k < it[5]; k++) {
      var mo = it[5] >= 8 ? Math.min(M - 1, Math.floor(k * M / it[5] + r() * M / it[5])) : ri(0, M - 1);   // regular buys spread evenly, the rest at random
      var y = end.getFullYear(), m = end.getMonth() - (M - 1) + mo;
      var maxDay = mo === M - 1 ? end.getDate() : 28;
      var date = new Date(y, m, ri(1, maxDay));
      var v = r() < 0.6 ? it[8][0] : it[8][ri(0, it[8].length - 1)];
      var qty = ri(it[6], it[7]);
      if (qty > 100) qty = Math.round(qty / 10) * 10;
      var rate = it[4] * (1 + off[v]) * (1 + (r() - 0.5) * it[9] * 0.5);
      rate = rate >= 100 ? Math.round(rate) : Math.round(rate * 100) / 100;
      var depts = deptFor[it[2]];
      lines.push({ date: date, it: it, vendor: vname[v] || v, qty: qty, rate: rate, dept: depts[ri(0, depts.length - 1)] });
    }
  });
  lines.sort(function (a, b) { return a.date - b.date; });
  var po = lines.map(function (l, i) {
    return { PO_No: String(4500210001 + i), PO_Date: isoDate(l.date), Item_Code: l.it[0], Item_Description: l.it[1], Category: l.it[2], Vendor: l.vendor,
      Qty: String(l.qty), UoM: l.it[3], Unit_Rate: String(l.rate), PO_Value: String(Math.round(l.qty * l.rate)), Plant: 'JR01 Jagi Road', Department: l.dept };
  });
  var base = {};
  ARC_MOCK_ITEMS.forEach(function (it) { base[it[0]] = it[4]; });
  var arcs = ARC_MOCK_ARCS.map(function (a) {
    var rate = Math.round(base[a[1]] * 0.94);
    return { ARC_No: a[0], Item_Code: a[1], Vendor: vname[a[2]] || a[2], ARC_Rate: String(rate), Committed_Qty: String(a[5]), Consumed_Qty: String(a[6]),
      Committed_Value: String(a[5] * rate), Consumed_Value: String(a[6] * rate), Valid_From: a[3], Valid_To: a[4] };
  });
  return { po: po, arcs: arcs };
}
