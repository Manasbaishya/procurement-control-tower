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

## Exec Stats → ARC Recommendations

A second tab in **Exec Stats** (PMO Admin role) that recommends items for a new Annual Rate Contract and flags existing ARCs that need action.

- **Data.** Sample data loads by default: about 300 PO lines, 40 items, 16 vendors, 12 months and 10 ARCs. **Upload PO Data** and **Upload ARC Master** accept CSV or XLSX and are read in the browser only. **Column templates** downloads the expected headers. Header matching ignores case, spaces and underscores. Dates can be `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, `7-Nov-2026` or Excel dates.
- **New ARC candidates.**
  - Items are grouped by Item_Code, or by the normalised description when there is no code. Items on an active ARC are excluded.
  - An item is eligible if it has at least 4 POs and at least ₹5,00,000 of spend in the last 12 months.
  - Score (0–100), with each factor scaled across the eligible items: spend 30%, frequency 25%, rate variance 20%, demand stability 15%, vendor spread 10%.
  - Estimated saving = (average rate − lowest rate) × annual quantity. Effort saved = POs × 6 hours. Proposed committed quantity = annual quantity × 0.85.
- **ARC health.**
  - Expired: Valid_To is in the past.
  - Renew/Extend: at least 80% consumed, by quantity or value.
  - Expiring: Valid_To is within 60 days.
  - Under-utilised: more than 50% of the validity period has passed but less than 20% is consumed.
- **Tuning.** Every threshold and weight is in `ARC_CONFIG` at the top of `js/arc-recommendations.js`. That file has no UI code. `arcAnalyse(poRows, arcRows, today)` can later take an SAP or Ariba extract unchanged.
- **Excel.** Reading and writing .xlsx uses SheetJS, which loads from cdnjs the first time you use it. Offline, Export falls back to CSV, and you need to upload CSV instead of XLSX.

## Folder layout

```
index.html            shell: sidebar, top bar, #app-viewport, drawer / modal / toast containers
css/app.css           small custom CSS (Tailwind does the rest)
js/data.js            masters (stages, buyers, categories, vendors, carriers) + seeded generators
js/state.js           appState and helpers (formatCurrency, showToast, getFollowUpLines, SLA calc, CSV)
js/arc-recommendations.js  ARC engine + ARC_CONFIG + sample ARC data (pure logic, no DOM)
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
