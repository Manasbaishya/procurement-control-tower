/* Bulk Upload: drag-drop CSV (parsed for real) / XLSX (simulated), diagnostics, template, batch jobs */
var BULK_COLUMNS = ['prNumber', 'line', 'materialNo', 'materialDescription', 'quantity', 'uom', 'category', 'department', 'requestingTeam', 'user', 'userEmail', 'prCreator', 'estimatedValue', 'requiredDeliveryDate'];

function bulkSampleRows() {
  function mat(cat, i) { return appState.materials.filter(function (x) { return x.category === cat; })[i]; }
  var a = mat('Mfg & Ops', 0), b = mat('Material', 1), c = mat('IT', 0), d = mat('Indirects', 2);
  var existing = appState.lines[3];
  function nbd(n) { return isoDate(addDays(DEMO_TODAY, n)); }
  return [BULK_COLUMNS,
    ['1004599301', '10', a.materialNo, a.description, '20', a.uom, a.category, 'Fab Maintenance', 'Production', 'Ananya Kalita', ' Ananya.Kalita@TataElectronics.Example', 'Ananya Kalita', String(20 * a.unitPrice), nbd(30)],
    ['1004599301', '20', b.materialNo, b.description, '4', b.uom, b.category, 'Fab Maintenance', 'Production', 'Ananya Kalita', 'ananya.kalita@tataelectronic.exmaple', 'Ananya Kalita', String(4 * b.unitPrice), nbd(30)],
    ['1004599302', '10', c.materialNo, c.description, '1', c.uom, c.category, 'IT & Automation', 'Engineering', 'Bikash Deka', 'bikash.deka', 'Kavya Menon', String(c.unitPrice), nbd(25)],
    ['1004599302', '10', c.materialNo, c.description, '1', c.uom, c.category, 'IT & Automation', 'Engineering', 'Bikash Deka', 'bikash.deka', 'Kavya Menon', String(c.unitPrice), nbd(25)],
    ['1004599303', '10', '9999999', 'Unlisted adaptor plate', '2', 'EA', 'Mfg & Ops', 'Quality', 'Quality', 'Shreya Iyer', 'shreya.iyer@tataelectronics.example', 'Shreya Iyer', '18000', nbd(40)],
    [existing.prNumber, String(existing.line), existing.materialNo, existing.materialDescription, String(existing.quantity), existing.uom, existing.category, existing.department, existing.requestingTeam, existing.user, existing.userEmail, existing.prCreator, String(existing.estimatedValue), existing.requiredDeliveryDate],
    ['1004599304', '10', d.materialNo, d.description, '6', d.uom, d.category, 'Process Engineering', 'Engineering', 'Manash Baishya', 'manash.baishya@@tataelectronics.example.', 'Manash Baishya', String(6 * d.unitPrice), nbd(35)]
  ];
}

