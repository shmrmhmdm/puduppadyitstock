/**
 * Puthuppadi Grama Panchayath IT Stock Register - Client Application
 */

const API_BASE = window.location.origin;

// Application State
let appData = {
  pcs: [],
  monitors: [],
  peripherals: [],
  printers: [],
  other_equipments: [],
  complaints: [],
  employees: [],
  generator: { name: 'Mahindra', serial: 'N3B24XL29998', capacity: '25 KVA', logs: [] },
  purchases: [],
  ip_allocations: []
};

let currentCategory = 'pcs';
let editMode = false;

// 1. Initialization
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadData();
  loadConfig();
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
}

// 2. Fetch Data from API (with Static Hosting / GitHub Pages fallback)
async function loadData() {
  try {
    const res = await fetch(`${API_BASE}/api/data`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status === 'success') {
      appData = json.data;
      renderAll();
      return;
    }
  } catch (err) {
    console.log('API endpoint not reachable, loading static stock_data.json:', err.message);
    try {
      const staticRes = await fetch('./stock_data.json');
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        appData = staticData;
        renderAll();
        return;
      }
    } catch (staticErr) {
      console.error('Failed to load static fallback data:', staticErr);
      showToast('Failed to load database. Running offline cache.', 'error');
    }
  }
}

async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.config) {
        if (json.config.google_apps_script_url) {
          document.getElementById('cfg-gas-url').value = json.config.google_apps_script_url;
        }
        if (json.config.last_synced) {
          document.getElementById('cfg-last-synced').innerText = json.config.last_synced;
        }
        return;
      }
    }
  } catch (err) {
    console.log('API config not reachable, loading config.json fallback');
  }

  try {
    const staticCfgRes = await fetch('./config.json');
    if (staticCfgRes.ok) {
      const cfg = await staticCfgRes.json();
      if (cfg.google_apps_script_url) {
        document.getElementById('cfg-gas-url').value = cfg.google_apps_script_url;
      }
      if (cfg.last_synced) {
        document.getElementById('cfg-last-synced').innerText = cfg.last_synced;
      }
    }
  } catch (e) {
    console.log('Config fallback notice:', e);
  }
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

  const ticket = {
    ticket_id: ticketId || `TKT-2026-${String(appData.tickets.length + 1).padStart(3, '0')}`,
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
    closed_date: (status === 'Closed' || status === 'Resolved') ? new Date().toISOString().split('T')[0] : '',
    turnaround_days: '',
    remarks: 'Managed via PGP IT Register'
  };

  try {
    const res = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Service ticket saved & synchronized successfully!', 'success');
      closeModal('complaint-modal');
      await loadData();
    } else {
      showToast(result.message || 'Failed to save ticket', 'error');
    }
  } catch (err) {
    showToast('API Connection error: ' + err.message, 'error');
  }
}

