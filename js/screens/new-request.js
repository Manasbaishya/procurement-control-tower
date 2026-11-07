/* New Request: simulated SAP "Fetch PR", request details (department, requesting team, NBD),
   pick lines, override category, ingest into the tower */
function lineInTower(pr, line) {
  var id = pr + '-' + line;
  if (findLine(id, true)) return 'In tower';
  if (findIntake(id)) return 'Awaiting allocation';
  return '';
}
function renderNewRequestScreen() {
  var nr = appState.ui.newRequest;
  var demo = Object.keys(appState.sapPrs);
  var html = pageHeader('New request', 'Fetch a PR from SAP (simulated lookup on sample PRs), confirm department, requesting team and need-by date, choose lines and ingest into the tower.') +
    '<section class="' + UI.card + ' p-4"><div class="flex flex-wrap items-end gap-3"><div><label class="' + UI.label + '" for="nr-pr">SAP PR number (10 digits)</label>' +
    '<input id="nr-pr" class="' + UI.input + ' w-56 font-mono" maxlength="10" inputmode="numeric" placeholder="e.g. ' + demo[0] + '" value="' + esc(nr ? nr.prNumber : '') + '" onkeydown="if(event.key===\'Enter\')fetchPR()"></div>' +
    '<button type="button" class="' + UI.btnPrimary + '" onclick="fetchPR()">' + icon('search', 'w-4 h-4') + 'Fetch PR</button>' +
    (nr ? '<button type="button" class="' + UI.btn + '" onclick="clearNewRequest()">' + icon('x', 'w-4 h-4') + 'Clear</button>' : '') + '</div>' +
    '<p class="mt-2 text-xs text-slate-500">Sample PRs: ' + demo.map(function (p) { return '<button type="button" class="font-mono text-blue-700 underline" onclick="fetchPR(\'' + p + '\')">' + p + '</button>'; }).join(', ') +
    '. A PR already in the tower (e.g. <span class="font-mono">' + esc(appState.lines[0].prNumber) + '</span>) shows its lines as blocked duplicates. No SAP connection is made.</p></section>';
  if (!nr || !nr.pr) return html;
  var pr = nr.pr, today = isoDate(DEMO_TODAY);
  var em = correctEmail(pr.userEmail || pr.user, pr.user);
  var details = '<section class="' + UI.card + ' mt-4 p-4"><h2 class="mb-3 text-sm font-semibold text-slate-800">Request details</h2>' +
    '<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">' +
    kv('PR', '<span class="font-mono">' + esc(pr.prNumber) + '</span> · ' + esc(pr.prStatus) + ' · ' + formatDate(pr.prCreationDate)) +
    kv('Requester', esc(pr.user) + ' · HOD ' + esc(pr.userHod)) +
    kv('Requester e-mail (for communication)', '<span class="font-mono text-xs">' + esc(em.email) + '</span>' +
      (em.changed ? '<div class="text-[11px] text-emerald-700">' + icon('wand-sparkles', 'w-3 h-3 inline') + ' Auto-corrected from “' + esc(String(pr.userEmail).trim()) + '” (' + esc(em.reason) + ')</div>' : '<div class="text-[11px] text-slate-500">' + icon('circle-check', 'w-3 h-3 inline') + ' Verified against employee directory</div>')) +
    kv('PR creator', esc(pr.prCreator || pr.user) + '<div class="text-[11px] text-slate-500">Buyer queries go to requester + PR creator</div>') + '</div>' +
    '<div class="mt-4 grid gap-4 sm:grid-cols-3">' +
    '<div><label class="' + UI.label + '" for="nr-dept">Department (required)</label><select id="nr-dept" class="' + UI.input + ' w-full" onchange="setNrField(\'department\',this.value)">' + selectOptions(DEPARTMENTS, nr.department, 'Select department…') + '</select></div>' +
    '<div><label class="' + UI.label + '" for="nr-team">Requesting team (required)</label><select id="nr-team" class="' + UI.input + ' w-full" onchange="setNrField(\'team\',this.value)">' + selectOptions(REQUESTING_TEAMS, nr.team, 'Select team…') + '</select></div>' +
    '<div><label class="' + UI.label + '" for="nr-nbd">Need-by date – NBD (required)</label><div class="relative">' + icon('calendar-days', 'w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none') +
    '<input id="nr-nbd" type="date" class="' + UI.input + ' w-full pl-8" min="' + today + '" value="' + esc(nr.nbd) + '" onchange="setNrNbd(this.value)"></div>' +
    '<p class="mt-1 text-[11px] text-slate-500">Applies to every selected line; change a single line below if needed.</p></div></div></section>';

  var rows = pr.lines.map(function (l, i) {
    var dup = lineInTower(pr.prNumber, l.line);
    var cur = nr.overrides[l.line] || l.category;
    var curCat = getCategory(cur);
    var lineNbd = nr.lineNbd[l.line] || nr.nbd;
    return '<tr class="' + (dup ? 'bg-slate-50 text-slate-400' : '') + '"><td class="' + UI.td + '"><input type="checkbox" aria-label="Pick line ' + l.line + '" ' + (dup ? 'disabled' : nr.selected[l.line] ? 'checked' : '') + ' onchange="toggleNrLine(' + i + ',this.checked)"></td>' +
      '<td class="' + UI.td + ' font-mono text-xs">' + l.line + '</td><td class="' + UI.td + '">' + esc(l.materialDescription) + '<div class="text-xs text-slate-500">' + esc(l.materialNo) + '</div></td>' +
      '<td class="' + UI.td + '">' + formatNum(l.quantity) + ' ' + esc(l.uom) + '</td><td class="' + UI.td + ' text-right">' + formatINRShort(l.estimatedValue) + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + esc(l.category) + '</td>' +
      '<td class="' + UI.td + '">' + (dup ? '<span class="inline-flex items-center gap-1 text-xs font-medium text-amber-700">' + icon('ban', 'w-3 h-3') + 'Duplicate – ' + esc(dup) + '</span>' :
        '<select class="' + UI.input + ' text-xs" aria-label="Category for line ' + l.line + '" onchange="setNrOverride(' + i + ',this.value)">' + selectOptions(appState.categories.map(function (c) { return { value: c.id, label: c.name }; }), curCat ? curCat.id : '') + '</select>' +
        (cur !== l.category ? '<div class="text-[11px] text-blue-700">Overridden from ' + esc(l.category) + '</div>' : '')) + '</td>' +
      '<td class="' + UI.td + '">' + (dup ? '—' : '<input type="date" class="' + UI.input + ' text-xs" aria-label="NBD for line ' + l.line + '" min="' + today + '" value="' + esc(lineNbd) + '" onchange="setNrLineNbd(' + i + ',this.value)">') + '</td>' +
      '<td class="' + UI.td + ' text-xs">' + (dup ? '—' : esc(curCat ? curCat.buyers.join(', ') : '—')) + '</td></tr>';
  }).join('');
  var n = pr.lines.filter(function (l) { return nr.selected[l.line] && !lineInTower(pr.prNumber, l.line); }).length;
  return html + details + '<section class="' + UI.card + ' mt-4">' +
    tableWrap('<th class="' + UI.th + '"></th>' + ths(['Line', 'Material', 'Qty', 'Est. value', 'SAP category', 'Tower category', 'NBD', 'Buyer pool']), rows) +
    '<div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3"><span class="text-xs text-slate-500">' + n + ' line(s) selected · they go to Work Allocation</span>' +
    '<button type="button" class="' + UI.btnPrimary + '" onclick="ingestNewRequest()"' + (n ? '' : ' disabled') + '>' + icon('download', 'w-4 h-4') + 'Ingest into tower</button></div></section>';
}
function fetchPR(prArg) {
  var prNo = String(prArg || fieldVal('nr-pr')).trim();
  if (!/^\d{10}$/.test(prNo)) { showToast('PR number must be exactly 10 digits.', 'error'); return; }
  var pr = appState.sapPrs[prNo];
  if (!pr) {
    var tower = linesOfPR(prNo);
    if (!tower.length) { appState.ui.newRequest = { prNumber: prNo, pr: null, selected: {}, overrides: {}, lineNbd: {} }; showToast('PR ' + prNo + ' not found in SAP (simulated lookup).', 'error'); rerender(); return; }
    var t0 = tower[0];
    pr = { prNumber: prNo, user: t0.user, userEmail: t0.userEmail, department: t0.department, requestingTeam: t0.requestingTeam, userHod: t0.userHod,
      prCreator: t0.prCreator, prCreatorEmail: t0.prCreatorEmail, prStatus: t0.prStatus, prCreationDate: t0.prCreationDate,
      lines: tower.map(function (l) { return { line: l.line, materialNo: l.materialNo, materialDescription: l.materialDescription, quantity: l.quantity, uom: l.uom, category: l.category, estimatedValue: l.estimatedValue, requiredDeliveryDate: l.requiredDeliveryDate }; }) };
  }
  var sel = {};
  pr.lines.forEach(function (l) { if (!lineInTower(prNo, l.line)) sel[l.line] = true; });
  var dates = pr.lines.map(function (l) { return l.requiredDeliveryDate; }).filter(function (d) { return d && d >= isoDate(DEMO_TODAY); }).sort();
  appState.ui.newRequest = { prNumber: prNo, pr: pr, selected: sel, overrides: {}, lineNbd: {},
    department: DEPARTMENTS.indexOf(pr.department) >= 0 ? pr.department : '', team: REQUESTING_TEAMS.indexOf(pr.requestingTeam) >= 0 ? pr.requestingTeam : '', nbd: dates[0] || '' };
  showToast('PR ' + prNo + ' fetched (simulated SAP lookup) · ' + pr.lines.length + ' lines', 'success');
  rerender();
}
function clearNewRequest() { appState.ui.newRequest = null; rerender(); }
function nrLine(i) {
  var nr = appState.ui.newRequest;
  if (!nr || !nr.pr || !nr.pr.lines[i]) { showToast('Line not found – fetch the PR again.', 'error'); return null; }
  return nr.pr.lines[i];
}
function setNrField(key, v) {
  var nr = appState.ui.newRequest;
  if (!nr || !nr.pr) { showToast('Fetch a PR first.', 'error'); return; }
  if (key === 'department' && v && DEPARTMENTS.indexOf(v) < 0) { showToast('Unknown department.', 'error'); return; }
  if (key === 'team' && v && REQUESTING_TEAMS.indexOf(v) < 0) { showToast('Unknown requesting team.', 'error'); return; }
  nr[key] = v;
}
function validNbd(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') && v >= isoDate(DEMO_TODAY); }
function setNrNbd(v) {
  var nr = appState.ui.newRequest;
  if (!nr || !nr.pr) { showToast('Fetch a PR first.', 'error'); return; }
  if (v && !validNbd(v)) { showToast('NBD cannot be in the past.', 'error'); rerender(); return; }
  nr.nbd = v; nr.lineNbd = {};
  rerender();
}
function setNrLineNbd(i, v) {
  var l = nrLine(i); if (!l) return;
  if (v && !validNbd(v)) { showToast('NBD cannot be in the past.', 'error'); rerender(); return; }
  appState.ui.newRequest.lineNbd[l.line] = v;
}
function toggleNrLine(i, on) { var l = nrLine(i); if (!l) return; appState.ui.newRequest.selected[l.line] = !!on; rerender(); }
function setNrOverride(i, catId) {
  var l = nrLine(i); if (!l) return;
  var c = getCategoryById(catId);
  if (!c) { showToast('Category not found.', 'error'); return; }
  appState.ui.newRequest.overrides[l.line] = c.name;
  rerender();
}
function ingestNewRequest() {
  if (!requirePerm('ingest')) return;
  var nr = appState.ui.newRequest;
  if (!nr || !nr.pr) { showToast('Fetch a PR first.', 'error'); return; }
  var missing = [];
  if (!nr.department) missing.push('department');
  if (!nr.team) missing.push('requesting team');
  if (!validNbd(nr.nbd)) missing.push('need-by date (today or later)');
  if (missing.length) { showToast('Please fill: ' + missing.join(', '), 'error'); return; }
  var pr = nr.pr, n = 0, blocked = 0, corrected = false;
  pr.lines.forEach(function (l) {
    if (!nr.selected[l.line]) return;
    if (lineInTower(pr.prNumber, l.line)) { blocked++; return; }
    var u = addIntake({ id: pr.prNumber + '-' + l.line, prNumber: pr.prNumber, line: l.line, materialNo: l.materialNo, materialDescription: l.materialDescription,
      quantity: l.quantity, uom: l.uom, department: nr.department, requestingTeam: nr.team, category: nr.overrides[l.line] || l.category,
      user: pr.user, userEmail: pr.userEmail || pr.user, userHod: pr.userHod, prCreator: pr.prCreator || pr.user, prCreatorEmail: pr.prCreatorEmail || pr.userEmail,
      requiredDeliveryDate: validNbd(nr.lineNbd[l.line]) ? nr.lineNbd[l.line] : nr.nbd, prStatus: pr.prStatus, prCreationDate: pr.prCreationDate, estimatedValue: l.estimatedValue,
      source: 'New Request (' + currentUserName() + ')', receivedAt: nowStamp() });
    if (u.userEmailOriginal) corrected = true;
    n++;
  });
  if (!n) { showToast('Nothing to ingest' + (blocked ? ' – ' + blocked + ' duplicate line(s) blocked' : ''), 'error'); return; }
  appState.ui.newRequest = null;
  showToast(n + ' line(s) of PR ' + pr.prNumber + ' ingested · waiting in Work Allocation' + (corrected ? ' · requester e-mail auto-corrected' : ''), 'success');
  rerender();
}