function renderBulkUploadScreen() {
  var r = appState.ui.bulkResult;
  var jobs = appState.batchJobs.map(function (j) {
    return '<tr><td class="' + UI.td + ' font-mono text-xs">' + esc(j.id) + '</td><td class="' + UI.td + ' text-xs">' + esc(j.file) + '</td><td class="' + UI.td + '">' + j.rows + '</td><td class="' + UI.td + '">' + j.valid + '</td>' +
      '<td class="' + UI.td + '">' + j.duplicates + '</td><td class="' + UI.td + '">' + j.unknown + '</td><td class="' + UI.td + ' text-xs">' + esc(j.status) + '</td><td class="' + UI.td + ' text-xs">' + formatDateTime(j.at) + ' · ' + esc(j.by) + '</td></tr>';
  }).join('');
  var diag = '';
  if (r) {
    var ok = r.rows.filter(function (x) { return !x.errors.length; });
    var rows = r.rows.map(function (x) {
      return '<tr class="' + (x.errors.length ? 'bg-red-50/50' : '') + '"><td class="' + UI.td + ' text-xs">' + x.rowNo + '</td><td class="' + UI.td + ' font-mono text-xs">' + esc(x.d.prNumber) + '/' + esc(x.d.line) + '</td>' +
        '<td class="' + UI.td + ' text-xs">' + esc(x.d.materialDescription) + '<div class="text-slate-500">' + esc(x.d.materialNo) + '</div></td><td class="' + UI.td + ' text-xs">' + esc(x.d.category) + '</td>' +
        '<td class="' + UI.td + ' text-xs">' + (x.errors.length ? '<span class="text-red-700">' + icon('circle-x', 'w-3 h-3 inline') + ' ' + esc(x.errors.join('; ')) + '</span>' : '<span class="text-emerald-700">' + icon('circle-check', 'w-3 h-3 inline') + ' Valid</span>') + '</td>' +
        '<td class="' + UI.td + ' text-xs">' + (x.route ? esc(x.route) : '—') +
        (x.d.emailNote ? '<div class="text-emerald-700">' + icon('wand-sparkles', 'w-3 h-3 inline') + ' ' + esc(x.d.emailNote) + '</div>' : '') + '</td></tr>';
    }).join('');
    diag = '<section class="' + UI.card + ' mt-4"><div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3"><h2 class="text-sm font-semibold text-slate-800">Parser diagnostics · ' + esc(r.file) + '</h2>' +
      (r.simulated ? '<span class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">' + icon('flask-conical', 'w-3 h-3 inline') + ' XLSX parsing simulated with sample rows</span>' : '') +
      '<span class="ml-auto flex gap-2 text-xs"><span class="text-slate-600">' + r.rows.length + ' rows</span><span class="text-emerald-700">' + ok.length + ' valid</span>' +
      '<span class="text-red-700">' + r.counts.duplicates + ' duplicates</span><span class="text-amber-700">' + r.counts.unknownMaterial + ' unknown material</span><span class="text-red-700">' + r.counts.other + ' other errors</span></span></div>' +
      tableWrap(ths(['Row', 'PR / line', 'Material', 'Category', 'Result', 'Auto-assign result']), rows) +
      '<div class="flex justify-end gap-2 border-t border-slate-200 px-4 py-3"><button type="button" class="' + UI.btn + '" onclick="clearBulk()">Discard</button>' +
      '<button type="button" class="' + UI.btnPrimary + '" onclick="ingestBulk()"' + (ok.length ? '' : ' disabled') + '>' + icon('download', 'w-4 h-4') + 'Ingest ' + ok.length + ' valid row(s)</button></div></section>';
  }
  return pageHeader('Bulk upload', 'Upload many PR lines at once. CSV is parsed in the browser; XLSX is simulated in this prototype.',
      '<button type="button" class="' + UI.btn + '" onclick="downloadBulkTemplate()">' + icon('file-down', 'w-4 h-4') + 'Sample template</button>' +
      '<button type="button" class="' + UI.btn + '" onclick="loadBulkSample()">' + icon('flask-conical', 'w-4 h-4') + 'Try with sample file</button>') +
    '<label id="bulk-drop" for="bulk-file" class="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-10 text-center hover:border-blue-400">' +
    icon('cloud-upload', 'w-8 h-8 text-slate-400') + '<span class="mt-2 text-sm font-semibold text-slate-700">Drag & drop a CSV or XLSX file here</span><span class="text-xs text-slate-500">or click to choose · columns: ' + BULK_COLUMNS.join(', ') + '</span>' +
    '<input id="bulk-file" type="file" accept=".csv,.xlsx,.xls" class="sr-only" onchange="handleBulkFile(this.files[0])"></label>' + diag +
    '<section class="' + UI.card + ' mt-5"><h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">Recent batch jobs</h2>' +
    tableWrap(ths(['Batch', 'File', 'Rows', 'Valid', 'Duplicates', 'Unknown', 'Status', 'When / by']), jobs) + '</section>';
}
function initBulkUpload() {
  var z = document.getElementById('bulk-drop');
  if (!z) return;
  z.addEventListener('dragover', function (e) { e.preventDefault(); z.classList.add('border-blue-500', 'bg-blue-50'); });
  z.addEventListener('dragleave', function () { z.classList.remove('border-blue-500', 'bg-blue-50'); });
  z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('border-blue-500', 'bg-blue-50'); if (e.dataTransfer.files[0]) handleBulkFile(e.dataTransfer.files[0]); });
}
function handleBulkFile(file) {
  if (!file) return;
  var name = file.name || 'upload';
  if (/\.xlsx?$/i.test(name)) { analyseBulk(bulkSampleRows(), name, true); return; }
  if (!/\.csv$/i.test(name)) { showToast('Only .csv or .xlsx files are supported.', 'error'); return; }
  var reader = new FileReader();
  reader.onload = function () { analyseBulk(parseCsv(String(reader.result)), name, false); };
  reader.onerror = function () { showToast('Could not read ' + name, 'error'); };
  reader.readAsText(file);
}
function loadBulkSample() { analyseBulk(bulkSampleRows(), 'sample_intake.csv', false); }
function analyseBulk(rows, fileName, simulated) {
  if (rows.length < 2) { showToast('File has no data rows.', 'error'); return; }
  var head = rows[0].map(function (h) { return h.trim(); });
  var missing = ['prNumber', 'line', 'materialNo', 'quantity', 'category'].filter(function (c) { return head.indexOf(c) < 0; });
  if (missing.length) { showToast('Missing required columns: ' + missing.join(', '), 'error'); return; }
  var seen = {}, counts = { duplicates: 0, unknownMaterial: 0, other: 0 };
  var out = rows.slice(1).map(function (r, i) {
    var d = {};
    head.forEach(function (h, k) { d[h] = (r[k] || '').trim(); });
    var errors = [], key = d.prNumber + '-' + d.line;
    if (!/^\d{10}$/.test(d.prNumber)) { errors.push('PR must be 10 digits'); counts.other++; }
    if (!/^\d+$/.test(d.line)) { errors.push('Line must be a number'); counts.other++; }
    if (!(Number(d.quantity) > 0)) { errors.push('Quantity must be > 0'); counts.other++; }
    if (seen[key]) { errors.push('Duplicate of row ' + seen[key] + ' in file'); counts.duplicates++; }
    else if (lineInTower(d.prNumber, d.line)) { errors.push('Duplicate – already ' + lineInTower(d.prNumber, d.line).toLowerCase()); counts.duplicates++; }
    seen[key] = seen[key] || (i + 2);
    var mat = getMaterial(d.materialNo);
    if (!mat) { errors.push('Unknown material ' + d.materialNo); counts.unknownMaterial++; }
    if (!getCategory(d.category)) { errors.push('Unknown category (use ' + appState.categories.map(function (c) { return c.name; }).join(' / ') + ')'); counts.other++; }
    if (d.requestingTeam && REQUESTING_TEAMS.indexOf(d.requestingTeam) < 0) { errors.push('Unknown requesting team'); counts.other++; }
    if (d.requiredDeliveryDate && d.requiredDeliveryDate < isoDate(DEMO_TODAY)) { errors.push('NBD is in the past'); counts.other++; }
    var em = correctEmail(d.userEmail || d.user, d.user);
    d.emailNote = em.changed ? 'E-mail auto-corrected → ' + em.email : '';
    return { rowNo: i + 2, d: d, errors: errors, mat: mat };
  });
  var valid = out.filter(function (x) { return !x.errors.length; });
  var plan = computeAutoAllocation(valid.map(function (x) { return { id: x.d.prNumber + '-' + x.d.line, prNumber: x.d.prNumber, category: x.d.category }; }));
  plan.forEach(function (p) { valid.forEach(function (x) { if (p.lineIds.indexOf(x.d.prNumber + '-' + x.d.line) >= 0) x.route = p.buyer + (p.reason ? ' · ' + p.reason : ''); }); });
  appState.ui.bulkResult = { file: fileName, rows: out, counts: counts, simulated: simulated };
  showToast('Parsed ' + out.length + ' rows from ' + fileName, 'info');
  rerender();
}
function clearBulk() { appState.ui.bulkResult = null; rerender(); }
function ingestBulk() {
  if (!requirePerm('ingest')) return;
  var r = appState.ui.bulkResult;
  if (!r) { showToast('Upload a file first.', 'error'); return; }
  var n = 0;
  r.rows.forEach(function (x) {
    if (x.errors.length || lineInTower(x.d.prNumber, x.d.line)) return;
    var req = REQUESTERS.filter(function (q) { return q.name === x.d.user; })[0];
    var creator = x.d.prCreator || x.d.user || 'Unknown requester';
    addIntake({ id: x.d.prNumber + '-' + x.d.line, prNumber: x.d.prNumber, line: Number(x.d.line), materialNo: x.d.materialNo,
      materialDescription: x.d.materialDescription || x.mat.description, quantity: Number(x.d.quantity), uom: x.d.uom || x.mat.uom,
      department: x.d.department || (req ? req.dept : '—'), requestingTeam: x.d.requestingTeam || (req ? req.team : 'Other'), category: x.d.category,
      user: x.d.user || 'Unknown requester', userEmail: x.d.userEmail || x.d.user || '',
      prCreator: creator, prCreatorEmail: directoryEmail(creator) || x.d.userEmail || '',
      userHod: req ? req.hod : '—', requiredDeliveryDate: x.d.requiredDeliveryDate || isoDate(addDays(DEMO_TODAY, 30)), prStatus: 'Released',
      prCreationDate: isoDate(DEMO_TODAY), estimatedValue: Number(x.d.estimatedValue) || Number(x.d.quantity) * x.mat.unitPrice,
      source: 'Bulk upload ' + r.file, receivedAt: nowStamp() });
    n++;
  });
  appState.batchJobs.unshift({ id: 'B-' + isoDate(DEMO_TODAY).slice(2, 4) + isoDate(DEMO_TODAY).slice(5, 7) + '-' + (appState.batchJobs.length + 1), file: r.file, rows: r.rows.length, valid: n,
    duplicates: r.counts.duplicates, unknown: r.counts.unknownMaterial, status: n === r.rows.length ? 'Ingested' : n ? 'Partially ingested' : 'Rejected', at: nowStamp(), by: currentUserName() });
  appState.ui.bulkResult = null;
  showToast(n + ' line(s) ingested · waiting in Work Allocation', 'success');
  rerender();
}
function downloadBulkTemplate() { downloadCsv('bulk_upload_template.csv', bulkSampleRows()); }
