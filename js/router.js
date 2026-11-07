/* =====================================================================
   NAV_ITEMS, sidebar, hash router, role switch, tour, download
   ===================================================================== */
var ALL_ROLES = ['Buyer', 'Requester', 'Proc Ops', 'PMO Admin'];
var NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'house', roles: ALL_ROLES, render: renderHomeScreen },
  { id: 'work-allocation', label: 'Work Allocation', icon: 'shuffle', roles: ['Buyer', 'PMO Admin'], render: renderWorkAllocationScreen,
    badge: function () { return appState.unallocated.length; } },
  { id: 'my-queue', label: 'My Work Queue', icon: 'inbox', roles: ['Buyer', 'PMO Admin'], render: renderWorkQueueScreen,
    badge: function () { return openLinesOf(queueBuyerName()).length; } },
  { id: 'all-requests', label: 'All Requests', icon: 'list', roles: ALL_ROLES, render: renderAllRequestsScreen, init: initAllRequests },
  { id: 'new-request', label: 'New Request', icon: 'file-plus', roles: ALL_ROLES, render: renderNewRequestScreen },
  { id: 'bulk-upload', label: 'Bulk Upload', icon: 'upload', roles: ['Buyer', 'PMO Admin'], render: renderBulkUploadScreen, init: initBulkUpload },
  { id: 'user-pending', label: 'User Pending Actions', icon: 'clock', roles: ['Buyer', 'PMO Admin'], render: renderUserPendingScreen,
    badge: function () { return pendingInfoLines().length; } },
  { id: 'user-response', label: 'User Response Portal', icon: 'message-square', roles: ['Requester', 'PMO Admin'], render: renderUserResponseScreen,
    badge: function () { return responsePortalLines().length; } },
  { id: 'vendor-outreach', label: 'Vendor Outreach', icon: 'send', roles: ['Buyer', 'PMO Admin'], render: renderVendorOutreachScreen,
    badge: function () { return outreachLines().length; } },
  { id: 'po-ops', label: 'PO / Proc Ops', icon: 'shopping-cart', roles: ['Buyer', 'Proc Ops', 'PMO Admin'], render: renderPoOpsScreen, init: initPoOps },
  { id: 'delivery-followup', label: 'Delivery Follow-Up', icon: 'truck', roles: ['Buyer', 'Proc Ops', 'PMO Admin'], render: renderDeliveryFollowupScreen,
    badge: function () { return getFollowUpLines('ALL').length; }, badgeTone: 'red' },
  { id: 'grn', label: 'GRN / Closure', icon: 'package-check', roles: ['Buyer', 'Proc Ops', 'PMO Admin'], render: renderGrnScreen,
    badge: function () { return grnLines().length; } },
  { id: 'analytics', label: 'Analytics', icon: 'activity', roles: ['Buyer', 'Proc Ops', 'PMO Admin'], render: renderAnalyticsScreen },
  { id: 'exec-stats', label: 'Exec Stats', icon: 'gauge', roles: ['PMO Admin'], render: renderExecStatsScreen },
  { id: 'reports', label: 'Reports', icon: 'file-text', roles: ['Buyer', 'Proc Ops', 'PMO Admin'], render: renderReportsScreen },
  { id: 'master-data', label: 'Master Data & Capacity', icon: 'database', roles: ['PMO Admin'], render: renderMasterDataScreen, init: initMasterData },
  { id: 'settings', label: 'Settings', icon: 'settings', roles: ['Proc Ops', 'PMO Admin'], render: renderSettingsScreen }
];

