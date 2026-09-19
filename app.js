/**
 * Puthuppadi Grama Panchayath IT Stock Register - Client Application
 */

const API_BASE = window.location.origin;
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbz73R1P-6JtjMgYixFFd22mngGU4a-WbbXr_3UEXxYHwfI_fJLWal64SG3Nk5PDSPOz/exec";

// Application State
let appData = {
  pcs: [],
  monitors: [],
  peripherals: [],
  printers: [],
  other_equipments: [],
  tickets: [],
  complaints: [],
  employees: [],
  generator: { name: 'Mahindra', serial: 'N3B24XL29998', capacity: '25 KVA', logs: [] },
  purchases: [],
  ip_allocations: []
};

let currentCategory = 'pcs';
let editMode = false;

function isLocalServer() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function getGasUrl() {
  const inputVal = document.getElementById('cfg-gas-url')?.value?.trim();
  const localVal = localStorage.getItem('pgp_gas_url')?.trim();
  if (inputVal && inputVal.startsWith('http')) return inputVal;
  if (localVal && localVal.startsWith('http')) return localVal;
  return DEFAULT_GAS_URL;
}

// 1. Initialization
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadConfig();
  loadData();
});

function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Global Search
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      handleGlobalSearch(e.target.value.toLowerCase());
    });
  }

  // Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      const isLight = document.body.classList.contains('theme-light');
      themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
  }

  // Quick Sync Button
  const quickSync = document.getElementById('quick-sync-btn');
  if (quickSync) {
    quickSync.addEventListener('click', () => testSync());
  }

  // Open Add Modal Button in Header
  const btnOpenAdd = document.getElementById('btn-open-add-modal');
  if (btnOpenAdd) {
    btnOpenAdd.addEventListener('click', () => {
      openAddModal(currentCategory);
    });
  }

  // Mobile menu toggle & drawer handling
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('main-sidebar') || document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

  function openMobileSidebar() {
    if (sidebar) sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileBtn) {
    mobileBtn.addEventListener('click', openMobileSidebar);
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeMobileSidebar);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }

  // Close modals when clicking on the dark backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}

// 2. Fetch Data (Hybrid: Python Server / Google Sheets Live / LocalStorage Cache / Bundled JSON)
async function loadData() {
  // 1. Instant Cache Render
  const cachedData = localStorage.getItem('pgp_stock_data');
  if (cachedData) {
    try {
      appData = JSON.parse(cachedData);
      renderAll();
    } catch (e) {}
  }

  // 2. Local Python Server (if running on localhost)
  if (isLocalServer()) {
    try {
      const localCtrl = new AbortController();
      const localTid = setTimeout(() => localCtrl.abort(), 1200);
      const res = await fetch(`${API_BASE}/api/data`, { signal: localCtrl.signal });
      clearTimeout(localTid);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          appData = json.data;
          try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
          renderAll();
          return;
        }
      }
    } catch (err) {
      console.log('Local API not running, checking direct Google Sheets Cloud:', err.message);
    }
  }

  // 3. Direct Google Sheets Cloud Fetch (100% works on GitHub Pages / Static Hosting)
  const gasUrl = getGasUrl();
  if (gasUrl) {
    try {
      const cloudRes = await fetch(gasUrl);
      if (cloudRes.ok) {
        const cloudJson = await cloudRes.json();
        if (cloudJson.status === 'success' && cloudJson.data) {
          parseCloudSpreadsheetData(cloudJson.data);
          const nowStr = new Date().toLocaleString();
          const lastSyncedEl = document.getElementById('cfg-last-synced');
          if (lastSyncedEl) lastSyncedEl.innerText = nowStr;
          try {
            localStorage.setItem('pgp_stock_data', JSON.stringify(appData));
            localStorage.setItem('pgp_last_synced', nowStr);
          } catch (e) {}
          renderAll();
          return;
        }
      }
    } catch (cloudErr) {
      console.warn('Google Sheets live fetch warning:', cloudErr);
    }
  }

  // 4. Bundled Static Fallback
  try {
    const staticRes = await fetch('./stock_data.json');
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      appData = staticData;
      try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
      renderAll();
      return;
    }
  } catch (staticErr) {
    console.warn('Static stock_data.json fallback warning:', staticErr);
  }
}

async function loadConfig() {
  const localGasUrl = localStorage.getItem('pgp_gas_url');
  if (localGasUrl) {
    const input = document.getElementById('cfg-gas-url');
    if (input) input.value = localGasUrl;
  }
  const lastSync = localStorage.getItem('pgp_last_synced');
  if (lastSync) {
    const el = document.getElementById('cfg-last-synced');
    if (el) el.innerText = lastSync;
  }

  if (isLocalServer()) {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.config) {
          if (json.config.google_apps_script_url) {
            document.getElementById('cfg-gas-url').value = json.config.google_apps_script_url;
            localStorage.setItem('pgp_gas_url', json.config.google_apps_script_url);
          }
          if (json.config.last_synced) {
            document.getElementById('cfg-last-synced').innerText = json.config.last_synced;
            localStorage.setItem('pgp_last_synced', json.config.last_synced);
          }
          return;
        }
      }
    } catch (err) {}
  }

  try {
    const staticCfgRes = await fetch('./config.json');
    if (staticCfgRes.ok) {
      const cfg = await staticCfgRes.json();
      if (cfg.google_apps_script_url && !localStorage.getItem('pgp_gas_url')) {
        document.getElementById('cfg-gas-url').value = cfg.google_apps_script_url;
      }
      if (cfg.last_synced && !localStorage.getItem('pgp_last_synced')) {
        document.getElementById('cfg-last-synced').innerText = cfg.last_synced;
      }
    }
  } catch (e) {}
}

// 3. View Switcher
function switchView(viewName) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  const activePanel = document.getElementById(`view-${viewName}`);
  if (activePanel) activePanel.classList.add('active');

  // Close mobile sidebar if open
  const sidebar = document.getElementById('main-sidebar') || document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';

  if (['pcs', 'monitors', 'peripherals', 'printers', 'other_equipments'].includes(viewName)) {
    currentCategory = viewName;
  }

  if (viewName === 'handover') {
    populateHandoverSelect();
  }
  if (viewName === 'qr_stickers') {
    renderQrStickers();
  }
}

// 4. Render All Modules
function renderAll() {
  updateSidebarBadges();
  renderDashboard();
  renderPcsTable();
  renderMonitorsTable();
  renderPeripheralsTable();
  renderPrintersTable();
  renderOtherEquipmentsTable();
  renderComplaintsTable();
  renderEmployeesTable();
  renderPurchasesAndGenerator();
  renderIpMap();
  populateHandoverSelect();
  renderQrStickers();
  checkUrlForAsset();
}

function updateSidebarBadges() {
  document.getElementById('badge-pcs').innerText = appData.pcs.length;
  document.getElementById('badge-monitors').innerText = appData.monitors.length;
  document.getElementById('badge-peripherals').innerText = appData.peripherals.length;
  document.getElementById('badge-printers').innerText = appData.printers.length;
  document.getElementById('badge-oe').innerText = appData.other_equipments.length;

  const openComplaints = appData.complaints.filter(c => c.status !== 'Closed').length;
  document.getElementById('badge-complaints').innerText = openComplaints;
}

