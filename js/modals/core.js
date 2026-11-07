/* Generic modal + drawer containers */
function openModal(opts) {
  var sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };
  document.getElementById('modal-root').innerHTML =
    '<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal-panel w-full ' + (sizes[opts.size || 'md']) + ' rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '">' +
    '<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5"><div><h2 class="text-base font-bold text-slate-900">' + esc(opts.title) + '</h2>' +
    (opts.subtitle ? '<p class="text-xs text-slate-500">' + opts.subtitle + '</p>' : '') + '</div>' +
    '<button type="button" class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onclick="closeModal()" aria-label="Close">' + icon('x', 'w-4 h-4') + '</button></div>' +
    '<div class="modal-body max-h-[70vh] overflow-y-auto px-5 py-4">' + opts.body + '</div>' +
    (opts.footer ? '<div class="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 rounded-b-xl">' + opts.footer + '</div>' : '') +
    '</div></div>';
  refreshIcons();
}
function closeModal() { var r = document.getElementById('modal-root'); if (r) r.innerHTML = ''; }
function isModalOpen() { var r = document.getElementById('modal-root'); return !!(r && r.innerHTML); }

function openDrawer(title, subtitle, body, footer) {
  document.getElementById('drawer-root').innerHTML =
    '<div class="fixed inset-0 z-50 bg-slate-900/40" onclick="closeDrawer()"></div>' +
    '<aside class="drawer-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
    '<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5"><div class="min-w-0"><h2 class="truncate text-base font-bold text-slate-900">' + esc(title) + '</h2>' +
    (subtitle ? '<p class="text-xs text-slate-500">' + subtitle + '</p>' : '') + '</div>' +
    '<button type="button" class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onclick="closeDrawer()" aria-label="Close">' + icon('x', 'w-4 h-4') + '</button></div>' +
    '<div class="drawer-body flex-1 overflow-y-auto px-5 py-4">' + body + '</div>' +
    (footer ? '<div class="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">' + footer + '</div>' : '') +
    '</aside>';
  refreshIcons();
}
function closeDrawer() { var r = document.getElementById('drawer-root'); if (r) r.innerHTML = ''; }

/* after an action: refresh screen, keep whichever drawer was open */
function afterAction(reopen) {
  rerender();
  if (reopen) reopen();
}
function fieldVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function kv(label, value) {
  return '<div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">' + esc(label) + '</dt><dd class="text-sm text-slate-800">' + value + '</dd></div>';
}