async function deleteTicket(ticketId) {
  if (!confirm(`Are you sure you want to delete ticket ${ticketId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/tickets?ticket_id=${ticketId}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(result.message, 'success');
      await loadData();
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
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

  try {
    const res = await fetch(`${API_BASE}/api/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchase })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Purchase record added & synced successfully!', 'success');
      closeModal('purchase-modal');
      await loadData();
    } else {
      showToast(result.message || 'Failed to save purchase', 'error');
    }
  } catch (err) {
    showToast('API Connection error: ' + err.message, 'error');
  }
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

  try {
    const res = await fetch(`${API_BASE}/api/generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Generator service log added & synced successfully!', 'success');
      closeModal('generator-modal');
      await loadData();
    } else {
      showToast(result.message || 'Failed to save log', 'error');
    }
  } catch (err) {
    showToast('API Connection error: ' + err.message, 'error');
  }
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
    office: office
  };

  try {
    const res = await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Staff details updated & synchronized successfully!', 'success');
      closeModal('employee-modal');
      await loadData();
    } else {
      showToast(result.message || 'Failed to save staff member', 'error');
    }
  } catch (err) {
    showToast('API Connection error: ' + err.message, 'error');
  }
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
  purTbody.innerHTML = '';
  appData.purchases.forEach(p => {
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

  const genTbody = document.getElementById('generator-table-body');
  genTbody.innerHTML = '';
  appData.generator.logs.forEach(g => {
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

// 14. IP Address Grid
function renderIpMap() {
  const container = document.getElementById('ip-grid-container');
  container.innerHTML = '';
  appData.ip_allocations.forEach(ipObj => {
    const cell = document.createElement('div');
    cell.className = `ip-cell ${ipObj.is_assigned ? 'used' : 'free'}`;
    const ipLast = ipObj.ip.split('.').pop();
    cell.innerHTML = `.${ipLast}`;
    cell.title = ipObj.is_assigned 
      ? `IP: ${ipObj.ip} (Assigned to: ${ipObj.assigned_to})`
      : `IP: ${ipObj.ip} (Available)`;

    if (ipObj.is_assigned) {
      cell.addEventListener('click', () => {
        switchView('pcs');
        document.getElementById('filter-pc-search').value = ipObj.assigned_to;
        filterPcs();
      });
    }

    container.appendChild(cell);
  });
}

// 15. RT-Section Asset Handover Generator
function populateHandoverSelect() {
  const select = document.getElementById('handover-pc-select');
  select.innerHTML = '';
  appData.pcs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_id;
    opt.innerText = `${p.asset_id} - ${p.employee_name || 'Vacant'} (${p.seat || p.office_section})`;
    select.appendChild(opt);
  });

  if (appData.pcs.length > 0) {
    populateHandoverSheet(appData.pcs[0].asset_id);
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

// 16. Dynamic Modal Builder for Stock CRUD
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

function buildModalFields(category, data = {}) {
  const container = document.getElementById('stock-modal-fields');
  container.innerHTML = '';

  let html = `
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
        <input type="text" id="form-brand" value="${data.brand || ''}" placeholder="Acer / HP / Dell / Logitech" required>
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
        <input type="text" id="form-proc" value="${data.processor || ''}" placeholder="Intel i3 / Intel i5 / Ryzen 5" required>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>RAM Capacity *:</label>
        <input type="text" id="form-ram" value="${data.ram || ''}" placeholder="8 GB / 16 GB" required>
      </div>
      <div class="form-group flex-1">
        <label>Storage (HDD / SSD) *:</label>
        <input type="text" id="form-storage" value="${data.storage || ''}" placeholder="500 SSD / 1 TB HDD" required>
      </div>
      <div class="form-group flex-1">
        <label>Operating System:</label>
        <input type="text" id="form-os" value="${data.os || 'Win 11'}" placeholder="Win 10 / Win 11 / Ubuntu">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Static IP Address:</label>
        <input type="text" id="form-ip" value="${data.ip_address || ''}" placeholder="192.168.0.x">
      </div>
      <div class="form-group flex-1">
        <label>Assigned Seat Code:</label>
        <input type="text" id="form-seat" value="${data.seat || ''}" placeholder="e.g. SEC / AS / SC1 / FO">
      </div>
      <div class="form-group flex-1">
        <label>Employee Name:</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Staff member name">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label>Office Section:</label>
        <input type="text" id="form-section" value="${data.office_section || 'PGP OFFICE'}" placeholder="PGP OFFICE / AE OFFICE / NREGS">
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
        <input type="text" id="form-amc-agency" value="${data.amc_agency || 'Keltron'}" placeholder="Keltron / Acer">
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
        <label>Assigned Seat Code:</label>
        <input type="text" id="form-seat" value="${data.assigned_seat || ''}" placeholder="e.g. SC1">
      </div>
      <div class="form-group flex-1">
        <label>Employee Name:</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Employee name">
      </div>
      <div class="form-group flex-1">
        <label>Connected PC Asset ID:</label>
        <input type="text" id="form-pc-id" value="${data.connected_pc_id || ''}" placeholder="PGP-SYS-PC001">
      </div>
    </div>
    `;
  } else if (category === 'peripherals') {
    html += `
      <div class="form-group flex-1">
        <label>Connected PC Asset ID:</label>
        <input type="text" id="form-pc-id" value="${data.connected_pc_id || ''}" placeholder="PGP-SYS-PC001">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex-1">
        <label>Assigned Seat Code:</label>
        <input type="text" id="form-seat" value="${data.assigned_seat || ''}" placeholder="e.g. SC1">
      </div>
      <div class="form-group flex-1">
        <label>Employee Name:</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Employee name">
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
        <label>Assigned Seat:</label>
        <input type="text" id="form-seat" value="${data.assigned_seat || ''}" placeholder="FO / SC1">
      </div>
      <div class="form-group flex-1">
        <label>Employee Name:</label>
        <input type="text" id="form-emp" value="${data.employee_name || ''}" placeholder="Employee Name">
      </div>
      <div class="form-group flex-1">
        <label>Connected Host PC:</label>
        <input type="text" id="form-pc-id" value="${data.connected_pc_id || ''}" placeholder="PGP-SYS-PC016">
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
        <label>Location / Section:</label>
        <input type="text" id="form-section" value="${data.section || 'PGP OFFICE'}" placeholder="PGP OFFICE SF / GF">
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
  const assetId = document.getElementById('form-asset-id').value.trim();
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
      status: isWorking ? 'Working' : 'Complaint'
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

  const endpoint = `${API_BASE}/api/stock`;
  const method = editMode ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, item: itemData })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(result.message || 'Record saved successfully!', 'success');
      closeModal('stock-modal');
      await loadData();
    } else {
      showToast(result.message || 'Failed to save record', 'error');
    }
  } catch (err) {
    showToast('API Connection error: ' + err.message, 'error');
  }
}

