// ============================================================
// FOXCARS Admin — Dashboard
// Stats + liste de toutes les inspections
// ============================================================

const STATUS_LABELS = { transmitted: 'Transmis', completed: 'Terminé', in_progress: 'En cours' };
const STATUS_CLASSES = { transmitted: 'badge-transmitted', completed: 'badge-completed', in_progress: 'badge-in_progress' };

let allInspections = [];
let currentFilter  = 'all';

async function loadDashboard() {
  const sb = getSupabase();

  // Charge inspections + profils clients en parallèle
  const [{ data: inspections }, { data: clients }] = await Promise.all([
    sb.from('inspections')
      .select('*')
      .order('inspection_date', { ascending: false }),
    sb.from('clients')
      .select('id, full_name, company_name, email'),
  ]);

  allInspections = inspections || [];

  // Map clients par id pour lookup rapide
  const clientMap = {};
  (clients || []).forEach(c => { clientMap[c.id] = c; });

  // Stats
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();

  const thisMonth  = allInspections.filter(i => {
    const d = new Date(i.inspection_date || i.created_at);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const inProgress = allInspections.filter(i => i.status === 'in_progress');
  const completed  = allInspections.filter(i => i.status === 'completed');

  document.getElementById('stat-clients').textContent    = (clients || []).length;
  document.getElementById('stat-month').textContent      = thisMonth.length;
  document.getElementById('stat-inprogress').textContent = inProgress.length;
  document.getElementById('stat-completed').textContent  = completed.length;

  // Rend le tableau
  renderTable(allInspections, clientMap);

  // Filtres
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.status;
      applyFilters(clientMap);
    });
  });

  document.getElementById('search-input').addEventListener('input', function () {
    applyFilters(clientMap);
  });

  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
}

function applyFilters(clientMap) {
  const search = document.getElementById('search-input').value.trim().toLowerCase();

  let filtered = allInspections;

  if (currentFilter !== 'all') {
    filtered = filtered.filter(i => i.status === currentFilter);
  }

  if (search) {
    filtered = filtered.filter(i => {
      const vehicle  = `${i.vehicle_make} ${i.vehicle_model} ${i.vehicle_plate || ''}`.toLowerCase();
      const client   = clientMap[i.client_id];
      const clientStr = client ? `${client.full_name} ${client.company_name || ''} ${client.email || ''}`.toLowerCase() : '';
      return vehicle.includes(search) || clientStr.includes(search);
    });
  }

  renderTable(filtered, clientMap);
}

function renderTable(inspections, clientMap) {
  const tbody = document.getElementById('inspections-body');
  const empty = document.getElementById('empty-state');

  if (inspections.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = inspections.map(insp => {
    const client  = clientMap[insp.client_id];
    const vehicle = `${insp.vehicle_make} ${insp.vehicle_model}${insp.vehicle_year ? ` (${insp.vehicle_year})` : ''}`;
    const clientName = client
      ? escapeHtml(client.company_name ? `${client.full_name} — ${client.company_name}` : client.full_name)
      : '<span style="color:var(--muted)">—</span>';

    return `
      <tr>
        <td style="font-weight:600;">${escapeHtml(vehicle)}</td>
        <td class="td-muted">
          ${insp.vehicle_plate
            ? `<code style="background:rgba(255,255,255,.06);padding:2px 8px;border-radius:4px;font-size:12px;">${escapeHtml(insp.vehicle_plate)}</code>`
            : '—'}
        </td>
        <td>${clientName}</td>
        <td class="td-muted">${formatDate(insp.inspection_date)}</td>
        <td>
          <span class="badge ${STATUS_CLASSES[insp.status] || ''}">
            ${escapeHtml(STATUS_LABELS[insp.status] || insp.status)}
          </span>
        </td>
        <td class="td-actions">
          <a href="inspection-form.html?id=${insp.id}" class="btn btn-sm btn-ghost">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Éditer
          </a>
        </td>
      </tr>`;
  }).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