function navItem(id) { for (var i = 0; i < NAV_ITEMS.length; i++) if (NAV_ITEMS[i].id === id) return NAV_ITEMS[i]; return null; }
function allowedNav() { return NAV_ITEMS.filter(function (n) { return n.roles.indexOf(appState.role) >= 0; }); }
function currentRouteId() { var h = (location.hash || '').replace(/^#\/?/, '').split('?')[0]; return h || 'home'; }
function navigate(id) {
  toggleSidebar(false);
  if (currentRouteId() === id) { renderApp(); return; }
  location.hash = '#/' + id;
}

function renderSidebar() {
  var cur = currentRouteId();
  var html = '<div class="flex items-center gap-2 border-b border-slate-800 px-4 py-4">' +
    '<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">' + icon('radar', 'w-5 h-5') + '</div>' +
    '<div><div class="text-[11px] font-bold tracking-wider text-sky-400">TATA ELECTRONICS</div><div class="text-sm font-semibold text-white">Control Tower</div></div>' +
    '<button type="button" class="ml-auto rounded p-1 text-slate-400 hover:text-white lg:hidden" onclick="toggleSidebar(false)" aria-label="Close menu">' + icon('x', 'w-4 h-4') + '</button></div>' +
    '<nav class="flex-1 overflow-y-auto px-2 py-3">';
  allowedNav().forEach(function (n) {
    var active = n.id === cur;
    var count = n.badge ? n.badge() : null;
    html += '<a href="#/' + n.id + '" onclick="toggleSidebar(false)" class="mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ' +
      (active ? 'bg-blue-600 font-semibold text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white') + '"' + (active ? ' aria-current="page"' : '') + '>' +
      icon(n.icon, 'w-4 h-4 shrink-0') + '<span class="flex-1 truncate">' + esc(n.label) + '</span>' +
      (count ? '<span class="rounded-full px-1.5 py-0.5 text-[10px] font-bold ' + (active ? 'bg-white/20 text-white' : n.badgeTone === 'red' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-200') + '">' + count + '</span>' : '') +
      '</a>';
  });
  html += '</nav><div class="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">' + esc(SITE.plant) + '<br>Sample data · no live integrations</div>';
  document.getElementById('sidebar').innerHTML = html;
}

function renderUserChip() {
  var el = document.getElementById('user-chip');
  el.innerHTML = '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">' +
    esc(currentUserName().split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2)) + '</span><span class="font-medium text-slate-800">' + esc(currentUserName()) + '</span>' +
    '<span class="text-xs text-slate-500">' + esc(appState.role) + '</span>';
  document.getElementById('role-select').value = appState.role;
}

function renderApp() {
  refreshBuyerLoads();
  refreshPOFlags();
  var id = currentRouteId();
  var item = navItem(id);
  if (!item || item.roles.indexOf(appState.role) < 0) {
    if (item) showToast(item.label + ' is not available for the ' + appState.role + ' role.', 'warn');
    else if (id !== 'home') showToast('Unknown page "' + id + '".', 'error');
    var first = allowedNav()[0].id;
    if (location.hash !== '#/' + first) { location.hash = '#/' + first; return; }
    item = navItem(first);
  }
  var vp = document.getElementById('app-viewport');
  vp.innerHTML = item.render();
  if (item.init) item.init();
  renderSidebar();
  renderUserChip();
  refreshIcons();
  if (window.__tourActive) positionTour();
}
// re-render the current screen without changing route (e.g. after an action)
function rerender() { renderApp(); }

function switchRole(role) {
  if (ROLES.indexOf(role) < 0) { showToast('Unknown role ' + role, 'error'); return; }
  appState.role = role;
  closeModal(); closeDrawer();
  showToast('Switched to ' + role + ' view (' + currentUserName() + ')', 'info');
  renderApp();
}

function toggleSidebar(open) {
  var sb = document.getElementById('sidebar'), bd = document.getElementById('sidebar-backdrop');
  if (!sb) return;
  if (open) { sb.classList.add('open'); bd.classList.remove('hidden'); }
  else { sb.classList.remove('open'); bd.classList.add('hidden'); }
}

/* ---------- Download HTML ---------- */
function downloadHtml() {
  if (window.__BUNDLED__) {
    var clone = document.documentElement.cloneNode(true);
    ['app-viewport', 'sidebar', 'drawer-root', 'modal-root', 'tour-root', 'toast-root', 'user-chip'].forEach(function (id) {
      var el = clone.querySelector('#' + id); if (el) el.innerHTML = '';
    });
    Array.prototype.forEach.call(clone.querySelectorAll('style:not([data-app])'), function (s) { s.remove(); });
    downloadBlob('procurement-control-tower.html', '<!DOCTYPE html>\n' + clone.outerHTML, 'text/html;charset=utf-8');
    showToast('Downloaded procurement-control-tower.html (single file)', 'success');
    return;
  }
  var a = document.createElement('a');
  a.href = 'dist/procurement-control-tower.html';
  a.download = 'procurement-control-tower.html';
  document.body.appendChild(a); a.click(); a.remove();
  showToast('Downloading dist/procurement-control-tower.html – if it is missing, run: python3 tools/bundle.py', 'info');
}

/* ---------- Guided demo tour ---------- */
var TOUR_STEPS = [
  { route: 'home', role: 'PMO Admin', title: 'One view of every PR line', text: 'Home shows every active PR line at Jagi Road from intake to GRN: KPI tiles, the pipeline by stage and the lines that are blocked or escalated.' },
  { route: 'work-allocation', role: 'PMO Admin', title: 'Allocation in one click', text: 'New SAP intake lands here. "Auto-allocate all" keeps PR lines together, skips buyers who are Out of Office (Runu today) and picks the least-loaded buyer in the category pool: Mfg & Ops, Indirects, Material, Equipment, IT or Other.' },
  { route: 'my-queue', role: 'Buyer', title: 'The buyer’s work queue', text: 'Kundal sees only his open lines with SLA badges and open queries. "Vendor history" shows the last 5–10 purchases of each material: vendor ID, contact, e-mail and phone.' },
  { route: 'user-pending', role: 'Buyer', title: 'Waiting on requesters', text: 'Buyer queries are auto-assigned to both the requester and the PR creator, at their auto-corrected e-mail addresses. You see what is missing, reminders sent and the 24-hour escalation to the HOD.' },
  { route: 'user-response', role: 'Requester', title: 'Requester answers in one place', text: 'Manash (requester or PR creator) answers each missing item. On submit the ticket moves to Vendor Outreach automatically and the thread updates.' },
  { route: 'vendor-outreach', role: 'Buyer', title: 'RFQ tracking', text: 'Per line: vendors contacted, quotes received, estimated value and the next step.' },
  { route: 'po-ops', role: 'Proc Ops', title: 'PO & vendor expediting', text: '500 POs: AWB links open the tracking view, "Ask AWB & Carrier" drafts the request, and "Refresh tracking" parses a pasted carrier CSV feed.' },
  { route: 'delivery-followup', role: 'Proc Ops', title: 'Auto-flagged deliveries', text: 'Rules A–D flag POs with no AWB, no scan, stuck at the Guwahati hub or a missed ETA, grouped by vendor with a copy-ready follow-up email.' },
  { route: 'grn', role: 'Proc Ops', title: 'GRN & closure', text: 'Received vs pending quantity, storage location and dock at Jagi Road, then close the line.' },
  { route: 'exec-stats', role: 'PMO Admin', title: 'Leadership dashboard', text: 'Spend, open commitments, cycle time vs the 7-day target, vendor on-time %, savings and delivery risk. Every card follows the filters. All data is sample data.' }
];
window.__tourActive = false;
window.__tourStep = 0;
function startTour() { window.__tourActive = true; window.__tourStep = 0; showTourStep(); }
function tourNext() { if (window.__tourStep < TOUR_STEPS.length - 1) { window.__tourStep++; showTourStep(); } else exitTour(); }
function tourBack() { if (window.__tourStep > 0) { window.__tourStep--; showTourStep(); } }
function exitTour() {
  window.__tourActive = false;
  document.getElementById('tour-root').innerHTML = '';
  showToast('Tour ended', 'info');
}
function showTourStep() {
  var s = TOUR_STEPS[window.__tourStep];
  closeModal(); closeDrawer();
  if (appState.role !== s.role) appState.role = s.role;
  if (currentRouteId() !== s.route) location.hash = '#/' + s.route; else renderApp();
  var n = window.__tourStep + 1;
  document.getElementById('tour-root').innerHTML =
    '<div class="tour-card fixed bottom-4 left-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-blue-200 bg-white p-4 lg:left-auto lg:right-6 lg:translate-x-0" role="dialog" aria-label="Demo tour">' +
    '<div class="flex items-center justify-between text-xs font-semibold text-blue-700"><span>' + icon('play', 'w-3 h-3 inline') + ' Demo tour · step ' + n + ' of ' + TOUR_STEPS.length + '</span>' +
    '<span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Role: ' + esc(s.role) + '</span></div>' +
    '<div class="mt-2 text-base font-bold text-slate-900">' + esc(s.title) + '</div><p class="mt-1 text-sm text-slate-600">' + esc(s.text) + '</p>' +
    '<div class="mt-3 h-1.5 rounded-full bg-slate-100"><div class="h-1.5 rounded-full bg-blue-600" style="width:' + (n / TOUR_STEPS.length * 100) + '%"></div></div>' +
    '<div class="mt-3 flex items-center justify-between"><button type="button" class="' + UI.btnSm + '" onclick="exitTour()">' + icon('x', 'w-3 h-3') + 'Exit</button>' +
    '<span class="flex gap-2"><button type="button" class="' + UI.btnSm + '" onclick="tourBack()"' + (n === 1 ? ' disabled' : '') + '>' + icon('chevron-left', 'w-3 h-3') + 'Back</button>' +
    '<button type="button" class="' + UI.btnPrimarySm + '" onclick="tourNext()">' + (n === TOUR_STEPS.length ? 'Finish' : 'Next') + icon('chevron-right', 'w-3 h-3') + '</button></span></div></div>';
  refreshIcons();
}
function positionTour() { /* card is fixed-position; nothing to recompute, kept for re-render hook */ }

/* ---------- boot ---------- */
window.addEventListener('hashchange', renderApp);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });
renderApp();
