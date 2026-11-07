/* =====================================================================
   appState + shared helpers
   ===================================================================== */
var ROLES = ['Buyer', 'Requester', 'Proc Ops', 'PMO Admin'];
var ROLE_USERS = { 'Buyer': 'Kundal', 'Requester': 'Manash Baishya', 'Proc Ops': 'Vikram Rao', 'PMO Admin': 'Anita Menon' };

var appState = Object.assign({
  role: 'Buyer',
  settings: {
    rules: { A: 5, B: 3, C: 2 },          // days – used live by Delivery Follow-Up
    escalation: { enabled: true, hours: 24 }
  },
  ui: {
    queueStatus: 'ALL', queueOpenQuery: false, queueBuyer: 'Kundal', queueHistory: {},
    allSearch: '', allStatus: '', allBuyer: '', allCategory: '', allPage: 0,
    allocCategory: 'ALL', allocSelected: {},
    poTab: 'expediting', poSearch: '', poStageFilter: '', poPage: 0, poCarrier: '', poMulti: [], portalSelected: '', queueSearch: '', queueDept: '',
    followRule: 'ALL',
    execPeriod: 6, execCategory: '', execBuyer: '', execMode: 'value', execVendorCategory: '', execTables: {}, execSort: { key: 'load', dir: -1 },
    rebalanceFrom: '', rebalanceTo: '', rebalancePct: 20,
    newRequest: null, bulkResult: null
  }
}, buildSeedData());

/* ---------- UI class tokens (Tailwind) ---------- */
var UI = {
  card: 'bg-white rounded-xl border border-slate-200 shadow-sm',
  btn: 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50',
  btnSm: 'inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50',
  btnPrimary: 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50',
  btnPrimarySm: 'inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700',
  btnDanger: 'inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700',
  input: 'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100',
  label: 'block text-xs font-semibold text-slate-500 mb-1',
  th: 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 whitespace-nowrap',
  td: 'px-3 py-2 text-sm text-slate-700 align-top',
  chip: 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
  chipOn: 'border-blue-600 bg-blue-600 text-white',
  chipOff: 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
};

/* ---------- formatting ---------- */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatNum(n, dp) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
}
function formatCurrency(v) { return '₹' + formatNum(Math.round(v || 0)); }
function formatINRShort(v) {
  v = Number(v || 0);
  var a = Math.abs(v), sign = v < 0 ? '-' : '';
  if (a >= 1e7) return sign + '₹' + formatNum(a / 1e7, 2) + ' Cr';
  if (a >= 1e5) return sign + '₹' + formatNum(a / 1e5, 2) + ' L';
  return sign + '₹' + formatNum(a);
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  var p = String(s).split(/[-T:]/);
  return new Date(+p[0], (+p[1]) - 1, +p[2], +(p[3] || 0), +(p[4] || 0));
}
function formatDate(s) { var d = parseDate(s); if (!d || isNaN(d)) return '—'; return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
function formatDateTime(s) {
  var d = parseDate(s); if (!d || isNaN(d)) return '—';
  var h = d.getHours(), m = d.getMinutes();
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
function monthLabel(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0].slice(2); }
function daysBetween(a, b) { return (parseDate(b) - parseDate(a)) / 86400000; }
function daysAgo(s) { return daysBetween(s, DEMO_TODAY); }
function nowStamp() { return isoDateTime(new Date(DEMO_TODAY.getTime() + (Date.now() % 3600000))); }
function icon(name, cls) { return '<i data-lucide="' + name + '" class="' + (cls || 'w-4 h-4') + '"></i>'; }
function refreshIcons() { if (window.lucide && window.lucide.createIcons) { try { window.lucide.createIcons(); } catch (e) { /* icons are cosmetic */ } } }

/* ---------- lookups ---------- */
function currentUserName() { return ROLE_USERS[appState.role]; }
function stageByKey(k) { for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === k) return STAGES[i]; return null; }
function getBuyer(name) { for (var i = 0; i < appState.buyers.length; i++) if (appState.buyers[i].name === name) return appState.buyers[i]; return null; }
function getBuyerById(id) { for (var i = 0; i < appState.buyers.length; i++) if (appState.buyers[i].id === id) return appState.buyers[i]; return null; }
function getCategory(name) { for (var i = 0; i < appState.categories.length; i++) if (appState.categories[i].name === name) return appState.categories[i]; return null; }
function getCategoryById(id) { for (var i = 0; i < appState.categories.length; i++) if (appState.categories[i].id === id) return appState.categories[i]; return null; }
function getVendor(id) { for (var i = 0; i < appState.vendors.length; i++) if (appState.vendors[i].id === id) return appState.vendors[i]; return null; }
function getVendorByName(n) { for (var i = 0; i < appState.vendors.length; i++) if (appState.vendors[i].name === n) return appState.vendors[i]; return null; }
function getCarrierByName(n) { for (var i = 0; i < appState.carriers.length; i++) if (appState.carriers[i].name === n || appState.carriers[i].id === n) return appState.carriers[i]; return null; }
function getMaterial(no) { for (var i = 0; i < appState.materials.length; i++) if (appState.materials[i].materialNo === String(no)) return appState.materials[i]; return null; }