// 5. Dashboard Renderer
function renderDashboard() {
  const totalPcs = appData.pcs.length;
  const workingPcs = appData.pcs.filter(p => p.is_working && !p.is_complaint).length;
  const complaintPcs = totalPcs - workingPcs;
  const amcCount = appData.pcs.filter(p => p.amc_type === 'AMC').length;

  document.getElementById('kpi-total-pcs').innerText = totalPcs;
  document.getElementById('kpi-working-pcs').innerText = workingPcs;
  document.getElementById('kpi-complaint-pcs').innerText = complaintPcs;
  document.getElementById('kpi-amc-count').innerText = amcCount;

  document.getElementById('dash-monitors').innerText = appData.monitors.length;
  document.getElementById('dash-km').innerText = appData.peripherals.length;
  document.getElementById('dash-ptr').innerText = appData.printers.length;
  document.getElementById('dash-oe').innerText = appData.other_equipments.length;
  document.getElementById('dash-emp').innerText = appData.employees.length;

  const usedIps = appData.ip_allocations.filter(i => i.is_assigned).length;
  document.getElementById('dash-ips').innerText = `${usedIps} / 254`;

  // Recent Complaints
  const recentTable = document.getElementById('dash-recent-complaints');
  recentTable.innerHTML = '';
  const recent = appData.complaints.slice(0, 5);
  if (recent.length === 0) {
    recentTable.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-muted">No complaints logged</td></tr>';
  } else {
    recent.forEach(c => {
      const statusClass = c.status === 'Closed' ? 'closed' : (c.status === 'Assisted' ? 'assisted' : 'open');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${c.ticket_id || c.id}</strong><br><small class="text-muted">${c.date || ''}</small></td>
        <td><span class="asset-badge">${c.pc_asset_id}</span></td>
        <td>${c.section_name || '-'}</td>
        <td>${c.complaint_details || ''}</td>
        <td><span class="status-tag ${statusClass}">${c.status}</span></td>
      `;
      recentTable.appendChild(tr);
    });
  }

  // Section distribution pills
  const sectionPills = document.getElementById('dash-section-pills');
  sectionPills.innerHTML = '';
  const secCounts = {};
  appData.pcs.forEach(p => {
    const sec = p.office_section || 'Unassigned';
    secCounts[sec] = (secCounts[sec] || 0) + 1;
  });

  Object.entries(secCounts).forEach(([sec, count]) => {
    const pill = document.createElement('div');
    pill.className = 'section-pill';
    pill.innerHTML = `<span>${sec}</span> <strong>${count} Systems</strong>`;
    sectionPills.appendChild(pill);
  });
}

// 6. Computers & Servers Register (`Register-PC`)
function renderPcsTable(items = appData.pcs) {
  const tbody = document.getElementById('pc-table-body');
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">No matching computer systems found</td></tr>';
    return;
  }

  items.forEach(p => {
    const isWorking = (p.is_working !== false && p.is_complaint !== true && p.status !== 'Complaint');
    const statusTag = isWorking 
      ? '<span class="status-tag working"><i class="fa-solid fa-check"></i> Working</span>'
      : '<span class="status-tag complaint"><i class="fa-solid fa-triangle-exclamation"></i> Complaint</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="asset-badge">${p.asset_id}</span></td>
      <td>
        <strong>${p.brand || ''} ${p.model || ''}</strong><br>
        <small class="text-muted"><i class="fa-solid fa-microchip"></i> ${p.category || 'Desktop'} | S/N: ${p.serial_number || 'N/A'}</small>
      </td>
      <td>
        <div><strong>CPU:</strong> ${p.processor || '-'}</div>
        <small class="text-muted">RAM: ${p.ram || '-'} | Storage: ${p.storage || '-'}</small>
      </td>
      <td>
        <div>${p.os || '-'}</div>
        <span class="ip-tag">${p.ip_address ? '<i class="fa-solid fa-network-wired"></i> ' + p.ip_address : '<span class="text-muted">No IP</span>'}</span>
      </td>
      <td>
        <strong>${p.employee_name || 'Unassigned'}</strong><br>
        <small class="text-muted">Seat: ${p.seat || 'N/A'}</small>
      </td>
      <td>${p.office_section || '-'}</td>
      <td>${statusTag}</td>
      <td>
        <div>${p.amc_type || 'N/A'}</div>
        <small class="text-muted">${p.amc_agency || ''}</small>
      </td>
      <td class="text-right">
        <div class="action-btns">
          <button class="action-btn" title="QR Code & Passport" onclick="openAssetPassport('${p.asset_id}')"><i class="fa-solid fa-qrcode"></i></button>
          <button class="action-btn" title="View Handover" onclick="generateHandoverFor('${p.asset_id}')"><i class="fa-solid fa-file-lines"></i></button>
          <button class="action-btn" title="Edit Item" onclick="openEditModal('pcs', '${p.asset_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete Item" onclick="deleteStockItem('pcs', '${p.asset_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterPcs() {
  const cat = document.getElementById('filter-pc-category').value;
  const status = document.getElementById('filter-pc-status').value;
  const amc = document.getElementById('filter-pc-amc').value;
  const query = document.getElementById('filter-pc-search').value.toLowerCase();

  const filtered = appData.pcs.filter(p => {
    const matchCat = !cat || p.category === cat;
    const isWorking = p.is_working && !p.is_complaint;
    const matchStatus = !status || (status === 'Working' ? isWorking : !isWorking);
    const matchAmc = !amc || (p.amc_type && p.amc_type.includes(amc));
    const matchQuery = !query || 
      (p.asset_id && p.asset_id.toLowerCase().includes(query)) ||
      (p.employee_name && p.employee_name.toLowerCase().includes(query)) ||
      (p.seat && p.seat.toLowerCase().includes(query)) ||
      (p.processor && p.processor.toLowerCase().includes(query)) ||
      (p.ip_address && p.ip_address.toLowerCase().includes(query)) ||
      (p.serial_number && p.serial_number.toLowerCase().includes(query));

    return matchCat && matchStatus && matchAmc && matchQuery;
  });

  renderPcsTable(filtered);
}

// 7. Monitors Register
function renderMonitorsTable(items = appData.monitors) {
  const tbody = document.getElementById('monitors-table-body');
  tbody.innerHTML = '';
  items.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="asset-badge">${m.asset_id}</span></td>
      <td><strong>${m.brand || ''}</strong> ${m.model || ''}</td>
      <td><span class="text-muted font-mono">${m.serial_number || 'N/A'}</span></td>
      <td>${m.specifications || '-'}</td>
      <td>${m.assigned_seat || '-'}</td>
      <td><strong>${m.employee_name || '-'}</strong></td>
      <td><span class="asset-badge">${m.connected_pc_id || 'None'}</span></td>
      <td><span class="status-tag working">Working</span></td>
      <td class="text-right">
        <div class="action-btns">
          <button class="action-btn" title="QR Code & Passport" onclick="openAssetPassport('${m.asset_id}')"><i class="fa-solid fa-qrcode"></i></button>
          <button class="action-btn" title="Edit" onclick="openEditModal('monitors', '${m.asset_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete" onclick="deleteStockItem('monitors', '${m.asset_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 8. Keyboards & Mice Register
function renderPeripheralsTable(items = appData.peripherals) {
  const tbody = document.getElementById('peripherals-table-body');
  tbody.innerHTML = '';
  items.forEach(k => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="asset-badge">${k.asset_id}</span></td>
      <td><i class="${k.category === 'Mouse' ? 'fa-solid fa-computer-mouse' : 'fa-solid fa-keyboard'}"></i> ${k.category || 'Peripheral'}</td>
      <td><strong>${k.brand || ''}</strong> ${k.model || ''}</td>
      <td><span class="text-muted font-mono">${k.serial_number || 'N/A'}</span></td>
      <td>${k.assigned_seat || '-'}</td>
      <td><strong>${k.employee_name || '-'}</strong></td>
      <td><span class="asset-badge">${k.connected_pc_id || 'None'}</span></td>
      <td><span class="status-tag working">Working</span></td>
      <td class="text-right">
        <div class="action-btns">
          <button class="action-btn" title="QR Code & Passport" onclick="openAssetPassport('${k.asset_id}')"><i class="fa-solid fa-qrcode"></i></button>
          <button class="action-btn" title="Edit" onclick="openEditModal('peripherals', '${k.asset_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete" onclick="deleteStockItem('peripherals', '${k.asset_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 9. Printers & Scanners Register
function renderPrintersTable(items = appData.printers) {
  const tbody = document.getElementById('printers-table-body');
  tbody.innerHTML = '';
  items.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="asset-badge">${p.asset_id}</span></td>
      <td>
        <strong>${p.brand || ''}</strong><br>
        <small class="text-muted">${p.category || 'Printer'}</small>
      </td>
      <td>
        <strong>${p.model || ''}</strong><br>
        <small class="text-muted font-mono">S/N: ${p.serial_number || 'N/A'}</small>
      </td>
      <td><span class="status-tag working" style="background: rgba(59,130,246,0.1); color: var(--primary);"><i class="fa-solid fa-droplet"></i> ${p.toner_cartridge || p.specifications || 'N/A'}</span></td>
      <td>${p.assigned_seat || '-'} (${p.employee_name || 'N/A'})</td>
      <td><span class="asset-badge">${p.connected_pc_id || 'N/A'}</span></td>
      <td><span class="status-tag working">Working</span></td>
      <td class="text-right">
        <div class="action-btns">
          <button class="action-btn" title="QR Code & Passport" onclick="openAssetPassport('${p.asset_id}')"><i class="fa-solid fa-qrcode"></i></button>
          <button class="action-btn" title="Edit" onclick="openEditModal('printers', '${p.asset_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete" onclick="deleteStockItem('printers', '${p.asset_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 10. Power & Network Infrastructure Register
function renderOtherEquipmentsTable(items = appData.other_equipments) {
  const tbody = document.getElementById('oe-table-body');
  tbody.innerHTML = '';
  items.forEach(o => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="asset-badge">${o.asset_id}</span></td>
      <td><strong>${o.category || o.item_name || 'Equipment'}</strong></td>
      <td><strong>${o.brand || ''}</strong> ${o.model || ''}</td>
      <td><span class="text-muted font-mono">${o.serial_number || 'N/A'}</span></td>
      <td>${o.details || '-'}</td>
      <td>${o.section || '-'}</td>
      <td><span class="status-tag ${o.status === 'Complaint' ? 'complaint' : 'working'}">${o.status || 'Working'}</span></td>
      <td class="text-right">
        <div class="action-btns">
          <button class="action-btn" title="QR Code & Passport" onclick="openAssetPassport('${o.asset_id}')"><i class="fa-solid fa-qrcode"></i></button>
          <button class="action-btn" title="Edit" onclick="openEditModal('other_equipments', '${o.asset_id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete" onclick="deleteStockItem('other_equipments', '${o.asset_id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 11. Complaints & Ticketing Service Desk
function renderComplaintsTable(items = appData.tickets || appData.complaints || []) {
  const tbody = document.getElementById('complaints-table-body');
  tbody.innerHTML = '';

  const tickets = appData.tickets || appData.complaints || [];

  // Update Ticket KPIs
  const totalCount = tickets.length;
  const openCount = tickets.filter(t => t.status === 'Open' || t.status === 'Vendor Assigned').length;
  const partsCount = tickets.filter(t => t.status === 'Parts Pending').length;
  const closedCount = tickets.filter(t => t.status === 'Closed' || t.status === 'Resolved').length;

  const statTotal = document.getElementById('tkt-stat-total');
  if (statTotal) statTotal.innerText = totalCount;
  const statOpen = document.getElementById('tkt-stat-open');
  if (statOpen) statOpen.innerText = openCount;
  const statParts = document.getElementById('tkt-stat-parts');
  if (statParts) statParts.innerText = partsCount;
  const statClosed = document.getElementById('tkt-stat-closed');
  if (statClosed) statClosed.innerText = closedCount;

  // Update dashboard badge
  const badgeComp = document.getElementById('badge-complaints');
  if (badgeComp) badgeComp.innerText = openCount + partsCount;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center p-4 text-muted">No matching service tickets found</td></tr>';
    return;
  }

  items.forEach(t => {
    let statusClass = 'open';
    if (t.status === 'Closed' || t.status === 'Resolved') statusClass = 'resolved';
    else if (t.status === 'Vendor Assigned') statusClass = 'vendor-assigned';
    else if (t.status === 'Parts Pending') statusClass = 'parts-pending';

    const prio = (t.priority || 'Medium').toLowerCase();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${t.ticket_id || t.id}</strong><br>
        <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${t.date_logged || t.date || '-'}</small>
      </td>
      <td>
        <span class="asset-badge">${t.asset_id || t.pc_asset_id}</span><br>
        <small class="text-muted">${t.office_section || t.section_name || ''} (${t.reported_by || ''})</small>
      </td>
      <td><span class="priority-tag ${prio}">${t.priority || 'Medium'}</span></td>
      <td>
        <strong>${t.fault_description || t.complaint_details || ''}</strong><br>
        <small class="text-muted"><i class="fa-solid fa-tag"></i> ${t.issue_category || 'Hardware'}</small>
      </td>
      <td>
        <div><strong>${t.service_provider || t.amc_details || 'Keltron AMC'}</strong></div>
        <small class="text-muted">${t.vendor_call_no || t.ticket_id || 'N/A'}</small>
      </td>
      <td>
        <div>${t.technician_name || '<span class="text-muted">Unassigned</span>'}</div>
        <small class="text-muted">${t.technician_phone || ''}</small>
      </td>
      <td>
        <div>${t.resolution || t.solution || '<span class="text-muted">In Progress</span>'}</div>
        ${t.parts_replaced ? `<small class="text-muted"><i class="fa-solid fa-wrench"></i> ${t.parts_replaced}</small>` : ''}
      </td>
      <td><span class="status-tag ${statusClass}">${t.status || 'Open'}</span></td>
      <td class="text-right">
        <div class="action-btns">
          ${t.ccfr_url ? `<a href="${t.ccfr_url}" target="_blank" class="action-btn" title="View Signed CCFR Report" style="color: #10b981;"><i class="fa-solid fa-file-invoice"></i></a>` : ''}
          <button class="action-btn" title="Print Job Card" onclick="openJobCardModal('${t.ticket_id || t.id}')"><i class="fa-solid fa-print"></i></button>
          <button class="action-btn" title="Edit Ticket" onclick="openEditTicketModal('${t.ticket_id || t.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="action-btn delete" title="Delete Ticket" onclick="deleteTicket('${t.ticket_id || t.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterTickets() {
  const status = document.getElementById('filter-tkt-status').value;
  const prio = document.getElementById('filter-tkt-priority').value;
  const provider = document.getElementById('filter-tkt-provider').value;
  const query = document.getElementById('filter-tkt-search').value.toLowerCase();

  const tickets = appData.tickets || appData.complaints || [];

  const filtered = tickets.filter(t => {
    const matchStatus = !status || t.status === status;
    const matchPrio = !prio || (t.priority && t.priority.toLowerCase() === prio.toLowerCase());
    const matchProv = !provider || (t.service_provider && t.service_provider.toLowerCase().includes(provider.toLowerCase()));
    const matchQuery = !query ||
      (t.ticket_id && t.ticket_id.toLowerCase().includes(query)) ||
      (t.vendor_call_no && t.vendor_call_no.toLowerCase().includes(query)) ||
      (t.asset_id && t.asset_id.toLowerCase().includes(query)) ||
      (t.technician_name && t.technician_name.toLowerCase().includes(query)) ||
      (t.fault_description && t.fault_description.toLowerCase().includes(query)) ||
      (t.office_section && t.office_section.toLowerCase().includes(query));

    return matchStatus && matchPrio && matchProv && matchQuery;
  });

  renderComplaintsTable(filtered);
}

// 12. Open & Populate Ticket Modals
function openTicketModal() {
  document.getElementById('complaint-modal-title').innerHTML = '<i class="fa-solid fa-plus"></i> Create New Service Ticket';
  document.getElementById('comp-id').value = '';
  document.getElementById('comp-tkt-id').value = '';
  document.getElementById('comp-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('comp-priority').value = 'High';
  document.getElementById('comp-category').value = 'Hardware Fault';
  document.getElementById('comp-details').value = '';
  document.getElementById('comp-ticket').value = '';
  document.getElementById('comp-vendor-date').value = '';
  document.getElementById('comp-attended-date').value = '';
  document.getElementById('comp-tech-name').value = '';
  document.getElementById('comp-tech-phone').value = '';
  document.getElementById('comp-parts').value = '';
  document.getElementById('comp-solution').value = '';
  document.getElementById('comp-status').value = 'Open';

  const fileInput = document.getElementById('comp-ccfr-file');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('comp-ccfr-url');
  if (urlInput) urlInput.value = '';
  const previewDiv = document.getElementById('comp-ccfr-preview');
  if (previewDiv) previewDiv.style.display = 'none';

  populateTicketAssetSelect();
  openModal('complaint-modal');
}

function openEditTicketModal(ticketId) {
  const tickets = appData.tickets || appData.complaints || [];
  const t = tickets.find(tk => tk.ticket_id === ticketId || tk.id === ticketId);
  if (!t) return;

  document.getElementById('complaint-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Ticket ${t.ticket_id || t.id}`;
  document.getElementById('comp-id').value = t.ticket_id || t.id;
  document.getElementById('comp-tkt-id').value = t.ticket_id || t.id;
  
  populateTicketAssetSelect(t.asset_id || t.pc_asset_id);
  
  document.getElementById('comp-priority').value = t.priority || 'Medium';
  document.getElementById('comp-item-name').value = t.item_name || '';
  document.getElementById('comp-section').value = t.office_section || t.section_name || '';
  document.getElementById('comp-reported-by').value = t.reported_by || '';
  document.getElementById('comp-category').value = t.issue_category || 'Hardware Fault';
  document.getElementById('comp-date').value = t.date_logged || t.date || '';
  document.getElementById('comp-details').value = t.fault_description || t.complaint_details || '';
  document.getElementById('comp-amc').value = t.service_provider || t.amc_details || '';
  document.getElementById('comp-ticket').value = t.vendor_call_no || t.ticket_id || '';
  document.getElementById('comp-vendor-date').value = t.vendor_call_date || '';
  document.getElementById('comp-attended-date').value = t.attended_date || t.assisted_date || '';
  document.getElementById('comp-tech-name').value = t.technician_name || '';
  document.getElementById('comp-tech-phone').value = t.technician_phone || '';
  document.getElementById('comp-parts').value = t.parts_replaced || '';
  document.getElementById('comp-status').value = t.status || 'Open';
  document.getElementById('comp-solution').value = t.resolution || t.solution || '';

  const fileInput = document.getElementById('comp-ccfr-file');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('comp-ccfr-url');
  if (urlInput) urlInput.value = t.ccfr_url || '';
  const previewDiv = document.getElementById('comp-ccfr-preview');
  const previewLink = document.getElementById('comp-ccfr-link');
  if (previewDiv && previewLink) {
    if (t.ccfr_url) {
      previewLink.href = t.ccfr_url;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }
  }

  openModal('complaint-modal');
}

function populateTicketAssetSelect(selectedId = '') {
  const pcSelect = document.getElementById('comp-pc-select');
  pcSelect.innerHTML = '<option value="">-- Choose Affected System / Equipment --</option>';

  // PCs
  const pcGroup = document.createElement('optgroup');
  pcGroup.label = 'Computers & Servers';
  appData.pcs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_id;
    opt.innerText = `${p.asset_id} - ${p.brand} ${p.model} (${p.seat || p.office_section} - ${p.employee_name || 'Vacant'})`;
    if (p.asset_id === selectedId) opt.selected = true;
    pcGroup.appendChild(opt);
  });
  pcSelect.appendChild(pcGroup);

  // Printers
  const ptrGroup = document.createElement('optgroup');
  ptrGroup.label = 'Printers & Scanners';
  appData.printers.forEach(pt => {
    const opt = document.createElement('option');
    opt.value = pt.asset_id;
    opt.innerText = `${pt.asset_id} - ${pt.brand} ${pt.model} (${pt.assigned_seat || ''})`;
    if (pt.asset_id === selectedId) opt.selected = true;
    ptrGroup.appendChild(opt);
  });
  pcSelect.appendChild(ptrGroup);

  // Other Equipments
  const oeGroup = document.createElement('optgroup');
  oeGroup.label = 'Power & Network';
  appData.other_equipments.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.asset_id;
    opt.innerText = `${o.asset_id} - ${o.category || o.item_name} (${o.section})`;
    if (o.asset_id === selectedId) opt.selected = true;
    oeGroup.appendChild(opt);
  });
  pcSelect.appendChild(oeGroup);
}

function onComplaintPcSelect(assetId) {
  if (!assetId) return;
  const pc = appData.pcs.find(p => p.asset_id === assetId);
  if (pc) {
    document.getElementById('comp-item-name').value = `${pc.brand} ${pc.model} (${pc.processor || ''}, ${pc.ram || ''})`;
    document.getElementById('comp-section').value = `${pc.office_section || ''} - Seat: ${pc.seat || ''}`;
    document.getElementById('comp-reported-by').value = pc.employee_name || '';
    document.getElementById('comp-amc').value = `${pc.amc_agency || 'Keltron'} (${pc.amc_type || 'AMC'})`;
    return;
  }

  const ptr = appData.printers.find(p => p.asset_id === assetId);
  if (ptr) {
    document.getElementById('comp-item-name').value = `${ptr.brand} ${ptr.model} (${ptr.category})`;
    document.getElementById('comp-section').value = ptr.assigned_seat || '';
    document.getElementById('comp-reported-by').value = ptr.employee_name || '';
    document.getElementById('comp-amc').value = 'Keltron AMC';
    document.getElementById('comp-category').value = 'Printer / Scanner';
    return;
  }

  const oe = appData.other_equipments.find(o => o.asset_id === assetId);
  if (oe) {
    document.getElementById('comp-item-name').value = `${oe.brand} ${oe.model} (${oe.category || oe.item_name})`;
    document.getElementById('comp-section').value = oe.section || '';
    document.getElementById('comp-amc').value = 'In-House / OEM';
    document.getElementById('comp-category').value = 'Power / UPS';
  }
}

// Helper: Recalculate IP allocations locally
function recalculateClientIps() {
  const assignedIps = {};
  (appData.pcs || []).forEach(p => {
    if (p.ip_address && String(p.ip_address).startsWith('192.168.0.')) {
      assignedIps[p.ip_address] = {
        asset_id: p.asset_id,
        employee_name: p.employee_name || '',
        seat: p.seat || '',
        office_section: p.office_section || '',
        brand: p.brand || '',
        model: p.model || '',
        processor: p.processor || '',
        ram: p.ram || '',
        os: p.os || '',
        status: p.status || 'Working'
      };
    }
  });
  const allocs = [];
  for (let i = 1; i <= 254; i++) {
    const ip = `192.168.0.${i}`;
    const assign = assignedIps[ip];
    allocs.push({
      ip: ip,
      ip_address: ip,
      is_assigned: !!assign,
      assigned_to: assign ? assign.asset_id : null,
      employee_name: assign ? assign.employee_name : null,
      seat: assign ? assign.seat : null,
      office_section: assign ? assign.office_section : null,
      brand: assign ? assign.brand : null,
      model: assign ? assign.model : null,
      processor: assign ? assign.processor : null,
      ram: assign ? assign.ram : null,
      os: assign ? assign.os : null,
      status: assign ? assign.status : null
    });
  }
  appData.ip_allocations = allocs;
}

