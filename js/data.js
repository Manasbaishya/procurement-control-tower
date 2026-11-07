/* =====================================================================
   Procurement Control Tower – masters + seeded dummy-data generators
   Everything here is SAMPLE DATA. A fixed seed means every reload
   produces exactly the same records.
   ===================================================================== */

/* ---------- Seeded random helpers ---------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
var SEED_RNG = mulberry32(20261107);
function rnd() { return SEED_RNG(); }
function rint(a, b) { return a + Math.floor(SEED_RNG() * (b - a + 1)); }
function rfloat(a, b, dp) { var v = a + SEED_RNG() * (b - a); var p = Math.pow(10, dp || 1); return Math.round(v * p) / p; }
function pick(arr) { return arr[Math.floor(SEED_RNG() * arr.length)]; }
function chance(p) { return SEED_RNG() < p; }
function weightedPick(items, weights) {
  var total = 0, i;
  for (i = 0; i < weights.length; i++) total += weights[i];
  var r = SEED_RNG() * total;
  for (i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

/* ---------- Dates (fixed demo "today" so data is identical on reload) ---------- */
var DEMO_TODAY = new Date(2026, 10, 7, 10, 0, 0); // 7 Nov 2026, 10:00 IST
function addDays(d, n) { var x = new Date(d.getTime()); x.setTime(x.getTime() + n * 86400000); return x; }
function isoDate(d) {
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function isoDateTime(d) {
  var h = d.getHours(), mi = d.getMinutes();
  return isoDate(d) + 'T' + (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
}

/* ---------- Site context ---------- */
var SITE = {
  company: 'Tata Electronics',
  site: 'Jagi Road, Assam',
  plant: 'Jagi Road Semiconductor Site',
  hub: 'Guwahati (GAU)',
  hubCode: 'GAU',
  emailDomain: 'tataelectronics.example', // sample domain – no real mailbox
  docks: ['Jagi Road Receiving Dock 1', 'Jagi Road Receiving Dock 2', 'Jagi Road Bonded Store'],
  storageLocations: ['SL-JR01 Main Stores', 'SL-JR02 Cleanroom Stores', 'SL-JR03 Chemical Store', 'SL-JR04 Gas Yard', 'SL-JR05 Spares Cage']
};

/* ---------- Stages & SLA ---------- */
var STAGES = [
  { key: 'PENDING SPECS',   label: 'Pending specs',   sla: 2,    controllable: true,  icon: 'file-text' },
  { key: 'INFO REQUIRED',   label: 'Info required',   sla: 2,    controllable: false, icon: 'circle-help' },
  { key: 'VENDOR OUTREACH', label: 'Vendor outreach', sla: 3,    controllable: true,  icon: 'send' },
  { key: 'COMMERCIALS',     label: 'Commercials',     sla: 2.5,  controllable: true,  icon: 'calculator' },
  { key: 'NFA APPROVED',    label: 'NFA approved',    sla: 1,    controllable: false, icon: 'badge-check' },
  { key: 'PO STAGE',        label: 'PO stage',        sla: 1,    controllable: true,  icon: 'file-check' },
  { key: 'IN-TRANSIT',      label: 'In-transit',      sla: 7,    controllable: false, icon: 'truck' },
  { key: 'GRN COMPLETED',   label: 'GRN completed',   sla: 2,    controllable: true,  icon: 'package-check' },
  { key: 'CLOSED',          label: 'Closed',          sla: null, controllable: false, icon: 'circle-check' },
  { key: 'ON HOLD',         label: 'On hold',         sla: null, controllable: false, icon: 'circle-pause' },
  { key: 'CANCELLED',       label: 'Cancelled',       sla: null, controllable: false, icon: 'circle-x' }
];
var PIPELINE_STAGES = ['PENDING SPECS', 'INFO REQUIRED', 'VENDOR OUTREACH', 'COMMERCIALS', 'NFA APPROVED', 'PO STAGE', 'IN-TRANSIT', 'GRN COMPLETED'];
var NEXT_ACTION = {
  'PENDING SPECS': 'Review specs & confirm category',
  'INFO REQUIRED': 'Await requester / PR creator reply',
  'VENDOR OUTREACH': 'Collect quotes from vendors',
  'COMMERCIALS': 'Finalise commercials & raise NFA',
  'NFA APPROVED': 'Create PO in SAP',
  'PO STAGE': 'Release PO & share with vendor',
  'IN-TRANSIT': 'Track shipment to Guwahati hub',
  'GRN COMPLETED': 'Verify GRN & close line',
  'CLOSED': '—',
  'ON HOLD': 'Awaiting decision to resume',
  'CANCELLED': '—'
};

/* ---------- Categories, buyer pools and buyers ---------- */
// pool = buyers who handle the category; fallback = covers when the whole pool is out of office
var CATEGORY_SEED = [
  { name: 'Mfg & Ops', pool: ['Kundal', 'Dhruba', 'Paran', 'Runu', 'Rajpritam'], fallback: 'Sneha' },
  { name: 'Indirects', pool: ['Sneha', 'Pratul', 'Chinmoyee'], fallback: 'Manash' },
  { name: 'Material',  pool: ['John'], fallback: 'Jitendra' },
  { name: 'Equipment', pool: ['Jitendra'], fallback: 'John' },
  { name: 'IT',        pool: ['Arvind'], fallback: 'Manash' },
  { name: 'Other',     pool: ['Manash'], fallback: 'Arvind' }
];
var BUYER_SEED = [
  // id, name, category, backup id, OOO, avg cycle days
  ['kundal', 'Kundal', 'Mfg & Ops', 'dhruba', false, 6.1], ['dhruba', 'Dhruba', 'Mfg & Ops', 'paran', false, 5.7],
  ['paran', 'Paran', 'Mfg & Ops', 'rajpritam', false, 6.4], ['runu', 'Runu', 'Mfg & Ops', 'kundal', true, 6.0],
  ['rajpritam', 'Rajpritam', 'Mfg & Ops', 'dhruba', false, 5.9],
  ['sneha', 'Sneha', 'Indirects', 'pratul', false, 4.8], ['pratul', 'Pratul', 'Indirects', 'chinmoyee', false, 5.2],
  ['chinmoyee', 'Chinmoyee', 'Indirects', 'sneha', false, 5.0],
  ['john', 'John', 'Material', 'jitendra', false, 7.4], ['jitendra', 'Jitendra', 'Equipment', 'john', false, 8.6],
  ['arvind', 'Arvind', 'IT', 'manash', false, 5.5], ['manash', 'Manash', 'Other', 'arvind', false, 4.9]
];
var BUYER_CAPACITY = 90;
// open lines per buyer the generator aims for (gives a realistic spread of load)
var BUYER_OPEN_TARGET = { kundal: 82, dhruba: 74, paran: 66, runu: 38, rajpritam: 79, sneha: 70, pratul: 58, chinmoyee: 63, john: 94, jitendra: 81, arvind: 45, manash: 30 };

/* materials per category: [description, uom, unit price ₹] */
var CATEGORY_MATERIALS = {
  'Mfg & Ops': [['Bearing SKF 6204-2RSH/C3', 'EA', 1800], ['Mechanical seal kit – DI water pump', 'SET', 42000], ['Cleanroom wipers 9x9 ISO 4', 'PK', 6500],
    ['Ultra-pure NF3 cylinder 47 L', 'CYL', 210000], ['HEPA filter H14 1220x610', 'EA', 21000], ['Pneumatic valve SS316 1/2 in', 'EA', 14500]],
  'Indirects': [['Epoxy floor coating – Bay 3', 'SQM', 1450], ['Ergonomic office chairs', 'EA', 14500], ['Acid-resistant apron', 'EA', 2400],
    ['Moisture barrier bags 10x18', 'PK', 7800], ['EHS signage set', 'SET', 38000]],
  'Material': [['Silicon wafer 300 mm prime', 'EA', 9800], ['CMP slurry – oxide 20 L', 'DRUM', 98000], ['Photoresist i-line 1 gal', 'BTL', 76000],
    ['Leadframe QFN 5x5 strip', 'STRIP', 420], ['Gold bonding wire 25 µm', 'SPOOL', 52000]],
  'Equipment': [['Wafer spin-rinse dryer', 'EA', 4200000], ['Dry pump rebuild kit', 'KIT', 690000], ['Wafer transfer robot end-effector', 'EA', 340000],
    ['Ellipsometer calibration standard', 'EA', 96000], ['Nitrogen dry cabinet 1250 L', 'EA', 320000]],
  'IT': [['Engineering laptop i7 32 GB', 'EA', 145000], ['Network switch 48-port PoE', 'EA', 265000], ['MES server licence (annual)', 'LIC', 850000],
    ['Industrial barcode scanner', 'EA', 32000], ['Online UPS 3 kVA', 'EA', 68000]],
  'Other': [['Calibration service – torque tools', 'JOB', 45000], ['Hazardous waste disposal', 'JOB', 120000], ['Canteen equipment repair', 'JOB', 38000],
    ['Training – ISO 14644 cleanroom', 'JOB', 85000]]
};

/* ---------- Requesting teams & departments ---------- */
var REQUESTING_TEAMS = ['Engineering', 'Production', 'Quality', 'PPC', 'MSE', 'Test', 'Warehouse', 'Admin', 'HR', 'Equipment', 'Other'];
var DEPARTMENTS = ['Process Engineering', 'Fab Maintenance', 'Facilities', 'Quality', 'Assembly & Test', 'EHS', 'IT & Automation', 'Admin', 'Supply Chain', 'HR'];

/* ---------- Vendors (SAP-style vendor id, dummy contacts on .example domains) ---------- */
var VENDOR_SEED = [
  ['V100101', 'Linde India', 'Kolkata', ['Mfg & Ops', 'Material'], 'Sourav Ghosh', 'Arpita Sen'],
  ['V100102', 'Air Liquide India', 'Mumbai', ['Mfg & Ops', 'Material'], 'Nikhil Joshi', 'Farah Khan'],
  ['V100103', 'Tokyo Electron India', 'Bengaluru', ['Equipment'], 'Kenji Mori', 'Deepak Rao'],
  ['V100104', 'Kyocera Fineceramics', 'Bengaluru', ['Material', 'Equipment'], 'Ravi Shankar', 'Meena Iyer'],
  ['V100105', 'Entegris', 'Bengaluru', ['Material'], 'Lakshmi Narayan', 'Arun Pillai'],
  ['V100106', 'Edwards Vacuum', 'Pune', ['Equipment', 'Mfg & Ops'], 'Sachin Kulkarni', 'Pooja Desai'],
  ['V100107', 'SKF India', 'Pune', ['Mfg & Ops'], 'Amol Patil', 'Neeta Shinde'],
  ['V100108', 'SMC Pneumatics India', 'Gurugram', ['Mfg & Ops'], 'Rakesh Yadav', 'Simran Kaur'],
  ['V100109', 'Siemens', 'Mumbai', ['Equipment', 'IT'], 'Vivek Menon', 'Anjali Shah'],
  ['V100110', 'CleanAir Systems', 'Kolkata', ['Mfg & Ops', 'Indirects'], 'Debashis Roy', 'Moumita Paul'],
  ['V100111', 'FilterTech Industries', 'Chennai', ['Mfg & Ops'], 'Karthik Raman', 'Divya S'],
  ['V100112', 'Assam Industrial Supplies', 'Guwahati', ['Indirects', 'Other'], 'Bhaskar Bora', 'Jyoti Das'],
  ['V100113', 'Precision Metrology Services', 'Hyderabad', ['Equipment', 'Other'], 'Srinivas Reddy', 'Kavitha N'],
  ['V100114', 'PackRight Solutions', 'Kolkata', ['Indirects', 'Material'], 'Abhijit Dutta', 'Rina Saha'],
  ['V100115', 'Redington India', 'Kolkata', ['IT'], 'Sumit Agarwal', 'Priyanka Jain'],
  ['V100116', 'Brahmaputra IT Services', 'Guwahati', ['IT', 'Other'], 'Hiranya Kalita', 'Nabanita Baruah']
];

/* ---------- Carriers (tracking URL templates, {AWB} placeholder) ---------- */
var CARRIER_SEED = [
  { id: 'bluedart',  name: 'Blue Dart', template: 'https://www.bluedart.com/tracking?awb={AWB}' },
  { id: 'dhl',       name: 'DHL Express', template: 'https://www.dhl.com/in-en/home/tracking.html?tracking-id={AWB}' },
  { id: 'fedex',     name: 'FedEx', template: 'https://www.fedex.com/fedextrack/?trknbr={AWB}' },
  { id: 'delhivery', name: 'Delhivery', template: 'https://www.delhivery.com/track/package/{AWB}' },
  { id: 'dtdc',      name: 'DTDC', template: 'https://www.dtdc.in/tracking.asp?cnno={AWB}' },
  { id: 'gati',      name: 'Gati', template: 'https://www.gati.com/track-by-docket/?docket={AWB}' }
];
var SHIPMENT_STAGES = ['PO Awarded', 'Dispatched', 'In Transit', 'At Guwahati', 'Delivered'];

/* ---------- Requesters (employee directory = source of truth for e-mail) ---------- */
var REQUESTERS = [
  { name: 'Manash Baishya',  dept: 'Process Engineering', hod: 'Dr. Rituraj Bora', team: 'Engineering' },
  { name: 'Ananya Kalita',   dept: 'Fab Maintenance',     hod: 'Sanjay Mehta',     team: 'Production' },
  { name: 'Debojit Saikia',  dept: 'Facilities',          hod: 'Pranab Das',       team: 'Equipment' },
  { name: 'Shreya Iyer',     dept: 'Quality',             hod: 'Meera Pillai',     team: 'Quality' },
  { name: 'Arjun Hazarika',  dept: 'Assembly & Test',     hod: 'Vivek Rao',        team: 'Test' },
  { name: 'Pooja Gogoi',     dept: 'EHS',                 hod: 'Nirmali Barua',    team: 'Other' },
  { name: 'Rahul Choudhury', dept: 'Fab Maintenance',     hod: 'Sanjay Mehta',     team: 'MSE' },
  { name: 'Kavya Menon',     dept: 'Supply Chain',        hod: 'Ashok Nair',       team: 'PPC' },
  { name: 'Bikash Deka',     dept: 'IT & Automation',     hod: 'Sunil Kapoor',     team: 'Engineering' },
  { name: 'Ritika Bhuyan',   dept: 'Admin',               hod: 'Farhan Ali',       team: 'Admin' },
  { name: 'Hemanta Nath',    dept: 'Supply Chain',        hod: 'Ashok Nair',       team: 'Warehouse' },
  { name: 'Tanvi Sharma',    dept: 'HR',                  hod: 'Leena Dutta',      team: 'HR' }
];
var MISSING_ITEM_POOL = ['Technical datasheet', 'Approved make / model', 'Drawing revision', 'Budget code / WBS', 'Quantity confirmation', 'Delivery location at site', 'Sample photo of existing part'];

function emailFor(name, domain) {
  return name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@' + (domain || SITE.emailDomain);
}
// realistic typing mistakes in SAP / upload data – the backend corrects these (see correctEmail in state.js)
function dirtyEmail(clean, k) {
  var local = clean.split('@')[0];
  switch (k % 5) {
    case 0: return '  ' + local.charAt(0).toUpperCase() + local.slice(1) + '@TataElectronics.Example ';
    case 1: return local + '@tataelectronics,example';
    case 2: return local + '@tataelectronic.exmaple';
    case 3: return local;
    default: return local + '@@tataelectronics.example.';
  }
}

/* =====================================================================
   Generators
   ===================================================================== */
function buildMaterialMaster() {
  var list = [], n = 1001000;
  CATEGORY_SEED.forEach(function (c) {
    CATEGORY_MATERIALS[c.name].forEach(function (m) {
      n += 17;
      list.push({ materialNo: String(n), description: m[0], uom: m[1], unitPrice: m[2], category: c.name });
    });
  });
  return list;
}

function vendorsForCategory(vendors, cat) {
  return vendors.filter(function (v) { return v.categories.indexOf(cat) >= 0; });
}

function pickStatus() {
  return weightedPick(
    ['PENDING SPECS', 'INFO REQUIRED', 'VENDOR OUTREACH', 'COMMERCIALS', 'NFA APPROVED', 'PO STAGE', 'IN-TRANSIT', 'GRN COMPLETED', 'ON HOLD'],
    [10, 10, 18, 12, 6, 10, 22, 6, 3]);
}
function daysInStatusFor(stage) {
  if (!stage || !stage.sla) return rint(1, 20);
  var r = rnd();
  if (r < 0.6) return rfloat(0, stage.sla * 0.7, 1);
  if (r < 0.85) return rfloat(stage.sla * 0.75, stage.sla, 1);
  return rfloat(stage.sla * 1.05, stage.sla * 2.6, 1);
}

function buildSeedData() {
  var buyers = BUYER_SEED.map(function (b) {
    return { id: b[0], name: b[1], team: b[2], mainCategory: b[2], backup: b[3], ooo: b[4],
      avgCycleDays: b[5], capacity: BUYER_CAPACITY, openLines: 0, email: emailFor(b[1] + ' buyer') };
  });
  var byName = {}; buyers.forEach(function (b) { byName[b.name] = b; });
  var categories = CATEGORY_SEED.map(function (c, i) {
    return { id: 'c' + (i + 1), name: c.name, buyers: c.pool.slice(), fallback: c.fallback, active: true };
  });
  var vendors = VENDOR_SEED.map(function (v) {
    var slug = v[1].toLowerCase().replace(/[^a-z]+/g, '');
    function phone() { return '+91 9' + String(rint(100000000, 999999999)).slice(0, 9); }
    return { id: v[0], name: v[1], city: v[2], categories: v[3].slice(),
      contactName: v[4], salesEmail: emailFor(v[4], slug + '.example'), phone: phone(),
      altContactName: v[5], altEmail: emailFor(v[5], slug + '.example'), altPhone: phone(),
      dispatchEmail: 'dispatch@' + slug + '.example', contact: v[4] };
  });
  var materials = buildMaterialMaster();
  var matsByCat = {};
  materials.forEach(function (m) { (matsByCat[m.category] = matsByCat[m.category] || []).push(m); });
  var stageMap = {}; STAGES.forEach(function (s) { stageMap[s.key] = s; });

  /* ----- purchase history per material: last 5–10 buys with vendor id, e-mail & contact ----- */
  var materialHistory = {};
  var histBase = new Date(2024, 0, 1).getTime();
  materials.forEach(function (m, mIdx) {
    var vs = vendorsForCategory(vendors, m.category);
    var usual = vs.slice(0, Math.min(vs.length, rint(1, 3)));
    var n = rint(5, 10), list = [];
    for (var i = 0; i < n; i++) {
      var v = chance(0.75) ? usual[0] : pick(usual.length > 1 ? usual : vs);
      var old = chance(0.3);
      var qty = m.unitPrice > 300000 ? 1 : rint(2, 60);
      var hd = addDays(DEMO_TODAY, -rint(10, 720));
      // PO numbers rise with the date, as SAP number ranges do
      list.push({ date: isoDate(hd), poNumber: String(4500060000 + Math.round((hd.getTime() - histBase) / 86400000) * 40 + (mIdx % 40)),
        vendorId: v.id, vendorName: v.name, contactName: old ? v.altContactName : v.contactName,
        email: old ? v.altEmail : v.salesEmail, phone: old ? v.altPhone : v.phone,
        qty: qty, uom: m.uom, unitPrice: Math.round(m.unitPrice * rfloat(0.85, 1.12, 2)), leadTimeDays: rint(4, 40) });
    }
    materialHistory[m.materialNo] = list.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  });

  /* ----- line items, grouped into PRs, quota per buyer ----- */
  var lines = [];
  var prSeq = 1004512000;
  var dirtyK = 0;

  function makeLine(pr, lineNo, cat, requester, creator, buyerName, status, prDate, team) {
    var mat = pick(matsByCat[cat]);
    var qty = mat.unitPrice > 500000 ? rint(1, 2) : mat.unitPrice > 50000 ? rint(1, 6) : rint(4, 120);
    var st = stageMap[status];
    var line = {
      id: pr + '-' + lineNo,
      prNumber: String(pr), line: lineNo,
      materialNo: mat.materialNo, materialDescription: mat.description,
      quantity: qty, uom: mat.uom,
      department: requester.dept, requestingTeam: team, category: cat,
      user: requester.name, userEmail: emailFor(requester.name), userHod: requester.hod,
      prCreator: creator.name, prCreatorEmail: emailFor(creator.name),
      currentStatus: status,
      daysInStatus: daysInStatusFor(st),
      stageSlaDays: st.sla,
      nextAction: NEXT_ACTION[status],
      assignedBuyer: buyerName,
      requiredDeliveryDate: isoDate(addDays(prDate, rint(20, 60))),
      prStatus: chance(0.85) ? 'Released' : 'Approved',
      prCreationDate: isoDate(prDate),
      estimatedValue: Math.round(qty * mat.unitPrice * rfloat(0.9, 1.15, 2)),
      remindersCount: 0, missingItems: [], buyerNote: '',
      poNumber: null, receivedQty: 0, storageLocation: '', dock: '',
      rfq: null,
      activityLog: []
    };
    line.activityLog.push({ timestamp: isoDateTime(addDays(prDate, 0.05)), author: 'SAP intake', role: 'System', action: 'PR line ingested from SAP (EBAN) – simulated' });
    line.activityLog.push({ timestamp: isoDateTime(addDays(prDate, 0.3)), author: 'Anita Menon', role: 'PMO Admin', action: 'Allocated to ' + buyerName + ' (' + cat + ')' });
    if (status === 'INFO REQUIRED') {
      var n = rint(1, 3), pool = MISSING_ITEM_POOL.slice();
      for (var k = 0; k < n; k++) line.missingItems.push(pool.splice(rint(0, pool.length - 1), 1)[0]);
      line.remindersCount = rint(0, 3);
      line.buyerNote = 'Need ' + line.missingItems.join(', ').toLowerCase() + ' before RFQ.';
    }
    if (status === 'VENDOR OUTREACH' || status === 'COMMERCIALS') {
      var vs = vendorsForCategory(vendors, cat).map(function (v) { return v.name; });
      var contacted = vs.slice(0, Math.max(1, Math.min(vs.length, rint(1, 3))));
      line.rfq = { vendorsContacted: contacted, quotesReceived: status === 'COMMERCIALS' ? contacted.length : rint(0, contacted.length),
        nextStep: status === 'COMMERCIALS' ? 'Negotiate & prepare NFA' : 'Chase pending quotes' };
    }
    if (status !== 'PENDING SPECS') {
      line.activityLog.push({ timestamp: isoDateTime(addDays(DEMO_TODAY, -line.daysInStatus)), author: buyerName, role: 'Buyer', action: 'Status changed to ' + status });
    }
    return line;
  }

  var requesterIdx = 0;
  buyers.forEach(function (b) {
    var quota = BUYER_OPEN_TARGET[b.id], made = 0;
    while (made < quota) {
      var n = Math.min(rint(1, 5), quota - made);
      var req = REQUESTERS[requesterIdx++ % REQUESTERS.length];
      // the PR is often keyed in by a department coordinator, not the requester
      var creator = chance(0.4) ? REQUESTERS[(requesterIdx + 3) % REQUESTERS.length] : req;
      var team = chance(0.7) ? req.team : pick(REQUESTING_TEAMS);
      var status = pickStatus();
      var stIdx = PIPELINE_STAGES.indexOf(status);
      var prDate = addDays(DEMO_TODAY, -(rint(1, 6) + Math.max(0, stIdx) * rint(2, 5)));
      prSeq++;
      var dirty = chance(0.12);
      for (var i = 0; i < n; i++) {
        var s = i === 0 ? status : (chance(0.7) ? status : pickStatus());
        var l = makeLine(prSeq, (i + 1) * 10, b.mainCategory, req, creator, b.name, s, prDate, team);
        if (dirty) l.userEmail = dirtyEmail(l.userEmail, dirtyK);
        lines.push(l);
      }
      if (dirty) dirtyK++;
      made += n;
    }
  });
  // closed / cancelled history lines
  for (var c = 0; c < 60; c++) {
    var cb = buyers[c % buyers.length];
    var creq = REQUESTERS[c % REQUESTERS.length];
    prSeq++;
    lines.push(makeLine(prSeq, 10, cb.mainCategory, creq, creq, cb.name, c % 9 === 0 ? 'CANCELLED' : 'CLOSED', addDays(DEMO_TODAY, -rint(30, 80)), creq.team));
  }

  // make sure the requester demo user (Manash Baishya) has a few INFO REQUIRED lines + other lines
  var manash = REQUESTERS[0];
  var infoLines = lines.filter(function (l) { return l.currentStatus === 'INFO REQUIRED' && l.user !== manash.name; });
  infoLines.slice(0, 4).forEach(function (l, i) {
    lines.filter(function (x) { return x.prNumber === l.prNumber; }).forEach(function (x) {
      x.user = manash.name; x.userEmail = i === 1 ? dirtyEmail(emailFor(manash.name), 1) : emailFor(manash.name); x.userHod = manash.hod; x.department = manash.dept;
      if (i === 2) { x.prCreator = 'Kavya Menon'; x.prCreatorEmail = emailFor('Kavya Menon'); } else { x.prCreator = manash.name; x.prCreatorEmail = emailFor(manash.name); }
    });
  });

  /* ----- receiving info for GRN lines ----- */
  lines.forEach(function (l) {
    if (l.currentStatus === 'GRN COMPLETED' || l.currentStatus === 'CLOSED') {
      l.receivedQty = l.currentStatus === 'CLOSED' || chance(0.6) ? l.quantity : Math.max(1, Math.floor(l.quantity * rfloat(0.4, 0.9, 2)));
      l.storageLocation = pick(SITE.storageLocations);
      l.dock = pick(SITE.docks);
    }
  });

  /* ----- 500 POs: 1–250 with AWB, 251–500 awarded, no AWB ----- */
  var pos = [];
  var hubRoute = { Kolkata: ['Kolkata Hub', 'Siliguri Gateway'], Mumbai: ['Mumbai Air Hub', 'Kolkata Hub'], Bengaluru: ['Bengaluru Air Hub', 'Kolkata Hub'],
    Pune: ['Pune Hub', 'Mumbai Air Hub'], Gurugram: ['Delhi Air Hub', 'Kolkata Hub'], Chennai: ['Chennai Air Hub', 'Kolkata Hub'],
    Hyderabad: ['Hyderabad Air Hub', 'Kolkata Hub'], Guwahati: ['Guwahati Local Hub'] };
  for (var p = 1; p <= 500; p++) {
    var stage = p <= 250 ? weightedPick(['Dispatched', 'In Transit', 'At Guwahati', 'Delivered'], [18, 40, 14, 28]) : 'PO Awarded';
    pos.push({ poNumber: String(4500100000 + p), seq: p, stage: stage, linked: false });
  }
  var pools = {
    transit: pos.filter(function (x) { return x.stage !== 'Delivered' && x.stage !== 'PO Awarded'; }),
    delivered: pos.filter(function (x) { return x.stage === 'Delivered'; }),
    awarded: pos.filter(function (x) { return x.stage === 'PO Awarded'; })
  };
  function takePO(poolName) {
    var pool = pools[poolName];
    for (var i = 0; i < pool.length; i++) if (!pool[i].linked) { pool[i].linked = true; return pool[i]; }
    return null;
  }
  function fillPO(po, src) {
    var vlist = vendorsForCategory(vendors, src.category);
    var v = vlist.length ? vlist[0] : vendors[0];
    if (vlist.length > 1 && chance(0.45)) v = pick(vlist);
    var carrier = pick(CARRIER_SEED);
    var hasAwb = po.seq <= 250;
    var daysSincePo = !hasAwb ? rint(0, 8) : po.stage === 'Delivered' ? rint(8, 30) : rint(3, 10);
    var poDate = addDays(DEMO_TODAY, -daysSincePo);
    Object.assign(po, {
      vendorId: v.id, vendor: v.name, vendorEmail: v.dispatchEmail,
      buyer: src.assignedBuyer, category: src.category,
      prNumber: src.prNumber, prLine: src.line, lineId: src.lineId || null,
      materialDescription: src.materialDescription, quantity: src.quantity, uom: src.uom,
      poValue: Math.round(src.estimatedValue * rfloat(0.86, 1.0, 2)),
      poDate: isoDate(poDate), daysSincePo: daysSincePo,
      carrier: '', carrierId: '', awb: '', dispatchDate: '', currentLocation: v.city + ' (vendor)',
      lastScanTime: '', scans: [], committedEta: isoDate(addDays(poDate, rint(8, 18))),
      followUpCount: chance(0.3) ? rint(1, 3) : 0, isStuck: false, isOverdue: false, deliveredDate: ''
    });
    if (hasAwb) {
      var dispatch = addDays(poDate, rint(1, 3));
      po.carrier = carrier.name; po.carrierId = carrier.id;
      po.awb = String(rint(10000000, 99999999)) + String(rint(100, 999));
      po.dispatchDate = isoDate(dispatch);
      po.committedEta = po.stage === 'Delivered' ? isoDate(addDays(dispatch, rint(5, 10))) : isoDate(addDays(DEMO_TODAY, rint(-3, 9)));
      var route = hubRoute[v.city] || ['Kolkata Hub'];
      var t = addDays(dispatch, 0.4);
      po.scans.push({ time: isoDateTime(t), location: v.city + ' (vendor pickup)', event: 'Picked up from vendor' });
      if (po.stage !== 'Dispatched') {
        route.forEach(function (h) {
          t = addDays(t, rfloat(0.6, 1.8, 1));
          if (t < DEMO_TODAY) po.scans.push({ time: isoDateTime(t), location: h, event: 'In transit – scanned at hub' });
        });
      }
      if (po.stage === 'At Guwahati' || po.stage === 'Delivered') {
        t = addDays(t, rfloat(0.5, 1.5, 1));
        if (t > DEMO_TODAY) t = addDays(DEMO_TODAY, -0.5);
        po.scans.push({ time: isoDateTime(t), location: 'Guwahati (GAU) Hub', event: 'Arrived at Guwahati hub' });
      }
      if (po.stage === 'Delivered') {
        t = addDays(t, rfloat(0.3, 1.2, 1));
        if (t > DEMO_TODAY) t = addDays(DEMO_TODAY, -0.2);
        po.scans.push({ time: isoDateTime(t), location: 'Jagi Road Receiving Dock 1', event: 'Delivered at Jagi Road site' });
        po.deliveredDate = isoDate(t);
      }
      // some shipments are genuinely stuck: push their scans back in time
      if (po.stage !== 'Delivered' && chance(0.25)) {
        var shift = rint(3, 7);
        po.scans.forEach(function (s) { s.time = isoDateTime(addDays(new Date(s.time), -shift)); });
      }
      var last = po.scans[po.scans.length - 1];
      po.lastScanTime = last.time;
      po.currentLocation = last.location;
    }
  }

  lines.forEach(function (l) {
    var poolName = null;
    if (l.currentStatus === 'IN-TRANSIT') poolName = chance(0.85) ? 'transit' : 'delivered';
    else if (l.currentStatus === 'GRN COMPLETED' || l.currentStatus === 'CLOSED') poolName = 'delivered';
    else if (l.currentStatus === 'PO STAGE' && chance(0.5)) poolName = 'awarded';
    if (!poolName) return;
    var po = takePO(poolName) || takePO('awarded');
    if (!po) return;
    fillPO(po, { category: l.category, assignedBuyer: l.assignedBuyer, prNumber: l.prNumber, line: l.line, lineId: l.id,
      materialDescription: l.materialDescription, quantity: l.quantity, uom: l.uom, estimatedValue: l.estimatedValue });
    l.poNumber = po.poNumber;
  });
  // remaining POs: legacy PRs that are not tracked line-by-line in the tower
  var legacyPr = 1004470000;
  pos.forEach(function (po) {
    if (po.linked) return;
    var cat = pick(categories);
    var mat = pick(matsByCat[cat.name]);
    var qty = mat.unitPrice > 500000 ? 1 : rint(2, 40);
    legacyPr++;
    fillPO(po, { category: cat.name, assignedBuyer: pick(cat.buyers), prNumber: String(legacyPr), line: 10, lineId: null,
      materialDescription: mat.description, quantity: qty, uom: mat.uom, estimatedValue: qty * mat.unitPrice });
    po.linked = true;
  });

  /* ----- 14 unallocated intake lines ----- */
  var unallocated = [];
  var intakeDefs = [
    ['1004599101', 'Mfg & Ops', 3, 1], ['1004599102', 'Material', 2, 2],
    ['1004599103', 'Equipment', 2, 3], ['1004599104', 'Indirects', 2, 4],
    ['1004599105', 'Mfg & Ops', 2, 5], ['1004599106', 'IT', 1, 8],
    ['1004599107', 'Other', 1, 9], ['1004599108', 'Indirects', 1, 10]
  ];
  intakeDefs.forEach(function (d, di) {
    var req = REQUESTERS[d[3]];
    for (var i = 0; i < d[2]; i++) {
      var mat = pick(matsByCat[d[1]]);
      var qty = mat.unitPrice > 300000 ? 1 : rint(5, 60);
      unallocated.push({
        id: d[0] + '-' + ((i + 1) * 10), prNumber: d[0], line: (i + 1) * 10,
        materialNo: mat.materialNo, materialDescription: mat.description, quantity: qty, uom: mat.uom,
        department: req.dept, requestingTeam: req.team, category: d[1], user: req.name,
        userEmail: di % 3 === 0 ? dirtyEmail(emailFor(req.name), di) : emailFor(req.name), userHod: req.hod,
        prCreator: req.name, prCreatorEmail: emailFor(req.name),
        requiredDeliveryDate: isoDate(addDays(DEMO_TODAY, rint(15, 45))), prStatus: 'Released',
        prCreationDate: isoDate(addDays(DEMO_TODAY, -rint(0, 2))), estimatedValue: Math.round(qty * mat.unitPrice),
        source: 'SAP intake', receivedAt: isoDateTime(addDays(DEMO_TODAY, -rfloat(0.1, 1.5, 1)))
      });
    }
  });

  /* ----- communication threads ----- */
  var threads = {};
  var msgSeq = 1;
  lines.forEach(function (l, idx) {
    if (l.currentStatus === 'INFO REQUIRED') {
      var to = l.prCreator && l.prCreator !== l.user ? l.user + ', ' + l.prCreator : l.user;
      threads[l.id] = [{ id: 'm' + (msgSeq++), type: 'Info request', author: l.assignedBuyer, role: 'Buyer', assignedTo: to,
        text: 'Please share: ' + l.missingItems.join(', ') + '.', status: 'Open', attachment: '',
        timestamp: isoDateTime(addDays(DEMO_TODAY, -l.daysInStatus)) }];
    } else if (l.currentStatus !== 'CLOSED' && l.currentStatus !== 'CANCELLED' && idx % 11 === 3) {
      threads[l.id] = [
        { id: 'm' + (msgSeq++), type: 'Query', author: l.user, role: 'Requester', assignedTo: l.assignedBuyer,
          text: 'Can we get an expected delivery date for this line? Line is critical for ' + l.department + '.', status: idx % 2 ? 'Open' : 'Answered', attachment: '',
          timestamp: isoDateTime(addDays(DEMO_TODAY, -rfloat(0.5, 3, 1))) }
      ];
      if (threads[l.id][0].status === 'Answered') {
        threads[l.id].push({ id: 'm' + (msgSeq++), type: 'Update', author: l.assignedBuyer, role: 'Buyer', assignedTo: l.user,
          text: 'Quotes expected this week; will confirm ETA once PO is released.', status: null, attachment: '',
          timestamp: isoDateTime(addDays(DEMO_TODAY, -0.3)) });
      }
    }
  });

  /* ----- allocation audit log ----- */
  var auditLog = [
    { timestamp: isoDateTime(addDays(DEMO_TODAY, -0.9)), actor: 'Anita Menon', action: 'Auto-allocated', detail: '9 lines across 4 PRs', from: '—', to: 'Multiple', reason: 'Daily intake run' },
    { timestamp: isoDateTime(addDays(DEMO_TODAY, -1.4)), actor: 'Anita Menon', action: 'OOO transfer', detail: 'Runu marked Out of Office', from: 'Runu', to: 'Kundal', reason: 'Planned leave' },
    { timestamp: isoDateTime(addDays(DEMO_TODAY, -2.2)), actor: 'Kundal', action: 'Reassigned', detail: 'PR 1004512004 line 10', from: 'Kundal', to: 'Dhruba', reason: 'Workload balancing' },
    { timestamp: isoDateTime(addDays(DEMO_TODAY, -3.1)), actor: 'Anita Menon', action: 'Manual allocation', detail: '3 lines of PR 1004512019', from: '—', to: 'Jitendra', reason: 'Specialist requirement' },
    { timestamp: isoDateTime(addDays(DEMO_TODAY, -4.0)), actor: 'Anita Menon', action: 'Rebalanced', detail: '6 lines', from: 'John', to: 'Jitendra', reason: 'Load above 100%' }
  ];

  var batchJobs = [
    { id: 'B-2611-03', file: 'intake_fab_maintenance_06Nov.csv', rows: 42, valid: 39, duplicates: 2, unknown: 1, status: 'Ingested', at: isoDateTime(addDays(DEMO_TODAY, -1.2)), by: 'Anita Menon' },
    { id: 'B-2611-02', file: 'indirects_q3.xlsx', rows: 18, valid: 18, duplicates: 0, unknown: 0, status: 'Ingested (XLSX simulated)', at: isoDateTime(addDays(DEMO_TODAY, -3.4)), by: 'Kundal' },
    { id: 'B-2611-01', file: 'it_refresh.csv', rows: 11, valid: 8, duplicates: 3, unknown: 0, status: 'Partially ingested', at: isoDateTime(addDays(DEMO_TODAY, -5.0)), by: 'Arvind' }
  ];

  /* ----- simulated SAP PRs for the "Fetch PR" lookup ----- */
  var sapPrs = {};
  [['1004599201', 'Material', 3, 0, 7], ['1004599202', 'Equipment', 2, 3, 3], ['1004599203', 'IT', 4, 8, 8], ['1004599204', 'Indirects', 2, 4, 1]].forEach(function (d, di) {
    var req = REQUESTERS[d[3]], creator = REQUESTERS[d[4]], ls = [];
    for (var i = 0; i < d[2]; i++) {
      var cat = i === d[2] - 1 && d[2] > 2 ? 'Mfg & Ops' : d[1];
      var mat = pick(matsByCat[cat]);
      var qty = mat.unitPrice > 300000 ? 1 : rint(2, 40);
      ls.push({ line: (i + 1) * 10, materialNo: mat.materialNo, materialDescription: mat.description, quantity: qty, uom: mat.uom,
        category: cat, estimatedValue: qty * mat.unitPrice, requiredDeliveryDate: isoDate(addDays(DEMO_TODAY, rint(20, 50))) });
    }
    sapPrs[d[0]] = { prNumber: d[0], user: req.name, userEmail: di < 2 ? dirtyEmail(emailFor(req.name), di + 2) : emailFor(req.name),
      department: req.dept, requestingTeam: req.team, userHod: req.hod, prCreator: creator.name, prCreatorEmail: emailFor(creator.name),
      prStatus: 'Released', prCreationDate: isoDate(addDays(DEMO_TODAY, -1)), lines: ls };
  });

  /* ----- exec history: 25 months of awarded PO records (Nov 2024 → Nov 2026) ----- */
  var execRecords = [];
  var catScale = {};
  categories.forEach(function (c) {
    var m = CATEGORY_MATERIALS[c.name], avg = 0;
    m.forEach(function (x) { avg += x[2] / m.length; });
    // dampen unit-price differences so capex doesn't dwarf every other category
    catScale[c.name] = 90000 * Math.pow(avg / 3000, 0.3);
  });
  var catVolume = { 'Mfg & Ops': 14, 'Indirects': 8, 'Material': 7, 'Equipment': 4, 'IT': 4, 'Other': 3 };
  for (var mi = 0; mi < 25; mi++) {
    var monthStart = new Date(2024, 10 + mi, 1);
    var monthKey = monthStart.getFullYear() + '-' + (monthStart.getMonth() < 9 ? '0' : '') + (monthStart.getMonth() + 1);
    var improve = mi / 24; // process gets a little better over time
    categories.forEach(function (c) {
      var count = rint(Math.ceil(catVolume[c.name] * 0.6), catVolume[c.name]);
      var vlist = vendorsForCategory(vendors, c.name);
      for (var r = 0; r < count; r++) {
        var w = vlist.map(function (v, i) { return i === 0 ? (c.name === 'Material' ? 5 : 2) : 1; });
        var vendor = vlist.length ? weightedPick(vlist, w) : vendors[0];
        var est = Math.round(catScale[c.name] * rfloat(0.6, 3.2, 2));
        var saving = rfloat(0.02, 0.11 + improve * 0.03, 3);
        var day = rint(1, mi === 24 ? 6 : 27);
        var cyc = {
          approval: rfloat(0.5, 2.2 - improve * 0.6, 1),
          sourcing: rfloat(1.2, 4.2 - improve * 1.0, 1),
          commercials: rfloat(0.8, 2.6 - improve * 0.5, 1),
          release: rfloat(0.3, 1.4 - improve * 0.3, 1)
        };
        var total = cyc.approval + cyc.sourcing + cyc.commercials + cyc.release;
        var grnMonth = mi + weightedPick([0, 1, 2, 3], [3, 4, 2, 1]); // month the GRN was posted
        execRecords.push({
          date: isoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day)), monthKey: monthKey, monthIdx: mi,
          category: c.name, vendor: vendor.name, buyer: pick(c.buyers),
          prEstimate: est, poValue: Math.round(est * (1 - saving)),
          cycle: cyc, cycleTotal: Math.round(total * 10) / 10,
          onTime: chance(0.78 + improve * 0.1), grnMonth: grnMonth, grnDone: grnMonth < 24,
          slaBreached: total > 7.5 ? true : chance(0.06)
        });
      }
    });
  }

  return {
    buyers: buyers, categories: categories, vendors: vendors, carriers: CARRIER_SEED.map(function (c) { return Object.assign({}, c); }),
    materials: materials, materialHistory: materialHistory, lines: lines, pos: pos.map(function (p) { delete p.linked; return p; }),
    unallocated: unallocated, threads: threads, auditLog: auditLog, batchJobs: batchJobs, sapPrs: sapPrs,
    execRecords: execRecords, followUpLog: [], msgSeq: msgSeq
  };
}