// 18. Delete Stock Item
async function deleteStockItem(category, assetId) {
  if (!confirm(`Are you sure you want to delete ${assetId}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/stock?category=${category}&asset_id=${assetId}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast(result.message, 'success');
      await loadData();
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

// 19. Complaint Desk Form & Handler
function openComplaintModal() {
  document.getElementById('complaint-modal-title').innerHTML = '<i class="fa-solid fa-plus"></i> Log New Complaint';
  document.getElementById('comp-id').value = '';
  document.getElementById('comp-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('comp-ticket').value = '';
  document.getElementById('comp-details').value = '';
  document.getElementById('comp-solution').value = '';
  document.getElementById('comp-status').value = 'Open';

  // populate select
  const pcSelect = document.getElementById('comp-pc-select');
  pcSelect.innerHTML = '<option value="">-- Choose Affected System --</option>';
  appData.pcs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_id;
    opt.innerText = `${p.asset_id} (${p.seat} - ${p.employee_name || 'Vacant'})`;
    pcSelect.appendChild(opt);
  });

  openModal('complaint-modal');
}

function onComplaintPcSelect(pcAssetId) {
  const pc = appData.pcs.find(p => p.asset_id === pcAssetId);
  if (pc) {
    document.getElementById('comp-section').value = pc.seat || pc.office_section || '';
    document.getElementById('comp-amc').value = `${pc.amc_agency || 'Keltron'} (${pc.amc_type || 'AMC'})`;
  }
}

function openEditComplaintModal(compId) {
  const comp = appData.complaints.find(c => c.id === compId);
  if (!comp) return;

  document.getElementById('complaint-modal-title').innerHTML = `<i class="fa-solid fa-pen"></i> Edit Ticket ${comp.ticket_id || comp.id}`;
  document.getElementById('comp-id').value = comp.id;
  
  const pcSelect = document.getElementById('comp-pc-select');
  pcSelect.innerHTML = '<option value="">-- Choose Affected System --</option>';
  appData.pcs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.asset_id;
    opt.innerText = `${p.asset_id} (${p.seat} - ${p.employee_name || 'Vacant'})`;
    if (p.asset_id === comp.pc_asset_id) opt.selected = true;
    pcSelect.appendChild(opt);
  });

  document.getElementById('comp-section').value = comp.section_name || '';
  document.getElementById('comp-date').value = comp.date || '';
  document.getElementById('comp-ticket').value = comp.ticket_id || '';
  document.getElementById('comp-details').value = comp.complaint_details || '';
  document.getElementById('comp-amc').value = comp.amc_details || '';
  document.getElementById('comp-status').value = comp.status || 'Open';
  document.getElementById('comp-solution').value = comp.solution || '';

  openModal('complaint-modal');
}

async function handleComplaintSubmit(e) {
  e.preventDefault();
  const compId = document.getElementById('comp-id').value;
  const pcAssetId = document.getElementById('comp-pc-select').value;
  const section = document.getElementById('comp-section').value.trim();
  const date = document.getElementById('comp-date').value;
  const ticket = document.getElementById('comp-ticket').value.trim();
  const details = document.getElementById('comp-details').value.trim();
  const amc = document.getElementById('comp-amc').value.trim();
  const status = document.getElementById('comp-status').value;
  const solution = document.getElementById('comp-solution').value.trim();

  const complaint = {
    id: compId || `CMP-${appData.complaints.length + 1}`,
    pc_asset_id: pcAssetId,
    section_name: section,
    date: date,
    ticket_id: ticket,
    complaint_details: details,
    amc_details: amc,
    status: status,
    solution: solution,
    closed_date: status === 'Closed' ? new Date().toLocaleDateString() : ''
  };

  try {
    const res = await fetch(`${API_BASE}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Complaint saved successfully!', 'success');
      closeModal('complaint-modal');
      await loadData();
    }
  } catch (err) {
    showToast('Failed to save complaint: ' + err.message, 'error');
  }
}