/* strict lookups: never fall back to the first record */
function findLine(id, silent) {
  for (var i = 0; i < appState.lines.length; i++) if (appState.lines[i].id === id) return appState.lines[i];
  if (!silent) showToast('Line ' + id + ' not found.', 'error');
  return null;
}
function findPO(no, silent) {
  for (var i = 0; i < appState.pos.length; i++) if (appState.pos[i].poNumber === String(no)) return appState.pos[i];
  if (!silent) showToast('PO ' + no + ' not found.', 'error');
  return null;
}
function linesOfPR(pr) { return appState.lines.filter(function (l) { return l.prNumber === pr; }); }

/* ---------- status helpers ---------- */
function isOpen(l) { return l.currentStatus !== 'CLOSED' && l.currentStatus !== 'CANCELLED'; }
function openLinesOf(buyerName) { return appState.lines.filter(function (l) { return l.assignedBuyer === buyerName && isOpen(l); }); }
function refreshBuyerLoads() {
  appState.buyers.forEach(function (b) { b.openLines = 0; });
  appState.lines.forEach(function (l) { if (isOpen(l)) { var b = getBuyer(l.assignedBuyer); if (b) b.openLines++; } });
}
function loadPct(b) { return Math.round((b.openLines / b.capacity) * 100); }

