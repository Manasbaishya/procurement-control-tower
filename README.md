# Procurement Control Tower – Tata Electronics (prototype)

A front-end prototype for SCM / PMO that tracks every purchase-requisition (PR) line from intake to GRN closure at the **Tata Electronics, Jagi Road (Assam)** semiconductor site. Inbound freight goes through the **Guwahati (GAU)** hub.

> **All data is sample data.** Nothing connects to SAP, email, WhatsApp or carrier APIs. Every action that would normally go out to another system is labelled "Logged (simulated)" or "Draft copied".

**Live demo:** https://manasbaishya.github.io/procurement-control-tower/ (GitHub Pages, no sign-in)

## How to open it

- **Double-click `index.html`.** It runs from `file://` with no server, build step or install.
- Or share the single-file version: run `python3 tools/bundle.py`, then send `dist/procurement-control-tower.html`. It works the same way.
- You need an internet connection the first time, because Tailwind (Play CDN) and Lucide icons load from a CDN.

Use the **Role** switcher in the top bar to change view: Buyer (Kundal, the default), Requester (Manash Baishya), Proc Ops or PMO Admin. **Demo tour** walks through the whole flow in 10 steps.

## Categories and buyers

| Category | Buyer pool |
|---|---|
| Mfg & Ops | Kundal, Dhruba, Paran, Runu, Rajpritam |
| Indirects | Sneha, Pratul, Chinmoyee |
| Material | John |
| Equipment | Jitendra |
| IT | Arvind |
| Other | Manash |

New work goes to the least-loaded buyer in the category's pool, skipping anyone who is Out of Office (Runu, in the sample data). If the whole pool is away, it goes to the category's fallback buyer. You can edit pools and fallbacks in **Master Data & Capacity**.

## Workflow rules

- **New Request** captures Department, Requesting Team (Engineering, Production, Quality, PPC, MSE, Test, Warehouse, Admin, HR, Equipment, Other) and a calendar need-by date (NBD). The NBD can't be in the past.
- **Requester e-mail auto-correction.** On every intake path (SAP, New Request, Bulk Upload) and before any communication, the address is cleaned up: case and spaces, `,` → `.`, doubled `@`, near-miss company domains, and a missing domain. A known name is then matched to the employee directory. Every correction is written to the line's activity log.
- **Buyer queries** are assigned automatically to both the requester and the PR creator. A pre-PO line moves to *Info required*. When either of them replies (in the User Response Portal or on the thread), the ticket moves to *Vendor outreach* automatically.
- **My Work Queue** shows a vendor history for each line's material: the last 5–10 purchases with vendor ID, vendor name, contact, e-mail, phone, unit price and lead time.

## Folder layout

```
index.html            shell: sidebar, top bar, #app-viewport, drawer / modal / toast containers
css/app.css           small custom CSS (Tailwind does the rest)
js/data.js            masters (stages, buyers, categories, vendors, carriers) + seeded generators
js/state.js           appState and helpers (formatCurrency, showToast, getFollowUpLines, SLA calc, CSV)
js/router.js          NAV_ITEMS, renderSidebar(), renderApp() hash router, role switch, tour, download
js/screens/*.js       one file per screen, each exposes renderXxxScreen() (+ optional initXxx())
js/modals/*.js        line drawer, thread drawer, reassign, bulk backup (OOO), auto-allocate,
                      tracking, follow-up log, AWB reminder, tracking import, vendor email chain
tools/bundle.py       inlines css + js into dist/procurement-control-tower.html
```

The scripts are classic `<script src>` files loaded in order, not ES modules, because ES modules don't load from `file://`.

## Sample data

- A fixed seed and a fixed demo date (7 Nov 2026) mean every reload produces the same data.
- About 840 PR lines across 12 buyers (90-line capacity each; Runu is Out of Office).
- 6 categories, 16 vendors with SAP-style vendor IDs (V1001xx), 500 POs (POs 1–250 have an AWB, 251–500 are awarded without one), 14 unallocated intake lines, 5–10 past purchases per material, and 25 months of awarded-PO history for Exec Stats.
- About 12% of requester e-mails are deliberately mistyped in the sample data so the auto-correction has something to show. All e-mail domains are `.example`.
- Changes you make (allocations, reassignments, AWBs, GRNs, settings) last only until you reload the page.
- All amounts are in INR using Indian digit grouping (₹, ₹ L, ₹ Cr).