// 20. Google Sheets Cloud Sync & Settings
async function saveConfig(e) {
  e.preventDefault();
  const gasUrl = document.getElementById('cfg-gas-url').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ google_apps_script_url: gasUrl })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Settings saved successfully!', 'success');
    }
  } catch (err) {
    showToast('Failed to save configuration: ' + err.message, 'error');
  }
}

async function testSync() {
  showToast('Connecting to Google Sheets...', 'info');
  try {
    const res = await fetch(`${API_BASE}/api/sync`, { method: 'POST' });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Successfully synced with Google Sheets!', 'success');
      if (result.data) {
        appData = result.data;
        renderAll();
      } else {
        await loadData();
      }
      loadConfig();
    } else {
      showToast(result.message || 'Sync failed', 'error');
    }
  } catch (err) {
    showToast('Sync error: ' + err.message, 'error');
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
  if (m) m.classList.add('active');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('active');
}

// 24. Toast Utility
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  msgEl.innerText = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ==========================================
// 25. QR CODE ENGINE & ASSET PASSPORT SYSTEM
// ==========================================

let html5QrScannerInstance = null;
let hasCheckedUrlAsset = false;

// Helper: Find item by Asset ID across all categories
function findItemByAssetId(assetId) {
  if (!assetId) return null;
  const aid = String(assetId).trim().toUpperCase();
  
  let found = appData.pcs.find(p => String(p.asset_id).toUpperCase() === aid);
  if (found) return { item: found, category: 'pcs', typeLabel: 'Computer / Server', icon: 'fa-desktop' };

  found = appData.monitors.find(m => String(m.asset_id).toUpperCase() === aid);
  if (found) return { item: found, category: 'monitors', typeLabel: 'Monitor / Display', icon: 'fa-display' };

  found = appData.peripherals.find(k => String(k.asset_id).toUpperCase() === aid);
  if (found) return { item: found, category: 'peripherals', typeLabel: 'Keyboard / Mouse', icon: 'fa-keyboard' };

  found = appData.printers.find(p => String(p.asset_id).toUpperCase() === aid);
  if (found) return { item: found, category: 'printers', typeLabel: 'Printer / Scanner', icon: 'fa-print' };

  found = appData.other_equipments.find(o => String(o.asset_id).toUpperCase() === aid);
  if (found) return { item: found, category: 'other_equipments', typeLabel: 'Power & Network Device', icon: 'fa-plug-circle-bolt' };

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

  const { item, category, typeLabel, icon } = result;
  const modalTitle = document.getElementById('passport-asset-title');
  if (modalTitle) modalTitle.innerText = `${item.asset_id} - ${item.brand || ''} ${item.model || ''}`;

  const isWorking = (item.is_working !== false && item.is_complaint !== true && item.status !== 'Complaint');
  const statusBadge = isWorking 
    ? '<span class="status-tag working"><i class="fa-solid fa-check"></i> Operational / Working</span>'
    : '<span class="status-tag complaint"><i class="fa-solid fa-triangle-exclamation"></i> Complaint / Fault Reported</span>';

  const assignedUser = item.employee_name || 'Unassigned';
  const assignedSeat = item.seat || item.assigned_seat || 'N/A';
  const officeSec = item.office_section || item.section || 'PGP OFFICE';

  // Build specifications list depending on equipment type
  let specTilesHtml = '';
  if (category === 'pcs') {
    specTilesHtml = `
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-microchip"></i> Processor</span>
        <span class="tile-val">${item.processor || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-memory"></i> RAM Memory</span>
        <span class="tile-val">${item.ram || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-hard-drive"></i> Storage</span>
        <span class="tile-val">${item.storage || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-brands fa-windows"></i> Operating System</span>
        <span class="tile-val">${item.os || 'N/A'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-network-wired"></i> Static IP Address</span>
        <span class="tile-val font-mono" style="color: var(--info);">${item.ip_address || 'DHCP / None'}</span>
      </div>
      <div class="passport-tile">
        <span class="tile-label"><i class="fa-solid fa-barcode"></i> Serial Number</span>
        <span class="tile-val font-mono">${item.serial_number || 'N/A'}</span>
      </div>
    `;
  } else if (category === 'monitors') {
    specTilesHtml = `
      <div class="passport-tile"><span class="tile-label">Display Specs</span><span class="tile-val">${item.specifications || 'Standard Monitor'}</span></div>
      <div class="passport-tile"><span class="tile-label">Serial Number</span><span class="tile-val font-mono">${item.serial_number || 'N/A'}</span></div>
      <div class="passport-tile"><span class="tile-label">Connected Computer</span><span class="tile-val font-mono">${item.connected_pc_id || 'N/A'}</span></div>
    `;
  } else if (category === 'printers') {
    specTilesHtml = `
      <div class="passport-tile"><span class="tile-label">Cartridge / Toner</span><span class="tile-val">${item.toner_cartridge || item.specifications || 'N/A'}</span></div>
      <div class="passport-tile"><span class="tile-label">Serial Number</span><span class="tile-val font-mono">${item.serial_number || 'N/A'}</span></div>
      <div class="passport-tile"><span class="tile-label">Connected Computer</span><span class="tile-val font-mono">${item.connected_pc_id || 'N/A'}</span></div>
    `;
  } else {
    specTilesHtml = `
      <div class="passport-tile"><span class="tile-label">Device Type</span><span class="tile-val">${item.category || item.item_name || 'Equipment'}</span></div>
      <div class="passport-tile"><span class="tile-label">Details</span><span class="tile-val">${item.details || item.specifications || 'N/A'}</span></div>
      <div class="passport-tile"><span class="tile-label">Serial Number</span><span class="tile-val font-mono">${item.serial_number || 'N/A'}</span></div>
    `;
  }

  // Find tickets for this asset
  const relatedTickets = (appData.tickets || appData.complaints || []).filter(t => t.asset_id === item.asset_id || t.pc_asset_id === item.asset_id);
  let ticketHistoryHtml = '';
  if (relatedTickets.length === 0) {
    ticketHistoryHtml = '<p class="text-muted" style="font-size: 12.5px; font-style: italic;">No breakdown tickets logged for this asset.</p>';
  } else {
    ticketHistoryHtml = `
      <div class="table-responsive">
        <table class="data-table" style="font-size: 12px;">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Date</th>
              <th>Issue Reported</th>
              <th>Status</th>
              <th>Work Done</th>
            </tr>
          </thead>
          <tbody>
            ${relatedTickets.map(t => `
              <tr>
                <td><strong>${t.ticket_id || t.id}</strong></td>
                <td>${t.date_logged || t.date || '-'}</td>
                <td>${t.fault_description || t.complaint_details || '-'}</td>
                <td><span class="status-tag ${t.status === 'Closed' ? 'working' : 'complaint'}">${t.status}</span></td>
                <td>${t.resolution || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const container = document.getElementById('passport-body-content');
  container.innerHTML = `
    <div class="passport-hero">
      <div class="passport-qr-frame" id="modal-qr-container"></div>
      <div class="passport-hero-info">
        <div class="passport-hero-id">
          <i class="fa-solid ${icon}"></i> ${item.asset_id}
        </div>
        <div class="passport-hero-model">${item.brand || ''} ${item.model || ''} (${typeLabel})</div>
        <div class="passport-hero-meta">
          <i class="fa-solid fa-user"></i> <strong>${assignedUser}</strong> | Seat: <strong>${assignedSeat}</strong> | ${officeSec}
        </div>
        <div style="margin-top: 4px;">
          ${statusBadge}
        </div>
      </div>
    </div>

    <div class="passport-grid-sections">
      <div>
        <div class="passport-section-title"><i class="fa-solid fa-sliders"></i> Hardware & Network Specifications</div>
        <div class="passport-spec-tiles">
          ${specTilesHtml}
        </div>
      </div>

      <div>
        <div class="passport-section-title"><i class="fa-solid fa-shield-halved"></i> Maintenance & Coverage</div>
        <div class="passport-spec-tiles">
          <div class="passport-tile"><span class="tile-label">AMC / Warranty Type</span><span class="tile-val">${item.amc_type || 'Warranty'}</span></div>
          <div class="passport-tile"><span class="tile-label">Service Agency</span><span class="tile-val">${item.amc_agency || 'Keltron AMC'}</span></div>
          <div class="passport-tile"><span class="tile-label">Purchase Date</span><span class="tile-val">${item.purchase_date || 'N/A'}</span></div>
        </div>
      </div>

      <div>
        <div class="passport-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Service & Maintenance History</div>
        ${ticketHistoryHtml}
      </div>
    </div>
  `;

  // Render QR Code in modal frame
  setTimeout(() => {
    const qrTarget = document.getElementById('modal-qr-container');
    if (qrTarget) {
      qrTarget.innerHTML = '';
      const assetUrl = getAssetPassportUrl(item.asset_id);
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrTarget, {
          text: assetUrl,
          width: 94,
          height: 94,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }
  }, 50);

  // Footer Actions
  const footer = document.getElementById('passport-footer-actions');
  footer.innerHTML = `
    <button class="btn btn-outline" onclick="printSingleSticker('${item.asset_id}')"><i class="fa-solid fa-print"></i> Print QR Sticker</button>
    <button class="btn btn-secondary" onclick="logComplaintFromPassport('${item.asset_id}')"><i class="fa-solid fa-triangle-exclamation" style="color: var(--warning);"></i> Report Complaint / Ticket</button>
    <button class="btn btn-primary" onclick="openEditModal('${category}', '${item.asset_id}')"><i class="fa-solid fa-pen"></i> Edit Hardware</button>
  `;

  openModal('asset-passport-modal');
}

// 27. Render Batch QR Asset Stickers View (`#view-qr_stickers`)
function renderQrStickers() {
  const grid = document.getElementById('qr-stickers-grid');
  if (!grid) return;

  const typeFilter = (document.getElementById('qr-filter-type')?.value) || 'pcs';
  const sectionFilter = (document.getElementById('qr-filter-section')?.value) || 'all';
  const query = (document.getElementById('qr-filter-search')?.value || '').toLowerCase();

  let itemsToRender = [];
  if (typeFilter === 'all') {
    itemsToRender = [
      ...appData.pcs.map(i => ({ ...i, _cat: 'pcs', _type: 'Desktop / Server' })),
      ...appData.monitors.map(i => ({ ...i, _cat: 'monitors', _type: 'Monitor' })),
      ...appData.printers.map(i => ({ ...i, _cat: 'printers', _type: 'Printer' })),
      ...appData.peripherals.map(i => ({ ...i, _cat: 'peripherals', _type: 'Peripheral' })),
      ...appData.other_equipments.map(i => ({ ...i, _cat: 'other_equipments', _type: 'Power/Network' }))
    ];
  } else if (appData[typeFilter]) {
    itemsToRender = appData[typeFilter].map(i => ({ ...i, _cat: typeFilter, _type: typeFilter }));
  }

  // Filter by section
  if (sectionFilter !== 'all') {
    itemsToRender = itemsToRender.filter(i => {
      const s = (i.office_section || i.section || 'PGP OFFICE').toUpperCase();
      return s.includes(sectionFilter.toUpperCase());
    });
  }

  // Filter by search query
  if (query) {
    itemsToRender = itemsToRender.filter(i => {
      const str = `${i.asset_id || ''} ${i.brand || ''} ${i.model || ''} ${i.employee_name || ''} ${i.seat || i.assigned_seat || ''} ${i.ip_address || ''}`.toLowerCase();
      return str.includes(query);
    });
  }

  grid.innerHTML = '';

  if (itemsToRender.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No equipment matches the selected sticker filters.</div>';
    return;
  }

  itemsToRender.forEach((item, index) => {
    const aid = item.asset_id;
    const card = document.createElement('div');
    card.className = 'qr-sticker-card';
    card.id = `sticker-${aid}`;

    const seat = item.seat || item.assigned_seat || 'N/A';
    const emp = item.employee_name || 'Unassigned';
    const sec = item.office_section || item.section || 'PGP OFFICE';
    const spec = item.processor || item.specifications || item.details || item.toner_cartridge || '';

    card.innerHTML = `
      <div class="qr-sticker-header">
        <div class="qr-panchayath-name">Puthuppadi Grama Panchayath</div>
        <div class="qr-sub-header">IT Asset Management</div>
      </div>
      <div class="qr-sticker-body-clean">
        <div class="qr-code-box-large" id="qr-box-${index}"></div>
        <div class="qr-asset-id-large">${aid}</div>
        <div class="qr-seat-badge">Seat: <strong>${seat}</strong> ${emp !== 'Unassigned' ? `(${emp})` : ''}</div>
        <div class="qr-office-tag">${sec}</div>
      </div>
      <div class="qr-sticker-footer">
        <button class="btn btn-sm btn-outline" style="padding: 3px 8px; font-size: 11px;" onclick="printSingleSticker('${aid}')"><i class="fa-solid fa-print"></i> Print</button>
        <button class="btn btn-sm btn-primary" style="padding: 3px 8px; font-size: 11px;" onclick="openAssetPassport('${aid}')"><i class="fa-solid fa-circle-info"></i> Passport</button>
      </div>
    `;

    grid.appendChild(card);

    // Generate QR Code inside box
    setTimeout(() => {
      const qrEl = document.getElementById(`qr-box-${index}`);
      if (qrEl && typeof QRCode !== 'undefined') {
        new QRCode(qrEl, {
          text: getAssetPassportUrl(aid),
          width: 115,
          height: 115,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    }, 40);
  });
}

// 28. Print Stickers
function printAllStickers() {
  document.body.className = 'printing-stickers';
  window.print();
  setTimeout(() => {
    document.body.className = 'theme-dark';
  }, 1000);
}

function printSingleSticker(assetId) {
  // Filter only this sticker, trigger print
  switchView('qr_stickers');
  const searchInput = document.getElementById('qr-filter-search');
  if (searchInput) {
    searchInput.value = assetId;
    renderQrStickers();
    setTimeout(() => {
      printAllStickers();
    }, 300);
  }
}

// 29. Log Complaint Pre-Filled from Asset Passport
function logComplaintFromPassport(assetId) {
  closeModal('asset-passport-modal');
  openAddTicketModal();
  
  const selectAsset = document.getElementById('tkt-asset-id');
  if (selectAsset) {
    selectAsset.value = assetId;
    handleTicketAssetChange();
  }
}

// 30. In-App Camera QR Code Scanner (`#qr-scanner-modal`)
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
          fps: 10,
          qrbox: { width: 220, height: 220 }
        },
        (decodedText, decodedResult) => {
          console.log("QR Code Scanned:", decodedText);
          handleQrScanSuccess(decodedText);
        },
        (errorMessage) => {
          // parse error / scanning
        }
      ).catch(err => {
        console.warn("Camera access warning:", err);
        streamEl.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
            <i class="fa-solid fa-video-slash" style="font-size: 28px; margin-bottom: 8px; color: var(--warning);"></i><br>
            Camera access is not permitted or unavailable.<br>
            Please use the manual Asset ID search below.
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
  showToast('QR Code Scanned Successfully!', 'success');

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
  }, 200);
}

function handleManualScanLookup() {
  const input = document.getElementById('manual-scan-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter an Asset ID', 'error');
    return;
  }
  const aid = input.value.trim().toUpperCase();
  closeQrScannerModal();
  openAssetPassport(aid);
}

// 31. URL Deep Linking: Detect ?asset=PGP-SYS-PC001 on initial load
function checkUrlForAsset() {
  if (hasCheckedUrlAsset) return;
  hasCheckedUrlAsset = true;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const assetParam = urlParams.get('asset');
    if (assetParam) {
      console.log('Deep link Asset detected:', assetParam);
      setTimeout(() => {
        openAssetPassport(assetParam);
      }, 300);
    }
  } catch (e) {
    console.error('URL check notice:', e);
  }
}