function slaInfo(l) {
  var st = stageByKey(l.currentStatus);
  if (!st || !st.sla) return { state: 'na', label: 'No SLA', icon: 'minus', cls: 'bg-slate-100 text-slate-500 border-slate-200', ratio: 0, remaining: null };
  var ratio = l.daysInStatus / st.sla;
  var remaining = Math.round((st.sla - l.daysInStatus) * 10) / 10;
  if (ratio > 1) return { state: 'breach', label: 'Breached', icon: 'circle-alert', cls: 'bg-red-50 text-red-700 border-red-200', ratio: ratio, remaining: remaining };
  if (ratio >= 0.75) return { state: 'risk', label: 'At risk', icon: 'clock', cls: 'bg-amber-50 text-amber-700 border-amber-200', ratio: ratio, remaining: remaining };
  return { state: 'on', label: 'On track', icon: 'circle-check', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', ratio: ratio, remaining: remaining };
}
function slaBadge(l) {
  var s = slaInfo(l);
  return '<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ' + s.cls + '">' + icon(s.icon, 'w-3 h-3') + s.label + '</span>';
}
var STATUS_STYLE = {
  'PENDING SPECS': 'bg-slate-100 text-slate-700 border-slate-200', 'INFO REQUIRED': 'bg-amber-50 text-amber-800 border-amber-200',
  'VENDOR OUTREACH': 'bg-sky-50 text-sky-800 border-sky-200', 'COMMERCIALS': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'NFA APPROVED': 'bg-violet-50 text-violet-800 border-violet-200', 'PO STAGE': 'bg-blue-50 text-blue-800 border-blue-200',
  'IN-TRANSIT': 'bg-cyan-50 text-cyan-800 border-cyan-200', 'GRN COMPLETED': 'bg-emerald-50 text-emerald-800 border-emerald-200',
  'CLOSED': 'bg-emerald-100 text-emerald-900 border-emerald-200', 'ON HOLD': 'bg-orange-50 text-orange-800 border-orange-200',
  'CANCELLED': 'bg-slate-100 text-slate-500 border-slate-200', 'NEW': 'bg-blue-50 text-blue-800 border-blue-200'
};
function statusBadge(status) {
  var st = stageByKey(status);
  return '<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ' + (STATUS_STYLE[status] || STATUS_STYLE.NEW) + '">' +
    icon(st ? st.icon : 'sparkles', 'w-3 h-3') + esc(st ? st.label : status) + '</span>';
}
var SHIP_ICON = { 'PO Awarded': 'file-check', 'Dispatched': 'package', 'In Transit': 'truck', 'At Guwahati': 'map-pin', 'Delivered': 'package-check' };
function shipBadge(stage) {
  var cls = stage === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : stage === 'At Guwahati' ? 'bg-violet-50 text-violet-700 border-violet-200' :
    stage === 'PO Awarded' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-sky-50 text-sky-700 border-sky-200';
  return '<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ' + cls + '">' + icon(SHIP_ICON[stage] || 'package', 'w-3 h-3') + esc(stage) + '</span>';
}

/* ---------- activity / threads ---------- */
function logActivity(line, action) {
  line.activityLog.push({ timestamp: nowStamp(), author: currentUserName(), role: appState.role, action: action });
}
function addThreadMessage(lineId, msg) {
  if (!appState.threads[lineId]) appState.threads[lineId] = [];
  var m = Object.assign({ id: 'm' + (appState.msgSeq++), author: currentUserName(), role: appState.role, status: null, attachment: '', assignedTo: '', timestamp: nowStamp() }, msg);
  appState.threads[lineId].push(m);
  return m;
}
function openQueryCount(lineId) {
  return (appState.threads[lineId] || []).filter(function (m) { return m.status === 'Open'; }).length;
}
function setLineStatus(line, status, note) {
  var prev = line.currentStatus;
  line.currentStatus = status;
  line.daysInStatus = 0;
  line.stageSlaDays = (stageByKey(status) || {}).sla || null;
  line.nextAction = NEXT_ACTION[status] || '—';
  logActivity(line, 'Status changed ' + prev + ' → ' + status + (note ? ' (' + note + ')' : ''));
}

/* ---------- "Backend": requester e-mail auto-correction ----------
   Order: (1) employee directory wins for a known name, (2) clean formatting,
   (3) fix near-miss company domains, (4) add the company domain if missing. */
var EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
function levenshtein(a, b) {
  var m = a.length, n = b.length, d = [], i, j;
  for (i = 0; i <= m; i++) d[i] = [i];
  for (j = 0; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function directoryEmail(name) {
  var r = REQUESTERS.filter(function (q) { return q.name.toLowerCase() === String(name || '').trim().toLowerCase(); })[0];
  return r ? emailFor(r.name) : null;
}
function correctEmail(raw, name) {
  var original = raw === null || raw === undefined ? '' : String(raw);
  var fixes = [];
  var s = original.trim().toLowerCase().replace(/\s+/g, '').replace(/\[at\]|\(at\)/g, '@').replace(/@+/g, '@').replace(/,/g, '.').replace(/\.+$/, '').replace(/\.{2,}/g, '.');
  if (s !== original) fixes.push('formatting');
  if (s && s.indexOf('@') < 0) { s = s + '@' + SITE.emailDomain; fixes.push('added company domain'); }
  var parts = s.split('@');
  if (parts.length === 2 && parts[1] !== SITE.emailDomain && levenshtein(parts[1], SITE.emailDomain) <= 3) {
    s = parts[0] + '@' + SITE.emailDomain; fixes.push('domain typo');
  }
  var dir = directoryEmail(name);
  if (dir && s !== dir) { s = dir; fixes.push('matched employee directory'); }
  var valid = EMAIL_RE.test(s);
  return { email: valid ? s : original.trim(), changed: valid && s !== original, valid: valid, original: original, reason: fixes.join(', ') };
}
/* corrects line.userEmail / prCreatorEmail in place (logged once) and returns the clean address */
function normaliseContactEmails(rec, isLine) {
  [['userEmail', 'user', 'Requester'], ['prCreatorEmail', 'prCreator', 'PR creator']].forEach(function (f) {
    if (!rec[f[1]]) return;
    var c = correctEmail(rec[f[0]], rec[f[1]]);
    if (c.changed) {
      rec[f[0] + 'Original'] = c.original;
      rec[f[0]] = c.email;
      if (isLine && rec.activityLog) rec.activityLog.push({ timestamp: nowStamp(), author: 'Email check', role: 'System', action: f[2] + ' e-mail auto-corrected "' + c.original.trim() + '" → ' + c.email + ' (' + c.reason + ')' });
    }
  });
  return rec;
}
function requesterEmail(l) { normaliseContactEmails(l, true); return l.userEmail; }
/* who a buyer query goes to: requester + PR creator (deduplicated) */
function queryRecipients(l) {
  normaliseContactEmails(l, true);
  var r = [{ name: l.user, email: l.userEmail, role: 'Requester' }];
  if (l.prCreator && l.prCreator !== l.user) r.push({ name: l.prCreator, email: l.prCreatorEmail, role: 'PR creator' });
  return r;
}
function recipientsLabel(l) { return queryRecipients(l).map(function (r) { return r.name; }).join(', '); }
var QUERY_STAGES = ['PENDING SPECS', 'VENDOR OUTREACH', 'COMMERCIALS'];
/* buyer raises a query: auto-assigned to requester + PR creator; pre-PO lines move to INFO REQUIRED */
function raiseBuyerQuery(l, text, type, items, attachment) {
  var to = recipientsLabel(l);
  var m = addThreadMessage(l.id, { type: type || 'Query', text: text, assignedTo: to, status: 'Open', attachment: attachment || '' });
  if (QUERY_STAGES.indexOf(l.currentStatus) >= 0) {
    l.missingItems = items && items.length ? items : [text.length > 80 ? text.slice(0, 77) + '…' : text];
    l.remindersCount = 0;
    setLineStatus(l, 'INFO REQUIRED', 'buyer query');
  } else if (l.currentStatus === 'INFO REQUIRED' && items && items.length) {
    items.forEach(function (i) { if (l.missingItems.indexOf(i) < 0) l.missingItems.push(i); });
  }
  logActivity(l, (type || 'Query') + ' auto-assigned to ' + queryRecipients(l).map(function (r) { return r.name + ' <' + r.email + '>'; }).join(' and ') + ' (notification simulated)');
  return m;
}
/* requester / PR creator replies: close open asks and move the ticket to VENDOR OUTREACH */
function recordUserReply(l, text, attachment) {
  (appState.threads[l.id] || []).forEach(function (m) { if (m.status === 'Open' && (m.type === 'Info request' || m.type === 'Query') && m.role !== 'Requester') m.status = 'Answered'; });
  var m = addThreadMessage(l.id, { type: 'Info provided', text: text, assignedTo: l.assignedBuyer, attachment: attachment || '' });
  if (l.currentStatus === 'INFO REQUIRED') {
    l.missingItems = [];
    setLineStatus(l, 'VENDOR OUTREACH', 'user replied – auto-moved');
    if (!l.rfq) l.rfq = { vendorsContacted: vendorsForCategory(appState.vendors, l.category).slice(0, 2).map(function (v) { return v.name; }), quotesReceived: 0, nextStep: 'Send RFQ with clarified specs' };
  }
  return m;
}

/* ---------- Delivery follow-up rules ---------- */
function poFlags(po) {
  var r = appState.settings.rules, flags = [];
  if (po.stage === 'Delivered') return flags;
  if (!po.awb && po.daysSincePo > r.A) flags.push({ rule: 'A', text: 'AWB not shared ' + po.daysSincePo + ' d after PO (> ' + r.A + ' d)' });
  if (po.awb && po.lastScanTime) {
    var since = Math.floor(daysAgo(po.lastScanTime));
    if (since > r.B && po.stage !== 'At Guwahati') flags.push({ rule: 'B', text: 'No carrier scan for ' + since + ' d (> ' + r.B + ' d)' });
    if (po.stage === 'At Guwahati' && since > r.C) flags.push({ rule: 'C', text: 'At Guwahati hub ' + since + ' d, not delivered (> ' + r.C + ' d)' });
  }
  if (po.committedEta && daysBetween(po.committedEta, DEMO_TODAY) > 0) flags.push({ rule: 'D', text: 'Committed ETA ' + formatDate(po.committedEta) + ' missed' });
  return flags;
}
function refreshPOFlags() {
  appState.pos.forEach(function (po) {
    var f = poFlags(po);
    po.isStuck = f.some(function (x) { return x.rule === 'B' || x.rule === 'C'; });
    po.isOverdue = f.some(function (x) { return x.rule === 'D'; });
  });
}
function getFollowUpLines(rule) {
  var out = [];
  appState.pos.forEach(function (po) {
    var f = poFlags(po);
    if (!f.length) return;
    if (rule && rule !== 'ALL' && !f.some(function (x) { return x.rule === rule; })) return;
    out.push({ po: po, flags: f });
  });
  return out;
}

/* ---------- permissions by role ---------- */
var PERMS = {
  'Buyer': ['reassign', 'changeStatus', 'thread', 'allocate', 'ingest', 'remind', 'createPO', 'recordAwb', 'grn', 'followup', 'outreach'],
  'Requester': ['thread', 'respond', 'ingest'],
  'Proc Ops': ['thread', 'createPO', 'recordAwb', 'grn', 'followup', 'importTracking'],
  'PMO Admin': ['reassign', 'changeStatus', 'thread', 'allocate', 'autoAllocate', 'ingest', 'remind', 'createPO', 'recordAwb', 'grn', 'followup', 'importTracking', 'masterData', 'settings', 'outreach', 'respond', 'ooo']
};
function can(action) { return PERMS[appState.role].indexOf(action) >= 0; }
function requirePerm(action) {
  if (can(action)) return true;
  showToast('Your role (' + appState.role + ') cannot do this.', 'error');
  return false;
}

/* ---------- toast ---------- */
function showToast(msg, type) {
  var root = document.getElementById('toast-root');
  if (!root) return;
  var styles = { success: ['circle-check', 'border-emerald-200 text-emerald-800'], error: ['circle-alert', 'border-red-200 text-red-800'],
    info: ['info', 'border-slate-200 text-slate-800'], warn: ['triangle-alert', 'border-amber-200 text-amber-800'] };
  var s = styles[type || 'info'] || styles.info;
  var el = document.createElement('div');
  el.className = 'toast pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3 py-2 text-sm shadow-lg ' + s[1];
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = icon(s[0], 'w-4 h-4 mt-0.5 shrink-0') + '<span>' + esc(msg) + '</span>';
  root.appendChild(el);
  refreshIcons();
  setTimeout(function () { el.style.opacity = '0'; }, 3200);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3600);
}

/* ---------- CSV + clipboard ---------- */
function csvCell(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadCsv(filename, rows) {
  var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8');
  showToast('Downloaded ' + filename + ' (' + (rows.length - 1) + ' rows)', 'success');
}
function downloadBlob(filename, content, mime) {
  var blob = new Blob([content], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function parseCsv(text) {
  var rows = [], row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
  return rows;
}
function copyText(text) {
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
  }
  return Promise.resolve(fallback());
}

/* ---------- tiny UI builders ---------- */
function kpiTile(label, value, sub, iconName, tone, onclick) {
  var tones = { blue: 'text-blue-600 bg-blue-50', amber: 'text-amber-600 bg-amber-50', green: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50', slate: 'text-slate-600 bg-slate-100', violet: 'text-violet-600 bg-violet-50', cyan: 'text-cyan-600 bg-cyan-50' };
  var tag = onclick ? 'button type="button" onclick="' + onclick + '"' : 'div';
  return '<' + tag + ' class="' + UI.card + ' p-4 text-left w-full ' + (onclick ? 'hover:border-blue-300' : '') + '">' +
    '<div class="flex items-center justify-between"><span class="text-xs font-semibold uppercase tracking-wide text-slate-500">' + esc(label) + '</span>' +
    '<span class="rounded-lg p-1.5 ' + (tones[tone] || tones.slate) + '">' + icon(iconName, 'w-4 h-4') + '</span></div>' +
    '<div class="mt-2 text-2xl font-bold text-slate-900">' + value + '</div>' +
    (sub ? '<div class="mt-1 text-xs text-slate-500">' + sub + '</div>' : '') + '</' + (onclick ? 'button' : 'div') + '>';
}
function pageHeader(title, subtitle, actions) {
  return '<div class="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 class="text-xl font-bold text-slate-900">' + esc(title) + '</h1>' +
    (subtitle ? '<p class="mt-0.5 text-sm text-slate-500">' + subtitle + '</p>' : '') + '</div>' +
    (actions ? '<div class="flex flex-wrap items-center gap-2">' + actions + '</div>' : '') + '</div>';
}
function emptyState(text) {
  return '<div class="px-4 py-10 text-center text-sm text-slate-500">' + icon('inbox', 'w-6 h-6 mx-auto mb-2 text-slate-400') + esc(text) + '</div>';
}
function chip(label, active, onclick, extra) {
  return '<button type="button" class="' + UI.chip + ' ' + (active ? UI.chipOn : UI.chipOff) + '" onclick="' + onclick + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
    (active ? icon('check', 'w-3 h-3') : '') + esc(label) + (extra !== undefined && extra !== '' ? ' <span class="opacity-75">(' + extra + ')</span>' : '') + '</button>';
}
function selectOptions(list, current, allLabel) {
  var html = allLabel !== undefined ? '<option value="">' + esc(allLabel) + '</option>' : '';
  list.forEach(function (o) {
    var v = typeof o === 'object' ? o.value : o, t = typeof o === 'object' ? o.label : o;
    html += '<option value="' + esc(v) + '"' + (String(v) === String(current) ? ' selected' : '') + '>' + esc(t) + '</option>';
  });
  return html;
}
function tableWrap(headHtml, bodyHtml) {
  return '<div class="overflow-x-auto"><table class="min-w-full divide-y divide-slate-200"><thead><tr>' + headHtml + '</tr></thead><tbody class="divide-y divide-slate-100">' + bodyHtml + '</tbody></table></div>';
}
function ths(list) { return list.map(function (h) { return '<th class="' + UI.th + '">' + h + '</th>'; }).join(''); }
function pager(page, total, size, fnName) {
  var pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return '<div class="px-3 py-2 text-xs text-slate-500">' + total + ' rows</div>';
  return '<div class="flex items-center justify-between px-3 py-2 text-xs text-slate-500"><span>Showing ' + (page * size + 1) + '–' + Math.min(total, (page + 1) * size) + ' of ' + total + '</span>' +
    '<span class="flex gap-1"><button class="' + UI.btnSm + '" onclick="' + fnName + '(' + (page - 1) + ')"' + (page <= 0 ? ' disabled' : '') + '>' + icon('chevron-left', 'w-3 h-3') + 'Prev</button>' +
    '<button class="' + UI.btnSm + '" onclick="' + fnName + '(' + (page + 1) + ')"' + (page >= pages - 1 ? ' disabled' : '') + '>Next' + icon('chevron-right', 'w-3 h-3') + '</button></span></div>';
}
function lineRef(l) { return '<span class="font-mono text-xs">' + esc(l.prNumber) + '/' + esc(l.line) + '</span>'; }
function oooBadge() { return '<span class="ml-1 inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">' + icon('user-x', 'w-3 h-3') + 'OOO</span>'; }

/* ---------- category helpers (6 categories, each with a buyer pool + fallback) ---------- */
function categoryPool(cat) { return (cat ? cat.buyers : []).map(getBuyer).filter(function (b) { return b; }); }
function poolLabel(cat) {
  return cat.buyers.map(function (n) { var b = getBuyer(n); return n + (b && b.ooo ? ' (OOO)' : ''); }).join(', ') + ' · fallback ' + cat.fallback;
}

/* boot: the "backend" cleans requester / PR-creator e-mails on everything already in the tower */
appState.lines.forEach(function (l) { normaliseContactEmails(l, true); });
appState.unallocated.forEach(function (u) { normaliseContactEmails(u, false); });
refreshBuyerLoads();
refreshPOFlags();