function getNextAssetId(category) {
  const prefixMap = {
    pcs: 'PGP-SYS-PC',
    monitors: 'PGP-SYS-MTR',
    peripherals: 'PGP-SYS-KM',
    printers: 'PGP-SYS-PTR',
    other_equipments: 'PGP-SYS-OE'
  };
  const prefix = prefixMap[category] || 'PGP-SYS-ITEM';
  const list = appData[category] || [];
  let maxNum = 0;
  list.forEach(it => {
    const aid = String(it.asset_id || '');
    if (aid.startsWith(prefix)) {
      const num = parseInt(aid.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

function getNextTicketId() {
  const year = new Date().getFullYear();
  const prefix = `TKT-${year}-`;
  const list = appData.tickets || appData.complaints || [];
  let maxNum = 0;
  list.forEach(t => {
    const tid = String(t.ticket_id || t.id || '');
    if (tid.startsWith(prefix)) {
      const num = parseInt(tid.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    } else if (tid.startsWith('TKT-')) {
      const parts = tid.split('-');
      const num = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}

function getRowDataForSheet(category, item) {
  if (category === 'pcs') {
    return [
      item.asset_id, item.category || 'Desktop', item.brand || '', item.model || '',
      item.serial_number || '', item.processor || '', item.ram || '', item.storage || '',
      item.os || '', item.ip_address || '', item.seat || '', item.employee_name || '',
      item.office_section || 'PGP OFFICE', item.purchase_date || '', item.warranty_expiry || '',
      item.is_working ? 1 : 0, item.status || 'Working',
      item.is_complaint ? 1 : 0, item.device_status || item.status || 'Working',
      item.amc_type || '', item.amc_agency || ''
    ];
  } else if (category === 'monitors') {
    return [
      item.asset_id, item.category || 'Monitor', item.brand || '', item.model || '',
      item.serial_number || '', item.specifications || '', item.assigned_seat || '',
      item.employee_name || '', item.purchase_date || '', item.warranty_expiry || '',
      item.connected_pc_id || '', item.status || 'Working'
    ];
  } else if (category === 'peripherals') {
    return [
      item.asset_id, item.category || 'Peripheral', item.brand || '', item.model || '',
      item.serial_number || '', item.assigned_seat || '', item.employee_name || '',
      item.purchase_date || '', item.warranty_expiry || '', item.connected_pc_id || '',
      item.status || 'Working'
    ];
  } else if (category === 'printers') {
    return [
      item.asset_id, item.category || 'Printer', item.brand || '', item.model || '',
      item.serial_number || '', item.specifications || '', item.toner_cartridge || '',
      item.assigned_seat || '', item.employee_name || '', item.purchase_date || '',
      item.warranty_expiry || '', item.connected_pc_id || '', item.status || 'Working'
    ];
  } else if (category === 'other_equipments') {
    return [
      item.asset_id, item.category || item.item_name || 'Equipment', item.brand || '',
      item.model || '', item.serial_number || '', item.details || '', item.section || 'PGP OFFICE',
      item.status || 'Working'
    ];
  }
  return [];
}

function ticketToSheetRow(t) {
  return [
    t.ticket_id, t.vendor_call_no || '', t.asset_id || t.pc_asset_id || '',
    t.item_name || '', t.office_section || t.section_name || '', t.reported_by || '',
    t.issue_category || 'Hardware Fault', t.priority || 'Medium',
    t.fault_description || t.complaint_details || '', t.service_provider || t.amc_details || 'Keltron AMC',
    t.date_logged || t.date || '', t.vendor_call_date || '', t.attended_date || '',
    t.technician_name || '', t.technician_phone || '', t.parts_replaced || '',
    t.resolution || t.solution || '', t.status || 'Open',
    t.closed_date || '', t.turnaround_days || '', t.remarks || 'Managed via PGP IT Register',
    t.ccfr_url || ''
  ];
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function postToCloudOrLocal(localEndpoint, localMethod, localBody, gasPayload) {
  let gasResult = null;
  // 1. Google Apps Script Web App Push
  const gasUrl = getGasUrl();
  if (gasUrl && gasPayload) {
    try {
      const resp = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(gasPayload)
      });
      if (resp.ok) {
        gasResult = await resp.json();
        if (gasResult && gasResult.status === 'success') {
          const nowStr = new Date().toLocaleString();
          const lastSyncedEl = document.getElementById('cfg-last-synced');
          if (lastSyncedEl) lastSyncedEl.innerText = nowStr;
          try { localStorage.setItem('pgp_last_synced', nowStr); } catch (e) {}
        } else if (gasResult && gasResult.status === 'error') {
          console.warn('Cloud Sync Error:', gasResult.message);
          showToast('Google Sheet Sync Notice: ' + gasResult.message, 'warning');
        }
      }
    } catch (e) {
      console.warn('Background Google Apps Script push notice:', e);
    }
  }

  // 2. Local Python Server (if active)
  if (isLocalServer() && localEndpoint) {
    try {
      await fetch(`${API_BASE}${localEndpoint}`, {
        method: localMethod || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: localBody ? JSON.stringify(localBody) : undefined
      });
    } catch (e) {
      console.log('Local server sync notice:', e);
    }
  }
  return gasResult;
}

async function handleComplaintSubmit(e) {
  e.preventDefault();
  const ticketId = document.getElementById('comp-id').value;
  const assetId = document.getElementById('comp-pc-select').value;
  const priority = document.getElementById('comp-priority').value;
  const itemName = document.getElementById('comp-item-name').value.trim();
  const section = document.getElementById('comp-section').value.trim();
  const reportedBy = document.getElementById('comp-reported-by').value.trim();
  const category = document.getElementById('comp-category').value;
  const dateLogged = document.getElementById('comp-date').value;
  const details = document.getElementById('comp-details').value.trim();
  const amc = document.getElementById('comp-amc').value.trim();
  const vendorCallNo = document.getElementById('comp-ticket').value.trim();
  const vendorDate = document.getElementById('comp-vendor-date').value;
  const attendedDate = document.getElementById('comp-attended-date').value;
  const techName = document.getElementById('comp-tech-name').value.trim();
  const techPhone = document.getElementById('comp-tech-phone').value.trim();
  const parts = document.getElementById('comp-parts').value.trim();
  const status = document.getElementById('comp-status').value;
  const solution = document.getElementById('comp-solution').value.trim();

  const finalTicketId = ticketId || getNextTicketId();
  const isClosed = (status === 'Closed' || status === 'Resolved');

  // Check for uploaded CCFR file
  const ccfrFileInput = document.getElementById('comp-ccfr-file');
  let fileData = null;
  if (ccfrFileInput && ccfrFileInput.files && ccfrFileInput.files.length > 0) {
    const file = ccfrFileInput.files[0];
    showToast('Uploading signed CCFR to Google Drive...', 'info');
    try {
      const base64 = await readFileAsBase64(file);
      fileData = {
        base64: base64,
        mimeType: file.type || 'application/pdf',
        fileName: file.name || 'CCFR_Document.pdf'
      };
    } catch (err) {
      console.warn('Failed to read CCFR file:', err);
    }
  }

  const existingCcfrUrl = document.getElementById('comp-ccfr-url')?.value.trim() || '';

  const ticket = {
    ticket_id: finalTicketId,
    id: finalTicketId,
    vendor_call_no: vendorCallNo,
    asset_id: assetId,
    pc_asset_id: assetId,
    item_name: itemName,
    office_section: section,
    section_name: section,
    reported_by: reportedBy,
    issue_category: category,
    priority: priority,
    fault_description: details,
    complaint_details: details,
    service_provider: amc,
    amc_details: amc,
    date_logged: dateLogged,
    date: dateLogged,
    vendor_call_date: vendorDate,
    attended_date: attendedDate,
    assisted_date: attendedDate,
    technician_name: techName,
    technician_phone: techPhone,
    parts_replaced: parts,
    resolution: solution,
    solution: solution,
    status: status,
    closed_date: isClosed ? new Date().toISOString().split('T')[0] : '',
    turnaround_days: '',
    remarks: 'Managed via PGP IT Register',
    ccfr_url: existingCcfrUrl
  };

  if (!appData.tickets) appData.tickets = [];
  const existingIdx = appData.tickets.findIndex(t => t.ticket_id === finalTicketId || t.id === finalTicketId);
  const isEdit = existingIdx !== -1;
  if (isEdit) {
    appData.tickets[existingIdx] = ticket;
  } else {
    appData.tickets.unshift(ticket);
  }
  appData.complaints = appData.tickets;

  // Update associated PC status
  if (assetId) {
    const pc = appData.pcs.find(p => p.asset_id === assetId);
    if (pc) {
      if (isClosed) {
        pc.is_complaint = false;
        pc.is_working = true;
        pc.status = 'Working';
        pc.device_status = 'Working';
      } else {
        pc.is_complaint = true;
        pc.is_working = false;
        pc.status = 'Complaint';
        pc.device_status = 'Complaint';
      }
    }
  }

  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  closeModal('complaint-modal');
  showToast('Service ticket saved & synchronized successfully!', 'success');

  const rowData = ticketToSheetRow(ticket);
  postToCloudOrLocal(
    '/api/tickets',
    'POST',
    { ticket },
    {
      action: isEdit ? 'update_ticket' : 'add_ticket',
      ticketId: finalTicketId,
      assetId: assetId,
      sheet: 'Ticketing_System',
      data: rowData,
      fileData: fileData,
      ccfrUrl: existingCcfrUrl
    }
  ).then(res => {
    if (res && res.ccfrUrl) {
      ticket.ccfr_url = res.ccfrUrl;
      try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
      renderAll();
      showToast('Signed CCFR attached to ticket!', 'success');
    }
  });
}

async function deleteTicket(ticketId) {
  if (!confirm(`Are you sure you want to delete ticket ${ticketId}?`)) return;

  if (appData.tickets) {
    appData.tickets = appData.tickets.filter(t => t.ticket_id !== ticketId && t.id !== ticketId);
    appData.complaints = appData.tickets;
  }
  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  showToast(`Ticket ${ticketId} deleted`, 'success');

  postToCloudOrLocal(
    `/api/tickets?ticket_id=${ticketId}`,
    'DELETE',
    null,
    {
      action: 'delete_ticket',
      ticketId: ticketId
    }
  );
}

// 13. Job Card / Service Slip Generator
function openJobCardModal(ticketId) {
  const tickets = appData.tickets || appData.complaints || [];
  const t = tickets.find(tk => tk.ticket_id === ticketId || tk.id === ticketId);
  if (!t) return;

  document.getElementById('jc-ticket-id').innerText = t.ticket_id || t.id;
  document.getElementById('jc-date').innerText = t.date_logged || t.date || new Date().toISOString().split('T')[0];
  document.getElementById('jc-asset-id').innerText = t.asset_id || t.pc_asset_id || 'N/A';
  
  const prio = (t.priority || 'Medium').toLowerCase();
  document.getElementById('jc-priority').innerHTML = `<span class="priority-tag ${prio}">${t.priority || 'Medium'}</span>`;
  document.getElementById('jc-item').innerText = t.item_name || 'Computer System';
  document.getElementById('jc-section').innerText = t.office_section || t.section_name || 'PGP OFFICE';
  document.getElementById('jc-reported-by').innerText = t.reported_by || 'Staff';
  document.getElementById('jc-provider').innerText = t.service_provider || t.amc_details || 'Keltron AMC';
  document.getElementById('jc-vendor-ref').innerText = t.vendor_call_no || 'Pending';
  document.getElementById('jc-fault-details').innerText = t.fault_description || t.complaint_details || 'Fault reported.';
  document.getElementById('jc-work-done').innerText = t.resolution || t.solution || '____________________________________________________';
  document.getElementById('jc-parts').innerText = t.parts_replaced || '____________________________________________________';
  document.getElementById('jc-tech').innerText = t.technician_name ? `${t.technician_name} (${t.technician_phone || ''})` : '____________________________________________________';

  const ccfrBtn = document.getElementById('jc-ccfr-btn');
  if (ccfrBtn) {
    if (t.ccfr_url) {
      ccfrBtn.href = t.ccfr_url;
      ccfrBtn.style.display = 'inline-flex';
    } else {
      ccfrBtn.style.display = 'none';
    }
  }

  openModal('job-card-modal');
}

function printJobCard() {
  window.print();
}

// 14. Purchases & Generator Handlers
function openPurchaseModal() {
  document.getElementById('pur-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('pur-amount').value = '';
  document.getElementById('pur-item').value = '';
  document.getElementById('pur-vendor').value = '';
  document.getElementById('pur-file').value = '';
  openModal('purchase-modal');
}

async function handlePurchaseSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('pur-date').value;
  const amount = document.getElementById('pur-amount').value;
  const item = document.getElementById('pur-item').value.trim();
  const vendor = document.getElementById('pur-vendor').value.trim();
  const fileNo = document.getElementById('pur-file').value.trim();

  const purchase = {
    date: date,
    amount: amount,
    item: item,
    vendor: vendor,
    file_number: fileNo
  };

  if (!appData.purchases) appData.purchases = [];
  appData.purchases.unshift(purchase);
  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  closeModal('purchase-modal');
  showToast('Purchase record added & synced successfully!', 'success');

  postToCloudOrLocal(
    '/api/purchases',
    'POST',
    { purchase },
    {
      action: 'add_purchase',
      data: [date, item, amount, vendor, fileNo]
    }
  );
}

function openGeneratorModal() {
  document.getElementById('gen-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('gen-hours').value = '';
  document.getElementById('gen-service').value = '';
  document.getElementById('gen-amount').value = '';
  document.getElementById('gen-remarks').value = '';
  openModal('generator-modal');
}

async function handleGeneratorSubmit(e) {
  e.preventDefault();
  const date = document.getElementById('gen-date').value;
  const hours = document.getElementById('gen-hours').value;
  const service = document.getElementById('gen-service').value.trim();
  const amount = document.getElementById('gen-amount').value;
  const remarks = document.getElementById('gen-remarks').value.trim();

  const log = {
    call_date: date,
    running_hours: hours,
    service_details: service,
    service_attended_date: date,
    amount: amount,
    remarks: remarks
  };

  if (!appData.generator) appData.generator = { name: 'Mahindra', serial: 'N3B24XL29998', capacity: '25 KVA', logs: [] };
  if (!Array.isArray(appData.generator.logs)) appData.generator.logs = [];
  appData.generator.logs.unshift(log);
  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  closeModal('generator-modal');
  showToast('Generator service log added & synced successfully!', 'success');

  postToCloudOrLocal(
    '/api/generator',
    'POST',
    { log },
    {
      action: 'add_generator',
      data: [date, service, hours, amount, remarks]
    }
  );
}

// 15. Employee Modal Handlers
function openEmployeeModal() {
  document.getElementById('emp-modal-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> Add New Staff / Seat';
  document.getElementById('emp-seat').value = '';
  document.getElementById('emp-seat').readOnly = false;
  document.getElementById('emp-seat').classList.remove('input-readonly');
  document.getElementById('emp-name').value = '';
  document.getElementById('emp-desig').value = '';
  document.getElementById('emp-office').value = 'PGP OFFICE';
  openModal('employee-modal');
}

function editEmployee(seatCode) {
  const emp = appData.employees.find(e => e.seat === seatCode);
  if (!emp) return;

  document.getElementById('emp-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Staff (${emp.seat})`;
  document.getElementById('emp-seat').value = emp.seat;
  document.getElementById('emp-seat').readOnly = true;
  document.getElementById('emp-seat').classList.add('input-readonly');
  document.getElementById('emp-name').value = emp.name;
  document.getElementById('emp-desig').value = emp.designation;
  document.getElementById('emp-office').value = emp.office;
  openModal('employee-modal');
}

async function handleEmployeeSubmit(e) {
  e.preventDefault();
  const seat = document.getElementById('emp-seat').value.trim().toUpperCase();
  const name = document.getElementById('emp-name').value.trim();
  const desig = document.getElementById('emp-desig').value.trim();
  const office = document.getElementById('emp-office').value.trim();

  const employee = {
    seat: seat,
    name: name,
    designation: desig,
    office: office,
    sl_no: appData.employees.length + 1
  };

  if (!appData.employees) appData.employees = [];
  const empIdx = appData.employees.findIndex(em => em.seat === seat);
  if (empIdx !== -1) {
    appData.employees[empIdx] = { ...appData.employees[empIdx], ...employee };
  } else {
    appData.employees.push(employee);
  }
  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  closeModal('employee-modal');
  showToast('Staff details updated & synchronized successfully!', 'success');

  postToCloudOrLocal(
    '/api/employees',
    'POST',
    { employee },
    {
      action: 'update_employee',
      employee: { seat, name, designation: desig, office }
    }
  );
}

// 12. Staff & Seats Directory
function renderEmployeesTable(items = appData.employees) {
  const tbody = document.getElementById('employees-table-body');
  tbody.innerHTML = '';
  items.forEach(e => {
    const assignedPc = appData.pcs.find(p => p.seat === e.seat);
    const pcBadge = assignedPc ? `<span class="asset-badge">${assignedPc.asset_id}</span>` : '<span class="text-muted">None</span>';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.sl_no}</td>
      <td><strong><span class="status-tag working" style="background: rgba(255,255,255,0.06); color: var(--text-primary);">${e.seat}</span></strong></td>
      <td><strong>${e.name}</strong></td>
      <td>${e.designation}</td>
      <td>${e.office}</td>
      <td>${pcBadge}</td>
      <td class="text-right">
        <button class="action-btn" title="Edit Employee" onclick="editEmployee('${e.seat}')"><i class="fa-solid fa-pen"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 13. Purchases and Generator
function renderPurchasesAndGenerator() {
  const purTbody = document.getElementById('purchases-table-body');
  if (purTbody) {
    purTbody.innerHTML = '';
    (appData.purchases || []).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.date || '-'}</td>
        <td><strong>${p.item || '-'}</strong></td>
        <td><strong class="text-success">${p.amount ? '₹' + p.amount : '-'}</strong></td>
        <td>${p.vendor || '-'}</td>
        <td><span class="text-muted">${p.file_number || '-'}</span></td>
      `;
      purTbody.appendChild(tr);
    });
  }

  const genTbody = document.getElementById('generator-table-body');
  if (genTbody) {
    genTbody.innerHTML = '';
    const logs = (appData.generator && Array.isArray(appData.generator.logs)) ? appData.generator.logs : [];
    logs.forEach(g => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${g.call_date || '-'}</td>
        <td>${g.service_details || 'Routine maintenance'}</td>
        <td>${g.running_hours ? g.running_hours + ' hrs' : '-'}</td>
        <td>${g.amount ? '₹' + g.amount : '-'}</td>
      `;
      genTbody.appendChild(tr);
    });
  }
}

// 14. IP Address Grid & Detailed Viewer
function openIpDetail(ipStr) {
  const ipObj = (appData.ip_allocations || []).find(i => (i.ip === ipStr || i.ip_address === ipStr));
  if (!ipObj) return;

  const titleEl = document.getElementById('ip-modal-title');
  const bodyEl = document.getElementById('ip-modal-body');
  const footerEl = document.getElementById('ip-modal-footer');

  if (ipObj.is_assigned && ipObj.assigned_to) {
    const pc = appData.pcs.find(p => p.asset_id === ipObj.assigned_to) || {};
    const empName = ipObj.employee_name || pc.employee_name || 'Unassigned Staff';
    const seatCode = ipObj.seat || pc.seat || 'N/A';
    const section = ipObj.office_section || pc.office_section || 'PGP OFFICE';
    const isWorking = (pc.is_working !== false && pc.is_complaint !== true && pc.status !== 'Complaint');

    titleEl.innerHTML = `<i class="fa-solid fa-network-wired" style="color: #10b981;"></i> IP: ${ipStr} (Allocated)`;
    bodyEl.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: 700; color: #10b981; font-family: monospace;"><i class="fa-solid fa-server"></i> ${ipStr}</span>
          <span class="status-tag ${isWorking ? 'working' : 'complaint'}">${isWorking ? 'Active / Working' : 'In Complaint'}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: var(--bg-input); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <small class="text-muted" style="display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Assigned Staff / User</small>
          <strong style="font-size: 14.5px; color: var(--text-primary);"><i class="fa-solid fa-user" style="color: var(--primary);"></i> ${empName}</strong>
        </div>

        <div style="background: var(--bg-input); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <small class="text-muted" style="display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Assigned Seat Code</small>
          <strong style="font-size: 14.5px; color: var(--text-primary);"><i class="fa-solid fa-chair" style="color: var(--warning);"></i> ${seatCode}</strong>
        </div>

        <div style="background: var(--bg-input); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <small class="text-muted" style="display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Office Section / Branch</small>
          <strong style="font-size: 14.5px; color: var(--text-primary);"><i class="fa-solid fa-building" style="color: #60a5fa;"></i> ${section}</strong>
        </div>

        <div style="background: var(--bg-input); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">
          <small class="text-muted" style="display: block; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">Host Computer Asset ID</small>
          <strong style="font-size: 14.5px; color: var(--text-primary);"><i class="fa-solid fa-desktop" style="color: var(--primary);"></i> ${ipObj.assigned_to}</strong>
        </div>
      </div>

      ${pc.brand || pc.model ? `
      <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); margin-top: 12px; font-size: 13px;">
        <strong>Hardware Model:</strong> ${pc.brand || ''} ${pc.model || ''} | ${pc.processor || 'CPU'} | ${pc.ram || 'RAM'} | ${pc.os || 'OS'}
      </div>
      ` : ''}
    `;

    footerEl.innerHTML = `
      <button type="button" class="btn btn-outline" onclick="closeModal('ip-detail-modal')">Close</button>
      <button type="button" class="btn btn-primary" onclick="closeModal('ip-detail-modal'); openAssetPassport('${ipObj.assigned_to}')"><i class="fa-solid fa-qrcode"></i> Asset Passport</button>
      <button type="button" class="btn btn-secondary" onclick="closeModal('ip-detail-modal'); openEditModal('pcs', '${ipObj.assigned_to}')"><i class="fa-solid fa-pen"></i> Edit PC</button>
    `;
  } else {
    titleEl.innerHTML = `<i class="fa-solid fa-network-wired" style="color: #94a3b8;"></i> IP: ${ipStr} (Available)`;
    bodyEl.innerHTML = `
      <div style="background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 16px; font-weight: 700; color: #94a3b8; font-family: monospace;">${ipStr}</span>
          <span class="status-tag" style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1;">Free / Unallocated</span>
        </div>
      </div>
      <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">
        This IP address is currently free in the <strong>192.168.0.0/24</strong> subnet and can be assigned to a new computer or server.
      </p>
    `;

    footerEl.innerHTML = `
      <button type="button" class="btn btn-outline" onclick="closeModal('ip-detail-modal')">Close</button>
      <button type="button" class="btn btn-primary" onclick="closeModal('ip-detail-modal'); openAddModal('pcs'); setTimeout(() => { const ipInp = document.getElementById('form-ip'); if (ipInp) ipInp.value = '${ipStr}'; }, 100);"><i class="fa-solid fa-plus"></i> Assign to New PC</button>
    `;
  }

  openModal('ip-detail-modal');
}

function renderIpMap() {
  const container = document.getElementById('ip-grid-container');
  if (!container) return;
  container.innerHTML = '';
  (appData.ip_allocations || []).forEach(ipObj => {
    const ipStr = String(ipObj.ip || ipObj.ip_address || '');
    if (!ipStr) return;
    const cell = document.createElement('div');
    cell.className = `ip-cell ${ipObj.is_assigned ? 'used' : 'free'}`;
    const ipLast = ipStr.includes('.') ? ipStr.split('.').pop() : ipStr;
    cell.innerHTML = `.${ipLast}`;

    if (ipObj.is_assigned && ipObj.assigned_to) {
      cell.title = `IP: ${ipStr}\nAssigned to: ${ipObj.assigned_to}\nStaff: ${ipObj.employee_name || 'Staff'}\nSeat: ${ipObj.seat || '-'}\nSection: ${ipObj.office_section || '-'}\n(Click to view details)`;
    } else {
      cell.title = `IP: ${ipStr} (Free / Available - Click to assign)`;
    }

    cell.style.cursor = 'pointer';
    cell.addEventListener('click', () => {
      openIpDetail(ipStr);
    });

    container.appendChild(cell);
  });
}

// 15. RT-Section Asset Handover Generator
function populateHandoverSelect() {
  const select = document.getElementById('handover-pc-select');
  if (!select) return;
  select.innerHTML = '';
  const pcs = appData.pcs || [];
  pcs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_id;
    opt.innerText = `${p.asset_id} - ${p.employee_name || 'Vacant'} (${p.seat || p.office_section || ''})`;
    select.appendChild(opt);
  });

  if (pcs.length > 0) {
    populateHandoverSheet(pcs[0].asset_id);
  }
}

function generateHandoverFor(assetId) {
  switchView('handover');
  document.getElementById('handover-pc-select').value = assetId;
  populateHandoverSheet(assetId);
}

function populateHandoverSheet(pcAssetId) {
  const pc = appData.pcs.find(p => p.asset_id === pcAssetId);
  if (!pc) return;

  document.getElementById('cert-asset-id').innerText = pc.asset_id;
  document.getElementById('cert-seat').innerText = pc.seat || 'N/A';
  document.getElementById('cert-employee').innerText = pc.employee_name || 'Unassigned';
  document.getElementById('cert-office').innerText = pc.office_section || 'PGP OFFICE';
  document.getElementById('cert-type').innerText = `${pc.category || 'Desktop'} (${pc.brand || ''} ${pc.model || ''})`;
  document.getElementById('cert-serial').innerText = pc.serial_number || 'N/A';
  document.getElementById('cert-processor').innerText = pc.processor || 'Intel Processor';
  document.getElementById('cert-ram').innerText = pc.ram || '8 GB';
  document.getElementById('cert-storage').innerText = pc.storage || '500 GB';
  document.getElementById('cert-os').innerText = pc.os || 'Windows';
  document.getElementById('cert-ip').innerText = pc.ip_address || 'Unassigned';
  document.getElementById('cert-amc').innerText = `${pc.amc_agency || 'Keltron'} (${pc.amc_type || 'AMC'})`;

  // Find linked monitor
  const mon = appData.monitors.find(m => m.connected_pc_id === pc.asset_id || m.assigned_seat === pc.seat);
  document.getElementById('cert-mon-id').innerText = mon ? mon.asset_id : 'N/A';
  document.getElementById('cert-mon-model').innerText = mon ? `${mon.brand} ${mon.model} (${mon.specifications || ''})` : 'N/A';
  document.getElementById('cert-mon-sn').innerText = mon ? mon.serial_number : 'N/A';

  // Find linked keyboard/mouse
  const km = appData.peripherals.filter(k => k.connected_pc_id === pc.asset_id || k.assigned_seat === pc.seat);
  document.getElementById('cert-km-id').innerText = km.length > 0 ? km.map(k => k.asset_id).join(' / ') : 'N/A';
  document.getElementById('cert-km-model').innerText = km.length > 0 ? km.map(k => `${k.brand} ${k.model}`).join(' / ') : 'N/A';
  document.getElementById('cert-km-sn').innerText = km.length > 0 ? km.map(k => k.serial_number).join(' / ') : 'N/A';

  // Find linked printer
  const ptr = appData.printers.find(pt => pt.connected_pc_id === pc.asset_id || pt.assigned_seat === pc.seat);
  document.getElementById('cert-ptr-id').innerText = ptr ? ptr.asset_id : 'None';
  document.getElementById('cert-ptr-model').innerText = ptr ? `${ptr.brand} ${ptr.model} (${ptr.category})` : 'None';
  document.getElementById('cert-ptr-sn').innerText = ptr ? ptr.serial_number : 'None';

  document.getElementById('cert-sig-emp').innerText = `${pc.employee_name || 'Staff Member'} (${pc.seat || ''})`;
}

// 16. QR Asset Stickers Generator & Printing
function getAllHardwareItems() {
  const all = [];
  (appData.pcs || []).forEach(x => all.push({ ...x, categoryKey: 'pcs', categoryLabel: 'PC / Server' }));
  (appData.monitors || []).forEach(x => all.push({ ...x, categoryKey: 'monitors', categoryLabel: 'Monitor' }));
  (appData.printers || []).forEach(x => all.push({ ...x, categoryKey: 'printers', categoryLabel: 'Printer / Scanner' }));
  (appData.peripherals || []).forEach(x => all.push({ ...x, categoryKey: 'peripherals', categoryLabel: 'Keyboard / Mouse' }));
  (appData.other_equipments || []).forEach(x => all.push({ ...x, categoryKey: 'other_equipments', categoryLabel: 'Power & Network' }));
  return all;
}

function renderQrStickers() {
  const container = document.getElementById('qr-stickers-grid');
  if (!container) return;

  const filterCat = document.getElementById('qr-filter-cat')?.value || 'all';
  const filterSection = document.getElementById('qr-filter-section')?.value || 'all';
  const filterSearch = (document.getElementById('qr-filter-search')?.value || '').toLowerCase().trim();

  let items = getAllHardwareItems();

  if (filterCat !== 'all') {
    items = items.filter(i => i.categoryKey === filterCat);
  }

  if (filterSection !== 'all') {
    items = items.filter(i => (i.office_section || i.office || '').toUpperCase().includes(filterSection.toUpperCase()));
  }

  if (filterSearch) {
    items = items.filter(i => {
      const text = `${i.asset_id || ''} ${i.seat || ''} ${i.employee_name || ''} ${i.brand || ''} ${i.model || ''} ${i.serial_number || ''}`.toLowerCase();
      return text.includes(filterSearch);
    });
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
        <i class="fa-solid fa-qrcode" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
        <p>No asset stickers found matching current filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  items.forEach((item, idx) => {
    const safeId = (item.asset_id || `item_${idx}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const card = document.createElement('div');
    card.className = 'qr-sticker-card';
    card.id = `sticker-${safeId}`;
    
    const qrUrl = getAssetPassportUrl(item.asset_id);
    const deviceMeta = [item.brand, item.model].filter(Boolean).join(' ');

    card.innerHTML = `
      <div class="qr-sticker-header">
        <span class="qr-panchayath-name">PUDUPPADY GP</span>
      </div>
      <div class="qr-sticker-body">
        <div class="qr-code-box" id="qr-target-${safeId}" title="Scan to view complete stock details"></div>
      </div>
      <div class="qr-asset-id"><i class="fa-solid fa-barcode"></i> ${item.asset_id}</div>
      ${deviceMeta ? `<div class="qr-sticker-meta">${deviceMeta}</div>` : ''}
      <div class="qr-sticker-footer no-print">
        <button class="btn btn-xs btn-outline" onclick="printSingleSticker('${item.asset_id}')" title="Print Sticker">
          <i class="fa-solid fa-print"></i> Print
        </button>
        <button class="btn btn-xs btn-secondary" onclick="openAssetPassport('${item.asset_id}')" title="View Full Details">
          <i class="fa-solid fa-eye"></i> Details
        </button>
      </div>
    `;
    container.appendChild(card);

    setTimeout(() => {
      const qrEl = document.getElementById(`qr-target-${safeId}`);
      if (qrEl) {
        qrEl.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrEl, {
            text: qrUrl,
            width: 100,
            height: 100,
            colorDark: "#1d4ed8",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      }
    }, 20);
  });
}

function printAllStickers() {
  document.body.classList.add('printing-stickers');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('printing-stickers');
  }, 1000);
}

function printSingleSticker(assetId) {
  const item = getAllHardwareItems().find(x => x.asset_id === assetId);
  if (!item) {
    showToast('Asset not found: ' + assetId, 'error');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=450,height=520');
  if (!printWindow) {
    showToast('Please allow popups to print individual sticker', 'warning');
    return;
  }

  const qrUrl = getAssetPassportUrl(item.asset_id);
  const deviceMeta = [item.brand, item.model].filter(Boolean).join(' ');

  const stickerHtml = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <title>QR Sticker - ' + item.asset_id + '</title>',
    '  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">',
    '  <style>',
    '    @page { size: auto; margin: 4mm; }',
    '    * { box-sizing: border-box; margin: 0; padding: 0; }',
    '    body {',
    '      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif;',
    '      background: #ffffff;',
    '      display: flex;',
    '      align-items: center;',
    '      justify-content: center;',
    '      min-height: 100vh;',
    '      padding: 10px;',
    '    }',
    '    .sticker-card {',
    '      width: 230px;',
    '      border: 2.5px solid #000000;',
    '      border-radius: 8px;',
    '      padding: 12px 10px;',
    '      text-align: center;',
    '      background: #ffffff;',
    '      display: flex;',
    '      flex-direction: column;',
    '      align-items: center;',
    '      justify-content: center;',
    '    }',
    '    .sticker-header {',
    '      font-size: 14px;',
    '      font-weight: 800;',
    '      letter-spacing: 0.5px;',
    '      text-transform: uppercase;',
    '      color: #000000;',
    '      border-bottom: 2px solid #000000;',
    '      padding-bottom: 5px;',
    '      margin-bottom: 6px;',
    '      width: 100%;',
    '    }',
    '    .sticker-sub {',
    '      font-size: 10.5px;',
    '      font-weight: 700;',
    '      color: #333333;',
    '      margin-bottom: 6px;',
    '    }',
    '    .qr-box {',
    '      width: 140px;',
    '      height: 140px;',
    '      margin: 4px auto;',
    '      display: flex;',
    '      align-items: center;',
    '      justify-content: center;',
    '    }',
    '    .qr-box img, .qr-box canvas {',
    '      width: 100% !important;',
    '      height: 100% !important;',
    '      display: block;',
    '    }',
    '    .sticker-id {',
    '      font-family: "JetBrains Mono", monospace;',
    '      font-size: 15px;',
    '      font-weight: 800;',
    '      letter-spacing: 0.5px;',
    '      color: #000000;',
    '      border-top: 2px solid #000000;',
    '      padding-top: 5px;',
    '      margin-top: 6px;',
    '      width: 100%;',
    '    }',
    '    .sticker-meta {',
    '      font-size: 11px;',
    '      font-weight: 700;',
    '      color: #334155;',
    '      margin-top: 4px;',
    '    }',
    '  </style>',
    '  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>',
    '</head>',
    '<body>',
    '  <div class="sticker-card">',
    '    <div class="sticker-header">PUTHUPPADI GP</div>',
    '    <div class="sticker-sub">IT ASSET MANAGEMENT</div>',
    '    <div class="qr-box" id="qr-single-target"></div>',
    '    <div class="sticker-id">' + item.asset_id + '</div>',
    deviceMeta ? '    <div class="sticker-meta">' + deviceMeta + '</div>' : '',
    '  </div>',
    '  <script>',
    '    new QRCode(document.getElementById("qr-single-target"), {',
    '      text: ' + JSON.stringify(qrUrl) + ',',
    '      width: 140,',
    '      height: 140,',
    '      colorDark: "#1d4ed8",',
    '      colorLight: "#ffffff",',
    '      correctLevel: QRCode.CorrectLevel.M',
    '    });',
    '    setTimeout(function() {',
    '      window.print();',
    '      window.close();',
    '    }, 400);',
    '  <\/script>',
    '</body>',
    '</html>'
  ].join('\n');

  printWindow.document.write(stickerHtml);
  printWindow.document.close();
}

// 17. Dynamic Modal Builder for Stock CRUD
function openAddModal(category = 'pcs') {
  editMode = false;
  currentCategory = category;
  document.getElementById('stock-modal-title').innerHTML = `<i class="fa-solid fa-plus"></i> Add New ${getCategoryDisplayName(category)}`;
  buildModalFields(category, {});
  openModal('stock-modal');
}

function openEditModal(category, assetId) {
  editMode = true;
  currentCategory = category;
  const item = appData[category].find(i => i.asset_id === assetId);
  if (!item) return;

  document.getElementById('stock-modal-title').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit ${item.asset_id}`;
  buildModalFields(category, item);
  openModal('stock-modal');
}

function getCategoryDisplayName(cat) {
  const map = {
    pcs: 'Computer / Laptop / Server',
    monitors: 'Monitor',
    peripherals: 'Keyboard / Mouse',
    printers: 'Printer / Scanner / Copier',
    other_equipments: 'Power & Network Equipment'
  };
  return map[cat] || 'Stock Item';
}

function buildSeatSelectHtml(selectedSeat = '') {
  const employees = appData.employees || [];
  let html = `<select id="form-seat" onchange="onSeatCodeSelect(this.value)">`;
  html += `<option value="">-- Choose Assigned Seat --</option>`;
  employees.forEach(emp => {
    if (emp.seat) {
      const isSel = (String(emp.seat).trim().toUpperCase() === String(selectedSeat).trim().toUpperCase()) ? 'selected' : '';
      html += `<option value="${emp.seat}" ${isSel}>${emp.seat} - ${emp.name || 'Vacant'} (${emp.designation || emp.office || 'Staff'})</option>`;
    }
  });
  html += `</select>`;
  return html;
}

function buildConnectedPcSelectHtml(selectedPcId = '') {
  const pcs = appData.pcs || [];
  let html = `<select id="form-pc-id">`;
  html += `<option value="">-- None / Standalone --</option>`;
  pcs.forEach(p => {
    const isSel = (String(p.asset_id).trim().toUpperCase() === String(selectedPcId).trim().toUpperCase()) ? 'selected' : '';
    html += `<option value="${p.asset_id}" ${isSel}>${p.asset_id} - ${p.brand || ''} ${p.model || ''} (${p.seat || p.office_section || ''})</option>`;
  });
  html += `</select>`;
  return html;
}

function onSeatCodeSelect(seatVal) {
  if (!seatVal) return;
  const emp = (appData.employees || []).find(e => String(e.seat).trim().toUpperCase() === String(seatVal).trim().toUpperCase());
  if (emp) {
    const empInput = document.getElementById('form-emp');
    if (empInput) empInput.value = emp.name || '';
    const secInput = document.getElementById('form-section');
    if (secInput && emp.office) secInput.value = emp.office;
  }
}

function buildModalFields(category, data = {}) {
  const container = document.getElementById('stock-modal-fields');
  container.innerHTML = '';

  let html = `
    <!-- Global Combo Datalists -->
    <datalist id="list-brand">
      <option value="Acer">
      <option value="Dell">
      <option value="HP">
      <option value="Lenovo">
      <option value="Asus">
      <option value="Logitech">
      <option value="Epson">
      <option value="Canon">
      <option value="Brother">
      <option value="Numeric">
      <option value="Hykon">
      <option value="APC">
      <option value="D-Link">
      <option value="TP-Link">
    </datalist>

    <datalist id="list-proc">
      <option value="intel i3">
      <option value="intel i5">
      <option value="intel i7">
      <option value="AMD Ryzen 3">
      <option value="AMD Ryzen 5">
      <option value="AMD Ryzen 7">
      <option value="Intel Pentium">
      <option value="Intel Celeron">
      <option value="Core 2 Duo">
    </datalist>

    <datalist id="list-ram">
      <option value="4 GB">
      <option value="8 GB">
      <option value="16 GB">
      <option value="32 GB">
      <option value="2 GB">
      <option value="64 GB">
    </datalist>

    <datalist id="list-storage">
      <option value="500 HDD">
      <option value="1 TB HDD">
      <option value="256 SSD">
      <option value="512 SSD">
      <option value="1 TB SSD">
      <option value="128 SSD">
      <option value="2 TB HDD">
    </datalist>

    <datalist id="list-os">
      <option value="Win 10">
      <option value="Win 11">
      <option value="Win 7">
      <option value="Ubuntu">
      <option value="Boss Linux">
      <option value="macOS">
    </datalist>

    <datalist id="list-section">
      <option value="PGP OFFICE">
      <option value="AE OFFICE">
      <option value="NREGS OFFICE">
      <option value="AGRI OFFICE">
      <option value="VEO OFFICE">
      <option value="ICDS OFFICE">
      <option value="FHC PUTHUPPADY">
      <option value="AYURVEDA HOSPITAL">
      <option value="Buds School">
      <option value="FRONT OFFICE">
    </datalist>

    <datalist id="list-agency">
      <option value="Keltron">
      <option value="Acer">
      <option value="HP">
      <option value="Dell">
      <option value="OEM / Vendor">
      <option value="Local Agency">
    </datalist>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Asset ID (Auto-assigned if empty):</label>
        <input type="text" id="form-asset-id" value="${data.asset_id || ''}" placeholder="e.g. PGP-SYS-..." ${editMode ? 'readonly class="input-readonly"' : ''}>
      </div>
      <div class="form-group flex-1">
        <label>Category / Type *:</label>
        <select id="form-category" required>
          ${getCategoryOptions(category, data.category)}
        </select>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Brand Name *:</label>
        <input list="list-brand" type="text" id="form-brand" value="${data.brand || ''}" placeholder="Choose or type Brand (Acer, Dell, HP...)" required>
      </div>
      <div class="form-group flex-1">
        <label>Model Name / Number *:</label>
        <input type="text" id="form-model" value="${data.model || ''}" placeholder="Veriton / Smart Tank / K120" required>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Serial Number (S/N):</label>
        <input type="text" id="form-serial" value="${data.serial_number || ''}" placeholder="Hardware Serial Number">
      </div>
  `;

  if (category === 'pcs') {
    html += `
      <div class="form-group flex-1">
        <label>Processor (CPU) *:</label>
        <input list="list-proc" type="text" id="form-proc" value="${data.processor || ''}" placeholder="intel i3 / intel i5 / Ryzen 5" required>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>RAM Capacity *:</label>
        <input list="list-ram" type="text" id="form-ram" value="${data.ram || ''}" placeholder="4 GB / 8 GB / 16 GB" required>
      </div>
      <div class="form-group flex-1">
        <label>Storage (HDD / SSD) *:</label>
        <input list="list-storage" type="text" id="form-storage" value="${data.storage || ''}" placeholder="500 HDD / 256 SSD / 1 TB HDD" required>
      </div>
      <div class="form-group flex-1">
        <label>Operating System:</label>
        <input list="list-os" type="text" id="form-os" value="${data.os || 'Win 11'}" placeholder="Win 10 / Win 11 / Ubuntu">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Static IP Address:</label>
        <input type="text" id="form-ip" value="${data.ip_address || ''}" placeholder="192.168.0.x">
      </div>
      <div class="form-group flex-1">
        <label>Assigned Seat Code (Auto-finds Staff) *:</label>
        ${buildSeatSelectHtml(data.seat)}
      </div>
      <div class="form-group flex-1">
        <label>Employee Name (Auto-filled):</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Auto-fills from Seat">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Office Section:</label>
        <input list="list-section" type="text" id="form-section" value="${data.office_section || 'PGP OFFICE'}" placeholder="PGP OFFICE / AE OFFICE / NREGS">
      </div>
      <div class="form-group flex-1">
        <label>Maintenance Coverage:</label>
        <select id="form-amc-type">
          <option value="AMC" ${data.amc_type === 'AMC' ? 'selected' : ''}>Keltron AMC</option>
          <option value="Warranty" ${data.amc_type === 'Warranty' ? 'selected' : ''}>OEM Warranty</option>
          <option value="NA" ${data.amc_type === 'NA' ? 'selected' : ''}>No AMC / Self</option>
        </select>
      </div>
      <div class="form-group flex-1">
        <label>AMC / Warranty Agency:</label>
        <input list="list-agency" type="text" id="form-amc-agency" value="${data.amc_agency || 'Keltron'}" placeholder="Keltron / Acer / HP">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>System Working Status:</label>
        <select id="form-status">
          <option value="Working" ${data.is_working !== false ? 'selected' : ''}>Working (Operational)</option>
          <option value="Complaint" ${data.is_working === false ? 'selected' : ''}>Complaint (Faulty)</option>
        </select>
      </div>
    </div>
    `;
  } else if (category === 'monitors') {
    html += `
      <div class="form-group flex-1">
        <label>Specifications (Screen Size & Type):</label>
        <input type="text" id="form-specs" value="${data.specifications || ''}" placeholder="22 inch LED / 24 inch IPS">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex-1">
        <label>Assigned Seat Code (Auto-finds Staff):</label>
        ${buildSeatSelectHtml(data.assigned_seat)}
      </div>
      <div class="form-group flex-1">
        <label>Employee Name (Auto-filled):</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Auto-fills from Seat">
      </div>
      <div class="form-group flex-1">
        <label>Connected Host PC Asset ID:</label>
        ${buildConnectedPcSelectHtml(data.connected_pc_id)}
      </div>
    </div>
    `;
  } else if (category === 'peripherals') {
    html += `
      <div class="form-group flex-1">
        <label>Connected Host PC Asset ID:</label>
        ${buildConnectedPcSelectHtml(data.connected_pc_id)}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex-1">
        <label>Assigned Seat Code (Auto-finds Staff):</label>
        ${buildSeatSelectHtml(data.assigned_seat)}
      </div>
      <div class="form-group flex-1">
        <label>Employee Name (Auto-filled):</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Auto-fills from Seat">
      </div>
    </div>
    `;
  } else if (category === 'printers') {
    html += `
      <div class="form-group flex-1">
        <label>Toner / Cartridge / Ink Model:</label>
        <input type="text" id="form-toner" value="${data.toner_cartridge || ''}" placeholder="e.g. GT 52/53, BK 005, 278A">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex-1">
        <label>Assigned Seat (Auto-finds Staff):</label>
        ${buildSeatSelectHtml(data.assigned_seat)}
      </div>
      <div class="form-group flex-1">
        <label>Employee Name (Auto-filled):</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Auto-fills from Seat">
      </div>
      <div class="form-group flex-1">
        <label>Connected Host PC:</label>
        ${buildConnectedPcSelectHtml(data.connected_pc_id)}
      </div>
    </div>
    `;
  } else if (category === 'other_equipments') {
    html += `
      <div class="form-group flex-1">
        <label>Technical Details / Rating:</label>
        <input type="text" id="form-details" value="${data.details || ''}" placeholder="5 KVA / 160 AH C20 / 300 Mbps">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex-1">
        <label>Location / Office Section:</label>
        <input list="list-section" type="text" id="form-section" value="${data.section || 'PGP OFFICE'}" placeholder="PGP OFFICE / AE OFFICE / NREGS">
      </div>
      <div class="form-group flex-1">
        <label>Working Status:</label>
        <select id="form-status">
          <option value="Working" ${data.status !== 'Complaint' ? 'selected' : ''}>Working</option>
          <option value="Complaint" ${data.status === 'Complaint' ? 'selected' : ''}>Complaint</option>
        </select>
      </div>
    </div>
    `;
  }

  container.innerHTML = html;
}

function getCategoryOptions(cat, selected) {
  if (cat === 'pcs') {
    return `
      <option value="Desktop" ${selected === 'Desktop' ? 'selected' : ''}>Desktop Computer</option>
      <option value="Laptop" ${selected === 'Laptop' ? 'selected' : ''}>Laptop</option>
      <option value="Server" ${selected === 'Server' ? 'selected' : ''}>Server</option>
    `;
  } else if (cat === 'monitors') {
    return `<option value="Monitor">Display Monitor</option>`;
  } else if (cat === 'peripherals') {
    return `
      <option value="Keyboard" ${selected === 'Keyboard' ? 'selected' : ''}>Keyboard</option>
      <option value="Mouse" ${selected === 'Mouse' ? 'selected' : ''}>Mouse</option>
      <option value="Combo" ${selected === 'Combo' ? 'selected' : ''}>Keyboard & Mouse Combo</option>
    `;
  } else if (cat === 'printers') {
    return `
      <option value="Ink Tank Printer" ${selected === 'Ink Tank Printer' ? 'selected' : ''}>Ink Tank Printer</option>
      <option value="Laser printer" ${selected === 'Laser printer' ? 'selected' : ''}>Laser Printer</option>
      <option value="Photocopier" ${selected === 'Photocopier' ? 'selected' : ''}>Photocopier Machine</option>
      <option value="Scanner" ${selected === 'Scanner' ? 'selected' : ''}>Document Scanner</option>
    `;
  } else if (cat === 'other_equipments') {
    return `
      <option value="UPS" ${selected === 'UPS' ? 'selected' : ''}>UPS System</option>
      <option value="Battery" ${selected === 'Battery' ? 'selected' : ''}>Inverter / UPS Battery</option>
      <option value="Modem" ${selected === 'Modem' ? 'selected' : ''}>Modem / Wi-Fi Router</option>
      <option value="Stabilizer" ${selected === 'Stabilizer' ? 'selected' : ''}>Voltage Stabilizer</option>
    `;
  }
  return `<option value="Item">Item</option>`;
}

// 17. Submit Handler for Stock Form
async function handleStockSubmit(e) {
  e.preventDefault();
  const category = currentCategory;
  let assetId = document.getElementById('form-asset-id').value.trim();
  if (!assetId) {
    assetId = getNextAssetId(category);
  }

  const itemType = document.getElementById('form-category').value;
  const brand = document.getElementById('form-brand').value.trim();
  const model = document.getElementById('form-model').value.trim();
  const serial = document.getElementById('form-serial').value.trim();

  let itemData = {
    asset_id: assetId,
    category: itemType,
    brand: brand,
    model: model,
    serial_number: serial
  };

  if (category === 'pcs') {
    const isWorking = document.getElementById('form-status').value === 'Working';
    itemData = {
      ...itemData,
      processor: document.getElementById('form-proc').value.trim(),
      ram: document.getElementById('form-ram').value.trim(),
      storage: document.getElementById('form-storage').value.trim(),
      os: document.getElementById('form-os').value.trim(),
      ip_address: document.getElementById('form-ip').value.trim(),
      seat: document.getElementById('form-seat').value.trim(),
      employee_name: document.getElementById('form-emp').value.trim(),
      office_section: document.getElementById('form-section').value.trim(),
      amc_type: document.getElementById('form-amc-type').value,
      amc_agency: document.getElementById('form-amc-agency').value.trim(),
      is_working: isWorking,
      is_complaint: !isWorking,
      status: isWorking ? 'Working' : 'Complaint',
      device_status: isWorking ? 'Working' : 'Complaint'
    };
  } else if (category === 'monitors') {
    itemData = {
      ...itemData,
      specifications: document.getElementById('form-specs').value.trim(),
      assigned_seat: document.getElementById('form-seat').value.trim(),
      employee_name: document.getElementById('form-emp').value.trim(),
      connected_pc_id: document.getElementById('form-pc-id').value.trim(),
      status: 'Working'
    };
  } else if (category === 'peripherals') {
    itemData = {
      ...itemData,
      assigned_seat: document.getElementById('form-seat').value.trim(),
      employee_name: document.getElementById('form-emp').value.trim(),
      connected_pc_id: document.getElementById('form-pc-id').value.trim(),
      status: 'Working'
    };
  } else if (category === 'printers') {
    itemData = {
      ...itemData,
      toner_cartridge: document.getElementById('form-toner').value.trim(),
      assigned_seat: document.getElementById('form-seat').value.trim(),
      employee_name: document.getElementById('form-emp').value.trim(),
      connected_pc_id: document.getElementById('form-pc-id').value.trim(),
      status: 'Working'
    };
  } else if (category === 'other_equipments') {
    itemData = {
      ...itemData,
      item_name: itemType,
      details: document.getElementById('form-details').value.trim(),
      section: document.getElementById('form-section').value.trim(),
      status: document.getElementById('form-status').value
    };
  }

  if (!appData[category]) appData[category] = [];
  const existingIdx = appData[category].findIndex(i => i.asset_id === assetId);
  const isEdit = existingIdx !== -1;

  if (isEdit) {
    appData[category][existingIdx] = itemData;
  } else {
    appData[category].push(itemData);
  }

  if (category === 'pcs') {
    recalculateClientIps();
  }

  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  closeModal('stock-modal');
  showToast(`Stock item ${assetId} saved & synchronized!`, 'success');

  const sheetMap = {
    pcs: 'Register-PC',
    monitors: 'Register-Monitor',
    peripherals: 'Register-K&M',
    printers: 'Register-PTR',
    other_equipments: 'Other_Equipments'
  };
  const rowData = getRowDataForSheet(category, itemData);
  const empInfo = itemData.seat ? { seat: itemData.seat, name: itemData.employee_name } : null;

  postToCloudOrLocal(
    '/api/stock',
    isEdit ? 'PUT' : 'POST',
    { category, item: itemData },
    {
      action: isEdit ? 'update' : 'add',
      sheet: sheetMap[category],
      data: rowData,
      assetId: assetId,
      employee: empInfo
    }
  );
}

// 18. Delete Stock Item
async function deleteStockItem(category, assetId) {
  if (!confirm(`Are you sure you want to delete ${assetId}?`)) return;

  if (appData[category]) {
    appData[category] = appData[category].filter(i => i.asset_id !== assetId);
  }
  if (category === 'pcs') {
    recalculateClientIps();
  }

  try { localStorage.setItem('pgp_stock_data', JSON.stringify(appData)); } catch (e) {}
  renderAll();
  showToast(`Item ${assetId} deleted`, 'success');

  const sheetMap = {
    pcs: 'Register-PC',
    monitors: 'Register-Monitor',
    peripherals: 'Register-K&M',
    printers: 'Register-PTR',
    other_equipments: 'Other_Equipments'
  };

  postToCloudOrLocal(
    `/api/stock?category=${category}&asset_id=${assetId}`,
    'DELETE',
    null,
    {
      action: 'delete',
      sheet: sheetMap[category],
      assetId: assetId
    }
  );
}

// 20. Google Sheets Cloud Sync & Settings
async function saveConfig(e) {
  e.preventDefault();
  const gasUrl = document.getElementById('cfg-gas-url').value.trim();

  try {
    localStorage.setItem('pgp_gas_url', gasUrl);
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_apps_script_url: gasUrl })
    });
    if (res.ok) {
      const result = await res.json();
      if (result.status === 'success') {
        showToast('Settings saved successfully!', 'success');
        return;
      }
    }
  } catch (err) {
    console.log('Local config save notice, stored in localStorage');
  }
  showToast('Settings saved successfully in browser!', 'success');
}

// Helper to parse boolean from Google Sheets
function parseBool(val, def = true) {
  if (val === null || val === undefined || val === '') return def;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['1', '1.0', 'true', 'yes', 'working'].includes(s)) return true;
  if (['0', '0.0', 'false', 'no', 'complaint'].includes(s)) return false;
  return def;
}

// Client-side parser for raw Google Sheet data from Apps Script
function parseCloudSpreadsheetData(cloudData) {
  if (!cloudData || typeof cloudData !== 'object') return null;

  // 0. Collect Active / Open Complaints first (Tickets that are NOT Closed/Resolved)
  const openComplaintPcIds = new Set();
  if (cloudData['Complaint_Register']) {
    cloudData['Complaint_Register'].slice(1).forEach(row => {
      const pcId = String(row[0] || row[1] || '').trim().toUpperCase();
      const status = String(row[8] || '').trim().toLowerCase();
      if (pcId && pcId.startsWith('PGP-SYS-PC') && status !== 'closed' && status !== 'resolved' && status !== '') {
        openComplaintPcIds.add(pcId);
      }
    });
  }
  if (cloudData['Ticketing_System']) {
    cloudData['Ticketing_System'].slice(1).forEach(row => {
      const pcId = String(row[2] || '').trim().toUpperCase();
      const status = String(row[17] || '').trim().toLowerCase();
      if (pcId && pcId.startsWith('PGP-SYS-PC') && status !== 'closed' && status !== 'resolved' && status !== '') {
        openComplaintPcIds.add(pcId);
      }
    });
  }

  // 1. PCs
  if (cloudData['Register-PC']) {
    const pcs = [];
    cloudData['Register-PC'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('PGP-SYS-PC')) {
        const pcId = String(row[0]).trim().toUpperCase();
        const presentStatus = String(row[16] || '').trim().toLowerCase();

        // System is in Complaint ONLY if there is an active unresolved complaint or explicitly set to complaint
        let isOperational = true;
        if (openComplaintPcIds.has(pcId)) {
          isOperational = false;
        } else if (presentStatus === 'complaint') {
          isOperational = false;
        } else {
          isOperational = true;
        }

        const statusVal = isOperational ? 'Working' : 'Complaint';

        pcs.push({
          asset_id: String(row[0]),
          category: String(row[1] || 'Desktop'),
          brand: String(row[2] || ''),
          model: String(row[3] || ''),
          serial_number: String(row[4] || ''),
          processor: String(row[5] || ''),
          ram: String(row[6] || ''),
          storage: String(row[7] || ''),
          os: String(row[8] || ''),
          ip_address: String(row[9] || ''),
          seat: String(row[10] || ''),
          employee_name: String(row[11] || ''),
          office_section: String(row[12] || ''),
          purchase_date: String(row[13] || ''),
          warranty_expiry: String(row[14] || ''),
          is_working: isOperational,
          status: statusVal,
          is_complaint: !isOperational,
          device_status: statusVal,
          amc_type: String(row[19] || ''),
          amc_agency: String(row[20] || '')
        });
      }
    });
    if (pcs.length > 0) appData.pcs = pcs;
  }

  // 2. Monitors
  if (cloudData['Register-Monitor']) {
    const monitors = [];
    cloudData['Register-Monitor'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('PGP-SYS-MTR')) {
        monitors.push({
          asset_id: String(row[0]),
          category: String(row[1] || 'Monitor'),
          brand: String(row[2] || ''),
          model: String(row[3] || ''),
          serial_number: String(row[4] || ''),
          specifications: String(row[5] || ''),
          assigned_seat: String(row[6] || ''),
          employee_name: String(row[7] || ''),
          purchase_date: String(row[8] || ''),
          warranty_expiry: String(row[9] || ''),
          connected_pc_id: String(row[10] || ''),
          status: String(row[11] || 'Working')
        });
      }
    });
    if (monitors.length > 0) appData.monitors = monitors;
  }

  // 3. Peripherals
  if (cloudData['Register-K&M']) {
    const km = [];
    cloudData['Register-K&M'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('PGP-SYS-KM')) {
        km.push({
          asset_id: String(row[0]),
          category: String(row[1] || 'Peripheral'),
          brand: String(row[2] || ''),
          model: String(row[3] || ''),
          serial_number: String(row[4] || ''),
          assigned_seat: String(row[5] || ''),
          employee_name: String(row[6] || ''),
          purchase_date: String(row[7] || ''),
          warranty_expiry: String(row[8] || ''),
          connected_pc_id: String(row[9] || ''),
          status: String(row[10] || 'Working')
        });
      }
    });
    if (km.length > 0) appData.peripherals = km;
  }

  // 4. Printers
  if (cloudData['Register-PTR']) {
    const ptrs = [];
    cloudData['Register-PTR'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('PGP-SYS-PTR')) {
        ptrs.push({
          asset_id: String(row[0]),
          category: String(row[1] || 'Printer'),
          brand: String(row[2] || ''),
          model: String(row[3] || ''),
          serial_number: String(row[4] || ''),
          specifications: String(row[5] || ''),
          toner_cartridge: String(row[6] || ''),
          assigned_seat: String(row[7] || ''),
          employee_name: String(row[8] || ''),
          purchase_date: String(row[9] || ''),
          warranty_expiry: String(row[10] || ''),
          connected_pc_id: String(row[11] || ''),
          status: String(row[12] || 'Working')
        });
      }
    });
    if (ptrs.length > 0) appData.printers = ptrs;
  }

  // 5. Other Equipments
  if (cloudData['Other_Equipments']) {
    const oe = [];
    cloudData['Other_Equipments'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('PGP-SYS-OE')) {
        oe.push({
          asset_id: String(row[0]),
          category: String(row[1] || 'Equipment'),
          brand: String(row[2] || ''),
          model: String(row[3] || ''),
          serial_number: String(row[4] || ''),
          details: String(row[5] || ''),
          section: String(row[6] || ''),
          status: String(row[7] || 'Working')
        });
      }
    });
    if (oe.length > 0) appData.other_equipments = oe;
  }

  // 6. Tickets
  if (cloudData['Ticketing_System'] && cloudData['Ticketing_System'].length > 1) {
    const tkts = [];
    cloudData['Ticketing_System'].slice(1).forEach(row => {
      if (row[0] && String(row[0]).startsWith('TKT-')) {
        tkts.push({
          ticket_id: String(row[0]),
          vendor_call_no: String(row[1] || ''),
          asset_id: String(row[2] || ''),
          item_name: String(row[3] || ''),
          office_section: String(row[4] || ''),
          reported_by: String(row[5] || ''),
          issue_category: String(row[6] || 'Hardware Fault'),
          priority: String(row[7] || 'Medium'),
          fault_description: String(row[8] || ''),
          service_provider: String(row[9] || 'Keltron AMC'),
          date_logged: String(row[10] || ''),
          vendor_call_date: String(row[11] || ''),
          attended_date: String(row[12] || ''),
          technician_name: String(row[13] || ''),
          technician_phone: String(row[14] || ''),
          parts_replaced: String(row[15] || ''),
          resolution: String(row[16] || ''),
          status: String(row[17] || 'Open'),
          closed_date: String(row[18] || ''),
          turnaround_days: String(row[19] || ''),
          remarks: String(row[20] || ''),
          ccfr_url: String(row[21] || '')
        });
      }
    });
    if (tkts.length > 0) appData.tickets = tkts;
  }

  // 7. Employees
  if (cloudData['Employee_list'] && cloudData['Employee_list'].length > 1) {
    const emps = [];
    cloudData['Employee_list'].slice(1).forEach(row => {
      if (row[1] && String(row[1]).trim()) {
        const rawSl = String(row[0] || '').replace(/[^0-9]/g, '');
        emps.push({
          sl_no: rawSl ? parseInt(rawSl, 10) : emps.length + 1,
          seat: String(row[1] || '').trim(),
          name: String(row[2] || '').trim(),
          designation: String(row[3] || '').trim(),
          office: String(row[4] || '').trim() || 'PGP OFFICE'
        });
      }
    });
    if (emps.length > 0) appData.employees = emps;
  }

  // 8. Purchases
  if (cloudData['Purchases'] && cloudData['Purchases'].length > 1) {
    const purchases = [];
    cloudData['Purchases'].slice(1).forEach(row => {
      if (row[0] || row[1]) {
        purchases.push({
          date: String(row[0] || ''),
          item: String(row[1] || ''),
          amount: String(row[2] || ''),
          vendor: String(row[3] || ''),
          file_number: String(row[4] || '')
        });
      }
    });
    if (purchases.length > 0) appData.purchases = purchases;
  }

  // 9. Generator
  if (cloudData['Generator'] && cloudData['Generator'].length > 1) {
    const logs = [];
    cloudData['Generator'].slice(1).forEach(row => {
      if (row[0] || row[1]) {
        logs.push({
          call_date: String(row[0] || ''),
          service_details: String(row[1] || ''),
          running_hours: String(row[2] || ''),
          amount: String(row[3] || ''),
          remarks: String(row[4] || '')
        });
      }
    });
    if (!appData.generator) appData.generator = { name: 'Mahindra', serial: 'N3B24XL29998', capacity: '25 KVA', logs: [] };
    appData.generator.logs = logs;
  }

  // Recalculate IP allocations
  const allocs = [];
  const assignedIps = {};
  (appData.pcs || []).forEach(p => {
    if (p.ip_address && String(p.ip_address).startsWith('192.168.0.')) {
      assignedIps[p.ip_address] = {
        asset_id: p.asset_id,
        employee_name: p.employee_name || '',
        seat: p.seat || '',
        office_section: p.office_section || '',
        brand: p.brand || '',
        model: p.model || '',
        processor: p.processor || '',
        ram: p.ram || '',
        os: p.os || '',
        status: p.status || 'Working'
      };
    }
  });
  for (let i = 1; i <= 254; i++) {
    const ip = `192.168.0.${i}`;
    const assign = assignedIps[ip];
    allocs.push({
      ip: ip,
      ip_address: ip,
      is_assigned: !!assign,
      assigned_to: assign ? assign.asset_id : null,
      employee_name: assign ? assign.employee_name : null,
      seat: assign ? assign.seat : null,
      office_section: assign ? assign.office_section : null,
      brand: assign ? assign.brand : null,
      model: assign ? assign.model : null,
      processor: assign ? assign.processor : null,
      ram: assign ? assign.ram : null,
      os: assign ? assign.os : null,
      status: assign ? assign.status : null
    });
  }
  appData.ip_allocations = allocs;

  return appData;
}

async function testSync() {
  // 1. Manage loading state for all sync buttons
  const syncButtons = [
    document.getElementById('quick-sync-btn'),
    document.getElementById('btn-test-sync-settings'),
    ...document.querySelectorAll('.btn-test-sync')
  ].filter(Boolean);

  const originalStates = syncButtons.map(btn => ({
    btn,
    html: btn.innerHTML,
    disabled: btn.disabled
  }));

  syncButtons.forEach(btn => {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Syncing...</span>';
    btn.disabled = true;
  });

  showToast('Connecting to Google Sheets...', 'info');

  const gasUrl = (document.getElementById('cfg-gas-url')?.value.trim()) || 
                 localStorage.getItem('pgp_gas_url') ||
                 DEFAULT_GAS_URL;

  try {
    // 2. Try local server first if on localhost (fast 1.2s timeout)
    if (isLocalServer()) {
      try {
        const localController = new AbortController();
        const localTimer = setTimeout(() => localController.abort(), 1200);
        const res = await fetch(`${API_BASE}/api/sync`, { method: 'POST', signal: localController.signal });
        clearTimeout(localTimer);
        if (res.ok) {
          const result = await res.json();
          if (result.status === 'success') {
            if (result.data) {
              appData = result.data;
            } else {
              await loadData();
            }
            renderAll();
            loadConfig();
            const pcCount = appData.pcs ? appData.pcs.length : 0;
            const tktCount = appData.tickets ? appData.tickets.length : 0;
            showToast(`✅ Successfully synced ${pcCount} Systems & ${tktCount} Tickets from Google Sheets!`, 'success');
            return;
          }
        }
      } catch (e) {
        console.log('Local API sync bypass -> Direct Google Apps Script Cloud sync...');
      }
    }

    // 3. Direct Cloud Fetch from Google Apps Script Web App (simple GET, no custom headers to prevent CORS issues)
    const cloudRes = await fetch(gasUrl);

    if (!cloudRes.ok) throw new Error(`HTTP ${cloudRes.status}: Google Sheets connection failed`);
    const cloudJson = await cloudRes.json();
    if (cloudJson.status === 'success' && cloudJson.data) {
      parseCloudSpreadsheetData(cloudJson.data);
      const nowStr = new Date().toLocaleString();
      const lastSyncedEl = document.getElementById('cfg-last-synced');
      if (lastSyncedEl) lastSyncedEl.innerText = nowStr;
      
      try {
        localStorage.setItem('pgp_stock_data', JSON.stringify(appData));
        localStorage.setItem('pgp_last_synced', nowStr);
        localStorage.setItem('pgp_gas_url', gasUrl);
      } catch (e) {}

      renderAll();
      const pcCount = appData.pcs ? appData.pcs.length : 0;
      const tktCount = appData.tickets ? appData.tickets.length : 0;
      showToast(`✅ Successfully synced ${pcCount} Systems & ${tktCount} Tickets from Google Sheets!`, 'success');
      return;
    } else {
      throw new Error(cloudJson.message || 'Invalid response from Google Apps Script');
    }
  } catch (directErr) {
    console.error('Direct cloud sync error:', directErr);
    let errMsg = directErr.message;
    if (directErr.name === 'AbortError') {
      errMsg = 'Connection timed out. Please check your internet connection.';
    }
    showToast('Google Sheet Sync Error: ' + errMsg, 'error');
  } finally {
    // Restore button states
    originalStates.forEach(({ btn, html, disabled }) => {
      btn.innerHTML = html;
      btn.disabled = disabled;
    });
  }
}

// 21. Global Search
function handleGlobalSearch(query) {
  if (!query) {
    renderAll();
    return;
  }

  // Filter PCs
  const matchedPcs = appData.pcs.filter(p => JSON.stringify(p).toLowerCase().includes(query));
  renderPcsTable(matchedPcs);

  // Filter Monitors
  const matchedMonitors = appData.monitors.filter(m => JSON.stringify(m).toLowerCase().includes(query));
  renderMonitorsTable(matchedMonitors);

  // Filter Peripherals
  const matchedPeripherals = appData.peripherals.filter(k => JSON.stringify(k).toLowerCase().includes(query));
  renderPeripheralsTable(matchedPeripherals);

  // Filter Printers
  const matchedPrinters = appData.printers.filter(pt => JSON.stringify(pt).toLowerCase().includes(query));
  renderPrintersTable(matchedPrinters);

  // If in another view, switch to PCs
  if (['dashboard', 'handover', 'ip_map'].includes(document.querySelector('.view-panel.active').id.replace('view-', ''))) {
    switchView('pcs');
  }
}

// 22. CSV Export
function exportData(category) {
  const items = appData[category] || [];
  if (items.length === 0) {
    showToast('No items to export', 'error');
    return;
  }

  const keys = Object.keys(items[0]);
  let csv = keys.join(',') + '\n';
  items.forEach(item => {
    csv += keys.map(k => `"${(item[k] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `PGP_IT_${category}_export.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 23. Modal Utilities
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('active');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
  
  // Check if any other modal is still active
  const anyActive = document.querySelector('.modal-overlay.active');
  if (!anyActive) {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }
}

// 24. Toast Utility
let toastTimer = null;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = toast ? toast.querySelector('.toast-icon') : null;
  if (!toast || !msgEl) return;

  msgEl.innerText = message;
  if (iconEl) {
    iconEl.className = 'toast-icon fa-solid ' + (
      type === 'success' ? 'fa-circle-check' :
      type === 'error' ? 'fa-circle-xmark' :
      type === 'warning' ? 'fa-triangle-exclamation' :
      type === 'info' ? 'fa-spinner fa-spin' : 'fa-circle-info'
    );
  }

  toast.className = `toast show ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, type === 'info' ? 6000 : 4000);
}

// ==========================================
// 25. QR CODE ENGINE & ASSET PASSPORT SYSTEM
// ==========================================

let html5QrScannerInstance = null;
let hasCheckedUrlAsset = false;

// Web Audio API feedback for QR Scan
function playScanSuccessSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // AudioContext not allowed before user interaction
  }
}

// Clipboard copy helper
function copyToClipboard(text, msg = 'Copied to clipboard!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg, 'success');
    }).catch(() => fallbackCopy(text, msg));
  } else {
    fallbackCopy(text, msg);
  }
}

function fallbackCopy(text, msg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(msg, 'success');
  } catch (e) {
    showToast('Failed to copy', 'error');
  }
  document.body.removeChild(ta);
}

// Helper: Find item by Asset ID across all categories + find connected ecosystem devices
function findItemByAssetId(assetId) {
  if (!assetId) return null;
  const aid = String(assetId).trim().toUpperCase();
  
  let found = appData.pcs.find(p => String(p.asset_id).toUpperCase() === aid);
  if (found) {
    const seat = found.seat || '';
    // Find connected monitors, peripherals, printers, power
    const connectedMonitors = (appData.monitors || []).filter(m => 
      String(m.connected_pc_id || '').toUpperCase() === aid || (seat && String(m.assigned_seat || '').toUpperCase() === seat.toUpperCase())
    );
    const connectedPeripherals = (appData.peripherals || []).filter(k => 
      String(k.connected_pc_id || '').toUpperCase() === aid || (seat && String(k.assigned_seat || '').toUpperCase() === seat.toUpperCase())
    );
    const connectedPrinters = (appData.printers || []).filter(p => 
      String(p.connected_pc_id || '').toUpperCase() === aid || (seat && String(p.assigned_seat || '').toUpperCase() === seat.toUpperCase())
    );
    const connectedEquipments = (appData.other_equipments || []).filter(o => 
      seat && String(o.assigned_seat || o.seat || '').toUpperCase() === seat.toUpperCase()
    );

    return { 
      item: found, 
      category: 'pcs', 
      typeLabel: 'Computer / Server', 
      typeLabelMl: 'കംപ്യൂട്ടർ സിസ്റ്റം (Desktop / Server)',
      icon: 'fa-desktop',
      connectedMonitors,
      connectedPeripherals,
      connectedPrinters,
      connectedEquipments
    };
  }

  found = appData.monitors.find(m => String(m.asset_id).toUpperCase() === aid);
  if (found) {
    const parentPc = (appData.pcs || []).find(p => 
      String(p.asset_id).toUpperCase() === String(found.connected_pc_id || '').toUpperCase() ||
      (found.assigned_seat && String(p.seat || '').toUpperCase() === String(found.assigned_seat).toUpperCase())
    );
    return { 
      item: found, 
      category: 'monitors', 
      typeLabel: 'Monitor / Display', 
      typeLabelMl: 'മോണിറ്റർ ഡിസ്‌പ്ലേ (LED Monitor)',
      icon: 'fa-display',
      parentPc
    };
  }

  found = appData.peripherals.find(k => String(k.asset_id).toUpperCase() === aid);
  if (found) {
    const parentPc = (appData.pcs || []).find(p => 
      String(p.asset_id).toUpperCase() === String(found.connected_pc_id || '').toUpperCase() ||
      (found.assigned_seat && String(p.seat || '').toUpperCase() === String(found.assigned_seat).toUpperCase())
    );
    return { 
      item: found, 
      category: 'peripherals', 
      typeLabel: 'Keyboard / Mouse', 
      typeLabelMl: 'കീബോർഡ് & മൗസ് (Peripherals)',
      icon: 'fa-keyboard',
      parentPc
    };
  }

  found = appData.printers.find(p => String(p.asset_id).toUpperCase() === aid);
  if (found) {
    const parentPc = (appData.pcs || []).find(p => 
      String(p.asset_id).toUpperCase() === String(found.connected_pc_id || '').toUpperCase() ||
      (found.assigned_seat && String(p.seat || '').toUpperCase() === String(found.assigned_seat).toUpperCase())
    );
    return { 
      item: found, 
      category: 'printers', 
      typeLabel: 'Printer / Scanner', 
      typeLabelMl: 'പ്രിന്റർ / സ്കാനർ (Printer)',
      icon: 'fa-print',
      parentPc
    };
  }

  found = appData.other_equipments.find(o => String(o.asset_id).toUpperCase() === aid);
  if (found) {
    return { 
      item: found, 
      category: 'other_equipments', 
      typeLabel: 'Power & Network Device', 
      typeLabelMl: 'പവർ & നെറ്റ്വർക്ക് ഉപകരണം (Network / UPS)',
      icon: 'fa-plug-circle-bolt'
    };
  }

  return null;
}

// Generate URL encoded link for asset
function getAssetPassportUrl(assetId) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?asset=${encodeURIComponent(assetId)}`;
}

// 26. Open Asset Passport Modal
function openAssetPassport(assetId) {
  const result = findItemByAssetId(assetId);
  if (!result) {
    showToast(`Asset "${assetId}" not found in inventory`, 'error');
    return;
  }

  const { item, category, typeLabel, typeLabelMl, icon, connectedMonitors, connectedPeripherals, connectedPrinters, connectedEquipments, parentPc } = result;
  
  const modalTitle = document.getElementById('passport-asset-title');
  if (modalTitle) modalTitle.innerText = `${item.asset_id} • ${item.brand || ''} ${item.model || ''}`;

  const isWorking = (item.is_working !== false && item.is_complaint !== true && item.status !== 'Complaint');
  const statusBadge = isWorking 
    ? '<span class="status-tag working"><i class="fa-solid fa-circle-check"></i> വർക്കിംഗ് (Operational)</span>'
    : '<span class="status-tag complaint"><i class="fa-solid fa-triangle-exclamation"></i> കംപ്ലയിന്റ് (Fault Reported)</span>';

  const amcBadge = (item.amc_type && item.amc_type !== 'NA' && item.amc_type !== 'None')
    ? `<span class="passport-cat-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.4);"><i class="fa-solid fa-shield-halved"></i> ${item.amc_type} (${item.amc_agency || 'Keltron'})</span>`
    : `<span class="passport-cat-badge" style="background: rgba(100, 116, 139, 0.15); color: var(--text-muted); border-color: var(--border-color);"><i class="fa-solid fa-shield-slash"></i> Non-AMC / Expired</span>`;

  const assignedUser = item.employee_name || 'Unassigned';
  const assignedSeat = item.seat || item.assigned_seat || 'N/A';
  const officeSec = item.office_section || item.section || 'PUTHUPPADI GP OFFICE';
  const assetUrl = getAssetPassportUrl(item.asset_id);

  // Specifications Building
  let specTilesHtml = '';
  if (category === 'pcs') {
    specTilesHtml = `
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-microchip"></i> Processor (പ്രൊസസ്സർ)</span>
        <span class="tile-val">${item.processor || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-memory"></i> RAM Memory (റാം)</span>
        <span class="tile-val">${item.ram || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-hard-drive"></i> Storage Drive (സ്റ്റോറേജ്)</span>
        <span class="tile-val">${item.storage || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-brands fa-windows"></i> Operating System (ഒ.എസ്)</span>
        <span class="tile-val">${item.os || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-network-wired"></i> Static IP (ഐ.പി വിലാസം)</span>
        <span class="tile-val font-mono" style="color: var(--info); display: flex; align-items: center; justify-content: space-between;">
          <span>${item.ip_address || 'DHCP / None'}</span>
          ${item.ip_address && item.ip_address !== 'NA' ? `<button class="copy-aid-btn" onclick="copyToClipboard('${item.ip_address}', 'IP Address Copied!')" title="Copy IP"><i class="fa-solid fa-copy"></i></button>` : ''}
        </span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-barcode"></i> Serial Number (സീരിയൽ നമ്പർ)</span>
        <span class="tile-val font-mono" style="display: flex; align-items: center; justify-content: space-between;">
          <span>${item.serial_number || 'N/A'}</span>
          ${item.serial_number && item.serial_number !== 'NA' ? `<button class="copy-aid-btn" onclick="copyToClipboard('${item.serial_number}', 'Serial Number Copied!')" title="Copy Serial"><i class="fa-solid fa-copy"></i></button>` : ''}
        </span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-laptop-code"></i> Chassis / Type (വിഭാഗം)</span>
        <span class="tile-val">${item.category || 'Desktop Workstation'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-industry"></i> Make & Model (മോഡൽ)</span>
        <span class="tile-val">${item.brand || ''} ${item.model || ''}</span>
      </div>
    `;
  } else if (category === 'monitors') {
    specTilesHtml = `
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-desktop"></i> Display Specifications</span>
        <span class="tile-val">${item.specifications || 'Standard LED Monitor'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-industry"></i> Brand & Model</span>
        <span class="tile-val">${item.brand || ''} ${item.model || ''}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-barcode"></i> Serial Number</span>
        <span class="tile-val font-mono">${item.serial_number || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-link"></i> Connected Computer ID</span>
        <span class="tile-val font-mono">${item.connected_pc_id || 'N/A'}</span>
      </div>
    `;
  } else if (category === 'printers') {
    specTilesHtml = `
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-box-archive"></i> Cartridge / Toner Model (ടോണർ)</span>
        <span class="tile-val" style="color: var(--warning); font-weight: 700;">${item.toner_cartridge || item.specifications || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-industry"></i> Brand & Model</span>
        <span class="tile-val">${item.brand || ''} ${item.model || ''}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-barcode"></i> Serial Number</span>
        <span class="tile-val font-mono">${item.serial_number || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-network-wired"></i> Network / Connection</span>
        <span class="tile-val font-mono">${item.ip_address || 'USB Local / Network'}</span>
      </div>
    `;
  } else {
    specTilesHtml = `
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-cube"></i> Device Category</span>
        <span class="tile-val">${item.category || item.item_name || 'Equipment'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-industry"></i> Brand & Model</span>
        <span class="tile-val">${item.brand || ''} ${item.model || ''}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-barcode"></i> Serial Number</span>
        <span class="tile-val font-mono">${item.serial_number || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-circle-info"></i> Technical Details</span>
        <span class="tile-val">${item.details || item.specifications || 'N/A'}</span>
      </div>
    `;
  }

  // Workstation Ecosystem (Connected Devices at this desk)
  let workstationHtml = '';
  if (category === 'pcs') {
    const hasMonitors = connectedMonitors && connectedMonitors.length > 0;
    const hasPeripherals = connectedPeripherals && connectedPeripherals.length > 0;
    const hasPrinters = connectedPrinters && connectedPrinters.length > 0;
    const hasEquipments = connectedEquipments && connectedEquipments.length > 0;

    if (!hasMonitors && !hasPeripherals && !hasPrinters && !hasEquipments) {
      workstationHtml = `
        <div class="passport-desk-card" style="grid-column: 1/-1; text-align: center; padding: 18px; color: var(--text-muted);">
          <i class="fa-solid fa-plug" style="font-size: 20px; margin-bottom: 6px; opacity: 0.5;"></i>
          <p style="font-size: 12.5px;">No auxiliary peripherals linked specifically to seat ${assignedSeat}.</p>
        </div>
      `;
    } else {
      let cards = '';
      if (hasMonitors) {
        connectedMonitors.forEach(m => {
          cards += `
            <div class="passport-desk-card">
              <div class="passport-desk-header">
                <span class="passport-desk-type"><i class="fa-solid fa-display"></i> Monitor</span>
                <span class="status-tag working" style="font-size: 10px; padding: 2px 6px;">${m.status || 'Working'}</span>
              </div>
              <div class="passport-desk-model">${m.brand || ''} ${m.model || ''}</div>
              <div class="passport-desk-meta">ID: ${m.asset_id}</div>
              <div class="passport-desk-meta">SN: ${m.serial_number || 'N/A'}</div>
              <button class="passport-desk-link-btn" onclick="openAssetPassport('${m.asset_id}')">
                <i class="fa-solid fa-qrcode"></i> View Monitor Details →
              </button>
            </div>
          `;
        });
      }
      if (hasPrinters) {
        connectedPrinters.forEach(p => {
          cards += `
            <div class="passport-desk-card">
              <div class="passport-desk-header">
                <span class="passport-desk-type" style="color: var(--warning);"><i class="fa-solid fa-print"></i> Printer</span>
                <span class="status-tag working" style="font-size: 10px; padding: 2px 6px;">${p.status || 'Working'}</span>
              </div>
              <div class="passport-desk-model">${p.brand || ''} ${p.model || ''}</div>
              <div class="passport-desk-meta">ID: ${p.asset_id}</div>
              <div class="passport-desk-meta">Toner: ${p.toner_cartridge || p.specifications || 'N/A'}</div>
              <button class="passport-desk-link-btn" onclick="openAssetPassport('${p.asset_id}')">
                <i class="fa-solid fa-qrcode"></i> View Printer Details →
              </button>
            </div>
          `;
        });
      }
      if (hasPeripherals) {
        connectedPeripherals.forEach(k => {
          cards += `
            <div class="passport-desk-card">
              <div class="passport-desk-header">
                <span class="passport-desk-type" style="color: var(--info);"><i class="fa-solid fa-keyboard"></i> ${k.category || 'Peripheral'}</span>
                <span class="status-tag working" style="font-size: 10px; padding: 2px 6px;">${k.status || 'Working'}</span>
              </div>
              <div class="passport-desk-model">${k.brand || ''} ${k.model || ''}</div>
              <div class="passport-desk-meta">ID: ${k.asset_id}</div>
              <div class="passport-desk-meta">SN: ${k.serial_number || 'N/A'}</div>
              <button class="passport-desk-link-btn" onclick="openAssetPassport('${k.asset_id}')">
                <i class="fa-solid fa-qrcode"></i> View Peripheral Details →
              </button>
            </div>
          `;
        });
      }
      if (hasEquipments) {
        connectedEquipments.forEach(o => {
          cards += `
            <div class="passport-desk-card">
              <div class="passport-desk-header">
                <span class="passport-desk-type" style="color: #a855f7;"><i class="fa-solid fa-plug-circle-bolt"></i> Power/Network</span>
              </div>
              <div class="passport-desk-model">${o.brand || ''} ${o.model || o.item_name || 'Device'}</div>
              <div class="passport-desk-meta">ID: ${o.asset_id}</div>
              <button class="passport-desk-link-btn" onclick="openAssetPassport('${o.asset_id}')">
                <i class="fa-solid fa-qrcode"></i> View Details →
              </button>
            </div>
          `;
        });
      }
      workstationHtml = cards;
    }
  } else if (parentPc) {
    workstationHtml = `
      <div class="passport-desk-card" style="grid-column: 1/-1;">
        <div class="passport-desk-header">
          <span class="passport-desk-type"><i class="fa-solid fa-desktop"></i> Host Workstation (പ്രധാന കമ്പ്യൂട്ടർ)</span>
          <span class="status-tag working">${parentPc.status || 'Working'}</span>
        </div>
        <div class="passport-desk-model" style="font-size: 14px; margin-top: 4px;">${parentPc.asset_id} • ${parentPc.brand || ''} ${parentPc.model || ''}</div>
        <div class="passport-desk-meta">User: ${parentPc.employee_name || 'Unassigned'} • Seat: ${parentPc.seat || 'N/A'} • IP: ${parentPc.ip_address || 'DHCP'}</div>
        <button class="passport-desk-link-btn" style="margin-top: 8px;" onclick="openAssetPassport('${parentPc.asset_id}')">
          <i class="fa-solid fa-arrow-right"></i> Open Host Computer Passport (${parentPc.asset_id}) →
        </button>
      </div>
    `;
  } else {
    workstationHtml = `
      <div class="passport-desk-card" style="grid-column: 1/-1; text-align: center; padding: 14px; color: var(--text-muted); font-size: 12.5px;">
        Stand-alone Panchayath IT Asset • Registered under ${assignedSeat}
      </div>
    `;
  }

  // Find tickets & maintenance history
  const relatedTickets = (appData.tickets || appData.complaints || []).filter(t => 
    String(t.asset_id || '').toUpperCase() === item.asset_id.toUpperCase() || 
    String(t.pc_asset_id || '').toUpperCase() === item.asset_id.toUpperCase()
  );

  let ticketHistoryHtml = '';
  if (relatedTickets.length === 0) {
    ticketHistoryHtml = `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; text-align: center; color: var(--text-muted); font-size: 12.5px;">
        <i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 18px; margin-bottom: 6px;"></i><br>
        ഈ ഉപകരണത്തിന് നിലവിൽ കംപ്ലയിന്റുകളോ ബ്രേക്ക്ഡൗൺ സർവീസുകളോ റിപ്പോർട്ട് ചെയ്തിട്ടില്ല (No breakdown tickets logged).
      </div>
    `;
  } else {
    ticketHistoryHtml = `
      <div class="table-responsive" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
        <table class="data-table" style="font-size: 12px; margin: 0;">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Date Logged</th>
              <th>Fault / Issue Description</th>
              <th>Status</th>
              <th>Service / Resolution</th>
            </tr>
          </thead>
          <tbody>
            ${relatedTickets.map(t => `
              <tr>
                <td><strong class="font-mono">${t.ticket_id || t.id}</strong></td>
                <td>${t.date_logged || t.date || '-'}</td>
                <td><strong>${t.fault_description || t.complaint_details || '-'}</strong></td>
                <td><span class="status-tag ${t.status === 'Closed' ? 'working' : 'complaint'}">${t.status}</span></td>
                <td>${t.resolution || t.work_done || 'Pending Keltron Service'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Build Container Content
  const container = document.getElementById('passport-body-content');
  container.innerHTML = `
    <!-- Top Hero Card -->
    <div class="passport-hero">
      <div class="passport-qr-frame" id="modal-qr-container" title="Scan this QR code to view live stock details">
        <!-- Live QR Code -->
      </div>
      <div class="passport-hero-info">
        <div class="passport-hero-badges">
          <span class="passport-cat-badge"><i class="fa-solid ${icon}"></i> ${typeLabel}</span>
          ${amcBadge}
          ${statusBadge}
        </div>
        <div class="passport-hero-id">
          <div class="passport-hero-id-chip">
            <i class="fa-solid fa-barcode"></i>
            <span>${item.asset_id}</span>
          </div>
          <button class="copy-aid-btn" onclick="copyToClipboard('${item.asset_id}', 'Asset ID Copied!')" title="Copy Asset ID"><i class="fa-solid fa-copy"></i> Copy ID</button>
        </div>
        <div class="passport-hero-model">${item.brand || ''} ${item.model || ''} <span class="malayalam-sub">(${typeLabelMl})</span></div>
        <div class="passport-hero-meta">
          <div class="passport-meta-item"><i class="fa-solid fa-user" style="color: var(--primary);"></i> <strong>${assignedUser}</strong></div>
          <div class="passport-meta-item"><i class="fa-solid fa-chair" style="color: var(--warning);"></i> Seat: <strong>${assignedSeat}</strong></div>
          <div class="passport-meta-item"><i class="fa-solid fa-building" style="color: var(--info);"></i> ${officeSec}</div>
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-warning btn-sm" onclick="logComplaintFromPassport('${item.asset_id}')" style="font-weight: 700; box-shadow: 0 3px 12px rgba(245, 158, 11, 0.35);">
            <i class="fa-solid fa-triangle-exclamation"></i> Report Complaint / കംപ്ലയിന്റ് നൽകുക
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Body -->
    <div class="passport-content-body">
      <!-- 1. Technical Specifications -->
      <div>
        <div class="passport-section-title">
          <i class="fa-solid fa-sliders"></i>
          <span>Hardware & Network Specifications (സാങ്കേതിക വിവരങ്ങൾ)</span>
        </div>
        <div class="passport-spec-tiles">
          ${specTilesHtml}
        </div>
      </div>

      <!-- 2. Workstation Ecosystem / Connected Devices -->
      <div>
        <div class="passport-section-title">
          <i class="fa-solid fa-network-wired"></i>
          <span>Workstation Ecosystem & Connected Hardware (ഈ സീറ്റിലെ മറ്റു ഉപകരണങ്ങൾ)</span>
        </div>
        <div class="passport-desk-grid">
          ${workstationHtml}
        </div>
      </div>

      <!-- 3. AMC & Warranty Details -->
      <div>
        <div class="passport-section-title">
          <i class="fa-solid fa-shield-halved"></i>
          <span>Maintenance & Commercial Inventory (മെയിന്റനൻസ് & സ്റ്റോക്ക് വിവരങ്ങൾ)</span>
        </div>
        <div class="passport-spec-tiles">
          <div class="passport-tile">
            <span class="tile-label"><i class="fa-solid fa-file-contract"></i> AMC / Warranty Coverage</span>
            <span class="tile-val">${item.amc_type || 'Warranty'}</span>
          </div>
          <div class="passport-tile">
            <span class="tile-label"><i class="fa-solid fa-headset"></i> Service Provider Agency</span>
            <span class="tile-val">${item.amc_agency || 'Keltron AMC'}</span>
          </div>
          <div class="passport-tile">
            <span class="tile-label"><i class="fa-solid fa-calendar-check"></i> Purchase / Induction Date</span>
            <span class="tile-val">${item.purchase_date || 'In Active Use'}</span>
          </div>
          <div class="passport-tile">
            <span class="tile-label"><i class="fa-solid fa-book-bookmark"></i> Stock Register Reference</span>
            <span class="tile-val">Puduppady GP IT Register</span>
          </div>
        </div>
      </div>

      <!-- 4. Ticket History -->
      <div>
        <div class="passport-section-title">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <span>Service & Breakdown History (സർവീസ് & മെയിന്റനൻസ് ഹിസ്റ്ററി)</span>
        </div>
        ${ticketHistoryHtml}
      </div>
    </div>
  `;

  // Render QR Code in modal frame
  setTimeout(() => {
    const qrTarget = document.getElementById('modal-qr-container');
    if (qrTarget) {
      qrTarget.innerHTML = '';
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrTarget, {
          text: assetUrl,
          width: 95,
          height: 95,
          colorDark: "#1d4ed8",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }
  }, 40);

  // Footer Action Buttons
  const footer = document.getElementById('passport-footer-actions');
  footer.innerHTML = `
    <button class="btn btn-secondary" onclick="logComplaintFromPassport('${item.asset_id}')" title="Report breakdown ticket">
      <i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i> Report Complaint / കംപ്ലയിന്റ് നൽകുക
    </button>
    <button class="btn btn-primary" onclick="closeModal('asset-passport-modal')">
      <i class="fa-solid fa-xmark"></i> Close / ക്ലോസ് ചെയ്യുക
    </button>
  `;

  openModal('asset-passport-modal');
}

// 27. Print Official Kerala Panchayath A4 IT Asset Passport Certificate
function printAssetPassportSheet(assetId) {
  const result = findItemByAssetId(assetId);
  if (!result) {
    showToast('Asset not found: ' + assetId, 'error');
    return;
  }

  const { item, category, typeLabel, typeLabelMl, connectedMonitors, connectedPeripherals, connectedPrinters } = result;
  const qrUrl = getAssetPassportUrl(item.asset_id);
  const printWindow = window.open('', '_blank', 'width=850,height=950');
  if (!printWindow) {
    showToast('Please allow popups to print Asset Passport Document', 'warning');
    return;
  }

  const assignedUser = item.employee_name || 'Unassigned';
  const assignedSeat = item.seat || item.assigned_seat || 'N/A';
  const officeSec = item.office_section || item.section || 'PUTHUPPADI GP OFFICE';
  const isWorking = (item.is_working !== false && item.is_complaint !== true && item.status !== 'Complaint');
  const statusText = isWorking ? 'OPERATIONAL / WORKING (പ്രവർത്തനക്ഷമം)' : 'COMPLAINT REPORTED (തകരാർ)';

  let accessoriesList = [];
  if (connectedMonitors && connectedMonitors.length > 0) {
    connectedMonitors.forEach(m => accessoriesList.push(`Monitor: ${m.brand || ''} ${m.model || ''} [${m.asset_id}]`));
  }
  if (connectedPrinters && connectedPrinters.length > 0) {
    connectedPrinters.forEach(p => accessoriesList.push(`Printer: ${p.brand || ''} ${p.model || ''} [${p.asset_id}]`));
  }
  if (connectedPeripherals && connectedPeripherals.length > 0) {
    connectedPeripherals.forEach(k => accessoriesList.push(`${k.category || 'Peripheral'}: ${k.brand || ''} ${k.model || ''} [${k.asset_id}]`));
  }

  const accessoriesHtml = accessoriesList.length > 0 
    ? accessoriesList.map(a => `<li>${a}</li>`).join('') 
    : '<li>Standard office hardware setup</li>';

  const certHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>IT Asset Passport - ${item.asset_id}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        @page { size: A4 portrait; margin: 12mm 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 10px;
          line-height: 1.4;
        }
        .passport-cert {
          border: 2px solid #0f172a;
          padding: 24px 28px;
          border-radius: 8px;
          max-width: 800px;
          margin: 0 auto;
        }
        .cert-header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .cert-header h1 {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .cert-header h2 {
          font-size: 15px;
          font-weight: 700;
          color: #1e3a8a;
          margin-top: 4px;
        }
        .cert-header p {
          font-size: 12px;
          color: #475569;
          margin-top: 2px;
        }
        .cert-top-grid {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 14px 18px;
        }
        .cert-id-box {
          flex: 1;
        }
        .cert-id-val {
          font-family: 'JetBrains Mono', monospace;
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
        }
        .cert-qr-frame {
          width: 95px;
          height: 95px;
          background: #ffffff;
          border: 1px solid #000000;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cert-qr-frame img, .cert-qr-frame canvas {
          width: 100% !important;
          height: 100% !important;
        }
        .cert-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          font-size: 12.5px;
        }
        .cert-table th, .cert-table td {
          border: 1px solid #cbd5e1;
          padding: 8px 12px;
          text-align: left;
        }
        .cert-table th {
          background: #f1f5f9;
          font-weight: 700;
          color: #1e293b;
          width: 32%;
        }
        .cert-table td {
          color: #0f172a;
        }
        .section-heading {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          color: #1e3a8a;
          margin: 14px 0 6px 0;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 3px;
        }
        .cert-footer {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          text-align: center;
          padding-top: 20px;
        }
        .sig-block {
          width: 200px;
          border-top: 1.5px dashed #0f172a;
          padding-top: 6px;
          font-size: 12px;
          font-weight: 700;
        }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
    </head>
    <body>
      <div class="passport-cert">
        <div class="cert-header">
          <h1>PUTHUPPADI GRAMA PANCHAYATH</h1>
          <h2>GOVERNMENT IT STOCK REGISTER & ASSET PASSPORT</h2>
          <p>പുതുപ്പാടി ഗ്രാമപഞ്ചായത്ത് • ഐ.ടി ഹാർഡ്‌വെയർ രജിസ്റ്റർ</p>
        </div>

        <div class="cert-top-grid">
          <div class="cert-id-box">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Official Asset Identification No:</div>
            <div class="cert-id-val">${item.asset_id}</div>
            <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 4px;">
              ${item.brand || ''} ${item.model || ''} (${typeLabel})
            </div>
            <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
              Status: <strong>${statusText}</strong>
            </div>
          </div>
          <div class="cert-qr-frame" id="cert-qr-target"></div>
        </div>

        <div class="section-heading">1. Location & Custody Allocation (ഉപയോഗിക്കുന്ന വ്യക്തി & സെക്ഷൻ)</div>
        <table class="cert-table">
          <tr><th>Custodian / Employee Name</th><td><strong>${assignedUser}</strong></td></tr>
          <tr><th>Designation & Seat Code</th><td><strong>${assignedSeat}</strong></td></tr>
          <tr><th>Office Section / Department</th><td>${officeSec}</td></tr>
          <tr><th>Network Static IP Address</th><td style="font-family: monospace; font-weight: 700;">${item.ip_address || 'DHCP / None'}</td></tr>
        </table>

        <div class="section-heading">2. Hardware Specifications (ഹാർഡ്‌വെയർ സാങ്കേതിക വിവരങ്ങൾ)</div>
        <table class="cert-table">
          <tr><th>Device Make & Model</th><td>${item.brand || ''} ${item.model || ''}</td></tr>
          <tr><th>Hardware Serial Number</th><td style="font-family: monospace; font-weight: 700;">${item.serial_number || 'N/A'}</td></tr>
          ${category === 'pcs' ? `
            <tr><th>Processor</th><td>${item.processor || 'N/A'}</td></tr>
            <tr><th>RAM Memory & Storage</th><td>${item.ram || 'N/A'} RAM • ${item.storage || 'N/A'}</td></tr>
            <tr><th>Operating System</th><td>${item.os || 'N/A'}</td></tr>
          ` : category === 'printers' ? `
            <tr><th>Cartridge / Toner Model</th><td><strong>${item.toner_cartridge || item.specifications || 'N/A'}</strong></td></tr>
          ` : `
            <tr><th>Specifications</th><td>${item.details || item.specifications || 'N/A'}</td></tr>
          `}
        </table>

        <div class="section-heading">3. Maintenance & Warranty Coverage (മെയിന്റനൻസ് കരാർ)</div>
        <table class="cert-table">
          <tr><th>AMC / Warranty Status</th><td><strong>${item.amc_type || 'Warranty'}</strong></td></tr>
          <tr><th>Service Agency</th><td>${item.amc_agency || 'Keltron AMC'}</td></tr>
          <tr><th>Date of Induction / Purchase</th><td>${item.purchase_date || 'In Active Use'}</td></tr>
        </table>

        <div class="section-heading">4. Connected Desk Accessories (ഈ സിസ്റ്റത്തിൽ ഉൾപ്പെട്ട ഉപകരണങ്ങൾ)</div>
        <ul style="padding-left: 20px; font-size: 12px; color: #334155; margin-bottom: 20px;">
          ${accessoriesHtml}
        </ul>

        <div class="cert-footer">
          <div class="sig-block">
            Custodian Signature<br>
            <span style="font-size: 10px; font-weight: 400; color: #64748b;">(ഉദ്യോഗസ്ഥന്റെ ഒപ്പ്)</span>
          </div>
          <div class="sig-block">
            IT Coordinator / Clerk<br>
            <span style="font-size: 10px; font-weight: 400; color: #64748b;">(ഐ.ടി ചുമതലയുള്ള ഉദ്യോഗസ്ഥൻ)</span>
          </div>
          <div class="sig-block">
            Secretary / Asst. Secretary<br>
            <span style="font-size: 10px; font-weight: 400; color: #64748b;">(സെക്രട്ടറി / ഗ്രാമപഞ്ചായത്ത്)</span>
          </div>
        </div>
      </div>

      <script>
        new QRCode(document.getElementById("cert-qr-target"), {
          text: ${JSON.stringify(qrUrl)},
          width: 95,
          height: 95,
          colorDark: "#1d4ed8",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
        setTimeout(function() {
          window.print();
        }, 400);
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.write(certHtml);
  printWindow.document.close();
}

// 28. Log Complaint Pre-Filled from Asset Passport
function logComplaintFromPassport(assetId) {
  closeModal('asset-passport-modal');
  setTimeout(() => {
    openTicketModal();
    const selectAsset = document.getElementById('comp-pc-select');
    if (selectAsset && assetId) {
      selectAsset.value = assetId;
      onComplaintPcSelect(assetId);
    }
  }, 100);
}

// 29. In-App Live Camera QR Code Scanner (`#qr-scanner-modal`)
function openQrScannerModal() {
  openModal('qr-scanner-modal');
  
  const streamEl = document.getElementById('qr-camera-stream');
  if (!streamEl) return;
  streamEl.innerHTML = '';

  if (typeof Html5Qrcode !== 'undefined') {
    try {
      html5QrScannerInstance = new Html5Qrcode("qr-camera-stream");
      html5QrScannerInstance.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 230, height: 230 }
        },
        (decodedText, decodedResult) => {
          console.log("QR Code Scanned:", decodedText);
          playScanSuccessSound();
          handleQrScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Scanning in progress
        }
      ).catch(err => {
        console.warn("Camera access warning:", err);
        streamEl.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
            <i class="fa-solid fa-video-slash" style="font-size: 32px; margin-bottom: 10px; color: var(--warning);"></i><br>
            <strong style="color: var(--text-primary); font-size: 14px;">Camera access is unavailable or not permitted.</strong><br>
            <span style="font-size: 12px; margin-top: 4px; display: block;">ക്യാമറ അനുമതി നൽകുക അല്ലെങ്കിൽ താഴെയുള്ള ബോക്സിൽ Asset ID ടൈപ്പ് ചെയ്യുക.</span>
          </div>
        `;
      });
    } catch (e) {
      console.error("Scanner init error:", e);
    }
  }
}

function closeQrScannerModal() {
  if (html5QrScannerInstance) {
    try {
      html5QrScannerInstance.stop().then(() => {
        html5QrScannerInstance.clear();
        html5QrScannerInstance = null;
      }).catch(() => {
        html5QrScannerInstance = null;
      });
    } catch (e) {
      html5QrScannerInstance = null;
    }
  }
  closeModal('qr-scanner-modal');
}

function handleQrScanSuccess(scannedText) {
  closeQrScannerModal();
  showToast('QR Code Scanned Successfully! വിവരങ്ങൾ കണ്ടെത്തുന്നു...', 'success');

  // Check if scannedText is a URL containing ?asset=...
  let assetId = scannedText.trim();
  if (scannedText.includes('asset=')) {
    try {
      const url = new URL(scannedText);
      assetId = url.searchParams.get('asset') || assetId;
    } catch (e) {
      const match = scannedText.match(/asset=([^&]+)/);
      if (match) assetId = decodeURIComponent(match[1]);
    }
  }

  setTimeout(() => {
    openAssetPassport(assetId);
  }, 250);
}

function handleManualScanLookup() {
  const input = document.getElementById('manual-scan-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter an Asset ID (e.g. PGP-SYS-PC001)', 'error');
    return;
  }
  const aid = input.value.trim().toUpperCase();
  closeQrScannerModal();
  openAssetPassport(aid);
}

// 30. URL Deep Linking: Detect ?asset=PGP-SYS-PC001 on initial load / mobile scan
function checkUrlForAsset() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const assetParam = urlParams.get('asset');
    if (assetParam && !hasCheckedUrlAsset) {
      hasCheckedUrlAsset = true;
      console.log('Deep link Asset detected:', assetParam);

      // Wait until appData is ready if loading asynchronously
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((appData.pcs && appData.pcs.length > 0) || attempts > 20) {
          clearInterval(interval);
          setTimeout(() => {
            openAssetPassport(assetParam);
          }, 200);
        }
      }, 150);
    }
  } catch (e) {
    console.error('URL check notice:', e);
  }
}

